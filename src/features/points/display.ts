import type { PointsRedeemTier } from '@/lib/supabase';

/**
 * Display-only helpers for the points card (no business logic: the server decides).
 * The approved tiers ("staffel") are 500 = €5, 1000 = €12,50, 2000 = €30
 * (supabase/migrations/0003_accounts_points.sql). The server's tiers win once loaded;
 * this copy only fills the "= €x korting" line before they arrive.
 */
export const APPROVED_TIERS_FALLBACK: readonly Pick<PointsRedeemTier, 'points' | 'value_cents'>[] = [
  { points: 500, value_cents: 500 },
  { points: 1000, value_cents: 1250 },
  { points: 2000, value_cents: 3000 },
];

type TierLike = Pick<PointsRedeemTier, 'points' | 'value_cents'>;

/** The biggest discount the balance can be exchanged for right now (null below the lowest tier). */
export function bestAffordableTier<T extends TierLike>(balance: number, tiers: readonly T[]): T | null {
  let best: T | null = null;
  for (const t of tiers) if (t.points <= balance && (!best || t.points > best.points)) best = t;
  return best;
}

/** The next tier still out of reach and how many points are missing. */
export function nextTier<T extends TierLike>(balance: number, tiers: readonly T[]): { tier: T; missing: number } | null {
  let next: T | null = null;
  for (const t of tiers) if (t.points > balance && (!next || t.points < next.points)) next = t;
  return next ? { tier: next, missing: next.points - balance } : null;
}
