import type { SetType } from '@/lib/db/types';

import { epley1rm, setVolume } from './oneRepMax';

/**
 * Personal-record detection. Pure: callers pass history and the new workout.
 *
 * Rules:
 * - Only completed, non-warmup sets count.
 * - A PR needs earlier history for that exercise; a first-ever session sets
 *   the baseline but is not celebrated (avoids "12 PR's!" on day one).
 * - At most one PR per kind per exercise per workout (the best one).
 */
export type PrKind = 'heaviest_weight' | 'most_reps_at_weight' | 'best_e1rm' | 'best_volume';

export interface PrSetInput {
  workoutId: string;
  exerciseId: string;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
}

export interface PersonalRecord {
  kind: PrKind;
  exerciseId: string;
  /** New best value: kg for weight/e1rm/volume, reps for most_reps_at_weight. */
  value: number;
  previous: number;
  weightKg: number;
  reps: number;
}

export interface ExerciseBests {
  heaviestWeight: number;
  bestE1rm: number;
  /** Highest total volume for this exercise in a single workout. */
  bestSessionVolume: number;
  /** Working sets as [weightKg, reps] pairs, for reps-at-weight comparisons. */
  sets: { weightKg: number; reps: number }[];
}

export const PR_LABELS_NL: Record<PrKind, string> = {
  heaviest_weight: 'Zwaarste gewicht',
  most_reps_at_weight: 'Meeste reps op dit gewicht',
  best_e1rm: 'Hoogste geschatte 1RM',
  best_volume: 'Meeste volume',
};

function counts(s: PrSetInput): boolean {
  return s.completed && s.setType !== 'warmup' && s.reps != null && s.reps > 0;
}

export function computeBests(history: readonly PrSetInput[]): Map<string, ExerciseBests> {
  const bests = new Map<string, ExerciseBests>();
  const sessionVolume = new Map<string, number>(); // `${exerciseId}|${workoutId}`
  for (const s of history) {
    if (!counts(s)) continue;
    const w = s.weightKg ?? 0;
    const r = s.reps ?? 0;
    let b = bests.get(s.exerciseId);
    if (!b) {
      b = { heaviestWeight: 0, bestE1rm: 0, bestSessionVolume: 0, sets: [] };
      bests.set(s.exerciseId, b);
    }
    b.heaviestWeight = Math.max(b.heaviestWeight, w);
    b.bestE1rm = Math.max(b.bestE1rm, epley1rm(w, r) ?? 0);
    b.sets.push({ weightKg: w, reps: r });
    const key = `${s.exerciseId}|${s.workoutId}`;
    const vol = (sessionVolume.get(key) ?? 0) + setVolume(w, r);
    sessionVolume.set(key, vol);
    b.bestSessionVolume = Math.max(b.bestSessionVolume, vol);
  }
  return bests;
}

/** Max reps previously done with at least `weightKg`, or null if never. */
function maxRepsAtOrAbove(b: ExerciseBests, weightKg: number): number | null {
  let max: number | null = null;
  for (const s of b.sets) if (s.weightKg >= weightKg && (max === null || s.reps > max)) max = s.reps;
  return max;
}

export function detectPrs(history: readonly PrSetInput[], current: readonly PrSetInput[]): PersonalRecord[] {
  const bests = computeBests(history);
  const byExercise = new Map<string, PrSetInput[]>();
  for (const s of current) {
    if (!counts(s)) continue;
    const list = byExercise.get(s.exerciseId) ?? [];
    list.push(s);
    byExercise.set(s.exerciseId, list);
  }

  const out: PersonalRecord[] = [];
  for (const [exerciseId, sets] of byExercise) {
    const b = bests.get(exerciseId);
    if (!b) continue; // first session: baseline only

    let heaviest: PrSetInput | null = null;
    let topE1rm: { set: PrSetInput; value: number } | null = null;
    let repsPr: { set: PrSetInput; previous: number } | null = null;
    let volume = 0;

    for (const s of sets) {
      const w = s.weightKg ?? 0;
      const r = s.reps ?? 0;
      volume += setVolume(w, r);
      if (w > 0 && (heaviest === null || w > (heaviest.weightKg ?? 0) || (w === heaviest.weightKg && r > (heaviest.reps ?? 0)))) {
        heaviest = s;
      }
      const e = epley1rm(w, r);
      if (e !== null && (topE1rm === null || e > topE1rm.value)) topE1rm = { set: s, value: e };
      const prev = maxRepsAtOrAbove(b, w);
      if (prev !== null && r > prev) {
        if (repsPr === null || w > (repsPr.set.weightKg ?? 0) || (w === repsPr.set.weightKg && r > (repsPr.set.reps ?? 0))) {
          repsPr = { set: s, previous: prev };
        }
      }
    }

    const hw = heaviest?.weightKg ?? 0;
    if (heaviest && hw > b.heaviestWeight && b.heaviestWeight > 0) {
      out.push({ kind: 'heaviest_weight', exerciseId, value: hw, previous: b.heaviestWeight, weightKg: hw, reps: heaviest.reps ?? 0 });
    }
    if (repsPr) {
      out.push({
        kind: 'most_reps_at_weight',
        exerciseId,
        value: repsPr.set.reps ?? 0,
        previous: repsPr.previous,
        weightKg: repsPr.set.weightKg ?? 0,
        reps: repsPr.set.reps ?? 0,
      });
    }
    if (topE1rm && b.bestE1rm > 0 && topE1rm.value > b.bestE1rm) {
      out.push({
        kind: 'best_e1rm',
        exerciseId,
        value: topE1rm.value,
        previous: b.bestE1rm,
        weightKg: topE1rm.set.weightKg ?? 0,
        reps: topE1rm.set.reps ?? 0,
      });
    }
    if (b.bestSessionVolume > 0 && volume > b.bestSessionVolume) {
      out.push({ kind: 'best_volume', exerciseId, value: volume, previous: b.bestSessionVolume, weightKg: 0, reps: 0 });
    }
  }
  return out;
}
