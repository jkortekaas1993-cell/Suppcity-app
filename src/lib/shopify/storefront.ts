import type { z } from 'zod';

import { SHOPIFY_STOREFRONT_API_VERSION } from '@/lib/config/constants';

import { defaultFetch, graphqlRequest, type FetchLike } from './http';
import type {
  Cart,
  CartMutationResult,
  Collection,
  NewCartLine,
  Page,
  ProductDetail,
  ProductSummary,
  VariantAvailability,
} from './models';
import {
  CART_BUYER_IDENTITY_UPDATE_MUTATION,
  CART_CREATE_MUTATION,
  CART_DISCOUNT_CODES_UPDATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  COLLECTION_PRODUCTS_QUERY,
  COLLECTIONS_QUERY,
  PRODUCT_QUERY,
  PRODUCTS_QUERY,
  VARIANTS_BY_ID_QUERY,
} from './storefrontQueries';
import {
  mapCart,
  mapCollection,
  mapProductDetail,
  mapProductSummary,
  mapVariantAvailability,
  unwrapCartPayload,
} from './storefrontMappers';
import {
  cartBuyerIdentityUpdateDataSchema,
  cartCreateDataSchema,
  cartDiscountCodesUpdateDataSchema,
  cartLinesAddDataSchema,
  cartLinesRemoveDataSchema,
  cartLinesUpdateDataSchema,
  cartQueryDataSchema,
  collectionProductsDataSchema,
  collectionsDataSchema,
  productDataSchema,
  productsDataSchema,
  variantsByIdDataSchema,
} from './storefrontSchemas';

export function storefrontEndpoint(domain: string, version: string = SHOPIFY_STOREFRONT_API_VERSION): string {
  return `https://${domain}/api/${version}/graphql.json`;
}

export interface StorefrontConfig {
  domain: string;
  /** Public Storefront access token (safe to ship in the app). */
  publicToken: string;
  version?: string;
  fetchImpl?: FetchLike;
}

export interface StorefrontClient {
  collections(first?: number): Promise<Collection[]>;
  products(opts?: { first?: number; after?: string | null; query?: string }): Promise<Page<ProductSummary>>;
  collectionProducts(
    handle: string,
    opts?: { first?: number; after?: string | null },
  ): Promise<{ collection: Collection; products: Page<ProductSummary> } | null>;
  product(handle: string): Promise<ProductDetail | null>;
  variantAvailability(variantIds: readonly string[]): Promise<Map<string, VariantAvailability>>;
  cart(cartId: string): Promise<Cart | null>;
  cartCreate(input: { lines: NewCartLine[]; customerAccessToken?: string | null; discountCodes?: string[] }): Promise<CartMutationResult>;
  cartLinesAdd(cartId: string, lines: NewCartLine[]): Promise<CartMutationResult>;
  cartLinesUpdate(cartId: string, lines: { lineId: string; quantity: number }[]): Promise<CartMutationResult>;
  cartLinesRemove(cartId: string, lineIds: string[]): Promise<CartMutationResult>;
  /** Attach the Customer Account API access token so checkout is pre-filled/authenticated. */
  cartBuyerIdentityUpdate(cartId: string, customerAccessToken: string): Promise<CartMutationResult>;
  cartDiscountCodesUpdate(cartId: string, codes: string[]): Promise<CartMutationResult>;
}

const toLineInput = (l: NewCartLine) => ({ merchandiseId: l.variantId, quantity: l.quantity });

