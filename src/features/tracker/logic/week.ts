/**
 * Week maths for the weekly goal ("weekdoel") and weekly stats. Pure.
 *
 * Weeks are ISO weeks (Monday to Sunday) in the device's local time, so a late
 * Sunday workout counts for the week the user experienced it in.
 */

export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 5;
export const DEFAULT_WEEKLY_GOAL = 3;

/** Clamps any stored/typed value to a whole number in 1..5 (default 3). */
export function clampWeeklyGoal(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_WEEKLY_GOAL;
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, Math.round(n)));
}

function toDate(at: string | number | Date): Date {
  return at instanceof Date ? at : new Date(at);
}

/** Local midnight of the Monday of the week containing `at`. */
export function startOfWeek(at: string | number | Date): Date {
  const d = toDate(at);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (monday.getDay() + 6) % 7; // Monday = 0
  monday.setDate(monday.getDate() - dow);
  return monday;
}

/**
 * ISO week key "2026-W42" (local time). Keys of consecutive weeks are
 * consecutive in `weekIndex`, which is what streaks use.
 */
export function weekKey(at: string | number | Date): string {
  const d = toDate(at);
  // ISO week-numbering year: the year of this week's Thursday.
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7));
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Monotonic week number (weeks since the Monday of 1970-01-05, local), so
 * "the next week" is always index + 1, across years and DST changes.
 */
export function weekIndex(at: string | number | Date): number {
  const monday = startOfWeek(at);
  const epochMonday = new Date(1970, 0, 5);
  // Round: a DST switch makes some weeks 167 or 169 hours long.
  return Math.round((monday.getTime() - epochMonday.getTime()) / (7 * 86_400_000));
}

/** Number of workouts per week index. */
export function workoutsPerWeek(startedAt: readonly (string | number)[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const at of startedAt) {
    const t = typeof at === 'number' ? at : Date.parse(at);
    if (!Number.isFinite(t)) continue;
    const w = weekIndex(t);
    out.set(w, (out.get(w) ?? 0) + 1);
  }
  return out;
}

export interface WeekGoalProgress {
  goal: number;
  /** Workouts this week (can exceed the goal). */
  done: number;
  /** Segments to fill: min(done, goal). */
  filled: number;
  reached: boolean;
}

/** Progress toward this week's goal. Never negative, never a "streak lost" state. */
export function weekGoalProgress(startedAt: readonly (string | number)[], now: number | Date, goal: number): WeekGoalProgress {
  const g = clampWeeklyGoal(goal);
  const done = workoutsPerWeek(startedAt).get(weekIndex(now)) ?? 0;
  return { goal: g, done, filled: Math.min(done, g), reached: done >= g };
}

export interface WeekVolume {
  thisWeekKg: number;
  lastWeekKg: number;
  /** Rounded % change vs last week, or null when last week had no volume. */
  changePct: number | null;
}

/** Training volume this week vs last week (for the Vandaag tile). */
export function weekVolume(workouts: readonly { startedAt: string | number; volumeKg: number }[], now: number | Date): WeekVolume {
  const current = weekIndex(now);
  let thisWeekKg = 0;
  let lastWeekKg = 0;
  for (const w of workouts) {
    const t = typeof w.startedAt === 'number' ? w.startedAt : Date.parse(w.startedAt);
    if (!Number.isFinite(t)) continue;
    const idx = weekIndex(t);
    if (idx === current) thisWeekKg += w.volumeKg;
    else if (idx === current - 1) lastWeekKg += w.volumeKg;
  }
  const changePct = lastWeekKg > 0 ? Math.round(((thisWeekKg - lastWeekKg) / lastWeekKg) * 100) : null;
  return { thisWeekKg, lastWeekKg, changePct };
}

/** Whole days between two instants, by local calendar date (0 = same day). */
export function daysBetween(from: string | number | Date, to: string | number | Date): number {
  const a = toDate(from);
  const b = toDate(to);
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / 86_400_000);
}
