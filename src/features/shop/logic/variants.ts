import type { ProductDetail, ProductVariant } from '@/lib/shopify';

/**
 * Which variants the product screen offers. The owner prefers not to show sold-out
 * flavours at all: sold-out variants are hidden, and "Uitverkocht" is only shown when
 * the whole product is sold out.
 */
export function sellableVariants(product: Pick<ProductDetail, 'variants'>): ProductVariant[] {
  return product.variants.filter((v) => v.available);
}

export function isSoldOut(product: Pick<ProductDetail, 'variants'>): boolean {
  return sellableVariants(product).length === 0;
}

/** Initial selection: the first variant that is in stock (null when the product is sold out). */
export function defaultVariantId(product: Pick<ProductDetail, 'variants'>): string | null {
  return sellableVariants(product)[0]?.id ?? null;
}

/**
 * Heading above the variant chips: the option name when there is one option
 * ("Smaak", "Inhoud"), otherwise a generic "Variant".
 */
export function variantGroupLabel(product: Pick<ProductDetail, 'variants'>): string {
  const names = new Set<string>();
  for (const v of product.variants) for (const o of v.options) if (o.name !== 'Title') names.add(o.name.trim());
  const [only] = [...names];
  return names.size === 1 && only ? only : 'Variant';
}
