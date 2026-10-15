import { FunctionCallError } from '@/lib/supabase/contracts';

import { redeemErrorMessage } from '../hooks';
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
