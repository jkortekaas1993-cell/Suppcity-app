# Architecture decisions

Short ADRs. Add a new one at the bottom; do not rewrite old ones (mark them "Superseded by ADR-N").

## ADR-1: React Native + Expo (managed, dev builds)
- **Context:** iOS + Android from one team of AI builders; native-feeling tracker required (hard rule 8).
- **Decision:** Expo SDK 54, TypeScript strict, expo-router; config plugins instead of committed `ios/`/`android/`.
- **Consequences:** Fast iteration and OTA updates; Checkout Kit and OAuth need dev builds, not Expo Go.

## ADR-2: Shopify Storefront API + Checkout Kit
- **Decision:** Catalogue/carts via Storefront API (public token); payment via `@shopify/checkout-sheet-kit` (Shopify's native checkout sheet).
- **Why:** Shopify keeps payments, discounts and taxes correct; no PCI scope in the app; same checkout as suppcity.nl.

## ADR-3: Shopify Customer Account API for login (OAuth PKCE)
- **Decision:** One Supp City account for web and app. The app does PKCE; the Edge Function `shopify-auth-exchange` verifies the token server-side and issues a Supabase session.
- **Why:** No second password; the user's identity is linked to their orders for reordering and points. The client is never trusted with the customer id (hard rule 6).

## ADR-4: Supabase (EU region) for app data
- **Decision:** Postgres + RLS on every table + Edge Functions (Deno), hosted in the EU.
- **Why:** GDPR (Art. 9 risk for training/health data), RLS as defence in depth, SQL for points/reports.

## ADR-5: Local SQLite as source of truth, sync later
- **Decision:** `expo-sqlite` holds all tracker data; client UUIDs, `updated_at`, soft deletes. Phase 1 custom push/pull sync via `SyncSource`; phase 2 PowerSync.
- **Why:** Gyms have poor signal; logging a set must never wait for the network. Training works without an account.

## ADR-6: Points ledger is server-authoritative
- **Decision:** `points_ledger` is append-only and written only by the service role (order webhooks, workout rewards). A trigger enforces 18+ and the weekly workout cap.
- **Why:** Hard rule 5; prevents client tampering; idempotent via `(user_id, reason, reference)` unique key.

## ADR-7: Claims as code
- **Decision:** Product/health claims come only from `src/content/claims.ts` (verbatim EU-register wording, owner-approved).
- **Why:** NVWA/EU 1924/2006 compliance (hard rule 4). No generated copy.

## ADR-8: Own design system, no UI kit
- **Decision:** `src/ui` with tokens (dark + light, one turquoise accent from the logo), heavy uppercase headings, tabular numbers.
- **Why:** Distinctive brand look; fewer dependencies to keep pinned.

## ADR-9: Expo Notifications
- **Decision:** `expo-notifications` for rest-timer (local) and stock reminders (local/remote). Ask permission only after the first finished workout; max 1 promotional push per week.

## ADR-10: One pinned Shopify API version for all Shopify APIs
- **Decision:** `SHOPIFY_API_VERSION = '2026-10'` in `src/lib/config/constants.ts` is used for Storefront, Customer Account AND Admin (Edge Functions mirror it in `supabase/functions/_shared/config.ts`; a test asserts equality). Bumped once per quarter in a dedicated PR.
- **Why:** On 2026-10-15 shopify.dev lists 2026-01, 2026-04, 2026-07 and 2026-10 as supported stable versions; 2026-10 is "Latest stable", accessible until 2027-10-16 15:00 UTC (shopify.dev/changelog/release-notes/2026-10). 2025-10 is out of the supported window (stable versions get ~12 months; 2025-04 ended 2026-04-16). One value avoids drift between app and server.

## ADR-11: App-shell integration layer
- **Decision:** `src/integration/` wires features together (account services, sync engine, workout points). Features expose slots/hooks (`registerAccountServices`, `ActiveWorkoutProvider.onWorkoutFinished`, `VandaagScreen.smartCard`, `IkScreen.pointsSlot`) instead of importing each other.
- **Why:** Keeps the "features only via index.ts" rule and lets each builder own their folder.

## ADR-12: PT code is a plain profile field (for now)
- **Decision:** `profiles.pt_code` is set by the user on their own row (RLS), format-checked in app and DB. No trainer registry yet, so every well-formed code is accepted. Sharing data with a PT needs the separate `pt_share` consent.
- **Why:** Minimal, safe MVP; a `trainers` table + server validation can replace it without changing the app contract (`PtCodeService`).
