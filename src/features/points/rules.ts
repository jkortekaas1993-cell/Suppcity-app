import { POINTS } from '@/lib/config/constants';

/**
 * Client-side mirror of the points rules for display only (hard rule 5).
 * The server (points_ledger trigger + Edge Functions) is authoritative.
 * No randomness, weekly cap, 18+ only. Never uses body/health data (hard rule 1).
 *
 * Order points: floor(order subtotal after discounts, excl. shipping, in EUR).
 * See supabase/functions/_shared/orderPoints.ts.
 */
export function pointsForOrder(subtotalAfterDiscountsEuro: number): number {
  if (!Number.isFinite(subtotalAfterDiscountsEuro) || subtotalAfterDiscountsEuro <= 0) return 0;
  return Math.floor(subtotalAfterDiscountsEuro) * POINTS.perEuroSpent;
}

export function workoutPointsAvailable(workoutsRewardedThisWeek: number): number {
  return workoutsRewardedThisWeek < POINTS.maxWorkoutsRewardedPerWeek ? POINTS.perWorkout : 0;
}
