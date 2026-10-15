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
- **Login:** Customer Account API PKCE in app → access token → `shopify-auth-exchange` verifies with Shopify → Supabase session (SecureStore). Local anonymous rows are claimed via `SyncSource.claimAnonymousRows`.
- **Order → points:** Shopify `orders/paid` webhook → Edge Function → `points_ledger` insert (service role). App only reads.
- **Delete account:** app → `delete-account` → `auth.users` delete → cascade over all public tables; app wipes local DB.

## Boundaries
- Features talk to data through repository interfaces (`src/lib/db/repositories.ts`), never raw SQL in screens.
- Health/training data never leaves the tracker/sync path (hard rule 1): no analytics events with weights/reps, no Shopify metafields with training data.
