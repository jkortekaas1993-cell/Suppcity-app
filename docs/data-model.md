# Data model

Local: `src/lib/db/schema.ts` (SQLite). Server: `supabase/migrations/*.sql` (Postgres).

## Shared conventions
| Column | Meaning |
|---|---|
| `id` | Client UUID v4 (built-in exercises: their slug). Primary key everywhere. |
| `user_id` | Owner. Nullable locally (anonymous use), `not null default auth.uid()` on server. |
| `created_at`, `updated_at` | UTC. `updated_at` bumped on every write (trigger on server). Sync cursor. |
| `deleted_at` | Soft delete; synced, then purged after retention. |

## Tables
| Table | Local | Server | Notes |
|---|---|---|---|
| exercises | ✓ | ✓ (custom only) | Built-in library ships in `src/content/exercises.nl.ts`. |
| routines | ✓ | ✓ | `program_slug` if created from `programs.ts`. |
| routine_exercises | ✓ | ✓ | Ordered by `position`; targets + rest time. |
| workouts | ✓ | ✓ | `source`: app / import_hevy / import_strong. |
| sets | ✓ | ✓ | `weight_kg`, `reps`, `rpe`, `set_type`. |
| profiles | – | ✓ | `shopify_customer_id` (server-only), `adult_confirmed_at`, `pt_code` (client-set, format `^[A-Z0-9]{4,12}$`, CHECK in 0005). |
| consents | – | ✓ | Append-only grant/revoke log via RPC `set_consent(type, granted, policy_version)`; `policy_version` = `POLICY_VERSION` in `src/lib/config/constants.ts`; `current_consents` view. |
| points_ledger | – | ✓ | Append-only, service role writes; `points_balance` view. |
| stock_items | later local | ✓ | Supply counter → reorder reminders (currently device-local KV in the shop feature). |
| app_state | ✓ (local only) | – | Active-workout snapshot, rest prefs, sync cursors (`sync:<user>:<push|pull>:<table>`), queued workout-point claims, `tracker.weeklyGoal`, `supplements.*` settings (below). Never synced; wiped on sign-out (except `supplements.*`, ADR-15) and on account deletion. |
| user_badges | ✓ (local only, migration 3) | – | Milestones (Mijlpalen): `badge_id`, `earned_at`, `source_ref`; one live row per badge (partial unique index). Derived from training data, so never used for points, discounts, marketing or segmentation (hard rules 1 and 5). Not in `TRACKER_TABLES`; wiped with tracker data. |
| app_state `tracker.weeklyGoal` | ✓ (local only) | – | Weekly training goal (3–7) for the weekly segments on Vandaag. No daily streak. |
| supplements | ✓ (local only, migration 4) | – | User's own supplement: `name`, `dose_text` (user's text, shown as-is), optional `shopify_variant_gid` (for reorder), stock `units_per_pack` / `units_left` (servings). |
| supplement_schedules | ✓ (local only, migration 4) | – | `days_mask` (bit 0 = Monday), `mode` fixed / training / rest, `time_local` `HH:MM`. |
| supplement_intakes | ✓ (local only, migration 4) | – | Tick-off log: `scheduled_for` (local `YYYY-MM-DDTHH:MM`), `status` taken / skipped, `taken_at`. Health data (hard rule 1): never synced, never leaves the device except in the user's own CSV export. |
| app_state `supplements.reminders` | ✓ (local only) | – | Separate, withdrawable choice for supplement reminders: `{ enabled, decidedAt }` (timestamped). Withdrawing cancels all pending reminders. A local **setting** (the current state, overwritten on change), not a consent log: it is not a consent under hard rule 2 (no data leaves the device), so it is not kept as an append-only history. Also `supplements.lastPlan` (count of scheduled/dropped reminders) and `supplements.trainingDays`. Stored per owner: `supplements.<key>` signed out, `supplements.<key>@<userId>` signed in (ADR-15). |

The supplement tables are not in `TRACKER_TABLES` and have no Supabase counterpart. The only thing that leaves the supplements feature is `getSupplementStockForReorder()` → the shop's ReorderCard on Vandaag: variant gid, the user's name for it and days left, nothing about intakes or times. Supplement rows are owner-scoped (ADR-15): `user_id` is the signed-in user or NULL (signed out), queries only see `user_id IS NULL OR user_id = <current user>`, and anonymous rows are claimed at sign-in. Sign-out keeps them (hidden) and switches the reminders; only account deletion runs `wipeSupplementsLocal()`, which deletes the three tables, all `supplements.*` settings and every scheduled reminder (`wipeAllLocalData` in `src/integration`).

## RLS
Enabled on every table. Owner policies use `user_id = (select auth.uid())`. `consents` is insert+select only, `points_ledger` select only, `profiles` select+update (no client insert; `shopify_customer_id` protected by trigger). `anon` has no table access.

## Retention (hard rule 9; values in `RETENTION_DAYS`)
| Data | Retention |
|---|---|
| Soft-deleted rows | 30 days, then hard delete (scheduled function) |
| Consent log | 5 years (proof of consent) |
| Inactive account (no login) | 2 years → notice email → delete |
| Deleted account | Immediate cascade delete; backups roll off within Supabase's backup window |

## Export
CSV export of workouts+sets (Tracker builder, `Trainen → Data` and `Ik → Data exporteren`), Hevy-compatible columns. The same Data screen exports the supplement schedule (`suppcity-supplementen.csv`) and the intake log (`suppcity-supplement-innames.csv`) via `exportSupplementsCsv()`. Exported as a real `.csv` file via expo-file-system + expo-sharing; import from a picked file (expo-document-picker) or pasted text.
