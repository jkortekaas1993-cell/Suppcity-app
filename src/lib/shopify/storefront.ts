import { getEnv, SHOPIFY_STOREFRONT_API_VERSION } from '@/lib/config';

/**
 * Thin Storefront API client (public token, read catalog + carts).
 * Shop&Login builder owns this file. Keep queries in ./queries/*.ts and
 * validate responses with zod at the boundary.
 */
export class StorefrontError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'StorefrontError';
  }
}

export function storefrontEndpoint(domain: string, version = SHOPIFY_STOREFRONT_API_VERSION): string {
  return `https://${domain}/api/${version}/graphql.json`;
}

export async function storefrontQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const env = getEnv();
  const res = await fetch(storefrontEndpoint(env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new StorefrontError(`Storefront HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors || !json.data) throw new StorefrontError('Storefront GraphQL error', json.errors);
  return json.data;
}
