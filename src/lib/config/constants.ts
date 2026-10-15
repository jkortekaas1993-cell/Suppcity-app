/**
 * Pinned Shopify API version (hard rule 7) for EVERY Shopify API we call:
 * Storefront, Customer Account and Admin (Edge Functions). One value, bumped
 * deliberately once per quarter in a dedicated PR.
 *
 * 2026-10 = latest stable on 2026-10-15, accessible until 2027-10-16 15:00 UTC
 * (shopify.dev/changelog/release-notes/2026-10). shopify.dev/docs/api/usage/versioning
 * lists 2026-01, 2026-04, 2026-07 and 2026-10 as the supported stable versions;
 * 2025-10 is no longer listed (access ends ~2026-10-16, like 2025-04 ended 2026-04-16).
 * Server mirror: supabase/functions/_shared/config.ts (a test asserts equality).
 */
export const SHOPIFY_API_VERSION = '2026-10';
export const SHOPIFY_STOREFRONT_API_VERSION = SHOPIFY_API_VERSION;
export const SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION = SHOPIFY_API_VERSION;

/**
 * Version of the privacy policy / consent texts the user agreed to. Sent with every
 * consent grant/revoke (`set_consent` RPC, hard rule 2). Bump when the consent copy
 * in src/features/account/consentCopy.ts or the privacy policy changes.
 */
export const POLICY_VERSION = '2026-10-15';

/**
 * Feature flags for things that are not built yet. A consent toggle may only be shown
 * for a processing that actually exists (compliance C2).
 */
export const FEATURES = {
  /** Apple Health / Health Connect integration. Off until it ships. */
  healthSync: false,
} as const;

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
