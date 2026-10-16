import { ShopifyApiError } from './errors';
import type {
  Cart,
  CartLine,
  CartMutationResult,
  Collection,
  ProductDetail,
  ProductSummary,
  ProductVariant,
  ShopImage,
  VariantAvailability,
} from './models';
import { parseMoney } from './money';
import type {
  RawCart,
  RawCartPayload,
  RawCollection,
  RawImage,
  RawProductCard,
  RawProductDetail,
  RawVariant,
} from './storefrontSchemas';
import { variantWithProductSchema } from './storefrontSchemas';

const DEFAULT_VARIANT_TITLE = 'Default Title';

export function mapImage(raw: RawImage | null | undefined, fallbackAlt: string): ShopImage | null {
  if (!raw) return null;
  return { url: raw.url, alt: raw.altText?.trim() || fallbackAlt };
}

export function mapCollection(raw: RawCollection): Collection {
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    image: mapImage(raw.image, raw.title),
  };
}

export function mapProductSummary(raw: RawProductCard): ProductSummary {
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    image: mapImage(raw.featuredImage, raw.title),
    priceFrom: parseMoney(raw.priceRange.minVariantPrice),
    available: raw.availableForSale,
    vendor: raw.vendor?.trim() || null,
    quickAddVariantId: quickAddVariantId(raw),
  };
}

/** The one variant to add from the grid: only when the product has exactly one, and it is in stock. */
export function quickAddVariantId(raw: Pick<RawProductCard, 'quickVariants'>): string | null {
  const nodes = raw.quickVariants?.nodes ?? [];
  const only = nodes.length === 1 ? nodes[0] : undefined;
  return only && only.availableForSale ? only.id : null;
}

export function mapVariant(raw: RawVariant, productTitle: string): ProductVariant {
  return {
    id: raw.id,
    title: raw.title,
    available: raw.availableForSale,
    price: parseMoney(raw.price),
    compareAtPrice: raw.compareAtPrice ? parseMoney(raw.compareAtPrice) : null,
    image: mapImage(raw.image, productTitle),
    options: raw.selectedOptions.map((o) => ({ name: o.name, value: o.value })),
  };
}

/** Metafield value is a JSON array of strings; anything else yields []. */
export function parseClaimIds(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function mapProductDetail(raw: RawProductDetail): ProductDetail {
  const variants = raw.variants.nodes.map((v) => mapVariant(v, raw.title));
  const only = variants.length === 1 ? variants[0] : undefined;
  return {
    ...mapProductSummary(raw),
    description: raw.description,
    images: raw.images.nodes.map((i) => mapImage(i, raw.title)).filter((i): i is ShopImage => i !== null),
    variants,
    hasOnlyDefaultVariant: only !== undefined && only.title === DEFAULT_VARIANT_TITLE,
    onlineStoreUrl: raw.onlineStoreUrl ?? null,
    claimIds: parseClaimIds(raw.claimIds?.value),
  };
}

export function mapCartLine(raw: RawCart['lines']['nodes'][number]): CartLine {
  const m = raw.merchandise;
  return {
    id: raw.id,
    quantity: raw.quantity,
    variantId: m.id,
    variantTitle: m.title === DEFAULT_VARIANT_TITLE ? null : m.title,
    productTitle: m.product.title,
    productHandle: m.product.handle,
    image: mapImage(m.image, m.product.title),
    unitPrice: parseMoney(raw.cost.amountPerQuantity),
    lineTotal: parseMoney(raw.cost.totalAmount),
    available: m.availableForSale,
  };
}

export function mapCart(raw: RawCart): Cart {
  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    subtotal: parseMoney(raw.cost.subtotalAmount),
    total: parseMoney(raw.cost.totalAmount),
    discountCodes: raw.discountCodes.map((d) => ({ code: d.code, applicable: d.applicable })),
    lines: raw.lines.nodes.map(mapCartLine),
  };
}

/** Unwrap a cart mutation payload: throw on userErrors, keep warnings. */
export function unwrapCartPayload(payload: RawCartPayload): CartMutationResult {
  if (payload.userErrors.length > 0) {
    throw new ShopifyApiError('user_error', payload.userErrors.map((e) => e.message).join('; '), payload.userErrors);
  }
  if (!payload.cart) throw new ShopifyApiError('invalid_response', 'Cart missing from mutation payload');
  return {
    cart: mapCart(payload.cart),
    warnings: payload.warnings.map((w) => ({ code: w.code, message: w.message })),
  };
}

/** Map `nodes(ids:)` results; ids that are missing/deleted come back as unavailable. */
export function mapVariantAvailability(
  requestedIds: readonly string[],
  nodes: readonly unknown[],
): Map<string, VariantAvailability> {
  const result = new Map<string, VariantAvailability>();
  nodes.forEach((node, index) => {
    const parsed = variantWithProductSchema.safeParse(node);
    const requestedId = requestedIds[index];
    if (parsed.success) {
      result.set(parsed.data.id, {
        variantId: parsed.data.id,
        productTitle: parsed.data.product.title,
        variantTitle: parsed.data.title,
        available: parsed.data.availableForSale,
      });
    } else if (requestedId) {
      result.set(requestedId, { variantId: requestedId, productTitle: '', variantTitle: '', available: false });
    }
  });
  return result;
}
