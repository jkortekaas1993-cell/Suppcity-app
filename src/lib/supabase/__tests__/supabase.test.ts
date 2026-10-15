import { createChunkedStorage } from '../chunkedStorage';
import { toConsentStates } from '../consents';
import { AuthExchangeResponse, FunctionCallError } from '../contracts';
import { toFunctionCallError } from '../functions';
import { normalisePtCode } from '../ptCode';
import { recoverSupabaseSession, RELOGIN_MESSAGE } from '../sessionRecovery';

describe('consents', () => {
  it('lists every consent type, defaulting to not granted', () => {
    const states = toConsentStates([
      { consent_type: 'marketing_email', granted: true, policy_version: '2026-10', created_at: '2026-10-15T10:00:00Z' },
    ]);
    expect(states).toHaveLength(5);
    expect(states.find((s) => s.type === 'marketing_email')).toEqual({
      type: 'marketing_email',
      granted: true,
      policyVersion: '2026-10',
      changedAt: '2026-10-15T10:00:00Z',
    });
    expect(states.find((s) => s.type === 'health_sync')).toMatchObject({ granted: false, changedAt: null });
  });
});

describe('function errors', () => {
  it('maps HTTP errors with a known body', async () => {
    const e = await toFunctionCallError({ context: { status: 409, json: async () => ({ error: 'insufficient_points' }) } });
    expect(e).toBeInstanceOf(FunctionCallError);
    expect(e.code).toBe('insufficient_points');
    expect(e.status).toBe(409);
  });
  it('maps unknown bodies to internal and missing responses to network', async () => {
    expect((await toFunctionCallError({ context: { status: 500, json: async () => 'oops' } })).code).toBe('internal');
    expect((await toFunctionCallError({ message: 'Failed to fetch' })).code).toBe('network');
  });
});

describe('contracts', () => {
  it('validates the auth exchange response', () => {
    const ok = AuthExchangeResponse.safeParse({
      session: { access_token: 'a', refresh_token: 'r', expires_in: 3600, expires_at: 1, token_type: 'bearer' },
      user: { id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e' },
      profile: { adultConfirmed: false, isNewUser: true },
    });
    expect(ok.success).toBe(true);
    expect(AuthExchangeResponse.safeParse({ session: {} }).success).toBe(false);
  });
});

describe('PT code', () => {
  it('normalises and validates (mirrors the 0005 CHECK constraint)', () => {
    expect(normalisePtCode(' pt 1234 ')).toBe('PT1234');
    expect(normalisePtCode('ab')).toBeNull();
    expect(normalisePtCode('bad-code!')).toBeNull();
  });
});

describe('chunked SecureStore adapter (M7)', () => {
  function mem() {
    const m = new Map<string, string>();
    const kv = { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v), removeItem: async (k: string) => void m.delete(k) };
    return { m, kv };
  }
  it('round-trips a session larger than 2 KB in chunks under the limit', async () => {
    const { m, kv } = mem();
    const s = createChunkedStorage(kv, 100);
    const big = 'x'.repeat(250) + 'é' + 'y'.repeat(30);
    await s.setItem('sb-session', big);
    expect(m.get('sb-session')).toBe('chunks:3');
    expect([...m.values()].every((v) => v.length <= 100)).toBe(true);
    expect(await s.getItem('sb-session')).toBe(big);
  });
  it('shrinks, removes stale chunks and handles small values directly', async () => {
    const { m, kv } = mem();
    const s = createChunkedStorage(kv, 10);
    await s.setItem('k', 'a'.repeat(35));
    await s.setItem('k', 'short');
    expect(await s.getItem('k')).toBe('short');
    expect([...m.keys()]).toEqual(['k']);
    await s.setItem('k', 'b'.repeat(25));
    await s.removeItem('k');
    expect(m.size).toBe(0);
    expect(await s.getItem('k')).toBeNull();
  });
  it('a torn write reads as signed out; a value that looks like a manifest is chunked', async () => {
    const { m, kv } = mem();
    const s = createChunkedStorage(kv, 10);
    await s.setItem('k', 'c'.repeat(25));
    m.delete('k.1');
    expect(await s.getItem('k')).toBeNull();
    await s.setItem('j', 'chunks:2');
    expect(await s.getItem('j')).toBe('chunks:2');
  });
});

describe('Supabase SIGNED_OUT recovery (M8)', () => {
  const deps = (token: string | null, exchangeOk = true, signingOut = false) => {
    const calls: string[] = [];
    return {
      calls,
      d: {
        shopifyAccessToken: async () => token,
        exchange: async (t: string) => {
          calls.push(t);
          if (!exchangeOk) throw new FunctionCallError('shopify_token_invalid', 401);
        },
        isSigningOut: () => signingOut,
      },
    };
  };
  it('re-exchanges a valid Shopify token', async () => {
    const t = deps('shp');
    expect(await recoverSupabaseSession('SIGNED_OUT', t.d)).toBe('recovered');
    expect(t.calls).toEqual(['shp']);
  });
  it('asks to log in again without a valid token or when the exchange fails', async () => {
    expect(await recoverSupabaseSession('SIGNED_OUT', deps(null).d)).toBe('login_required');
    expect(await recoverSupabaseSession('SIGNED_OUT', deps('shp', false).d)).toBe('login_required');
    expect(RELOGIN_MESSAGE).toContain('Log opnieuw in');
  });
  it('ignores other events and our own sign-out', async () => {
    expect(await recoverSupabaseSession('TOKEN_REFRESHED', deps('shp').d)).toBe('ignored');
    const own = deps('shp', true, true);
    expect(await recoverSupabaseSession('SIGNED_OUT', own.d)).toBe('ignored');
    expect(own.calls).toEqual([]);
  });
});
