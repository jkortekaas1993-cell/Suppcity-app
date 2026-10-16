# Supp City app: guide for agents and developers

A free workout tracker with the Supp City shop built in (suppcity.nl, Shopify).
The UI is in **Dutch**. Code, comments, commit messages and docs are in **English**.

## Architecture in one minute

- **App:** React Native + Expo SDK 54, TypeScript strict, expo-router (file-based routes in `app/`).
- **Tabs:** `Vandaag`, `Trainen` (100% free of ads and the shop), `Shop`, `Ik`. `ActiveWorkoutBar` sits above the tab bar on every tab while a workout is running.
- **Offline first:** local SQLite (`expo-sqlite`) is the source of truth for tracker data. Every row has a client UUID, `created_at`, `updated_at` and `deleted_at`. Supabase (EU) is the sync target. A custom sync layer comes first, then PowerSync.
- **Shop:** Shopify Storefront API (public token) for the catalogue and carts, and `@shopify/checkout-sheet-kit` for checkout.
- **Login:** Shopify Customer Account API (OAuth PKCE). The Edge Function `shopify-auth-exchange` checks the Shopify token **server-side** and returns a Supabase session.
- **Backend:** Supabase Postgres with RLS on every table, plus Edge Functions (Deno) for the auth exchange, deleting accounts, points webhooks and push.

More detail is in `docs/architecture.md`, `docs/data-model.md` and `docs/decisions.md`.

## Folders and ownership

Three builders work in parallel. **Only touch files you own.** If a change is needed in a shared file, make a small, separate PR and say so in the description.

