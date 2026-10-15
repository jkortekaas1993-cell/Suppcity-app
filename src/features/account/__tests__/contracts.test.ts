import { applyConsent } from '../consentCopy';
import { interpretExchangeResponse, normalisePtCode } from '../contracts';

describe('shopify-auth-exchange response', () => {
  const session = { access_token: 'a', refresh_token: 'r', expires_in: 3600 };
  it('accepts a valid session', () => {
    const r = interpretExchangeResponse(200, { supabaseSession: session, userId: 'u1' });
    expect(r).toEqual({ ok: true, value: { supabaseSession: session, userId: 'u1', isNewUser: false } });
  });
  it('rejects malformed bodies', () => {
    expect(interpretExchangeResponse(200, { supabaseSession: {} })).toEqual({ ok: false, reason: 'invalid_response', status: 200 });
  });
  it('maps invalid tokens and server errors', () => {
    expect(interpretExchangeResponse(401, { error: 'x' })).toMatchObject({ reason: 'invalid_shopify_token' });
    expect(interpretExchangeResponse(400, { error: 'invalid_shopify_token' })).toMatchObject({ reason: 'invalid_shopify_token' });
    expect(interpretExchangeResponse(500, null)).toMatchObject({ reason: 'server', status: 500 });
  });
});

describe('PT code', () => {
  it('normalises and validates', () => {
    expect(normalisePtCode(' pt 1234 ')).toBe('PT1234');
    expect(normalisePtCode('ab')).toBeNull();
    expect(normalisePtCode('bad-code!')).toBeNull();
  });
});

describe('consents (hard rule 2)', () => {
  it('toggles one consent without touching the others', () => {
    const start = [
      { type: 'marketing_email' as const, granted: false, updatedAt: null },
      { type: 'analytics' as const, granted: true, updatedAt: '2026-01-01T00:00:00Z' },
    ];
    const next = applyConsent(start, 'marketing_email', true, '2026-10-15T10:00:00Z');
    expect(next[0]).toEqual({ type: 'marketing_email', granted: true, updatedAt: '2026-10-15T10:00:00Z' });
    expect(next[1]).toBe(start[1]);
    expect(applyConsent(start, 'pt_share', true, 't')).toHaveLength(3);
  });
});