export function createStorefrontClient(config: StorefrontConfig): StorefrontClient {
  const endpoint = storefrontEndpoint(config.domain, config.version);
  const fetchImpl: FetchLike = config.fetchImpl ?? defaultFetch();
  const headers = { 'X-Shopify-Storefront-Access-Token': config.publicToken };

  const run = <S extends z.ZodTypeAny>(query: string, schema: S, variables?: Record<string, unknown>) =>
    graphqlRequest({ endpoint, headers, query, variables, schema, fetchImpl });

  return {
    async collections(first = 50) {
      const data = await run(COLLECTIONS_QUERY, collectionsDataSchema, { first });
      return data.collections.nodes.map(mapCollection);
    },
    async products({ first = 24, after = null, query } = {}) {
      const data = await run(PRODUCTS_QUERY, productsDataSchema, { first, after, query: query ?? null });
      return {
        items: data.products.nodes.map(mapProductSummary),
        hasNextPage: data.products.pageInfo.hasNextPage,
        endCursor: data.products.pageInfo.endCursor,
      };
    },
    async collectionProducts(handle, { first = 24, after = null } = {}) {
      const data = await run(COLLECTION_PRODUCTS_QUERY, collectionProductsDataSchema, { handle, first, after });
      if (!data.collection) return null;
      const { products, ...collection } = data.collection;
      return {
        collection: mapCollection(collection),
        products: {
          items: products.nodes.map(mapProductSummary),
          hasNextPage: products.pageInfo.hasNextPage,
          endCursor: products.pageInfo.endCursor,
        },
      };
    },
    async product(handle) {
      const data = await run(PRODUCT_QUERY, productDataSchema, { handle });
      return data.product ? mapProductDetail(data.product) : null;
    },
    async variantAvailability(variantIds) {
      if (variantIds.length === 0) return new Map();
      const data = await run(VARIANTS_BY_ID_QUERY, variantsByIdDataSchema, { ids: [...variantIds] });
      return mapVariantAvailability(variantIds, data.nodes);
    },
    async cart(cartId) {
      const data = await run(CART_QUERY, cartQueryDataSchema, { id: cartId });
      return data.cart ? mapCart(data.cart) : null;
    },
    async cartCreate({ lines, customerAccessToken, discountCodes }) {
      const input: Record<string, unknown> = { lines: lines.map(toLineInput) };
      if (customerAccessToken) input.buyerIdentity = { customerAccessToken, countryCode: 'NL' };
      if (discountCodes && discountCodes.length > 0) input.discountCodes = discountCodes;
      const data = await run(CART_CREATE_MUTATION, cartCreateDataSchema, { input });
      return unwrapCartPayload(data.cartCreate);
    },
    async cartLinesAdd(cartId, lines) {
      const data = await run(CART_LINES_ADD_MUTATION, cartLinesAddDataSchema, { cartId, lines: lines.map(toLineInput) });
      return unwrapCartPayload(data.cartLinesAdd);
    },
    async cartLinesUpdate(cartId, lines) {
      const data = await run(CART_LINES_UPDATE_MUTATION, cartLinesUpdateDataSchema, {
        cartId,
        lines: lines.map((l) => ({ id: l.lineId, quantity: l.quantity })),
      });
      return unwrapCartPayload(data.cartLinesUpdate);
    },
    async cartLinesRemove(cartId, lineIds) {
      const data = await run(CART_LINES_REMOVE_MUTATION, cartLinesRemoveDataSchema, { cartId, lineIds });
      return unwrapCartPayload(data.cartLinesRemove);
    },
    async cartBuyerIdentityUpdate(cartId, customerAccessToken) {
      const data = await run(CART_BUYER_IDENTITY_UPDATE_MUTATION, cartBuyerIdentityUpdateDataSchema, {
        cartId,
        buyerIdentity: { customerAccessToken, countryCode: 'NL' },
      });
      return unwrapCartPayload(data.cartBuyerIdentityUpdate);
    },
    async cartDiscountCodesUpdate(cartId, codes) {
      const data = await run(CART_DISCOUNT_CODES_UPDATE_MUTATION, cartDiscountCodesUpdateDataSchema, {
        cartId,
        discountCodes: codes,
      });
      return unwrapCartPayload(data.cartDiscountCodesUpdate);
    },
  };
}
