# Supabase backend (Backend&Sync)

EU project. Postgres + RLS on every table, four Edge Functions (Deno), one pg_cron job.

## Contents

| Path | What |
|---|---|
| `migrations/0001_init.sql` | Base schema (architect) |
| `migrations/0002_sync.sql` | `server_updated_at` pull cursor + LWW trigger `sync_row_write` |
| `migrations/0003_accounts_points.sql` | Shopify linking, `delete_account`, points rules, redeem tiers/redemptions, GDPR helpers |
| `migrations/0004_consents_retention.sql` | `set_consent` RPC, `run_retention` + pg_cron |
| `migrations/0005_pt_code.sql` | PT code format check |
| `migrations/0006_hardening.sql` | `confirm_adult()` RPC + protected `adult_confirmed_at`/`deleted_at`, `updated_at` cap (now + 5 min), `redeem_expire_stale()` + pg_cron (every 15 min), consent source `app` only, pinned `search_path` |
| `functions/shopify-auth-exchange` | Shopify Customer Account token → Supabase session |
| `functions/delete-account` | Deletes the caller's account (hard rule 3) |
| `functions/shopify-webhooks` | `orders/paid` points + mandatory GDPR webhooks |
| `functions/redeem-points` | Points → one-time Shopify discount code |
| `functions/_shared` | Pure, tested modules (HMAC, points rule, contracts, …) |
| `tests/` | SQL tests on a throwaway local Postgres; `functions/_tests` Deno tests |

## Deploy

```bash
supabase link --project-ref <ref>            # EU region project
supabase db push                             # applies migrations 0002..0004
supabase secrets set --env-file ./secrets.env  # see list below (file NOT in git)
supabase functions deploy shopify-auth-exchange --no-verify-jwt
supabase functions deploy shopify-webhooks --no-verify-jwt
supabase functions deploy delete-account
supabase functions deploy redeem-points
```

Then in the dashboard:
1. **Database → Extensions:** check `pg_cron` is enabled; `select * from cron.job` shows `suppcity-retention` (03:17 UTC daily). If 0004 ran before pg_cron was enabled: `select cron.schedule('suppcity-retention', '17 3 * * *', 'select public.run_retention()');`. Same for 0006: `select cron.schedule('suppcity-redeem-sweep', '*/15 * * * *', 'select public.redeem_expire_stale()');`
2. **Authentication → Providers → Email:** sign-ups OFF (users are only created server-side). Leave the Email provider itself enabled (session minting uses it internally; no mail is sent).
3. **Authentication → Rate limits:** keep defaults; `shopify-auth-exchange` calls `generateLink` once per login.

### Secrets (`supabase secrets set`, never in the app)

| Name | Used by | Value |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | all | set automatically by Supabase |
| `SHOPIFY_STOREFRONT_DOMAIN` | auth-exchange | storefront domain, e.g. `suppcity.nl` |
| `SHOPIFY_CUSTOMER_API_URL` | auth-exchange | optional override; default `https://<storefront>/customer/api/2026-10/graphql` (check against `https://<storefront>/.well-known/customer-account-api`) |
| `SHOPIFY_SHOP_DOMAIN` | webhooks, redeem | `<shop>.myshopify.com` |
| `SHOPIFY_WEBHOOK_SECRET` | webhooks | client secret of the Shopify app that owns the webhook subscriptions |
| `SHOPIFY_WEBHOOK_SECRET_PREVIOUS` | webhooks | only during secret rotation, then remove |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | redeem | Admin API access token of that app |
| `REDEEM_CODE_SECRET` | redeem | random 32+ chars; derives discount codes (never change after go-live) |

## What the shop owner sets up in Shopify

1. **Customer accounts** (new): Settings → Customer accounts → "Customer accounts". Headless/Hydrogen channel → Customer Account API → **public client** (mobile, PKCE), callback URI of the app (Shop&Login). Protected customer data access: only `customer` id is read server-side.
2. **Custom app** (Dev Dashboard / Settings → Apps → Develop apps), Admin API version **2026-10**, scopes:
   - `write_discounts` (+ implied `read_discounts`) – create redemption codes
   - `read_orders` – needed for the `orders/paid` webhook
   - `read_customers` – customer id in order payloads
3. **Webhook subscriptions** of that app, all to `https://<ref>.supabase.co/functions/v1/shopify-webhooks`, format JSON, API version 2026-10:
   - `orders/paid`
   - compliance: `customers/data_request`, `customers/redact`, `shop/redact` (Partner/Dev Dashboard → app → Compliance webhooks)
