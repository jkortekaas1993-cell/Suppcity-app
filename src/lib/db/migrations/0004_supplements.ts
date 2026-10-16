import type { Migration } from '../schema';

/**
 * Local migration 4: supplement schedule (release 2a, owner: Supplements builder).
 *
 * LOCAL ONLY. Supplement intakes count as health data (hard rule 1): these tables
 * are not in TRACKER_TABLES, are never synced and never leave the device, except
 * as the user's own CSV export (hard rule 9).
 *
 * INTEGRATION: append `supplementsMigration` to `migrations` in ../schema.ts right
 * after migration 3 (versions must stay 1, 2, 3, 4, ...). It is kept in its own file
 * so the branch stays green while migration 3 lands on another branch.
 *
 * - `units_*` count servings ("porties") as the user typed them; one intake = one unit.
 * - `days_mask`: bit 0 = Monday ... bit 6 = Sunday (ISO weekday - 1). It always holds
 *   the weekdays on which the schedule fires; for mode 'training'/'rest' the app
 *   derives it from the user's own training days.
 * - `time_local` is the user's local wall-clock time 'HH:MM'.
 * - `scheduled_for` is the local planned moment 'YYYY-MM-DDTHH:MM' (no zone).
 */
export const supplementsMigration: Migration = {
  version: 4,
  name: 'local_supplements',
  sql: `
CREATE TABLE IF NOT EXISTS supplements (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  shopify_variant_gid TEXT,
  dose_text TEXT NOT NULL DEFAULT '',
  units_per_pack INTEGER CHECK (units_per_pack IS NULL OR units_per_pack > 0),
  units_left INTEGER CHECK (units_left IS NULL OR units_left >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS supplement_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  supplement_id TEXT NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  days_mask INTEGER NOT NULL CHECK (days_mask >= 0 AND days_mask <= 127),
  mode TEXT NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed','training','rest')),
  time_local TEXT NOT NULL CHECK (length(time_local) = 5 AND substr(time_local, 3, 1) = ':'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS supplement_schedules_supplement_idx ON supplement_schedules(supplement_id);

CREATE TABLE IF NOT EXISTS supplement_intakes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  supplement_id TEXT NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  schedule_id TEXT REFERENCES supplement_schedules(id) ON DELETE SET NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('taken','skipped')),
  taken_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS supplement_intakes_slot_uq ON supplement_intakes(supplement_id, scheduled_for);
CREATE INDEX IF NOT EXISTS supplement_intakes_scheduled_idx ON supplement_intakes(scheduled_for);
`,
};

/** Local-only supplement tables, children first (wipe order). Never synced. */
export const SUPPLEMENT_TABLES = ['supplement_intakes', 'supplement_schedules', 'supplements'] as const;
