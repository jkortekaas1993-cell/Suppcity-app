/** Pinned external API versions (hard rule 7). Bump deliberately, once per quarter, in a dedicated PR. */
export const SHOPIFY_STOREFRONT_API_VERSION = '2026-10';
export const SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION = '2026-10';

/** Points rules (hard rule 5). Server is authoritative; these mirror it for UI only. */
export const POINTS = {
  perEuroSpent: 1,
  perWorkout: 10,
  maxWorkoutsRewardedPerWeek: 3,
  minimumAge: 18,
} as const;

/** Data retention (hard rule 9), in days. Mirrored in docs/data-model.md. */
export const RETENTION_DAYS = {
  softDeletedRows: 30,
  consentLog: 365 * 5,
  inactiveAccount: 365 * 2,
} as const;
