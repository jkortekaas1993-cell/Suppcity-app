import { base64UrlDecodeToString, bytesToBase64, bytesToBase64Url } from '../base64';
import {
  buildAuthorizationUrl,
  buildCodeExchangeBody,
  buildRedirectUri,
  buildRefreshBody,
  createPkcePair,
  decodeJwtPayload,
  idTokenNonceMatches,
  isExpiring,
  parseCallbackUrl,
  pinCustomerApiVersion,
  toStoredTokens,
} from '../oauth';

const fixedBytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => i);

describe('base64', () => {
  it('encodes RFC 4648 vectors', () => {
    const enc = (s: string) => bytesToBase64(Uint8Array.from(s, (c) => c.charCodeAt(0)));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('Zg==');
    expect(enc('fo')).toBe('Zm8=');
    expect(enc('foo')).toBe('Zm9v');
    expect(enc('foobar')).toBe('Zm9vYmFy');
  });
  it('base64url strips padding and swaps characters', () => {
    expect(bytesToBase64Url(Uint8Array.from([0xfb, 0xff]))).toBe('-_8');
  });
  it('decodes base64url to utf-8', () => {
    expect(base64UrlDecodeToString('eyJub25jZSI6ImFiYyJ9')).toBe('{"nonce":"abc"}');
    expect(base64UrlDecodeToString('w6lw')).toBe('ép');
  });
});

describe('PKCE', () => {
  it('makes a 43-char verifier and a base64url S256 challenge', async () => {
    let hashedInput = '';
    const pair = await createPkcePair(fixedBytes, async (input) => {
      hashedInput = input;
      return 'ab+/cd==';
    });
    expect(pair.verifier).toHaveLength(43);
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashedInput).toBe(pair.verifier);
    expect(pair.challenge).toBe('ab-_cd');
  });

  it('turns a standard base64 SHA-256 into the RFC 7636 appendix B challenge', async () => {
    // RFC 7636 B: SHA-256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") in base64.
    const pair = await createPkcePair(fixedBytes, async () => 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM=');
    expect(pair.challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('authorization request', () => {
  it('includes all required Customer Account API parameters', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://shopify.com/authentication/123/oauth/authorize',
      clientId: 'client-1',
      redirectUri: 'shop.123.app://auth/callback',
      state: 'st',
      nonce: 'no',
      codeChallenge: 'ch',
    });
    expect(url.startsWith('https://shopify.com/authentication/123/oauth/authorize?')).toBe(true);
    expect(url).toContain('scope=openid%20email%20customer-account-api%3Afull');
    expect(url).toContain('response_type=code');
    expect(url).toContain('client_id=client-1');
    expect(url).toContain('redirect_uri=shop.123.app%3A%2F%2Fauth%2Fcallback');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('code_challenge=ch');
    expect(url).toContain('state=st');
    expect(url).toContain('nonce=no');
    expect(url).not.toContain('prompt=');
  });
  it('builds the mobile redirect uri scheme', () => {
    expect(buildRedirectUri('68817682732')).toBe('shop.68817682732.app://auth/callback');
  });
});

describe('callback parsing', () => {
  it('accepts a matching state', () => {
    expect(parseCallbackUrl('shop.1.app://auth/callback?code=abc&state=xyz', 'xyz')).toEqual({ ok: true, code: 'abc' });
  });
  it('rejects a state mismatch (CSRF)', () => {
    expect(parseCallbackUrl('shop.1.app://auth/callback?code=abc&state=evil', 'xyz')).toEqual({
      ok: false,
      error: 'state_mismatch',
    });
  });
  it('maps access_denied to denied', () => {
    const r = parseCallbackUrl('shop.1.app://auth/callback?error=access_denied&state=xyz', 'xyz');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('denied');
  });
  it('reports missing code', () => {
    expect(parseCallbackUrl('shop.1.app://auth/callback?state=xyz', 'xyz')).toEqual({ ok: false, error: 'missing_code' });
  });
});

describe('token bodies and lifetimes', () => {
  it('encodes the code exchange with code_verifier and no secret', () => {
    const body = buildCodeExchangeBody({ clientId: 'c', redirectUri: 'shop.1.app://cb', code: 'k', codeVerifier: 'v' });
    expect(body).toBe('grant_type=authorization_code&client_id=c&redirect_uri=shop.1.app%3A%2F%2Fcb&code=k&code_verifier=v');
    expect(body).not.toContain('secret');
  });
  it('encodes the refresh body', () => {
    expect(buildRefreshBody({ clientId: 'c', refreshToken: 'r' })).toBe('grant_type=refresh_token&client_id=c&refresh_token=r');
  });
  it('keeps previous refresh/id tokens when not rotated', () => {
    const prev = { accessToken: 'a0', expiresAt: 0, refreshToken: 'r0', idToken: 'i0' };
    const next = toStoredTokens({ access_token: 'a1', expires_in: 3600 }, 1_000, prev);
    expect(next).toEqual({ accessToken: 'a1', expiresAt: 3_601_000, refreshToken: 'r0', idToken: 'i0' });
  });
  it('treats tokens within the skew as expiring', () => {
    expect(isExpiring({ expiresAt: 100_000 }, 30_000)).toBe(false);
    expect(isExpiring({ expiresAt: 100_000 }, 50_000)).toBe(true);
  });
});

describe('id_token nonce', () => {
  const jwt = (payload: object) => `x.${bytesToBase64Url(Uint8Array.from(JSON.stringify(payload), (c) => c.charCodeAt(0)))}.sig`;
  it('decodes the payload', () => {
    expect(decodeJwtPayload(jwt({ nonce: 'n1', sub: 's' }))).toEqual({ nonce: 'n1', sub: 's' });
    expect(decodeJwtPayload('garbage')).toBeNull();
  });
  it('checks the nonce', () => {
    expect(idTokenNonceMatches(jwt({ nonce: 'n1' }), 'n1')).toBe(true);
    expect(idTokenNonceMatches(jwt({ nonce: 'other' }), 'n1')).toBe(false);
    expect(idTokenNonceMatches(undefined, 'n1')).toBe(true);
  });
});

describe('version pinning', () => {
  it('rewrites the discovered graphql url to the pinned version', () => {
    expect(pinCustomerApiVersion('https://shopify.com/123/account/customer/api/2027-01/graphql', '2026-10')).toBe(
      'https://shopify.com/123/account/customer/api/2026-10/graphql',
    );
  });
});
