import { APPROVED_TIERS_FALLBACK, bestAffordableTier, nextTier } from '../display';

describe('points display', () => {
  it('shows the biggest affordable discount from the approved tiers', () => {
    expect(bestAffordableTier(1240, APPROVED_TIERS_FALLBACK)?.value_cents).toBe(1250);
    expect(bestAffordableTier(500, APPROVED_TIERS_FALLBACK)?.value_cents).toBe(500);
    expect(bestAffordableTier(2500, APPROVED_TIERS_FALLBACK)?.value_cents).toBe(3000);
    expect(bestAffordableTier(499, APPROVED_TIERS_FALLBACK)).toBeNull();
  });
  it('tells how far the next tier is', () => {
    expect(nextTier(120, APPROVED_TIERS_FALLBACK)).toEqual({ tier: { points: 500, value_cents: 500 }, missing: 380 });
    expect(nextTier(1240, APPROVED_TIERS_FALLBACK)?.missing).toBe(760);
    expect(nextTier(2000, APPROVED_TIERS_FALLBACK)).toBeNull();
  });
});
