import type { MuscleGroup, SqlValue } from '@/lib/db';

import type { ExerciseSetRow } from '../logic/exerciseStats';
import type { WeekSetRow, WeekWorkoutRow } from '../logic/week';

/**
 * READ-ONLY queries for Voortgang on the tracker's local SQLite tables (workouts, sets,
 * exercises; see src/lib/db/schema.ts). Nothing here writes: the tracker owns the data.
 *
 * Same filters as the repositories: soft-deleted rows are skipped (`deleted_at IS NULL`),
 * only finished workouts (`ended_at IS NOT NULL`) and completed sets (`completed_at IS NOT NULL`).
 * User scope: rows of the signed-in user or without owner (anonymous, not yet claimed),
 * never another account's rows. `userId = null` (signed out) applies no owner filter, like
 * the repositories, because sign-out wipes local data.
 *
 * Index check (no new migration needed, existing indexes from schema.ts v1/v2):
 * - exerciseSets: `sets_exercise_idx (exercise_id, completed_at)` + workouts PK.
 * - weekRows: `workouts_started_idx (started_at)` range scan, then `sets_workout_idx (workout_id, position)`.
 * - exerciseOptions: one pass over completed sets grouped by exercise; fine for local
 *   histories (tens of thousands of sets). If it ever gets slow, a partial covering index
 *   `sets(exercise_id, workout_id) WHERE deleted_at IS NULL AND completed_at IS NOT NULL`
 *   is the one to add (Tracker builder, appended migration).
 */

/** Subset of expo-sqlite's async API that we need (SQLiteDatabase satisfies it). */
export interface ReadDb {
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
}

const scope = (alias: string) => `(? IS NULL OR ${alias}.user_id IS NULL OR ${alias}.user_id = ?)`;
const FINISHED = `w.deleted_at IS NULL AND w.ended_at IS NOT NULL`;
const COMPLETED = `s.deleted_at IS NULL AND s.completed_at IS NOT NULL`;

export interface ExerciseOption {
  id: string;
  name: string;
  primary_muscle: MuscleGroup;
  /** Finished workouts with at least one working set of this exercise. */
  workouts: number;
  last_started_at: string;
}

/** Exercises with history, most-trained first (ties: most recent first). */
export function exerciseOptions(db: ReadDb, userId: string | null): Promise<ExerciseOption[]> {
  return db.getAllAsync<ExerciseOption>(
    `SELECT s.exercise_id AS id, e.name_nl AS name, e.primary_muscle AS primary_muscle,
            COUNT(DISTINCT w.id) AS workouts, MAX(w.started_at) AS last_started_at
     FROM sets s
     JOIN workouts w ON w.id = s.workout_id
     JOIN exercises e ON e.id = s.exercise_id
     WHERE ${COMPLETED} AND s.set_type != 'warmup' AND ${FINISHED} AND ${scope('w')}
     GROUP BY s.exercise_id
     ORDER BY workouts DESC, last_started_at DESC`,
    [userId, userId],
  );
}

/** All completed sets of one exercise in finished workouts, oldest first. */
export function exerciseSets(db: ReadDb, exerciseId: string, userId: string | null): Promise<ExerciseSetRow[]> {
  return db.getAllAsync<ExerciseSetRow>(
    `SELECT s.workout_id, w.started_at, s.set_type, s.weight_kg, s.reps
     FROM sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_id = ? AND ${COMPLETED} AND ${FINISHED} AND ${scope('w')}
     ORDER BY w.started_at, s.position`,
    [exerciseId, userId, userId],
  );
}

/** Finished workouts started in [from, to) and their completed sets with muscle groups. */
export async function weekRows(
  db: ReadDb,
  from: Date,
  to: Date,
  userId: string | null,
): Promise<{ workouts: WeekWorkoutRow[]; sets: WeekSetRow[] }> {
  const range = [from.toISOString(), to.toISOString(), userId, userId];
  const [workouts, sets] = await Promise.all([
    db.getAllAsync<WeekWorkoutRow>(
      `SELECT w.id, w.started_at, w.ended_at
       FROM workouts w
       WHERE ${FINISHED} AND w.started_at >= ? AND w.started_at < ? AND ${scope('w')}
       ORDER BY w.started_at`,
      range,
    ),
    db.getAllAsync<WeekSetRow>(
      `SELECT s.workout_id, s.set_type, s.weight_kg, s.reps, e.primary_muscle, e.secondary_muscles
       FROM workouts w
       JOIN sets s ON s.workout_id = w.id
       LEFT JOIN exercises e ON e.id = s.exercise_id
       WHERE ${FINISHED} AND w.started_at >= ? AND w.started_at < ? AND ${scope('w')} AND ${COMPLETED}`,
      range,
    ),
  ]);
  return { workouts, sets };
}