| Path | Owner |
|---|---|
| `app/(tabs)/shop.tsx`, `app/(tabs)/ik.tsx`, new routes under `app/shop/**`, `app/account/**`, `app/auth/**` | Shop&Login |
| `src/features/shop/**`, `src/features/account/**` (UI side) | Shop&Login |
| `src/lib/shopify/**` | Shop&Login |
| `src/content/claims.ts` | Shop&Login (**every change needs owner review**) |
| `app/(tabs)/vandaag.tsx`, `app/(tabs)/trainen.tsx`, new routes under `app/workout/**`, `app/exercise/**`, `app/routine/**` | Tracker |
| `src/features/tracker/**` | Tracker |
| `src/lib/db/**` except `src/lib/db/sync/**` (repository implementations, new **appended** migrations in `schema.ts`) | Tracker |
| `src/content/exercises.nl.ts`, `src/content/programs.ts` | Tracker |
| `supabase/**` (migrations, functions, config) | Backend&Sync |
| `src/lib/supabase/**`, `src/lib/db/sync/**` (new) | Backend&Sync |
| `src/features/points/**` | Backend&Sync |
| `src/ui/**`, `src/integration/**`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/index.tsx`, `src/lib/config/**`, `package.json`, `tsconfig.json`, `eslint.config.js`, `app.json`, `app.config.ts`, `.github/**`, `CLAUDE.md`, `docs/**` | **Architect / shared** (small PRs only) |

Rules for working across features:
- Features import each other **only through their `index.ts`** (`@/features/shop`). ESLint enforces this.
- Cross-feature wiring lives in `src/integration/` (sync engine, account services, workout points) and in route files: `Vandaag` shows exactly **one** smart card in the tracker's slot (`ReorderCard` from shop); `Ik` receives `PointsPanel` from points.
- App ↔ Edge Function contracts have one source of truth: `src/lib/supabase/contracts.ts` (server copy `supabase/functions/_shared/contracts.ts`). Do not redefine them in features.
- If a local table changes, the matching Supabase table must change too. The Tracker builder writes the SQLite migration; the Backend&Sync builder writes the matching `supabase/migrations/000N_*.sql`. Agree on this in both PR descriptions.

## Conventions

- Import alias `@/` → `src/`. Use named exports, except for route files in `app/`, which need a default export.
- Read colours, spacing and type from `src/ui` (`useTheme`, `Text`, `Button`, `Card`, `ListItem`, `Screen`). Do not hard-code colours. Each screen gets at most one accent action.
- Keep weights in kg internally. Show numbers with tabular figures. Touch targets are at least 48 pt.
- Validate everything external (Shopify, Supabase, CSV) with `zod` at the boundary.
- Migrations are **append-only**. Never change a migration that has shipped.
- Commits follow Conventional Commits (`feat(tracker): ...`, `fix(shop): ...`). Each PR covers one feature and runs CI green.
- Never put secrets in the app. `EXPO_PUBLIC_*` holds public values only. Server secrets go in `supabase secrets`.

## The nine hard rules

1. **Body and Health data are never used for marketing, points or segmentation.** That covers weights, sets, body weight and HealthKit/Health Connect. It does not flow to Shopify, Metricool or MyChatBot.
2. **Each consent is separate, can be withdrawn, and is logged with a timestamp.** The `consents` table is append-only. The current state comes from `current_consents`.
3. **Account deletion happens in the app** (Ik → Account verwijderen → Edge Function `delete-account`, with cascade).
4. **Only fixed, approved claim sentences** from `src/content/claims.ts`, via `getApprovedClaim()`. Never generate, paraphrase or combine product or health claims.
5. **Points:** per euro plus at most 3 rewarded workouts per ISO week. No chance mechanics (no spin, no shake-and-win). 18+ only. The server enforces this (trigger on `points_ledger`).
6. **Shopify tokens are verified server-side only.** RLS is on for **every** table, with policy `user_id = auth.uid()`. The client never writes `shopify_customer_id` or points.
7. **Versions are pinned.** Exact dependency versions via `npx expo install`, ONE Shopify API version (`SHOPIFY_API_VERSION`) in `src/lib/config/constants.ts` for Storefront, Customer Account and Admin, and updates once per quarter in a separate PR.
8. **The tracker is native** (React Native screens). No webviews for training.
9. **CSV export and retention periods.** The user can export all training data as CSV. Retention periods are in `RETENTION_DAYS` and `docs/data-model.md`.

## Version policy

- Expo SDK 54 (React Native 0.81, React 19.1). Add packages with `npx expo install <pkg>` so the version fits the SDK. Run `npm run deps:check` before every release.
- Shopify Storefront, Customer Account and Admin API: `2026-10` (`SHOPIFY_API_VERSION` in `constants.ts`; Edge Function mirror in `supabase/functions/_shared/config.ts`, a test keeps them equal). Latest stable on 2026-10-15, supported until 2027-10-16. Check once per quarter (ADR-10).
- Consent texts: `POLICY_VERSION` in `constants.ts`; bump it when consent copy or the privacy policy changes.
- Exact versions only in `package.json` (no `^`/`~`; `.npmrc` has `save-exact=true`, CI checks it).
- `package-lock.json` is committed and CI runs `npm ci`. After changing dependencies, regenerate it: delete the lockfile on a branch, push, and CI (on `main` only) publishes a fresh one to the `ci/lockfile` branch; fetch it, commit it, and delete that branch.
- CI surfaces npm, ESLint and Jest failures as check-run annotations, so they are readable through the GitHub API without log access.

## Running the app

```bash
cp .env.example .env        # fill in public tokens
npm install
npx expo start              # Expo Go / dev build; press i (iOS) or a (Android)
npm run typecheck && npm run lint && npm test
```

`app.config.ts` adds the Customer Account callback scheme `shop.<EXPO_PUBLIC_SHOPIFY_SHOP_ID>.app` to `app.json`'s `suppcity` scheme, so set that env var for dev builds and in EAS.

Checkout Kit and the Customer Account login need a **development build** (`npx expo run:ios` / `run:android` or EAS). Expo Go is enough for UI and tracker work.

Supabase locally: `supabase start`, then `supabase db reset` runs `supabase/migrations`. SQL tests without Docker: `supabase/tests/run.sh` (needs Postgres 16 binaries).
