import { z } from 'zod';

import { base64ToBase64Url, base64UrlDecodeToString, bytesToBase64Url } from './base64';

/**
 * Pure OAuth 2.0 + PKCE helpers for the Shopify Customer Account API (public mobile client).
 * No React Native imports: randomness and SHA-256 are injected so this runs in Jest/Node.
 *
 * Flow (shopify.dev/docs/api/customer):
 * 1. Discover endpoints at https://{shop}/.well-known/openid-configuration
 * 2. Open authorization_endpoint with response_type=code, PKCE S256, state, nonce
 * 3. Exchange code + code_verifier at token_endpoint (form-encoded, no client secret)
 * 4. Refresh with grant_type=refresh_token (headless/mobile clients receive a refresh token)
 */

export const CUSTOMER_ACCOUNT_SCOPES = 'openid email customer-account-api:full';

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** 32 random bytes → 43-char base64url verifier (RFC 7636 §4.1). */
export function createCodeVerifier(randomBytes: (n: number) => Uint8Array): string {
  return bytesToBase64Url(randomBytes(32));
}

/** S256 challenge: base64url(SHA-256(verifier)). `sha256Base64` returns standard base64. */
export async function createPkcePair(
  randomBytes: (n: number) => Uint8Array,
  sha256Base64: (input: string) => Promise<string>,
): Promise<PkcePair> {
  const verifier = createCodeVerifier(randomBytes);
  const challenge = base64ToBase64Url(await sha256Base64(verifier));
  return { verifier, challenge };
}

export function randomToken(randomBytes: (n: number) => Uint8Array, size = 16): string {
  return bytesToBase64Url(randomBytes(size));
}

export const openIdConfigurationSchema = z.object({
  issuer: z.string().optional(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  end_session_endpoint: z.string().url().optional(),
});
export type OpenIdConfiguration = z.infer<typeof openIdConfigurationSchema>;

export const customerApiConfigurationSchema = z.object({
  graphql_api: z.string().url(),
});

export interface AuthorizationRequest {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  locale?: string;
  /** 'none' for a silent re-auth attempt when no refresh token is available. */
  prompt?: 'none';
}

export function buildAuthorizationUrl(req: AuthorizationRequest): string {
  const params: [string, string][] = [
    ['scope', CUSTOMER_ACCOUNT_SCOPES],
    ['client_id', req.clientId],
    ['response_type', 'code'],
    ['redirect_uri', req.redirectUri],
    ['state', req.state],
    ['nonce', req.nonce],
    ['code_challenge', req.codeChallenge],
    ['code_challenge_method', 'S256'],
    ['locale', req.locale ?? 'nl'],
  ];
  if (req.prompt) params.push(['prompt', req.prompt]);
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const sep = req.authorizationEndpoint.includes('?') ? '&' : '?';
  return `${req.authorizationEndpoint}${sep}${query}`;
}

export type CallbackResult =
  | { ok: true; code: string }
  | { ok: false; error: 'state_mismatch' | 'missing_code' | 'denied' | 'oauth_error'; description?: string };

/** Parse the redirect URL (custom scheme) without relying on a URL polyfill. */
export function parseCallbackUrl(url: string, expectedState: string): CallbackResult {
  const qIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const query = qIndex >= 0 ? url.slice(qIndex + 1, hashIndex > qIndex ? hashIndex : undefined) : '';
  const params = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    if (k) params.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' ')));
  }
  const error = params.get('error');
  if (error) {
    return { ok: false, error: error === 'access_denied' ? 'denied' : 'oauth_error', description: params.get('error_description') };
  }
  if (params.get('state') !== expectedState) return { ok: false, error: 'state_mismatch' };
  const code = params.get('code');
  if (!code) return { ok: false, error: 'missing_code' };
  return { ok: true, code };
}

export function formEncode(body: Record<string, string>): string {
  return Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export function buildCodeExchangeBody(input: {
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): string {
  return formEncode({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier,
  });
}

export function buildRefreshBody(input: { clientId: string; refreshToken: string }): string {
  return formEncode({
    grant_type: 'refresh_token',
    client_id: input.clientId,
    refresh_token: input.refreshToken,
  });
}

export const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export interface StoredTokens {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
  refreshToken: string | null;
  idToken: string | null;
}

/** Shopify does not always rotate refresh/id tokens; keep the previous ones when absent. */
export function toStoredTokens(res: TokenResponse, nowMs: number, previous?: StoredTokens | null): StoredTokens {
  return {
    accessToken: res.access_token,
    expiresAt: nowMs + res.expires_in * 1000,
    refreshToken: res.refresh_token ?? previous?.refreshToken ?? null,
    idToken: res.id_token ?? previous?.idToken ?? null,
  };
}

/** True when the token expires within `skewMs` (default 60 s). */
export function isExpiring(tokens: Pick<StoredTokens, 'expiresAt'>, nowMs: number, skewMs = 60_000): boolean {
  return tokens.expiresAt - skewMs <= nowMs;
}

/** Decode (NOT verify) a JWT payload. Signature verification happens server-side. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const parsed: unknown = JSON.parse(base64UrlDecodeToString(part));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Replay protection: the id_token's nonce must equal the one we sent. */
export function idTokenNonceMatches(idToken: string | null | undefined, expectedNonce: string): boolean {
  if (!idToken) return true; // nonce only checkable when an id_token is returned
  return decodeJwtPayload(idToken)?.nonce === expectedNonce;
}

/**
 * The discovered graphql_api already contains the latest version. Hard rule 7 pins it:
 * rewrite `/customer/api/<any>/graphql` to our pinned version.
 */
export function pinCustomerApiVersion(discoveredUrl: string, version: string): string {
  return discoveredUrl.replace(/\/customer\/api\/[^/]+\/graphql(\.json)?$/, `/customer/api/${version}/graphql`);
}

/** Mobile callback scheme required by Shopify: shop.{shop_id}.app://... */
export function buildRedirectUri(shopId: string): string {
  return `shop.${shopId}.app://auth/callback`;
}
