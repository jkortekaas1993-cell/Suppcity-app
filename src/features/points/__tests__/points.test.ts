import { FunctionCallError } from '@/lib/supabase/contracts';

import { redeemErrorMessage } from '../errors';
import { redeemTier, resumePendingRedemption, type PendingRedemption, type PendingRedemptionStore } from '../redeemFlow';
import { pointsForOrder, workoutPointsAvailable } from '../rules';
import { canAfford, formatEuroCents, ledgerLabel } from '../service';

describe('points display helpers', () => {
  it('formats euro cents in Dutch style', () => {
    expect(formatEuroCents(500)).toBe('€ 5,00');
    expect(formatEuroCents(1250)).toBe('€ 12,50');
  });
  it('labels and affordability', () => {
    expect(ledgerLabel({ reason: 'workout' })).toBe('Training afgerond');
    expect(canAfford(499, { points: 500 })).toBe(false);
    expect(canAfford(500, { points: 500 })).toBe(true);
  });
  it('maps redeem errors; only transient ones are retryable', () => {
    expect(redeemErrorMessage(new FunctionCallError('insufficient_points', 409)).retryable).toBe(false);
    expect(redeemErrorMessage(new FunctionCallError('redeem_failed', 502)).message).toContain('teruggezet');
    expect(redeemErrorMessage(new FunctionCallError('redeem_pending', 503)).retryable).toBe(true);
    expect(redeemErrorMessage(new Error('offline')).retryable).toBe(true);
  });
});

describe('points rules (hard rule 5)', () => {
  it('awards whole euros only', () => {
    expect(pointsForOrder(49.99)).toBe(49);
    expect(pointsForOrder(-5)).toBe(0);
    expect(pointsForOrder(Number.NaN)).toBe(0);
  });
  it('caps rewarded workouts per week', () => {
    expect(workoutPointsAvailable(2)).toBeGreaterThan(0);
    expect(workoutPointsAvailable(3)).toBe(0);
  });
});

describe('redemption key survives a restart (M5)', () => {
  const ok = { redemptionId: 'r', status: 'issued' as const, code: 'SC-1', valueCents: 500, minOrderCents: 2500, points: 500, expiresAt: 'x' };
  function memStore() {
    let v: PendingRedemption | null = null;
    const store: PendingRedemptionStore = { get: async () => v, set: async (p) => void (v = p), clear: async () => void (v = null) };
    return { store, peek: () => v };
  }

  it('persists the key before calling and reuses it after a crash', async () => {
    const s = memStore();
    const sent: string[] = [];
    let ids = 0;
    const down = { redeem: async (req: { redemptionId: string }) => { sent.push(req.redemptionId); throw new FunctionCallError('redeem_pending', 503); } };
    const r1 = await redeemTier(down, s.store, 'eur5', () => `id${++ids}`);
    expect(r1).toMatchObject({ status: 'error', retryable: true });
    expect(s.peek()).toEqual({ tierId: 'eur5', redemptionId: 'id1' });

    // "app restart": a new run resumes with the SAME key
    const up = { redeem: async (req: { redemptionId: string }) => { sent.push(req.redemptionId); return { ...ok, redemptionId: req.redemptionId }; } };
    const r2 = await resumePendingRedemption(up, s.store);
    expect(r2).toMatchObject({ status: 'done' });
    expect(sent).toEqual(['id1', 'id1']);
    expect(s.peek()).toBeNull();
    expect(await resumePendingRedemption(up, s.store)).toBeNull();
  });

  it('clears the key on a definitive error; finishes an older pending tier first', async () => {
    const s = memStore();
    const failed = { redeem: async () => { throw new FunctionCallError('redeem_failed', 502); } };
    expect(await redeemTier(failed, s.store, 'eur5', () => 'a')).toMatchObject({ status: 'error', retryable: false });
    expect(s.peek()).toBeNull();

    await s.store.set({ tierId: 'eur5', redemptionId: 'old' });
    const sent: string[] = [];
    const up = { redeem: async (req: { redemptionId: string }) => { sent.push(req.redemptionId); return ok; } };
    await redeemTier(up, s.store, 'eur30', () => 'new');
    expect(sent).toEqual(['old', 'new']);
    expect(s.peek()).toBeNull();
  });
});
