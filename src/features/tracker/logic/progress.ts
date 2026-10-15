import type { SetType } from '@/lib/db/types';

import { epley1rm, setVolume } from './oneRepMax';

/** Per-exercise progress over time. Pure. */
export interface ProgressSetInput {
  workoutId: string;
  startedAt: string;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
}

export interface ProgressPoint {
  workoutId: string;
  startedAt: string;
  /** Best estimated 1RM that session (kg). */
  e1rm: number;
  bestWeightKg: number;
  bestReps: number;
  volumeKg: number;
}

export function exerciseProgress(sets: readonly ProgressSetInput[]): ProgressPoint[] {
  const byWorkout = new Map<string, ProgressPoint>();
  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    const e = epley1rm(s.weightKg, s.reps);
    let p = byWorkout.get(s.workoutId);
    if (!p) {
      p = { workoutId: s.workoutId, startedAt: s.startedAt, e1rm: 0, bestWeightKg: 0, bestReps: 0, volumeKg: 0 };
      byWorkout.set(s.workoutId, p);
    }
    p.volumeKg += setVolume(s.weightKg, s.reps);
    if (e !== null && e > p.e1rm) {
      p.e1rm = e;
      p.bestWeightKg = s.weightKg ?? 0;
      p.bestReps = s.reps ?? 0;
    }
  }
  return [...byWorkout.values()]
    .filter((p) => p.e1rm > 0 || p.volumeKg > 0)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Scales values to 0..1 for a simple bar chart; flat series map to 1. */
export function normalizeSeries(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max <= 0) return values.map(() => 0);
  if (max === min) return values.map(() => 1);
  // Keep a visible floor so the lowest bar is not invisible.
  const floor = 0.15;
  return values.map((v) => floor + ((v - min) / (max - min)) * (1 - floor));
}
