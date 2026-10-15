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
| profiles | – | ✓ | `shopify_customer_id` (server-only), `adult_confirmed_at`, `pt_code`. |
| consents | – | ✓ | Append-only grant/revoke log; `current_consents` view. |
| points_ledger | – | ✓ | Append-only, service role writes; `points_balance` view. |
| stock_items | later local | ✓ | Supply counter → reorder reminders. |

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
CSV export of workouts+sets (Tracker builder), format compatible with Strong/Hevy column names where possible.
