import type { SetType } from '@/lib/db/types';

import { setVolume } from './oneRepMax';
import type { PersonalRecord, PrKind } from './prs';

/** Pure helpers for the active-workout header and the summary / PR moment. */

const PR_PRIORITY: Record<PrKind, number> = {
  heaviest_weight: 4,
  best_e1rm: 3,
  most_reps_at_weight: 2,
  best_volume: 1,
};

/**
 * The PR to put on the big gold card: heaviest weight beats e1RM beats reps
 * beats volume; within a kind the bigger number wins.
 */
export function pickHeadlinePr<T extends PersonalRecord>(prs: readonly T[]): T | null {
  let best: T | null = null;
  for (const p of prs) {
    if (
      best === null ||
      PR_PRIORITY[p.kind] > PR_PRIORITY[best.kind] ||
      (PR_PRIORITY[p.kind] === PR_PRIORITY[best.kind] && p.value > best.value)
    ) {
      best = p;
    }
  }
  return best;
}

/** Volume (kg × reps) of ticked, non-warmup sets of the running workout. */
export function workoutVolumeKg(
  exercises: readonly { sets: readonly { setType: SetType; weightKg: number | null; reps: number | null; completedAt: number | null }[] }[],
): number {
  let total = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      if (s.completedAt === null || s.setType === 'warmup') continue;
      total += setVolume(s.weightKg, s.reps);
    }
  }
  return total;
}
