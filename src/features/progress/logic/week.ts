import type { MuscleGroup, SetType } from '@/lib/db';

/**
 * Weekly overview (Voortgang → Week, Vandaag "Volume week"). Pure. ISO weeks start on
 * Monday 00:00 local time. Warm-up sets never count as sets or volume.
 */

/** Monday 00:00 (local) of the ISO week containing `d`. */
export function startOfIsoWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - dow);
  return out;
}

/** [start, end) of the ISO week `offset` weeks from the one containing `now` (−1 = last week). */
export function isoWeekRange(now: Date, offset = 0): { start: Date; end: Date } {
  const start = startOfIsoWeek(now);
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export interface WeekWorkoutRow {
  id: string;
  started_at: string;
  ended_at: string | null;
}

export interface WeekSetRow {
  workout_id: string;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  primary_muscle: MuscleGroup | null;
  /** JSON array as stored in SQLite (exercises.secondary_muscles). */
  secondary_muscles: string | null;
}

export interface WeekStats {
  workouts: number;
  /** Completed working sets (no warm-ups). */
  sets: number;
  durationMin: number;
  volumeKg: number;
}

/** A forgotten "finish" must not turn one workout into 14 hours of training. */
export const MAX_WORKOUT_MINUTES = 4 * 60;

const isWorkingSet = (s: WeekSetRow) => s.set_type !== 'warmup';

export function weekStats(workouts: readonly WeekWorkoutRow[], sets: readonly WeekSetRow[]): WeekStats {
  const ids = new Set(workouts.map((w) => w.id));
  let durationMin = 0;
  for (const w of workouts) {
    if (!w.ended_at) continue;
    const min = (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60_000;
    if (Number.isFinite(min) && min > 0) durationMin += Math.min(min, MAX_WORKOUT_MINUTES);
  }
  let count = 0;
  let volumeKg = 0;
  for (const s of sets) {
    if (!ids.has(s.workout_id) || !isWorkingSet(s)) continue;
    count += 1;
    if (s.weight_kg != null && s.reps != null && s.weight_kg > 0 && s.reps > 0) volumeKg += s.weight_kg * s.reps;
  }
  return { workouts: workouts.length, sets: count, durationMin, volumeKg };
}

export interface MuscleSetCount {
  muscle: MuscleGroup;
  /** Primary = 1 per set, secondary = 0,5 per set. */
  sets: number;
}

export const SECONDARY_MUSCLE_WEIGHT = 0.5;

function parseMuscles(json: string | null): MuscleGroup[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is MuscleGroup => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Working sets per muscle group, highest first (ties by name). */
export function setsPerMuscle(sets: readonly WeekSetRow[]): MuscleSetCount[] {
  const totals = new Map<MuscleGroup, number>();
  const add = (m: MuscleGroup, n: number) => totals.set(m, (totals.get(m) ?? 0) + n);
  for (const s of sets) {
    if (!isWorkingSet(s) || !s.primary_muscle) continue;
    add(s.primary_muscle, 1);
    for (const m of new Set(parseMuscles(s.secondary_muscles))) {
      if (m !== s.primary_muscle) add(m, SECONDARY_MUSCLE_WEIGHT);
    }
  }
  return [...totals.entries()]
    .map(([muscle, n]) => ({ muscle, sets: n }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

export interface WeekSummary {
  /** ISO string of this week's Monday 00:00 local. */
  weekStart: string;
  current: WeekStats;
  previous: WeekStats;
  /** current − previous, per field. */
  delta: WeekStats;
  /** Volume change in %, null when last week had no volume. */
  volumeChangePct: number | null;
  muscles: MuscleSetCount[];
}

/**
 * Splits rows from [last week start, this week end) into both weeks and compares them.
 * `workouts` must be finished workouts; sets belong to those workouts.
 */
export function summarizeWeeks(
  workouts: readonly WeekWorkoutRow[],
  sets: readonly WeekSetRow[],
  now: Date,
): WeekSummary {
  const cur = isoWeekRange(now, 0);
  const prev = isoWeekRange(now, -1);
  const inRange = (w: WeekWorkoutRow, r: { start: Date; end: Date }) => {
    const t = Date.parse(w.started_at);
    return t >= r.start.getTime() && t < r.end.getTime();
  };
  const curW = workouts.filter((w) => inRange(w, cur));
  const prevW = workouts.filter((w) => inRange(w, prev));
  const curIds = new Set(curW.map((w) => w.id));
  const curSets = sets.filter((s) => curIds.has(s.workout_id));
  const current = weekStats(curW, curSets);
  const previous = weekStats(prevW, sets);
  return {
    weekStart: cur.start.toISOString(),
    current,
    previous,
    delta: {
      workouts: current.workouts - previous.workouts,
      sets: current.sets - previous.sets,
      durationMin: current.durationMin - previous.durationMin,
      volumeKg: current.volumeKg - previous.volumeKg,
    },
    volumeChangePct: previous.volumeKg > 0 ? ((current.volumeKg - previous.volumeKg) / previous.volumeKg) * 100 : null,
    muscles: setsPerMuscle(curSets),
  };
}
