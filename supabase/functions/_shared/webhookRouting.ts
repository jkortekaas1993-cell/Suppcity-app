// Topic routing + compliance payloads for shopify-webhooks. Pure.
import { z } from 'zod';

export const SUPPORTED_TOPICS = ['orders/paid', 'customers/data_request', 'customers/redact', 'shop/redact'] as const;
export type SupportedTopic = (typeof SUPPORTED_TOPICS)[number];

export function asTopic(header: string | null): SupportedTopic | null {
  return (SUPPORTED_TOPICS as readonly string[]).includes(header ?? '') ? (header as SupportedTopic) : null;
}

const Id = z.union([z.number(), z.string()]);

export const CustomerPrivacyPayload = z.object({
  shop_domain: z.string(),
  customer: z.object({ id: Id }),
});

export const ShopRedactPayload = z.object({ shop_domain: z.string() });

/** Shopify domains are compared case-insensitively. */
export function sameShop(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}
