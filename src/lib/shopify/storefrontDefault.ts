import { getEnv } from '@/lib/config';

import { createStorefrontClient, type StorefrontClient } from './storefront';

let client: StorefrontClient | null = null;

/** App-wide Storefront client built from EXPO_PUBLIC_* config. */
export function getStorefront(): StorefrontClient {
  if (!client) {
    const env = getEnv();
    client = createStorefrontClient({
      domain: env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN,
      publicToken: env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
    });
  }
  return client;
}
