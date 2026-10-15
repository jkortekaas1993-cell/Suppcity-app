import { toConsentStates } from '../consents';
import { AuthExchangeResponse, FunctionCallError } from '../contracts';
import { toFunctionCallError } from '../functions';
import { normalisePtCode } from '../ptCode';

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
