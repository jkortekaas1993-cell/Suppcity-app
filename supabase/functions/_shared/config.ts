// Server-side constants for Edge Functions. Pure module (no Deno globals).
// The version mirrors SHOPIFY_API_VERSION in src/lib/config/constants.ts (hard rule 7);
// _tests/pure.test.ts asserts they are identical. Edge Functions are bundled from
// supabase/functions only, so the value is mirrored rather than imported.

export const SHOPIFY_API_VERSION = '2026-10';
export const SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION = SHOPIFY_API_VERSION;
export const SHOPIFY_ADMIN_API_VERSION = SHOPIFY_API_VERSION;

/** Points per whole euro of the order subtotal after discounts, excl. shipping. */
export const POINTS_PER_EURO = 1;
/** Only orders in this shop currency earn points. */
export const POINTS_CURRENCY = 'EUR';

/** Prefix of discount codes issued for points. */
export const REDEEM_CODE_PREFIX = 'SC';
