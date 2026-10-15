import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config on top of app.json. Adds the Shopify Customer Account API
 * callback scheme `shop.<SHOP_ID>.app` (required by Shopify for mobile public
 * clients; see buildRedirectUri in src/lib/shopify/oauth.ts) next to our own
 * `suppcity` scheme. SHOP_ID comes from EXPO_PUBLIC_SHOPIFY_SHOP_ID (.env / EAS env).
 */
export function customerAccountScheme(shopId: string | undefined): string | null {
  const id = shopId?.trim();
  return id && /^\d+$/.test(id) ? `shop.${id}.app` : null;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  const own = Array.isArray(base.scheme) ? base.scheme : base.scheme ? [base.scheme] : [];
  const shopScheme = customerAccountScheme(process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID);
  return {
    ...base,
    name: base.name ?? 'Supp City',
    slug: base.slug ?? 'suppcity-app',
    scheme: shopScheme ? [...own.filter((s) => s !== shopScheme), shopScheme] : own,
  };
};
