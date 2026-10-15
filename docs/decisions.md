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
