import { ShopifyApiError } from './errors';
import { isExpiring, toStoredTokens, type StoredTokens, type TokenResponse } from './oauth';

/**
 * Token lifecycle for the Customer Account API, independent of React Native.
 * Storage, clock and the refresh call are injected (SecureStore in the app, fakes in tests).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Stored as separate keys: SecureStore values can be limited to ~2 KB and an
 * id_token alone can approach that.
 */
const KEYS = {
  accessToken: 'shopify.customer.accessToken',
  expiresAt: 'shopify.customer.expiresAt',
  refreshToken: 'shopify.customer.refreshToken',
  idToken: 'shopify.customer.idToken',
} as const;

export async function readTokens(store: KeyValueStore): Promise<StoredTokens | null> {
  const [accessToken, expiresAt, refreshToken, idToken] = await Promise.all([
    store.getItem(KEYS.accessToken),
    store.getItem(KEYS.expiresAt),
    store.getItem(KEYS.refreshToken),
    store.getItem(KEYS.idToken),
  ]);
  const expires = Number(expiresAt);
  if (!accessToken || !Number.isFinite(expires)) return null;
  return { accessToken, expiresAt: expires, refreshToken, idToken };
}

export async function writeTokens(store: KeyValueStore, tokens: StoredTokens): Promise<void> {
  await Promise.all([
    store.setItem(KEYS.accessToken, tokens.accessToken),
    store.setItem(KEYS.expiresAt, String(tokens.expiresAt)),
    tokens.refreshToken ? store.setItem(KEYS.refreshToken, tokens.refreshToken) : store.removeItem(KEYS.refreshToken),
    tokens.idToken ? store.setItem(KEYS.idToken, tokens.idToken) : store.removeItem(KEYS.idToken),
  ]);
}

export async function clearTokens(store: KeyValueStore): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => store.removeItem(k)));
}

export interface TokenManager {
  /** Valid access token, refreshing if needed. Throws ShopifyApiError('unauthorized') when signed out. */
  getValidAccessToken(): Promise<string>;
  current(): Promise<StoredTokens | null>;
  save(response: TokenResponse): Promise<StoredTokens>;
  clear(): Promise<void>;
}

export function createTokenManager(deps: {
  store: KeyValueStore;
  now: () => number;
  refresh: (refreshToken: string) => Promise<TokenResponse>;
  /** Called when tokens become unusable (refresh rejected), so UI can show "signed out". */
  onSignedOut?: () => void;
}): TokenManager {
  let inflight: Promise<string> | null = null;

  async function refreshOnce(tokens: StoredTokens): Promise<string> {
    if (!tokens.refreshToken) {
      await clearTokens(deps.store);
      deps.onSignedOut?.();
      throw new ShopifyApiError('unauthorized', 'Access token expired and no refresh token');
    }
    try {
      const res = await deps.refresh(tokens.refreshToken);
      const next = toStoredTokens(res, deps.now(), tokens);
      await writeTokens(deps.store, next);
      return next.accessToken;
    } catch (error) {
      if (error instanceof ShopifyApiError && error.kind === 'unauthorized') {
        await clearTokens(deps.store);
        deps.onSignedOut?.();
      }
      throw error;
    }
  }

  return {
    async getValidAccessToken() {
      const tokens = await readTokens(deps.store);
      if (!tokens) throw new ShopifyApiError('unauthorized', 'Not signed in');
      if (!isExpiring(tokens, deps.now())) return tokens.accessToken;
      // Single-flight: concurrent callers share one refresh request.
      inflight ??= refreshOnce(tokens).finally(() => {
        inflight = null;
      });
      return inflight;
    },
    current: () => readTokens(deps.store),
    async save(response) {
      const previous = await readTokens(deps.store);
      const tokens = toStoredTokens(response, deps.now(), previous);
      await writeTokens(deps.store, tokens);
      return tokens;
    },
    clear: () => clearTokens(deps.store),
  };
}
