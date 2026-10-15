import type { RedeemPointsResponse } from '@/lib/supabase';

import { redeemErrorMessage } from './errors';
import type { PointsService } from './service';

/**
 * Redemption with a PERSISTED idempotency key (review M5). The key is written to the
 * local app_state before the call and removed only on a definitive answer, so an
 * app crash or kill mid-redemption is finished on the next start with the same key
 * (the server never debits twice for one key). If the user never comes back, the
 * server sweep `redeem_expire_stale()` refunds pending redemptions after 1 hour.
 */
export interface PendingRedemption {
  tierId: string;
  redemptionId: string;
}

export interface PendingRedemptionStore {
  get(): Promise<PendingRedemption | null>;
  set(p: PendingRedemption): Promise<void>;
  clear(): Promise<void>;
}

export const PENDING_REDEMPTION_KEY = 'points.pendingRedemption';

export type RedeemOutcome =
  | { status: 'done'; result: RedeemPointsResponse }
  | { status: 'error'; message: string; retryable: boolean };

async function attempt(svc: Pick<PointsService, 'redeem'>, store: PendingRedemptionStore, p: PendingRedemption): Promise<RedeemOutcome> {
  try {
    const result = await svc.redeem(p);
    await store.clear();
    return { status: 'done', result };
  } catch (e) {
    const { message, retryable } = redeemErrorMessage(e);
    if (!retryable) await store.clear(); // definitive: a new attempt needs a new key
    return { status: 'error', message, retryable };
  }
}

/** Finish a redemption left over from an earlier run (call on start). Null when none. */
export async function resumePendingRedemption(
  svc: Pick<PointsService, 'redeem'>,
  store: PendingRedemptionStore,
): Promise<RedeemOutcome | null> {
  const pending = await store.get();
  return pending ? attempt(svc, store, pending) : null;
}

export async function redeemTier(
  svc: Pick<PointsService, 'redeem'>,
  store: PendingRedemptionStore,
  tierId: string,
  newId: () => string,
): Promise<RedeemOutcome> {
  const existing = await store.get();
  if (existing && existing.tierId !== tierId) {
    // Finish the earlier one first; never leave a debited redemption behind.
    const earlier = await attempt(svc, store, existing);
    if (earlier.status === 'error' && earlier.retryable) return earlier;
  }
  const reuse = existing && existing.tierId === tierId ? existing : null;
  const pending = reuse ?? { tierId, redemptionId: newId() };
  if (!reuse) await store.set(pending);
  return attempt(svc, store, pending);
}
