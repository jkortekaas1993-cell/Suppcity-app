import { z } from 'zod';

import { moneyV2Schema } from './money';

/**
 * Raw Storefront API response shapes (2026-10), validated with zod at the boundary.
 * Only the fields our queries select. Mappers turn these into app models.
 */
const nullableString = z.string().nullable().optional();

export const imageSchema = z.object({
  url: z.string(),
  altText: nullableString,
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
});

export const selectedOptionSchema = z.object({ name: z.string(), value: z.string() });

export const variantSchema = z.object({
  id: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  price: moneyV2Schema,
  compareAtPrice: moneyV2Schema.nullable().optional(),
  image: imageSchema.nullable().optional(),
  selectedOptions: z.array(selectedOptionSchema),
});

export const productCardSchema = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  featuredImage: imageSchema.nullable().optional(),
  priceRange: z.object({ minVariantPrice: moneyV2Schema }),
});

export const productDetailSchema = productCardSchema.extend({
  description: z.string(),
  vendor: nullableString,
  productType: nullableString,
  onlineStoreUrl: nullableString,
  /** Metafield suppcity.claim_ids (list.single_line_text_field → JSON string array). */
  claimIds: z.object({ value: z.string() }).nullable().optional(),
  images: z.object({ nodes: z.array(imageSchema) }),
  variants: z.object({ nodes: z.array(variantSchema) }),
});

export const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

export const collectionSchema = z.object({
  id: z.string(),
  handle: z.string(),
  title: z.string(),
  description: z.string(),
  image: imageSchema.nullable().optional(),
});

export const collectionsDataSchema = z.object({
  collections: z.object({ nodes: z.array(collectionSchema) }),
});

export const productsDataSchema = z.object({
  products: z.object({ nodes: z.array(productCardSchema), pageInfo: pageInfoSchema }),
});

export const collectionProductsDataSchema = z.object({
  collection: collectionSchema
    .extend({ products: z.object({ nodes: z.array(productCardSchema), pageInfo: pageInfoSchema }) })
    .nullable(),
});

export const productDataSchema = z.object({ product: productDetailSchema.nullable() });

export const variantWithProductSchema = variantSchema.extend({
  product: z.object({ id: z.string(), handle: z.string(), title: z.string() }),
});

/** `nodes(ids:)` returns null for unknown ids and `{}` for non-variant nodes; items are validated individually. */
export const variantsByIdDataSchema = z.object({ nodes: z.array(z.unknown()) });

export const cartLineSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  cost: z.object({ totalAmount: moneyV2Schema, amountPerQuantity: moneyV2Schema }),
  merchandise: z.object({
    id: z.string(),
    title: z.string(),
    availableForSale: z.boolean(),
    image: imageSchema.nullable().optional(),
    product: z.object({ id: z.string(), handle: z.string(), title: z.string() }),
  }),
});

export const cartSchema = z.object({
  id: z.string(),
  checkoutUrl: z.string(),
  totalQuantity: z.number().int(),
  cost: z.object({ subtotalAmount: moneyV2Schema, totalAmount: moneyV2Schema }),
  discountCodes: z.array(z.object({ code: z.string(), applicable: z.boolean() })),
  lines: z.object({ nodes: z.array(cartLineSchema) }),
});

export const userErrorSchema = z.object({
  field: z.array(z.string()).nullable().optional(),
  message: z.string(),
  code: nullableString,
});

export const cartWarningSchema = z.object({ code: z.string(), message: z.string(), target: nullableString });

const cartPayload = z.object({
  cart: cartSchema.nullable(),
  userErrors: z.array(userErrorSchema),
  warnings: z.array(cartWarningSchema).optional().default([]),
});

export const cartQueryDataSchema = z.object({ cart: cartSchema.nullable() });
export const cartCreateDataSchema = z.object({ cartCreate: cartPayload });
export const cartLinesAddDataSchema = z.object({ cartLinesAdd: cartPayload });
export const cartLinesUpdateDataSchema = z.object({ cartLinesUpdate: cartPayload });
export const cartLinesRemoveDataSchema = z.object({ cartLinesRemove: cartPayload });
export const cartBuyerIdentityUpdateDataSchema = z.object({ cartBuyerIdentityUpdate: cartPayload });
export const cartDiscountCodesUpdateDataSchema = z.object({ cartDiscountCodesUpdate: cartPayload });

export type RawProductCard = z.infer<typeof productCardSchema>;
export type RawProductDetail = z.infer<typeof productDetailSchema>;
export type RawCollection = z.infer<typeof collectionSchema>;
export type RawCart = z.infer<typeof cartSchema>;
export type RawVariant = z.infer<typeof variantSchema>;
export type RawVariantWithProduct = z.infer<typeof variantWithProductSchema>;
export type RawImage = z.infer<typeof imageSchema>;
export type RawCartPayload = z.infer<typeof cartPayload>;
