import { createCustomerAccountClient, discoverCustomerAccount, exchangeCode } from '../customerAccount';
import { orderStatusLabel } from '../customerAccountMappers';
import { createTokenManager, type KeyValueStore } from '../customerSession';
import { ShopifyApiError } from '../errors';
import type { FetchLike } from '../http';

const eur = (amount: string) => ({ amount, currencyCode: 'EUR' });

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

function jsonFetch(handler: (url: string, init: Parameters<FetchLike>[1]) => { status?: number; body: unknown }): FetchLike {
  return async (url, init) => {
    const r = handler(url, init);
    const status = r.status ?? 200;
    return { ok: status < 300, status, json: async () => r.body };
  };
}

describe('discovery', () => {
  it('reads both well-known documents and pins the version', async () => {
    const seen: string[] = [];
    const ep = await discoverCustomerAccount(
      'suppcity.nl',
      jsonFetch((url) => {
        seen.push(url);
        if (url.endsWith('openid-configuration')) {
          return {
            body: {
              issuer: 'https://shopify.com/1',
              authorization_endpoint: 'https://shopify.com/authentication/1/oauth/authorize',
              token_endpoint: 'https://shopify.com/authentication/1/oauth/token',
              end_session_endpoint: 'https://shopify.com/authentication/1/logout',
            },
          };
        }
        return { body: { graphql_api: 'https://shopify.com/1/account/customer/api/2027-01/graphql' } };
      }),
    );
    expect(seen).toContain('https://suppcity.nl/.well-known/openid-configuration');
    expect(seen).toContain('https://suppcity.nl/.well-known/customer-account-api');
    expect(ep.graphqlUrl).toBe('https://shopify.com/1/account/customer/api/2026-10/graphql');
  });
});

describe('token endpoint', () => {
  it('posts form-encoded and validates the response', async () => {
    let contentType = '';
    const res = await exchangeCode(
      jsonFetch((_u, init) => {
        contentType = init.headers['Content-Type'] ?? '';
        return { body: { access_token: 'shcat_1', expires_in: 3600, refresh_token: 'r', id_token: 'i' } };
      }),
      'https://t',
      { clientId: 'c', redirectUri: 'r', code: 'k', codeVerifier: 'v' },
    );
    expect(contentType).toBe('application/x-www-form-urlencoded');
    expect(res.access_token).toBe('shcat_1');
  });
  it('maps invalid_grant to unauthorized', async () => {
    await expect(
      exchangeCode(jsonFetch(() => ({ status: 400, body: { error: 'invalid_grant' } })), 'https://t', {
        clientId: 'c',
        redirectUri: 'r',
        code: 'k',
        codeVerifier: 'v',
      }),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});

describe('token manager', () => {
  it('returns a fresh token without refreshing', async () => {
    const store = memoryStore();
    let refreshes = 0;
    const tm = createTokenManager({
      store,
      now: () => 0,
      refresh: async () => {
        refreshes++;
        return { access_token: 'new', expires_in: 3600 };
      },
    });
    await tm.save({ access_token: 'a', expires_in: 3600, refresh_token: 'r' });
    expect(await tm.getValidAccessToken()).toBe('a');
    expect(refreshes).toBe(0);
  });

  it('refreshes once for concurrent callers and keeps the refresh token', async () => {
    const store = memoryStore();
    let now = 0;
    let refreshes = 0;
    const tm = createTokenManager({
      store,
      now: () => now,
      refresh: async (rt) => {
        refreshes++;
        expect(rt).toBe('r');
        return { access_token: 'a2', expires_in: 3600 };
      },
    });
    await tm.save({ access_token: 'a1', expires_in: 60, refresh_token: 'r' });
    now = 59_000;
    const [x, y] = await Promise.all([tm.getValidAccessToken(), tm.getValidAccessToken()]);
    expect([x, y]).toEqual(['a2', 'a2']);
    expect(refreshes).toBe(1);
    expect((await tm.current())?.refreshToken).toBe('r');
  });

  it('signs out when the refresh token is rejected', async () => {
    const store = memoryStore();
    let signedOut = false;
    const tm = createTokenManager({
      store,
      now: () => 10_000_000,
      refresh: async () => {
        throw new ShopifyApiError('unauthorized', 'invalid_grant');
      },
      onSignedOut: () => {
        signedOut = true;
      },
    });
    await store.setItem('shopify.customer.accessToken', 'old');
    await store.setItem('shopify.customer.expiresAt', '0');
    await store.setItem('shopify.customer.refreshToken', 'dead');
    await expect(tm.getValidAccessToken()).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(signedOut).toBe(true);
    expect(store.data.size).toBe(0);
  });

  it('throws unauthorized when signed out', async () => {
    const tm = createTokenManager({ store: memoryStore(), now: () => 0, refresh: async () => ({ access_token: 'x', expires_in: 1 }) });
    await expect(tm.getValidAccessToken()).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});

describe('customer account client', () => {
  it('sends the raw token and maps orders', async () => {
    let auth = '';
    const client = createCustomerAccountClient({
      graphqlUrl: 'https://g',
      getAccessToken: async () => 'shcat_x',
      fetchImpl: jsonFetch((_u, init) => {
        auth = init.headers.Authorization ?? '';
        return {
          body: {
            data: {
              customer: {
                orders: {
                  nodes: [
                    {
                      id: 'gid://shopify/Order/1',
                      name: '#1001',
                      number: 1001,
                      processedAt: '2026-09-01T10:00:00Z',
                      financialStatus: 'PAID',
                      fulfillmentStatus: 'FULFILLED',
                      totalPrice: eur('49.90'),
                      lineItems: {
                        nodes: [
                          {
                            id: 'li1',
                            name: 'Creatine',
                            quantity: 2,
                            variantId: 'gid://shopify/ProductVariant/11',
                            productId: 'gid://shopify/Product/1',
                            variantTitle: 'Default Title',
                            sku: null,
                            giftCard: false,
                            image: null,
                            totalPrice: eur('49.90'),
                          },
                        ],
                      },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          },
        };
      }),
    });
    const page = await client.orders();
    expect(auth).toBe('shcat_x');
    expect(page.items[0]?.total.cents).toBe(4990);
    expect(page.items[0]?.lines[0]?.variantTitle).toBeNull();
    expect(orderStatusLabel(page.items[0]!)).toBe('Verzonden');
  });

  it('prefers refund status over shipping status', () => {
    expect(orderStatusLabel({ financialStatus: 'REFUNDED', fulfillmentStatus: 'FULFILLED' })).toBe('Terugbetaald');
    expect(orderStatusLabel({ financialStatus: null, fulfillmentStatus: null })).toBe('Besteld');
  });
});
