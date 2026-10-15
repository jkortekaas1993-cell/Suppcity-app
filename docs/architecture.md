# Architecture

```
┌─────────────────────────── App (Expo / React Native) ───────────────────────────┐
│ app/ (expo-router)          src/features/*            src/ui (design system)    │
│   (tabs) Vandaag Trainen    tracker  shop  points       Screen Card Button ...  │
│          Shop Ik            account                                              │
│                    │                 │                                           │
│      src/lib/db (SQLite, source of truth)    src/lib/shopify    src/lib/supabase │
└────────────┬───────────────────────────────────────┬──────────────────┬──────────┘
             │ sync (custom → PowerSync)              │ Storefront API   │ auth/session
             ▼                                        ▼                  ▼
   Supabase (EU): Postgres + RLS            Shopify (suppcity.nl)   Edge Functions
   tracker tables, profiles, consents,      Storefront, Checkout    shopify-auth-exchange
   points_ledger, stock_items               Kit, Customer Account   delete-account, webhooks
```

## Data flows
- **Logging a set:** UI → `SetRepository` → SQLite (instant). Sync pushes later when online and logged in.
- **Login:** Customer Account API PKCE in app (`src/lib/shopify`) → access token → `signInWithShopifyToken()` (`src/lib/supabase/auth.ts`) → `shopify-auth-exchange` verifies with Shopify → Supabase session (SecureStore). Then the `AccountLifecycle.onSignedIn` hook (`src/integration/AppServices.tsx`) calls `SyncSource.claimAnonymousRows(userId)` and runs the first sync. Contracts live in ONE place: `src/lib/supabase/contracts.ts` (server copy `supabase/functions/_shared/contracts.ts`).
- **Sync:** `CustomSyncEngine` (`src/lib/db/sync`) over the tracker's `SyncSource` (SQLite) and the Supabase adapter. Runs on app start (if signed in), after login and after every finished workout. Cursors live in the local-only `app_state` table. `applyRemote` writes engine-merged rows verbatim and never bumps `updated_at`.
- **Workout → points:** `ActiveWorkoutProvider` calls `onWorkoutFinished(workoutId)` → the id is queued in `app_state` → sync → only after a successful sync `award_workout_points(workout_id)` (server decides 18+, weekly cap, once per workout). Failed sync/RPC keeps the id queued.
- **Order → points:** Shopify `orders/paid` webhook → Edge Function → `points_ledger` insert (service role). App only reads.
- **Delete account:** app → `delete-account` → `auth.users` delete → cascade over all public tables → `AccountLifecycle.onAccountDeleted` → `Repositories.wipeLocalData()` (all tracker tables + `app_state`, library re-seeded) → sign out of Shopify and Supabase.

## App shell wiring
`src/integration/` (architect-owned) is the only place that connects features: it registers `ConsentService` and `PtCodeService` (`src/lib/supabase`) plus the login/deletion lifecycle into the account feature, mounts `ActiveWorkoutProvider` with the points hook, and owns the sync engine. Route files compose cross-feature widgets: `app/(tabs)/vandaag.tsx` passes the shop's `ReorderCard` as the single smart card; `app/(tabs)/ik.tsx` passes the points `PointsPanel` into `IkScreen`.

## Boundaries
- Features talk to data through repository interfaces (`src/lib/db/repositories.ts`), never raw SQL in screens.
- Health/training data never leaves the tracker/sync path (hard rule 1): no analytics events with weights/reps, no Shopify metafields with training data.
