import type { SetType, WorkoutSource } from '@/lib/db/types';

import { toCsv } from './csv';

/**
 * CSV export of all own training data (hard rule 9). One row per set, with
 * Hevy-compatible column names so the file can be re-imported here or elsewhere.
 * Times are ISO-8601 UTC.
 */
export interface ExportRow {
  workoutId: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  source: WorkoutSource;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  completedAt: string | null;
}

export const EXPORT_HEADERS = [
  'title',
  'start_time',
  'end_time',
  'description',
  'exercise_title',
  'set_index',
  'set_type',
  'weight_kg',
  'reps',
  'rpe',
  'exercise_id',
  'workout_id',
  'source',
  'completed_at',
] as const;

export function workoutsToCsv(rows: readonly ExportRow[]): string {
  return toCsv(
    EXPORT_HEADERS,
    rows.map((r) => [
      r.title,
      r.startedAt,
      r.endedAt,
      r.notes,
      r.exerciseName,
      r.setIndex,
      r.setType,
      r.weightKg,
      r.reps,
      r.rpe,
      r.exerciseId,
      r.workoutId,
      r.source,
      r.completedAt,
    ]),
  );
}
