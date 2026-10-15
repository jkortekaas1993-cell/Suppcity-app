import type { ProductDetail, ProductVariant } from '@/lib/shopify';

/**
 * What the app shows about a product (compliance C1, hard rule 4). The free-text
 * Shopify description is NOT shown in the app: it can contain unapproved health
 * claims. The app shows only name, variant, price, contents (variant options) and
 * approved claims (approvedClaimsFor); full product information stays on suppcity.nl.
 * See docs/decisions.md ADR-13.
 */
export interface ProductFact {
  label: string;
  value: string;
}

/** Variant options as plain facts, e.g. "Inhoud: 500 g", "Smaak: Vanille". */
export function productFacts(product: Pick<ProductDetail, 'hasOnlyDefaultVariant'>, variant: Pick<ProductVariant, 'options'> | null): ProductFact[] {
  if (!variant || product.hasOnlyDefaultVariant) return [];
  return variant.options
    .filter((o) => o.name.trim() && o.value.trim() && o.name !== 'Title')
    .map((o) => ({ label: o.name.trim(), value: o.value.trim() }));
}

const SHOP_HOST = /^(www\.)?suppcity\.nl$/i;

/**
 * Product page on suppcity.nl for "Volledige productinformatie". Only https links on
 * suppcity.nl are opened; anything else falls back to /products/<handle>.
 */
export function productPageUrl(product: Pick<ProductDetail, 'handle' | 'onlineStoreUrl'>): string {
  const raw = product.onlineStoreUrl;
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'https:' && SHOP_HOST.test(u.hostname)) return u.toString();
    } catch {
      // fall through
    }
  }
  return `https://suppcity.nl/products/${encodeURIComponent(product.handle)}`;
}
