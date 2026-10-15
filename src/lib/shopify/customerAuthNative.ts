import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { getEnv } from '@/lib/config';

import {
  createCustomerAccountClient,
  discoverCustomerAccount,
  endSession,
  exchangeCode,
  refreshTokens,
  type CustomerAccountClient,
  type CustomerAccountEndpoints,
} from './customerAccount';
import { createTokenManager, type KeyValueStore, type TokenManager } from './customerSession';
import { ShopifyApiError } from './errors';
import { secureKv } from './secureKv';
import { defaultFetch, type FetchLike } from './http';
import {
  buildAuthorizationUrl,
  buildRedirectUri,
  createPkcePair,
  idTokenNonceMatches,
  parseCallbackUrl,
  randomToken,
} from './oauth';

/**
 * React Native wiring for the Customer Account API login (OAuth 2.0 + PKCE, public client).
 * Uses an in-app auth session (ASWebAuthenticationSession / Custom Tabs) via expo-web-browser.
 */
const secureStore: KeyValueStore = secureKv;

const fetchImpl: FetchLike = (url, init) => defaultFetch()(url, init);
const randomBytes = (n: number) => Crypto.getRandomBytes(n);
const sha256Base64 = (input: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, { encoding: Crypto.CryptoEncoding.BASE64 });

interface AuthConfig {
  shopDomain: string;
  clientId: string;
  redirectUri: string;
}

function authConfig(): AuthConfig {
  const env = getEnv();
  const clientId = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;
  const shopId = process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID;
  if (!clientId || !shopId) {
    throw new Error('Missing EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID / EXPO_PUBLIC_SHOPIFY_SHOP_ID');
  }
  return { shopDomain: env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN, clientId, redirectUri: buildRedirectUri(shopId) };
}

let endpointsPromise: Promise<CustomerAccountEndpoints> | null = null;
function endpoints(): Promise<CustomerAccountEndpoints> {
  endpointsPromise ??= discoverCustomerAccount(authConfig().shopDomain, fetchImpl).catch((e: unknown) => {
    endpointsPromise = null; // retry discovery next time
    throw e;
  });
  return endpointsPromise;
}

const signedOutListeners = new Set<() => void>();
export function onCustomerSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

export const customerTokens: TokenManager = createTokenManager({
  store: secureStore,
  now: () => Date.now(),
  refresh: async (refreshToken) => {
    const ep = await endpoints();
    return refreshTokens(fetchImpl, ep.openId.token_endpoint, { clientId: authConfig().clientId, refreshToken });
  },
  onSignedOut: () => signedOutListeners.forEach((l) => l()),
});

export type SignInResult = { ok: true; accessToken: string } | { ok: false; reason: 'cancelled' | 'failed' };

/** Full interactive login. Returns the Shopify access token on success. */
export async function signInWithShopify(): Promise<SignInResult> {
  const cfg = authConfig();
  const ep = await endpoints();
  const pkce = await createPkcePair(randomBytes, sha256Base64);
  const state = randomToken(randomBytes);
  const nonce = randomToken(randomBytes);
  const url = buildAuthorizationUrl({
    authorizationEndpoint: ep.openId.authorization_endpoint,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    state,
    nonce,
    codeChallenge: pkce.challenge,
  });

  const result = await WebBrowser.openAuthSessionAsync(url, cfg.redirectUri);
  if (result.type !== 'success') return { ok: false, reason: 'cancelled' };

  const callback = parseCallbackUrl(result.url, state);
  if (!callback.ok) return { ok: false, reason: callback.error === 'denied' ? 'cancelled' : 'failed' };

  const tokenResponse = await exchangeCode(fetchImpl, ep.openId.token_endpoint, {
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    code: callback.code,
    codeVerifier: pkce.verifier,
  });
  if (!idTokenNonceMatches(tokenResponse.id_token, nonce)) {
    throw new ShopifyApiError('invalid_response', 'id_token nonce mismatch');
  }
  const stored = await customerTokens.save(tokenResponse);
  return { ok: true, accessToken: stored.accessToken };
}

/** Ends the Shopify session (API-style logout for mobile clients) and wipes local tokens. */
export async function signOutFromShopify(): Promise<void> {
  const tokens = await customerTokens.current();
  await customerTokens.clear();
  if (tokens?.idToken) {
    const ep = await endpoints().catch(() => null);
    if (ep?.openId.end_session_endpoint) await endSession(fetchImpl, ep.openId.end_session_endpoint, tokens.idToken);
  }
}

let accountClient: Promise<CustomerAccountClient> | null = null;
export function getCustomerAccount(): Promise<CustomerAccountClient> {
  accountClient ??= endpoints().then((ep) =>
    createCustomerAccountClient({
      graphqlUrl: ep.graphqlUrl,
      getAccessToken: () => customerTokens.getValidAccessToken(),
      fetchImpl,
    }),
  );
  return accountClient;
}
