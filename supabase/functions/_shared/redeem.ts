// Points → Shopify discount code. Pure: code derivation, mutation input, error mapping.
//
// Idempotency with Shopify: the code is DERIVED from the redemption id with an HMAC
// over a server secret, so a retry after a crash produces the same code. If Shopify
// says the code already exists, we look it up instead of creating a second one.
import { REDEEM_CODE_PREFIX } from './config.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export async function deriveDiscountCode(redemptionId: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`redeem:${redemptionId}`)));
  let s = '';
  for (let i = 0; i < 10; i++) s += ALPHABET[(mac[i] ?? 0) % ALPHABET.length];
  return `${REDEEM_CODE_PREFIX}-${s.slice(0, 5)}-${s.slice(5)}`;
}

export interface Redemption {
  id: string;
  points: number;
  value_cents: number;
  min_order_cents: number;
  valid_days: number;
  status: 'pending' | 'issued' | 'failed';
  discount_code: string | null;
  expires_at: string | null;
}

export function centsToDecimal(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export const DISCOUNT_CREATE_MUTATION = `mutation RedeemPoints($input: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount: $input) {
    codeDiscountNode { id }
    userErrors { field code message }
  }
}`;

export const DISCOUNT_BY_CODE_QUERY = `query RedeemLookup($code: String!) {
  codeDiscountNodeByCode(code: $code) { id }
}`;

/** DiscountCodeBasicInput (Admin API 2025-10): fixed amount, one use, only for this customer. */
export function buildDiscountInput(r: Redemption, code: string, customerGid: string, now: Date) {
  const endsAt = new Date(now.getTime() + r.valid_days * 86_400_000);
  return {
    title: `Supp City punten ${r.points} (${r.id.slice(0, 8)})`,
    code,
    startsAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    context: { customers: { add: [customerGid] } },
    customerGets: {
      value: { discountAmount: { amount: centsToDecimal(r.value_cents), appliesOnEachItem: false } },
      items: { all: true },
    },
    minimumRequirement:
      r.min_order_cents > 0
        ? { subtotal: { greaterThanOrEqualToSubtotal: centsToDecimal(r.min_order_cents) } }
        : undefined,
    usageLimit: 1,
    appliesOncePerCustomer: true,
    combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
  };
}

export interface UserError {
  field?: string[] | null;
  code?: string | null;
  message: string;
}

/** Shopify reports a duplicate code as code TAKEN (or a message saying so). */
export function isCodeTaken(errors: readonly UserError[]): boolean {
  return errors.some((e) => e.code === 'TAKEN' || /already (been )?taken|must be unique/i.test(e.message));
}
