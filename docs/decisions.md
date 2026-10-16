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
- **Implementation (C3):** the summary of the first finished workout shows `NotificationOptInCard` with separate choices (Rusttimer, Bestelstatus, Aanvullen, Acties; Acties default off, max 1 per week via `canSendPromotion`). Only "Opslaan" calls `requestPermissionsAsync`. Choices live in local `app_state` (`notifications.prefs`). A foreground handler (`setNotificationHandler`) shows the rest-timer notification while the app is open. Marketing push additionally requires the server-side `marketing_push` consent; no promotional push is sent on the local choice alone.

## ADR-10: One pinned Shopify API version for all Shopify APIs
- **Decision:** `SHOPIFY_API_VERSION = '2026-10'` in `src/lib/config/constants.ts` is used for Storefront, Customer Account AND Admin (Edge Functions mirror it in `supabase/functions/_shared/config.ts`; a test asserts equality). Bumped once per quarter in a dedicated PR.
- **Why:** On 2026-10-15 shopify.dev lists 2026-01, 2026-04, 2026-07 and 2026-10 as supported stable versions; 2026-10 is "Latest stable", accessible until 2027-10-16 15:00 UTC (shopify.dev/changelog/release-notes/2026-10). 2025-10 is out of the supported window (stable versions get ~12 months; 2025-04 ended 2026-04-16). One value avoids drift between app and server.

## ADR-11: App-shell integration layer
- **Decision:** `src/integration/` wires features together (account services, sync engine, workout points). Features expose slots/hooks (`registerAccountServices`, `ActiveWorkoutProvider.onWorkoutFinished`, `VandaagScreen.smartCard`, `IkScreen.pointsSlot`) instead of importing each other.
- **Why:** Keeps the "features only via index.ts" rule and lets each builder own their folder.

## ADR-12: PT code is a plain profile field (for now)
- **Decision:** `profiles.pt_code` is set by the user on their own row (RLS), format-checked in app and DB. No trainer registry yet, so every well-formed code is accepted. Sharing data with a PT needs the separate `pt_share` consent.
- **Why:** Minimal, safe MVP; a `trainers` table + server validation can replace it without changing the app contract (`PtCodeService`).

## ADR-13: No Shopify product description in the app
- **Decision:** The product screen does not render the Shopify `description` (free text). It shows only product name, variant, price, contents (variant options such as "Inhoud"), approved claims via `approvedClaimsFor()` / `getApprovedClaim()`, and a quiet link "Volledige productinformatie op suppcity.nl" that opens the external browser (`productPageUrl`, https + suppcity.nl only). Collection descriptions are shown as written by the shop owner for categories, not products.
- **Why:** Compliance review C1. Webshop copy is written for the site and can contain health claims that are not in `src/content/claims.ts`; showing it in the app would break hard rule 4 (only fixed, approved claim sentences). Filtering free text reliably is not possible, so the app does not show it at all. Full legal product information (ingredients, warnings) stays on one place: suppcity.nl.

## ADR-14: Points redemption tiers approved by the owner
- **Decision:** The redemption tiers in `0003_accounts_points.sql` are approved by the shop owner (2026-10-16): 500 points = €5 (min. order €25), 1000 points = €12,50 (min. order €40), 2000 points = €30 (min. order €60).
- **Why:** Owner sign-off on the proposal from sprint 1. Later changes go via a new tier row and deactivating the old one, never by editing history.

## ADR-15: Supplements stay on the device at sign-out, scoped by owner
- **Decision:** Signing out wipes tracker data (it is in the account and returns with the next sync) but NOT the local-only supplement tables and `supplements.*` settings. Every supplement row carries `user_id` (the signed-in user, or NULL when made while signed out) and every supplement query only sees rows with `user_id IS NULL OR user_id = <current user>`; settings are stored per owner (`supplements.<key>` signed out, `supplements.<key>@<userId>` signed in). At sign-in, anonymous rows and settings are claimed by the account (an existing account setting wins). Sign-out cancels the account's supplement reminders and plans the signed-out owner's. Only account deletion wipes all supplement data (`wipeSupplementsLocal`). The sign-out dialog says so.
- **Why:** Review H1 (release 2a). Supplements are never synced (hard rule 1), so wiping them at sign-out destroyed data the user could not get back. Owner scoping keeps the original guarantee: the next person on the same phone sees nothing of the previous account. The alternative (wipe at sign-out after offering a CSV export) was rejected because it still loses data for people who sign out by habit.

## ADR-16: One SQLite connection, exclusive and queued write transactions
- **Decision:** All app code uses the connection opened by `<DatabaseProvider>` (`useDatabase()` in React, `getSharedDatabase()` outside React); no feature opens its own connection. Atomic writes use expo-sqlite 16 `withExclusiveTransactionAsync` through `SqlDb.withExclusiveTransactionAsync(task(tx))`: every query of the task goes through `tx`, transactions on the file run one at a time (FIFO queue, `src/lib/db/txQueue.ts`), a nested transaction throws, and connections use `PRAGMA busy_timeout = 5000`.
- **Why:** Review M (release 2a). With `withTransactionAsync` on a shared connection, unrelated queries end up inside (and are rolled back with) someone else's transaction, and two flows writing at once (badge sync after a workout, supplements, sync engine, CSV import) fail with "cannot start a transaction within a transaction". An exclusive transaction runs on its own connection; queueing avoids SQLITE_BUSY between two of them. Note: that connection does not enable `foreign_keys` (the pragma is a no-op inside a transaction); no transaction relies on cascades (wipes delete children first, deletes are soft).
