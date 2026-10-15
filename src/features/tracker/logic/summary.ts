import type { SetType } from '@/lib/db/types';

import { epley1rm, setVolume } from './oneRepMax';

/** Workout totals and per-exercise bests. Pure. */
export interface SummarySetInput {
  exerciseId: string;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
}

export interface WorkoutSummary {
  durationMs: number;
  /** kg × reps over completed working (non-warmup) sets. */
  volumeKg: number;
  completedSets: number;
  totalReps: number;
  exerciseCount: number;
}

export function summarizeWorkout(
  startedAt: string | number,
  endedAt: string | number | null,
  sets: readonly SummarySetInput[],
): WorkoutSummary {
  const start = typeof startedAt === 'number' ? startedAt : Date.parse(startedAt);
  const end = endedAt === null ? start : typeof endedAt === 'number' ? endedAt : Date.parse(endedAt);
  let volumeKg = 0;
  let completedSets = 0;
  let totalReps = 0;
  const exercises = new Set<string>();
  for (const s of sets) {
    if (!s.completed) continue;
    exercises.add(s.exerciseId);
    completedSets += 1;
    if (s.setType === 'warmup') continue;
    volumeKg += setVolume(s.weightKg, s.reps);
    totalReps += s.reps ?? 0;
  }
  return {
    durationMs: Number.isFinite(end - start) ? Math.max(0, end - start) : 0,
    volumeKg,
    completedSets,
    totalReps,
    exerciseCount: exercises.size,
  };
}

/** Best set of a list: highest e1RM, tie broken by weight. */
export function bestSet<T extends { weightKg: number | null; reps: number | null }>(sets: readonly T[]): T | null {
  let best: T | null = null;
  let bestE = 0;
  for (const s of sets) {
    const e = epley1rm(s.weightKg, s.reps) ?? 0;
    if (e > bestE || (e === bestE && best && (s.weightKg ?? 0) > (best.weightKg ?? 0))) {
      best = s;
      bestE = e;
    }
  }
  return best;
}
