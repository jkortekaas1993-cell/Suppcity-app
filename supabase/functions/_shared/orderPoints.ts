// orders/paid → points. Pure.
//
// Rule (hard rule 5, documented in supabase/README.md):
//   points = floor(subtotal after discounts, excl. shipping) × POINTS_PER_EURO
// Source field: current_subtotal_price_set.shop_money (falls back to subtotal_price).
// Shopify's subtotal is "after discounts, before shipping, duties, taxes and tips";
// suppcity.nl shows prices incl. BTW, so the subtotal includes VAT. Shipping, tips
// and gift-card purchases are excluded. Orders in another shop currency earn 0.
// Only the amount is used; never product/health data (hard rule 1).
import { z } from 'zod';

import { POINTS_CURRENCY, POINTS_PER_EURO } from './config.ts';

const Money = z.object({ amount: z.string(), currency_code: z.string() });

export const OrderPaidPayload = z.object({
  id: z.union([z.number(), z.string()]),
  admin_graphql_api_id: z.string().optional(),
  currency: z.string().optional(),
  test: z.boolean().optional(),
  subtotal_price: z.string().optional(),
  current_subtotal_price_set: z.object({ shop_money: Money }).optional().nullable(),
  line_items: z
    .array(z.object({ gift_card: z.boolean().optional(), price: z.string().optional(), quantity: z.number().optional() }))
    .optional(),
  customer: z
    .object({ id: z.union([z.number(), z.string()]), admin_graphql_api_id: z.string().optional() })
    .nullable()
    .optional(),
});
export type OrderPaidPayload = z.infer<typeof OrderPaidPayload>;

export interface OrderPoints {
  orderGid: string;
  customerGid: string | null;
  points: number;
}

/** "57.99" → 5799 cents without float rounding. Invalid → null. */
export function decimalToCents(s: string): number | null {
  const m = /^(-?)(\d+)(?:\.(\d{1,2})\d*)?$/.exec(s.trim());
  if (!m) return null;
  const whole = Number(m[2]);
  const frac = Number((m[3] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + frac;
  return m[1] === '-' ? -cents : cents;
}

export function gid(kind: 'Order' | 'Customer', id: number | string, given?: string): string {
  if (given && given.startsWith(`gid://shopify/${kind}/`)) return given;
  return `gid://shopify/${kind}/${String(id)}`;
}

export function pointsForOrder(payload: OrderPaidPayload): OrderPoints {
  const orderGid = gid('Order', payload.id, payload.admin_graphql_api_id);
  const customerGid = payload.customer ? gid('Customer', payload.customer.id, payload.customer.admin_graphql_api_id) : null;

  const money = payload.current_subtotal_price_set?.shop_money;
  const amount = money?.amount ?? payload.subtotal_price;
  const currency = money?.currency_code ?? payload.currency;
  let cents = amount !== undefined ? decimalToCents(amount) : null;
  if (cents === null || currency !== POINTS_CURRENCY || payload.test === true) {
    return { orderGid, customerGid, points: 0 };
  }
  // Gift cards are money, not a purchase: exclude them from the subtotal.
  for (const li of payload.line_items ?? []) {
    if (li.gift_card && li.price) cents -= (decimalToCents(li.price) ?? 0) * (li.quantity ?? 1);
  }
  const points = Math.max(0, Math.floor(cents / 100)) * POINTS_PER_EURO;
  return { orderGid, customerGid, points };
}
