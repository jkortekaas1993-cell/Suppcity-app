import { ShopifyApiError, userMessageFor } from '../errors';
import type { FetchLike } from '../http';
import { formatMoney, parseMoney } from '../money';
import { createStorefrontClient, storefrontEndpoint } from '../storefront';
import { mapProductDetail } from '../storefrontMappers';
import { productDetailSchema } from '../storefrontSchemas';

const eur = (amount: string) => ({ amount, currencyCode: 'EUR' });

const rawCart = {
  id: 'gid://shopify/Cart/abc?key=k',
  checkoutUrl: 'https://suppcity.nl/cart/c/abc',
  totalQuantity: 3,
  cost: { subtotalAmount: eur('74.85'), totalAmount: eur('74.85') },
  discountCodes: [{ code: 'APP10', applicable: true }],
  lines: {
    nodes: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 3,
        cost: { totalAmount: eur('74.85'), amountPerQuantity: eur('24.95') },
        merchandise: {
          id: 'gid://shopify/ProductVariant/11',
          title: 'Default Title',
          availableForSale: true,
          image: null,
          product: { id: 'gid://shopify/Product/1', handle: 'creatine', title: 'Creatine Monohydraat' },
        },
      },
    ],
  },
};

function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: Parameters<FetchLike>[1] }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    const status = next.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => next.body };
  };
  return { impl, calls };
}

describe('money', () => {
  it('parses to cents without float drift', () => {
    expect(parseMoney(eur('24.95')).cents).toBe(2495);
    expect(parseMoney(eur('0.10')).cents).toBe(10);
  });
  it('formats in Dutch', () => {
    expect(formatMoney({ cents: 2495, currencyCode: 'EUR' })).toMatch(/24,95/);
  });
});

describe('storefront client', () => {
  it('pins the API version in the endpoint', () => {
    expect(storefrontEndpoint('suppcity.myshopify.com')).toBe('https://suppcity.myshopify.com/api/2026-10/graphql.json');
  });

  it('sends the public token and maps a cart create', async () => {
    const f = fakeFetch([{ body: { data: { cartCreate: { cart: rawCart, userErrors: [], warnings: [] } } } }]);
    const client = createStorefrontClient({ domain: 'x.myshopify.com', publicToken: 'pub', fetchImpl: f.impl });
    const res = await client.cartCreate({
      lines: [{ variantId: 'gid://shopify/ProductVariant/11', quantity: 3 }],
      customerAccessToken: 'cat',
      discountCodes: ['APP10'],
    });
    expect(f.calls[0]?.init.headers['X-Shopify-Storefront-Access-Token']).toBe('pub');
    const sent = JSON.parse(f.calls[0]?.init.body ?? '{}') as { variables: { input: Record<string, unknown> } };
    expect(sent.variables.input.buyerIdentity).toEqual({ customerAccessToken: 'cat', countryCode: 'NL' });
    expect(sent.variables.input.discountCodes).toEqual(['APP10']);
    expect(res.cart.total.cents).toBe(7485);
    expect(res.cart.lines[0]?.variantTitle).toBeNull();
    expect(res.cart.lines[0]?.unitPrice.cents).toBe(2495);
  });

  it('throws user_error on userErrors', async () => {
    const f = fakeFetch([
      { body: { data: { cartLinesAdd: { cart: null, userErrors: [{ field: ['lines'], message: 'Sold out', code: 'INVALID' }] } } } },
    ]);
    const client = createStorefrontClient({ domain: 'x', publicToken: 'p', fetchImpl: f.impl });
    await expect(client.cartLinesAdd('c', [{ variantId: 'v', quantity: 1 }])).rejects.toMatchObject({ kind: 'user_error' });
  });

  it('throws invalid_response when the shape is wrong', async () => {
    const f = fakeFetch([{ body: { data: { collections: { nodes: [{ id: 1 }] } } } }]);
    const client = createStorefrontClient({ domain: 'x', publicToken: 'p', fetchImpl: f.impl });
    await expect(client.collections()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('throws graphql on top-level errors and http on 5xx', async () => {
    const f = fakeFetch([{ body: { errors: [{ message: 'boom' }] } }, { status: 503, body: {} }]);
    const client = createStorefrontClient({ domain: 'x', publicToken: 'p', fetchImpl: f.impl });
    await expect(client.product('a')).rejects.toMatchObject({ kind: 'graphql' });
    await expect(client.product('a')).rejects.toMatchObject({ kind: 'http', status: 503 });
  });

  it('maps network failures and gives a Dutch message', async () => {
    const client = createStorefrontClient({
      domain: 'x',
      publicToken: 'p',
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });
    const error = await client.collections().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ShopifyApiError);
    expect(userMessageFor(error)).toMatch(/Geen verbinding/);
  });

  it('maps variant availability incl. deleted variants', async () => {
    const f = fakeFetch([
      {
        body: {
          data: {
            nodes: [
              {
                id: 'v1',
                title: '500 g',
                availableForSale: false,
                price: eur('19.95'),
                compareAtPrice: null,
                image: null,
                selectedOptions: [],
                product: { id: 'p', handle: 'h', title: 'Whey' },
              },
              null,
            ],
          },
        },
      },
    ]);
    const client = createStorefrontClient({ domain: 'x', publicToken: 'p', fetchImpl: f.impl });
    const map = await client.variantAvailability(['v1', 'v2']);
    expect(map.get('v1')?.available).toBe(false);
    expect(map.get('v1')?.productTitle).toBe('Whey');
    expect(map.get('v2')).toEqual({ variantId: 'v2', productTitle: '', variantTitle: '', available: false });
  });
});

describe('product mapping', () => {
  it('flags the implicit default variant and falls back alt text', () => {
    const raw = productDetailSchema.parse({
      id: 'p',
      handle: 'creatine',
      title: 'Creatine',
      availableForSale: true,
      featuredImage: { url: 'https://cdn/x.jpg', altText: null },
      priceRange: { minVariantPrice: eur('24.95') },
      description: 'Puur',
      vendor: 'Supp City',
      productType: null,
      images: { nodes: [{ url: 'https://cdn/x.jpg', altText: '' }] },
      variants: {
        nodes: [
          {
            id: 'v',
            title: 'Default Title',
            availableForSale: true,
            price: eur('24.95'),
            compareAtPrice: eur('29.95'),
            image: null,
            selectedOptions: [{ name: 'Title', value: 'Default Title' }],
          },
        ],
      },
    });
    const p = mapProductDetail(raw);
    expect(p.hasOnlyDefaultVariant).toBe(true);
    expect(p.images[0]?.alt).toBe('Creatine');
    expect(p.variants[0]?.compareAtPrice?.cents).toBe(2995);
  });
});
