import { EXERCISES_NL } from '@/content/exercises.nl';

import type {
  AppStateRepository,
  DataPortRepository,
  ExerciseRepository,
  ExerciseSetHistoryRow,
  ExportJoinRow,
  PreviousSetSummary,
  Repositories,
  RoutineRepository,
  SetRepository,
  SyncSource,
  WorkoutListItem,
  WorkoutRepository,
} from './repositories';
import { TRACKER_TABLES, type TrackerTable } from './schema';
import type {
  Exercise,
  IsoDateTime,
  MuscleGroup,
  NewRow,
  Routine,
  RoutineExercise,
  Uuid,
  Workout,
  WorkoutSet,
} from './types';

/**
 * expo-sqlite implementation of the repository contracts.
 *
 * Depends only on the small `SqlDb` subset of expo-sqlite's async API
 * (`runAsync` / `getAllAsync` / `getFirstAsync` / `withTransactionAsync`), so it
 * has no Expo imports and can be exercised in Node against any SQLite driver.
 *
 * Every write sets `updated_at`; deletes are soft (`deleted_at`) so they sync.
 */

export type SqlValue = string | number | null;

export interface SqlDb {
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface RepositoryDeps {
  newId: () => string;
  now: () => IsoDateTime;
  /** Logged-in Supabase user id, if any. New rows are stamped with it. */
  currentUserId?: () => Uuid | null;
}

// --- row mapping -------------------------------------------------------------

interface ExerciseRow extends Omit<Exercise, 'secondary_muscles' | 'is_custom'> {
  secondary_muscles: string;
  is_custom: number;
}

function parseMuscles(json: string): MuscleGroup[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is MuscleGroup => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toExercise(row: ExerciseRow): Exercise {
  return { ...row, secondary_muscles: parseMuscles(row.secondary_muscles), is_custom: row.is_custom === 1 };
}

const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(',');

const NOT_DELETED = 'deleted_at IS NULL';

export function createSqliteRepositories(db: SqlDb, deps: RepositoryDeps): Repositories {
  const userId = (): Uuid | null => deps.currentUserId?.() ?? null;

  // --- exercises -------------------------------------------------------------
  const exercises: ExerciseRepository = {
    async list(filter) {
      const where = [NOT_DELETED];
      const params: SqlValue[] = [];
      if (filter?.muscle) {
        where.push('primary_muscle = ?');
        params.push(filter.muscle);
      }
      if (filter?.search?.trim()) {
        where.push('name_nl LIKE ?');
        params.push(`%${filter.search.trim()}%`);
      }
      const rows = await db.getAllAsync<ExerciseRow>(
        `SELECT * FROM exercises WHERE ${where.join(' AND ')} ORDER BY name_nl COLLATE NOCASE`,
        params,
      );
      return rows.map(toExercise);
    },
    async get(id) {
      const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', [id]);
      return row ? toExercise(row) : null;
    },
    async createCustom(input) {
      const now = deps.now();
      const row: Exercise = {
        id: input.id ?? deps.newId(),
        user_id: input.user_id ?? userId(),
        slug: null,
        name_nl: input.name_nl.trim(),
        primary_muscle: input.primary_muscle,
        secondary_muscles: input.secondary_muscles,
        equipment: input.equipment,
        is_custom: true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await db.runAsync(
        `INSERT INTO exercises (id, user_id, slug, name_nl, primary_muscle, secondary_muscles, equipment, is_custom, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)`,
        [row.id, row.user_id, row.name_nl, row.primary_muscle, JSON.stringify(row.secondary_muscles), row.equipment, now, now],
      );
      return row;
    },
    async softDelete(id) {
      const now = deps.now();
      // Built-in library rows cannot be deleted.
      await db.runAsync('UPDATE exercises SET deleted_at = ?, updated_at = ? WHERE id = ? AND is_custom = 1', [now, now, id]);
    },
  };

  // --- routines ----------------------------------------------------------------
  async function insertRoutineExercises(routineId: Uuid, items: NewRow<RoutineExercise>[], now: IsoDateTime) {
    for (const e of items) {
      await db.runAsync(
        `INSERT INTO routine_exercises (id, user_id, routine_id, exercise_id, position, target_sets, target_reps_min, target_reps_max, rest_seconds, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id ?? deps.newId(),
          e.user_id ?? userId(),
          routineId,
          e.exercise_id,
          e.position,
          e.target_sets,
          e.target_reps_min,
          e.target_reps_max,
          e.rest_seconds,
          now,
          now,
        ],
      );
    }
  }

  const routines: RoutineRepository = {
    list() {
      return db.getAllAsync<Routine>(`SELECT * FROM routines WHERE ${NOT_DELETED} ORDER BY position, created_at`, []);
    },
    async get(id) {
      const routine = await db.getFirstAsync<Routine>(`SELECT * FROM routines WHERE id = ? AND ${NOT_DELETED}`, [id]);
      if (!routine) return null;
      const items = await db.getAllAsync<RoutineExercise>(
        `SELECT * FROM routine_exercises WHERE routine_id = ? AND ${NOT_DELETED} ORDER BY position`,
        [id],
      );
      return { routine, exercises: items };
    },
    async create(input, items) {
      const now = deps.now();
      const routine: Routine = {
        id: input.id ?? deps.newId(),
        user_id: input.user_id ?? userId(),
        name: input.name,
        notes: input.notes,
        program_slug: input.program_slug,
        position: input.position,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO routines (id, user_id, name, notes, program_slug, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [routine.id, routine.user_id, routine.name, routine.notes, routine.program_slug, routine.position, now, now],
        );
        await insertRoutineExercises(routine.id, items, now);
      });
      return routine;
    },
    async update(id, patch) {
      const sets: string[] = [];
      const params: SqlValue[] = [];
      if (patch.name !== undefined) (sets.push('name = ?'), params.push(patch.name));
      if (patch.notes !== undefined) (sets.push('notes = ?'), params.push(patch.notes));
      if (patch.position !== undefined) (sets.push('position = ?'), params.push(patch.position));
      if (patch.program_slug !== undefined) (sets.push('program_slug = ?'), params.push(patch.program_slug));
      if (sets.length === 0) return;
      await db.runAsync(`UPDATE routines SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [...params, deps.now(), id]);
    },
    async replaceExercises(routineId, items) {
      const now = deps.now();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE routine_exercises SET deleted_at = ?, updated_at = ? WHERE routine_id = ? AND ${NOT_DELETED}`,
          [now, now, routineId],
        );
        await insertRoutineExercises(routineId, items, now);
        await db.runAsync('UPDATE routines SET updated_at = ? WHERE id = ?', [now, routineId]);
      });
    },
    async softDelete(id) {
      const now = deps.now();
      await db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE routines SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
        await db.runAsync(
          `UPDATE routine_exercises SET deleted_at = ?, updated_at = ? WHERE routine_id = ? AND ${NOT_DELETED}`,
          [now, now, id],
        );
      });
    },
    async maxPosition() {
      const row = await db.getFirstAsync<{ m: number | null }>(`SELECT MAX(position) AS m FROM routines WHERE ${NOT_DELETED}`, []);
      return row?.m ?? -1;
    },
  };

  // --- workouts ----------------------------------------------------------------
  const STATS_SQL = `
    SELECT w.*,
      COALESCE(st.set_count, 0) AS set_count,
      COALESCE(st.volume_kg, 0) AS volume_kg,
      COALESCE(st.exercise_count, 0) AS exercise_count
    FROM workouts w
    LEFT JOIN (
      SELECT workout_id,
        COUNT(*) AS set_count,
        SUM(CASE WHEN set_type != 'warmup' THEN COALESCE(weight_kg, 0) * COALESCE(reps, 0) ELSE 0 END) AS volume_kg,
        COUNT(DISTINCT exercise_id) AS exercise_count
      FROM sets
      WHERE deleted_at IS NULL AND completed_at IS NOT NULL
      GROUP BY workout_id
    ) st ON st.workout_id = w.id
    WHERE w.deleted_at IS NULL AND w.ended_at IS NOT NULL`;

  const workouts: WorkoutRepository = {
    async start(input) {
      const now = deps.now();
      const w: Workout = {
        id: input.id ?? deps.newId(),
        user_id: input.user_id ?? userId(),
        routine_id: input.routine_id,
        title: input.title,
        started_at: input.started_at,
        ended_at: input.ended_at,
        notes: input.notes,
        source: input.source,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await db.runAsync(
        `INSERT INTO workouts (id, user_id, routine_id, title, started_at, ended_at, notes, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.id, w.user_id, w.routine_id, w.title, w.started_at, w.ended_at, w.notes, w.source, now, now],
      );
      return w;
    },
    async finish(id, endedAt) {
      await db.runAsync('UPDATE workouts SET ended_at = ?, updated_at = ? WHERE id = ?', [endedAt, deps.now(), id]);
    },
    async update(id, patch) {
      const sets: string[] = [];
      const params: SqlValue[] = [];
      if (patch.title !== undefined) (sets.push('title = ?'), params.push(patch.title));
      if (patch.notes !== undefined) (sets.push('notes = ?'), params.push(patch.notes));
      if (sets.length === 0) return;
      await db.runAsync(`UPDATE workouts SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [...params, deps.now(), id]);
    },
    async get(id) {
      const workout = await db.getFirstAsync<Workout>(`SELECT * FROM workouts WHERE id = ? AND ${NOT_DELETED}`, [id]);
      if (!workout) return null;
      const rows = await db.getAllAsync<WorkoutSet>(
        `SELECT * FROM sets WHERE workout_id = ? AND ${NOT_DELETED} ORDER BY position`,
        [id],
      );
      return { workout, sets: rows };
    },
    history({ limit, before }) {
      return db.getAllAsync<Workout>(
        `SELECT * FROM workouts WHERE ${NOT_DELETED} AND ended_at IS NOT NULL ${before ? 'AND started_at < ?' : ''}
         ORDER BY started_at DESC LIMIT ?`,
        before ? [before, limit] : [limit],
      );
    },
    historyWithStats({ limit, before }) {
      return db.getAllAsync<WorkoutListItem>(
        `${STATS_SQL} ${before ? 'AND w.started_at < ?' : ''} ORDER BY w.started_at DESC LIMIT ?`,
        before ? [before, limit] : [limit],
      );
    },
    lastFinished() {
      return db.getFirstAsync<Workout>(
        `SELECT * FROM workouts WHERE ${NOT_DELETED} AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`,
        [],
      );
    },
    async softDelete(id) {
      const now = deps.now();
      await db.withTransactionAsync(async () => {
        await db.runAsync('UPDATE workouts SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
        await db.runAsync(`UPDATE sets SET deleted_at = ?, updated_at = ? WHERE workout_id = ? AND ${NOT_DELETED}`, [
          now,
          now,
          id,
        ]);
      });
    },
  };

  // --- sets ----------------------------------------------------------------------
  const SET_COLUMNS = 'id, user_id, workout_id, exercise_id, position, set_type, weight_kg, reps, rpe, completed_at';

  function setParams(s: NewRow<WorkoutSet> & { id: Uuid }): SqlValue[] {
    return [
      s.id,
      s.user_id ?? userId(),
      s.workout_id,
      s.exercise_id,
      s.position,
      s.set_type,
      s.weight_kg,
      s.reps,
      s.rpe,
      s.completed_at,
    ];
  }

  const sets: SetRepository = {
    async add(input) {
      const now = deps.now();
      const row: WorkoutSet = {
        ...input,
        id: input.id ?? deps.newId(),
        user_id: input.user_id ?? userId(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await db.runAsync(`INSERT INTO sets (${SET_COLUMNS}, created_at, updated_at) VALUES (${placeholders(12)})`, [
        ...setParams(row),
        now,
        now,
      ]);
      return row;
    },
    async update(id, patch) {
      const cols: string[] = [];
      const params: SqlValue[] = [];
      for (const key of ['position', 'set_type', 'weight_kg', 'reps', 'rpe', 'completed_at', 'exercise_id'] as const) {
        const v = patch[key];
        if (v !== undefined) {
          cols.push(`${key} = ?`);
          params.push(v);
        }
      }
      if (cols.length === 0) return;
      await db.runAsync(`UPDATE sets SET ${cols.join(', ')}, updated_at = ? WHERE id = ?`, [...params, deps.now(), id]);
    },
    async upsertMany(rows) {
      if (rows.length === 0) return;
      const now = deps.now();
      await db.withTransactionAsync(async () => {
        for (const r of rows) {
          await db.runAsync(
            `INSERT INTO sets (${SET_COLUMNS}, created_at, updated_at) VALUES (${placeholders(12)})
             ON CONFLICT(id) DO UPDATE SET
               exercise_id = excluded.exercise_id, position = excluded.position, set_type = excluded.set_type,
               weight_kg = excluded.weight_kg, reps = excluded.reps, rpe = excluded.rpe,
               completed_at = excluded.completed_at, updated_at = excluded.updated_at, deleted_at = NULL
             WHERE sets.deleted_at IS NOT NULL
               OR sets.position IS NOT excluded.position OR sets.set_type IS NOT excluded.set_type
               OR sets.weight_kg IS NOT excluded.weight_kg OR sets.reps IS NOT excluded.reps
               OR sets.rpe IS NOT excluded.rpe OR sets.completed_at IS NOT excluded.completed_at`,
            [...setParams(r), now, now],
          );
        }
      });
    },
    async softDelete(id) {
      const now = deps.now();
      await db.runAsync('UPDATE sets SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
    },
    async softDeleteMany(ids) {
      if (ids.length === 0) return;
      const now = deps.now();
      await db.runAsync(
        `UPDATE sets SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders(ids.length)}) AND ${NOT_DELETED}`,
        [now, now, ...ids],
      );
    },
    async previousFor(exerciseId, beforeWorkoutId) {
      const w = await db.getFirstAsync<{ id: Uuid; started_at: IsoDateTime }>(
        `SELECT w.id, w.started_at FROM workouts w
         WHERE w.deleted_at IS NULL AND w.ended_at IS NOT NULL AND w.id != ?
           AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_id = w.id AND s.exercise_id = ?
                       AND s.deleted_at IS NULL AND s.completed_at IS NOT NULL)
         ORDER BY w.started_at DESC LIMIT 1`,
        [beforeWorkoutId ?? '', exerciseId],
      );
      if (!w) return null;
      const rows = await db.getAllAsync<PreviousSetSummary['sets'][number]>(
        `SELECT position, set_type, weight_kg, reps FROM sets
         WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL AND completed_at IS NOT NULL
         ORDER BY position`,
        [w.id, exerciseId],
      );
      return { workout_id: w.id, started_at: w.started_at, sets: rows };
    },
    async personalRecords(exerciseId) {
      const base = `FROM sets s JOIN workouts w ON w.id = s.workout_id
        WHERE s.exercise_id = ? AND s.deleted_at IS NULL AND s.completed_at IS NOT NULL AND s.set_type != 'warmup'
          AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL AND s.weight_kg > 0 AND s.reps > 0`;
      const heaviest = await db.getFirstAsync<WorkoutSet>(
        `SELECT s.* ${base} ORDER BY s.weight_kg DESC, s.reps DESC LIMIT 1`,
        [exerciseId],
      );
      const e = await db.getFirstAsync<{ best: number | null }>(
        `SELECT MAX(CASE WHEN s.reps = 1 THEN s.weight_kg ELSE s.weight_kg * (1 + s.reps / 30.0) END) AS best ${base}`,
        [exerciseId],
      );
      return { heaviest, bestE1rm: e?.best ?? null };
    },
    async completedHistory(exerciseIds, opts) {
      if (exerciseIds.length === 0) return [];
      return db.getAllAsync<ExerciseSetHistoryRow>(
        `SELECT s.id, s.workout_id, s.exercise_id, w.started_at, s.set_type, s.weight_kg, s.reps
         FROM sets s JOIN workouts w ON w.id = s.workout_id
         WHERE s.exercise_id IN (${placeholders(exerciseIds.length)})
           AND s.deleted_at IS NULL AND s.completed_at IS NOT NULL
           AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL AND w.id != ?
         ORDER BY w.started_at, s.position`,
        [...exerciseIds, opts?.excludeWorkoutId ?? ''],
      );
    },
    exercisesWithHistory() {
      return db.getAllAsync<{ exercise_id: Uuid; last_started_at: IsoDateTime; workouts: number }>(
        `SELECT s.exercise_id, MAX(w.started_at) AS last_started_at, COUNT(DISTINCT w.id) AS workouts
         FROM sets s JOIN workouts w ON w.id = s.workout_id
         WHERE s.deleted_at IS NULL AND s.completed_at IS NOT NULL AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL
         GROUP BY s.exercise_id ORDER BY last_started_at DESC`,
        [],
      );
    },
  };

  // --- import / export --------------------------------------------------------
  const dataPort: DataPortRepository = {
    exportRows() {
      return db.getAllAsync<ExportJoinRow>(
        `SELECT w.id AS workout_id, w.title, w.started_at, w.ended_at, w.notes, w.source,
                s.exercise_id, e.name_nl AS exercise_name, s.position, s.set_type, s.weight_kg, s.reps, s.rpe, s.completed_at
         FROM sets s
         JOIN workouts w ON w.id = s.workout_id
         JOIN exercises e ON e.id = s.exercise_id
         WHERE s.deleted_at IS NULL AND w.deleted_at IS NULL AND w.ended_at IS NOT NULL AND s.completed_at IS NOT NULL
         ORDER BY w.started_at, s.position`,
        [],
      );
    },
    async importWorkouts({ newExercises, workouts: items }) {
      let imported = 0;
      let skipped = 0;
      const now = deps.now();
      await db.withTransactionAsync(async () => {
        for (const e of newExercises) {
          await db.runAsync(
            `INSERT INTO exercises (id, user_id, slug, name_nl, primary_muscle, secondary_muscles, equipment, is_custom, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)`,
            [
              e.id ?? deps.newId(),
              e.user_id ?? userId(),
              e.name_nl,
              e.primary_muscle,
              JSON.stringify(e.secondary_muscles),
              e.equipment,
              now,
              now,
            ],
          );
        }
        for (const { workout, sets: items2 } of items) {
          const exists = await db.getFirstAsync<{ id: string }>(
            `SELECT id FROM workouts WHERE source = ? AND started_at = ? AND ${NOT_DELETED} LIMIT 1`,
            [workout.source, workout.started_at],
          );
          if (exists) {
            skipped++;
            continue;
          }
          const workoutId = workout.id ?? deps.newId();
          await db.runAsync(
            `INSERT INTO workouts (id, user_id, routine_id, title, started_at, ended_at, notes, source, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
            [
              workoutId,
              workout.user_id ?? userId(),
              workout.title,
              workout.started_at,
              // Imported workouts are finished by definition.
              workout.ended_at ?? workout.started_at,
              workout.notes,
              workout.source,
              now,
              now,
            ],
          );
          for (const s of items2) {
            await db.runAsync(`INSERT INTO sets (${SET_COLUMNS}, created_at, updated_at) VALUES (${placeholders(12)})`, [
              ...setParams({ ...s, id: s.id ?? deps.newId(), workout_id: workoutId }),
              now,
              now,
            ]);
          }
          imported++;
        }
      });
      return { imported, skipped };
    },
  };

  // --- local app state --------------------------------------------------------
  const appState: AppStateRepository = {
    async get<T>(key: string) {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_state WHERE key = ?', [key]);
      if (!row) return null;
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await db.runAsync(
        `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, JSON.stringify(value), deps.now()],
      );
    },
    async remove(key) {
      await db.runAsync('DELETE FROM app_state WHERE key = ?', [key]);
    },
  };

  // --- sync seam (Backend&Sync builds on this) ---------------------------------
  const columnCache = new Map<TrackerTable, Set<string>>();
  function assertTable(table: string): TrackerTable {
    if (!(TRACKER_TABLES as readonly string[]).includes(table)) throw new Error(`Unknown sync table: ${table}`);
    return table as TrackerTable;
  }
  async function columnsOf(table: TrackerTable): Promise<Set<string>> {
    let cols = columnCache.get(table);
    if (!cols) {
      const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, []);
      cols = new Set(info.map((c) => c.name));
      columnCache.set(table, cols);
    }
    return cols;
  }

  /** Sync wire-ish local format: booleans and arrays decoded (same shape for changesSince and getByIds). */
  function decodeSyncRows(t: TrackerTable, rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return t === 'exercises'
      ? rows.map((r) => ({ ...r, is_custom: r.is_custom === 1, secondary_muscles: parseMuscles(String(r.secondary_muscles ?? '[]')) }))
      : rows;
  }

  const sync: SyncSource = {
    async changesSince(table, updatedAfter, uid) {
      const t = assertTable(table);
      // Built-in library exercises ship with the app and are never synced.
      const extra = t === 'exercises' ? 'AND is_custom = 1' : '';
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${t} WHERE (? IS NULL OR updated_at > ?) AND (user_id IS NULL OR user_id = ?) ${extra} ORDER BY updated_at`,
        [updatedAfter, updatedAfter, uid],
      );
      return decodeSyncRows(t, rows);
    },
    async getByIds(table, ids) {
      const t = assertTable(table);
      const out: Record<string, unknown>[] = [];
      // Stay well below SQLite's bound-parameter limit.
      for (let i = 0; i < ids.length; i += 500) {
        const part = ids.slice(i, i + 500);
        if (part.length === 0) continue;
        out.push(
          ...(await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t} WHERE id IN (${placeholders(part.length)})`, part)),
        );
      }
      return decodeSyncRows(t, out);
    },
    async applyRemote(table, rows) {
      const t = assertTable(table);
      const cols = await columnsOf(t);
      await db.withTransactionAsync(async () => {
        for (const raw of rows) {
          const row: Record<string, SqlValue> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (!cols.has(k)) continue;
            if (typeof v === 'boolean') row[k] = v ? 1 : 0;
            else if (Array.isArray(v)) row[k] = JSON.stringify(v);
            else if (v === null || typeof v === 'string' || typeof v === 'number') row[k] = v;
          }
          const keys = Object.keys(row);
          if (!keys.includes('id') || !keys.includes('updated_at')) continue;
          // Rows arrive ALREADY MERGED by the sync engine (LWW + sticky deletes, see
          // src/lib/db/sync/merge.ts), so they are written verbatim: no LWW guard here
          // (it would drop a merged sticky delete) and updated_at is never bumped
          // (that would echo every pulled row back to the server).
          const updates = keys.filter((k) => k !== 'id' && k !== 'created_at').map((k) => `${k} = excluded.${k}`);
          await db.runAsync(
            `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${placeholders(keys.length)})
             ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
            keys.map((k) => row[k] ?? null),
          );
        }
      });
    },
    async claimAnonymousRows(uid) {
      const now = deps.now();
      await db.withTransactionAsync(async () => {
        for (const t of TRACKER_TABLES) {
          const extra = t === 'exercises' ? 'AND is_custom = 1' : '';
          await db.runAsync(`UPDATE ${t} SET user_id = ?, updated_at = ? WHERE user_id IS NULL ${extra}`, [uid, now]);
        }
      });
    },
  };

  async function seedLibrary(): Promise<void> {
    const now = deps.now();
    await db.withTransactionAsync(async () => {
      for (const e of EXERCISES_NL) {
        const muscles = JSON.stringify(e.secondary_muscles);
        await db.runAsync(
          `INSERT INTO exercises (id, user_id, slug, name_nl, primary_muscle, secondary_muscles, equipment, is_custom, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, 0, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name_nl = excluded.name_nl, primary_muscle = excluded.primary_muscle,
             secondary_muscles = excluded.secondary_muscles, equipment = excluded.equipment, updated_at = excluded.updated_at
           WHERE exercises.name_nl IS NOT excluded.name_nl OR exercises.primary_muscle IS NOT excluded.primary_muscle
             OR exercises.secondary_muscles IS NOT excluded.secondary_muscles OR exercises.equipment IS NOT excluded.equipment`,
          [e.slug, e.slug, e.name_nl, e.primary_muscle, muscles, e.equipment, now, now],
        );
      }
    });
  }

  async function wipeLocalData(): Promise<void> {
    await db.withTransactionAsync(async () => {
      // Children first (foreign keys), then the local-only app_state (incl. sync cursors).
      for (const t of ['sets', 'routine_exercises', 'workouts', 'routines', 'exercises', 'app_state'] as const) {
        await db.runAsync(`DELETE FROM ${t}`, []);
      }
    });
    columnCache.clear();
    await seedLibrary();
  }

  return { exercises, routines, workouts, sets, dataPort, appState, sync, seedLibrary, wipeLocalData };
}
