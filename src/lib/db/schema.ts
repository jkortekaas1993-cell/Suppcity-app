/**
 * Local SQLite schema: the offline source of truth for tracker data.
 *
 * Conventions (mirror supabase/migrations/0001_init.sql):
 * - `id` is a client-generated UUID v4 (TEXT). Never autoincrement.
 * - Timestamps are ISO-8601 UTC strings. `updated_at` is bumped on every write.
 * - Deletes are soft (`deleted_at`) so they can sync; purged after RETENTION_DAYS.
 * - `user_id` is nullable locally: training works without an account and rows are
 *   claimed on first login.
 * - Weights are stored in kg as REAL; the UI converts.
 * - Exercise ids: built-in library rows use their stable `slug` as `id`
 *   (seeded from src/content/exercises.nl.ts, never synced); custom exercises
 *   use a UUID. So `exercise_id` is "slug or uuid", same as on the server.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const syncColumns = `
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
`;

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'init_tracker',
    sql: `
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  slug TEXT,
  name_nl TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0,1)),
  ${syncColumns}
);
CREATE UNIQUE INDEX IF NOT EXISTS exercises_slug_uq ON exercises(slug) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  notes TEXT,
  program_slug TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  ${syncColumns}
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3 CHECK (target_sets > 0),
  target_reps_min INTEGER,
  target_reps_max INTEGER,
  rest_seconds INTEGER NOT NULL DEFAULT 90 CHECK (rest_seconds >= 0),
  ${syncColumns}
);
CREATE INDEX IF NOT EXISTS routine_exercises_routine_idx ON routine_exercises(routine_id, position);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  routine_id TEXT REFERENCES routines(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','import_hevy','import_strong')),
  ${syncColumns}
);
CREATE INDEX IF NOT EXISTS workouts_started_idx ON workouts(started_at DESC);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'normal' CHECK (set_type IN ('warmup','normal','dropset','failure')),
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg >= 0),
  reps INTEGER CHECK (reps IS NULL OR reps >= 0),
  rpe REAL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  completed_at TEXT,
  ${syncColumns}
);
CREATE INDEX IF NOT EXISTS sets_workout_idx ON sets(workout_id, position);
CREATE INDEX IF NOT EXISTS sets_exercise_idx ON sets(exercise_id, completed_at DESC);
`,
  },
];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0;

export const TRACKER_TABLES = ['exercises', 'routines', 'routine_exercises', 'workouts', 'sets'] as const;
export type TrackerTable = (typeof TRACKER_TABLES)[number];
