import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { POINTS } from '@/lib/config/constants';
import {
  FUNCTIONS,
  invokeFunction,
  RedeemPointsResponse,
  WORKOUT_POINTS_RESULTS,
  type PointsLedgerEntry,
  type PointsRedeemTier,
  type RedeemPointsRequest,
  type WorkoutPointsResult,
} from '@/lib/supabase';

/**
 * Points data access (hard rule 5). Read-only for the client except two server
 * calls: the `award_workout_points` RPC and the `redeem-points` Edge Function.
 * Body/health data never enters any of these calls (hard rule 1).
 */
export interface PointsService {
  balance(): Promise<number>;
  history(limit?: number): Promise<PointsLedgerEntry[]>;
  tiers(): Promise<PointsRedeemTier[]>;
  /** Pass a stable redemptionId; reuse it when retrying after an error. */
  redeem(req: RedeemPointsRequest): Promise<RedeemPointsResponse>;
  /** Call after a workout is finished AND synced. Server decides eligibility. */
  claimWorkoutPoints(workoutId: string): Promise<WorkoutPointsResult>;
}

const LedgerRow = z.object({
  id: z.string(),
  user_id: z.string(),
  reason: z.enum(['order', 'workout', 'redeem', 'adjustment', 'expiry']),
  points: z.number().int(),
  reference: z.string().nullable(),
  iso_week: z.string().nullable(),
  created_at: z.string(),
});
const TierRow = z.object({
  id: z.string(),
  points: z.number().int(),
  value_cents: z.number().int(),
  min_order_cents: z.number().int(),
  valid_days: z.number().int(),
});

export function createPointsService(client: SupabaseClient): PointsService {
  return {
    async balance() {
      const { data, error } = await client.from('points_balance').select('balance').maybeSingle();
      if (error) throw error;
      return z.object({ balance: z.number() }).nullable().parse(data)?.balance ?? 0;
    },
    async history(limit = 50) {
      const { data, error } = await client
        .from('points_ledger')
        .select('id, user_id, reason, points, reference, iso_week, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return z.array(LedgerRow).parse(data ?? []);
    },
    async tiers() {
      const { data, error } = await client
        .from('points_redeem_tiers')
        .select('id, points, value_cents, min_order_cents, valid_days')
        .order('points', { ascending: true });
      if (error) throw error;
      return z.array(TierRow).parse(data ?? []);
    },
    redeem: (req) => invokeFunction(client, FUNCTIONS.redeemPoints, req, RedeemPointsResponse),
    async claimWorkoutPoints(workoutId) {
      const { data, error } = await client.rpc('award_workout_points', { p_workout_id: workoutId });
      if (error) throw error;
      return z.enum(WORKOUT_POINTS_RESULTS).parse(data);
    },
  };
}

/** Pure display helpers (Dutch UI). */
export function formatEuroCents(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `€ ${euros},${rest}`;
}

const REASON_LABELS: Record<PointsLedgerEntry['reason'], string> = {
  order: 'Bestelling',
  workout: 'Training afgerond',
  redeem: 'Ingewisseld',
  adjustment: 'Correctie',
  expiry: 'Verlopen',
};

export function ledgerLabel(entry: Pick<PointsLedgerEntry, 'reason'>): string {
  return REASON_LABELS[entry.reason];
}

export function canAfford(balance: number, tier: Pick<PointsRedeemTier, 'points'>): boolean {
  return balance >= tier.points;
}

export const POINTS_RULES_TEXT = `1 punt per euro en ${POINTS.perWorkout} punten per training (max. ${POINTS.maxWorkoutsRewardedPerWeek} per week). Vanaf 18 jaar.`;
