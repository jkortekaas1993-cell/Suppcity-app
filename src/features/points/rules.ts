import { POINTS } from '@/lib/config/constants';

/**
 * Client-side mirror of the points rules for display only (hard rule 5).
 * The server (points_ledger trigger + Edge Functions) is authoritative.
 * No randomness, weekly cap, 18+ only. Never uses body/health data (hard rule 1).
 */
export function pointsForOrder(totalEuro: number): number {
  if (!Number.isFinite(totalEuro) || totalEuro <= 0) return 0;
  return Math.floor(totalEuro) * POINTS.perEuroSpent;
}

export function workoutPointsAvailable(workoutsRewardedThisWeek: number): number {
  return workoutsRewardedThisWeek < POINTS.maxWorkoutsRewardedPerWeek ? POINTS.perWorkout : 0;
}
