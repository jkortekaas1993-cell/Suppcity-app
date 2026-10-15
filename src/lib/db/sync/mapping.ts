import type { RemoteRow, SyncRow, SyncTable } from './types';

/**
 * Local (SQLite) ↔ wire (Supabase) row conversion. Pure.
 * Only whitelisted columns cross the wire. Conversions:
 *  - exercises.is_custom: INTEGER 0/1 ↔ boolean
 *  - exercises.secondary_muscles: JSON text ↔ text[]
 *  - built-in exercises (is_custom = 0, slug ids) are never pushed.
 */

const BASE = ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at'] as const;

export const SYNC_COLUMNS: Record<SyncTable, readonly string[]> = {
  exercises: [...BASE, 'slug', 'name_nl', 'primary_muscle', 'secondary_muscles', 'equipment', 'is_custom'],
  routines: [...BASE, 'name', 'notes', 'program_slug', 'position'],
  routine_exercises: [
    ...BASE,
    'routine_id',
    'exercise_id',
    'position',
    'target_sets',
    'target_reps_min',
    'target_reps_max',
    'rest_seconds',
  ],
  workouts: [...BASE, 'routine_id', 'title', 'started_at', 'ended_at', 'notes', 'source'],
  sets: [...BASE, 'workout_id', 'exercise_id', 'position', 'set_type', 'weight_kg', 'reps', 'rpe', 'completed_at'],
};

function pick(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of SYNC_COLUMNS[table]) out[c] = row[c] ?? null;
  return out;
}

/** Should this local row be pushed at all? */
export function isSyncable(table: SyncTable, local: Record<string, unknown>): boolean {
  if (table === 'exercises') return local.is_custom === 1 || local.is_custom === true;
  return true;
}

export function toRemote(table: SyncTable, local: Record<string, unknown>, userId: string): SyncRow {
  const r = pick(table, local);
  r.user_id = userId;
  if (table === 'exercises') {
    r.is_custom = r.is_custom === 1 || r.is_custom === true;
    r.secondary_muscles = parseJsonArray(r.secondary_muscles);
  }
  return r as SyncRow;
}

export function fromRemote(table: SyncTable, remote: RemoteRow | SyncRow): SyncRow {
  const r = pick(table, remote);
  if (table === 'exercises') {
    r.is_custom = r.is_custom === true || r.is_custom === 1 ? 1 : 0;
    r.secondary_muscles = JSON.stringify(Array.isArray(r.secondary_muscles) ? r.secondary_muscles : []);
  }
  if (table === 'sets') {
    // Postgres numeric arrives as number or string depending on the client
    for (const c of ['weight_kg', 'rpe'] as const) if (typeof r[c] === 'string') r[c] = Number(r[c]);
  }
  return r as SyncRow;
}

function parseJsonArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
