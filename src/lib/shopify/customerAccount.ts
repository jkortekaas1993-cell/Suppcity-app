import type { z } from 'zod';

import { SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION } from '@/lib/config/constants';

import { mapOrderDetail, mapOrderSummary } from './customerAccountMappers';
import { CUSTOMER_ORDERS_QUERY, CUSTOMER_PROFILE_QUERY, ORDER_QUERY } from './customerAccountQueries';
import { customerOrdersDataSchema, customerProfileDataSchema, orderDataSchema } from './customerAccountSchemas';
import { ShopifyApiError } from './errors';
import { graphqlRequest, type FetchLike } from './http';
import type { CustomerProfile, OrderDetail, OrderSummary, Page } from './models';
import {
  buildCodeExchangeBody,
  buildRefreshBody,
  customerApiConfigurationSchema,
  openIdConfigurationSchema,
  pinCustomerApiVersion,
  tokenResponseSchema,
  type OpenIdConfiguration,
  type TokenResponse,
} from './oauth';

/**
 * Customer Account API: endpoint discovery, token endpoint calls and GraphQL.
 * Framework-free; fetch injected. Token storage lives in ./customerSession.ts.
 */
export interface CustomerAccountEndpoints {
  openId: OpenIdConfiguration;
  graphqlUrl: string;
}

async function getJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' } });
  } catch (cause) {
    throw new ShopifyApiError('network', 'Discovery request failed', cause);
  }
  if (!res.ok) throw new ShopifyApiError('http', `Discovery HTTP ${res.status}`, undefined, res.status);
  return res.json();
}

export async function discoverCustomerAccount(
  shopDomain: string,
  fetchImpl: FetchLike,
  version: string = SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION,
): Promise<CustomerAccountEndpoints> {
  const [openIdRaw, apiRaw] = await Promise.all([
    getJson(fetchImpl, `https://${shopDomain}/.well-known/openid-configuration`),
    getJson(fetchImpl, `https://${shopDomain}/.well-known/customer-account-api`),
  ]);
  const openId = openIdConfigurationSchema.safeParse(openIdRaw);
  const api = customerApiConfigurationSchema.safeParse(apiRaw);
  if (!openId.success || !api.success) {
    throw new ShopifyApiError('invalid_response', 'Unexpected discovery document');
  }
  return { openId: openId.data, graphqlUrl: pinCustomerApiVersion(api.data.graphql_api, version) };
}

async function postToken(fetchImpl: FetchLike, tokenEndpoint: string, body: string): Promise<TokenResponse> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
  } catch (cause) {
    throw new ShopifyApiError('network', 'Token request failed', cause);
  }
  if (res.status === 400 || res.status === 401) {
    // invalid_grant / unsupported_grant_type: the refresh token is dead → sign in again.
    throw new ShopifyApiError('unauthorized', `Token HTTP ${res.status}`, await res.json().catch(() => null), res.status);
  }
  if (!res.ok) throw new ShopifyApiError('http', `Token HTTP ${res.status}`, undefined, res.status);
  const parsed = tokenResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new ShopifyApiError('invalid_response', 'Unexpected token response', parsed.error.issues);
  return parsed.data;
}

export function exchangeCode(
  fetchImpl: FetchLike,
  tokenEndpoint: string,
  input: { clientId: string; redirectUri: string; code: string; codeVerifier: string },
): Promise<TokenResponse> {
  return postToken(fetchImpl, tokenEndpoint, buildCodeExchangeBody(input));
}

export function refreshTokens(
  fetchImpl: FetchLike,
  tokenEndpoint: string,
  input: { clientId: string; refreshToken: string },
): Promise<TokenResponse> {
  return postToken(fetchImpl, tokenEndpoint, buildRefreshBody(input));
}

/** Mobile clients call the logout endpoint as an API (returns 200), no browser redirect. */
export async function endSession(fetchImpl: FetchLike, endSessionEndpoint: string, idToken: string): Promise<void> {
  const sep = endSessionEndpoint.includes('?') ? '&' : '?';
  try {
    await fetchImpl(`${endSessionEndpoint}${sep}id_token_hint=${encodeURIComponent(idToken)}`, {
      method: 'GET',
      headers: {},
    });
  } catch {
    // Best effort: local tokens are wiped regardless.
  }
}

export interface CustomerAccountClient {
  profile(): Promise<CustomerProfile>;
  orders(opts?: { first?: number; after?: string | null }): Promise<Page<OrderSummary>>;
  order(id: string): Promise<OrderDetail | null>;
}

/** `getAccessToken` must return a valid (refreshed) token; see customerSession.getValidAccessToken. */
export function createCustomerAccountClient(opts: {
  graphqlUrl: string;
  getAccessToken: () => Promise<string>;
  fetchImpl: FetchLike;
}): CustomerAccountClient {
  const run = async <S extends z.ZodTypeAny>(query: string, schema: S, variables?: Record<string, unknown>) => {
    const token = await opts.getAccessToken();
    // Customer Account API expects the raw token in Authorization (no "Bearer" prefix).
    return graphqlRequest({
      endpoint: opts.graphqlUrl,
      headers: { Authorization: token },
      query,
      variables,
      schema,
      fetchImpl: opts.fetchImpl,
    });
  };
  return {
    async profile() {
      const data = await run(CUSTOMER_PROFILE_QUERY, customerProfileDataSchema);
      return {
        id: data.customer.id,
        firstName: data.customer.firstName ?? null,
        email: data.customer.emailAddress?.emailAddress ?? null,
      };
    },
    async orders({ first = 20, after = null } = {}) {
      const data = await run(CUSTOMER_ORDERS_QUERY, customerOrdersDataSchema, { first, after });
      return {
        items: data.customer.orders.nodes.map(mapOrderSummary),
        hasNextPage: data.customer.orders.pageInfo.hasNextPage,
        endCursor: data.customer.orders.pageInfo.endCursor,
      };
    },
    async order(id) {
      const data = await run(ORDER_QUERY, orderDataSchema, { id });
      return data.order ? mapOrderDetail(data.order) : null;
    },
  };
}
