// Server-side constants for Edge Functions. Pure module (no Deno globals).
// Versions mirror src/lib/config/constants.ts (hard rule 7); a test asserts they match.

export const SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION = '2025-10';
export const SHOPIFY_ADMIN_API_VERSION = '2025-10';

/** Points per whole euro of the order subtotal after discounts, excl. shipping. */
export const POINTS_PER_EURO = 1;
/** Only orders in this shop currency earn points. */
export const POINTS_CURRENCY = 'EUR';

/** Prefix of discount codes issued for points. */
export const REDEEM_CODE_PREFIX = 'SC';
