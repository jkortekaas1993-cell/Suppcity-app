import { z } from 'zod';

import { moneyV2Schema } from './money';

/** Raw Customer Account API (2026-10) shapes for the fields our queries select. */
const imageSchema = z.object({ url: z.string(), altText: z.string().nullable().optional() });

export const orderLineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  variantId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  variantTitle: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  image: imageSchema.nullable().optional(),
  totalPrice: moneyV2Schema.nullable().optional(),
  giftCard: z.boolean().optional(),
});

export const orderSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.number().int(),
  processedAt: z.string(),
  financialStatus: z.string().nullable().optional(),
  fulfillmentStatus: z.string().nullable().optional(),
  totalPrice: moneyV2Schema,
  lineItems: z.object({ nodes: z.array(orderLineItemSchema) }),
});

export const orderDetailSchema = orderSummarySchema.extend({
  subtotal: moneyV2Schema.nullable().optional(),
  totalShipping: moneyV2Schema,
  totalTax: moneyV2Schema.nullable().optional(),
});

export const customerOrdersDataSchema = z.object({
  customer: z.object({
    orders: z.object({
      nodes: z.array(orderSummarySchema),
      pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
    }),
  }),
});

export const orderDataSchema = z.object({ order: orderDetailSchema.nullable() });

export const customerProfileDataSchema = z.object({
  customer: z.object({
    id: z.string(),
    firstName: z.string().nullable().optional(),
    emailAddress: z.object({ emailAddress: z.string().nullable().optional() }).nullable().optional(),
  }),
});

export type RawOrderSummary = z.infer<typeof orderSummarySchema>;
export type RawOrderDetail = z.infer<typeof orderDetailSchema>;
export type RawOrderLineItem = z.infer<typeof orderLineItemSchema>;
