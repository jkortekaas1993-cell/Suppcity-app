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

// --- milestones and weekly goal (hard rule 9: all own data, also the local-only parts) ---

export const BADGES_CSV_FILE = 'suppcity-mijlpalen.csv';
export const WEEKLY_GOAL_CSV_FILE = 'suppcity-weekdoel.csv';

export const BADGE_EXPORT_HEADERS = ['badge_id', 'title', 'description', 'earned_at', 'workout_id'] as const;

export interface BadgeExportRow {
  badgeId: string;
  title: string;
  description: string;
  earnedAt: string;
  workoutId: string | null;
}

export function badgesToCsv(rows: readonly BadgeExportRow[]): string {
  return toCsv(
    BADGE_EXPORT_HEADERS,
    rows.map((r) => [r.badgeId, r.title, r.description, r.earnedAt, r.workoutId]),
  );
}

export const WEEKLY_GOAL_EXPORT_HEADERS = ['valid_from_week', 'valid_from_date', 'weekly_goal', 'current'] as const;

export interface WeeklyGoalExportRow {
  /** ISO week "2026-W42"; empty = since the start (before the first change). */
  validFromWeek: string;
  /** Monday YYYY-MM-DD; empty = since the start. */
  validFromDate: string;
  weeklyGoal: number;
  current: boolean;
}

export function weeklyGoalsToCsv(rows: readonly WeeklyGoalExportRow[]): string {
  return toCsv(
    WEEKLY_GOAL_EXPORT_HEADERS,
    rows.map((r) => [r.validFromWeek, r.validFromDate, r.weeklyGoal, r.current ? 'ja' : 'nee']),
  );
}