4. Put the app's **client secret** in `SHOPIFY_WEBHOOK_SECRET` and the **Admin API token** in `SHOPIFY_ADMIN_ACCESS_TOKEN`.

## Auth linking (shopify-auth-exchange)

1. App does the Customer Account PKCE login (Shop&Login) and POSTs `{ shopifyAccessToken }`.
2. The function calls the Customer Account API **with that token** (`query { customer { id } }`). Only Shopify's answer is trusted; a customer id in the request is ignored (hard rule 6). 401 from Shopify → `shopify_token_invalid`.
3. Find the user by `profiles.shopify_customer_id`, else create an auth user with a **synthetic, undeliverable e-mail** `shopify-<id>@auth.suppcity.nl` (no real e-mail stored in Supabase; Shopify stays the source of contact data) and a random password that is never stored. `link_shopify_customer` writes the link (service role only).
4. Session: `auth.admin.generateLink({ type: 'magiclink' })` returns a hashed token **without sending mail**; `auth.verifyOtp({ token_hash, type: 'magiclink' })` turns it into a normal GoTrue session (access + refresh token).

Why this method: a standard Supabase session (refresh, revocation, `auth.uid()` in RLS all work out of the box), uses only documented admin APIs, and the JWT secret never leaves Supabase. Alternatives rejected: signing our own JWTs (needs the JWT secret in the function, no refresh/revocation), storing a password per user (secret at rest), Supabase third-party auth (Shopify Customer Account tokens are opaque, not OIDC JWTs Supabase can verify).

## Points rules (hard rule 5, server-enforced)

- **Orders:** `floor(current_subtotal_price in EUR) × 1`. Shopify's subtotal is *after discounts, before shipping, duties, taxes and tips*; shop prices include BTW, so the subtotal includes VAT. Excluded: shipping, gift-card line items, test orders, non-EUR orders, guest checkouts and users without 18+ confirmation (no retroactive points). Idempotent on the order gid. Refunds are **not** deducted yet (open point).
- **Workouts:** RPC `award_workout_points(workout_id)`: 10 points, max **3 per ISO week** (Europe/Amsterdam), 18+ only, own workout, `source = 'app'`, finished, ≥ 10 minutes, started within 8 days. Uses only the workout's start/end time – never sets, weights or Health data (hard rule 1). The cap is also enforced by the ledger trigger (advisory lock), so it cannot be raced.
- **Ledger:** append-only, also for the service role (except redacting order refs on `shop/redact` and cascade on account deletion). Sign checked per reason.
- **Redeem tiers** (`points_redeem_tiers`, change by inserting a new row and setting `active = false` on the old one): 500 pt → €5 (min €25), 1000 pt → €12.50 (min €40), 2000 pt → €30 (min €60); 90 days valid; one use; only for that customer; combines with shipping discounts only. Flow: reserve (atomic debit) → Shopify `discountCodeBasicCreate` with a code derived from the redemption id → issued. Shopify down → stays `pending`, the client retries with the same `redemptionId` (no double debit, no second code). Definitive Shopify error → `failed` + one refund.

## GDPR webhooks

| Topic | Action |
|---|---|
| `customers/data_request` | Logged in `shopify_privacy_requests` (status `received`/`no_data`). **Owner action within 30 days:** `select public.export_customer_data('gid://shopify/Customer/<id>');` and send the JSON to the shop owner/customer. Then set `status = 'completed'`. |
| `customers/redact` | Deletes the linked app account (same path as in-app deletion), logs anonymously. |
| `shop/redact` | Removes all Shopify customer ids and order references; app accounts and training data stay (they belong to the app users). |

Invalid HMAC → `401` (Shopify requirement). Handled requests → `200`; DB errors → `500` so Shopify retries.

## Retention (hard rule 9, `run_retention()`, daily)

Soft-deleted rows 30 days · consent log 5 years (current state per type always kept) · inactive 2 years: notice row in `retention_notices` 30 days before deletion (**open:** mailer for the notice), sign-in cancels · anonymous deletion log 5 years.

## Tests

```bash
supabase/tests/run.sh          # needs Postgres 16 binaries + psql; no Docker
deno test supabase/functions/_tests
```
`run.sh` starts a throwaway cluster, loads `tests/supabase_mock.sql` (minimal `auth` schema + roles), applies all migrations and runs every `tests/*.test.sql` on a fresh database.
