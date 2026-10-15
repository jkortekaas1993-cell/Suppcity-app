import type { VariantAvailability } from '@/lib/shopify/models';

import { planReorder, reorderableVariantIds, skippedNotice } from '../logic/reorder';

const avail = (variantId: string, available: boolean, productTitle = 'P'): [string, VariantAvailability] => [
  variantId,
  { variantId, available, productTitle, variantTitle: '' },
];

const line = (over: Partial<{ title: string; variantTitle: string | null; variantId: string | null; quantity: number; isGiftCard: boolean }>) => ({
  title: 'Creatine',
  variantTitle: null,
  variantId: 'v1',
  quantity: 1,
  isGiftCard: false,
  ...over,
});

describe('planReorder', () => {
  it('adds available lines and merges duplicate variants', () => {
    const plan = planReorder(
      [line({ variantId: 'v1', quantity: 1 }), line({ variantId: 'v1', quantity: 2 }), line({ variantId: 'v2', title: 'Whey' })],
      new Map([avail('v1', true), avail('v2', true)]),
    );
    expect(plan.lines).toEqual([
      { variantId: 'v1', quantity: 3 },
      { variantId: 'v2', quantity: 1 },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('skips sold-out, deleted, variant-less and gift-card lines with reasons', () => {
    const plan = planReorder(
      [
        line({ title: 'Whey', variantTitle: 'Chocolade', variantId: 'sold' }),
        line({ title: 'Oud', variantId: 'gone' }),
        line({ title: 'Custom', variantId: null }),
        line({ title: 'Cadeaubon', isGiftCard: true }),
        line({ title: 'Creatine', variantId: 'ok' }),
      ],
      new Map([avail('sold', false), avail('ok', true), ['gone', { variantId: 'gone', available: false, productTitle: '', variantTitle: '' }]]),
    );
    expect(plan.lines).toEqual([{ variantId: 'ok', quantity: 1 }]);
    expect(plan.skipped).toEqual([
      { title: 'Whey (Chocolade)', reason: 'sold_out' },
      { title: 'Oud', reason: 'no_longer_sold' },
      { title: 'Custom', reason: 'no_longer_sold' },
      { title: 'Cadeaubon', reason: 'gift_card' },
    ]);
    expect(skippedNotice(plan.skipped)).toBe(
      'Niet toegevoegd: Whey (Chocolade) (uitverkocht), Oud (niet meer leverbaar), Custom (niet meer leverbaar), Cadeaubon (cadeaubon).',
    );
  });

  it('returns no notice when nothing was skipped', () => {
    expect(skippedNotice([])).toBeNull();
  });

  it('collects unique reorderable ids', () => {
    expect(
      reorderableVariantIds([
        { variantId: 'a', isGiftCard: false },
        { variantId: 'a', isGiftCard: false },
        { variantId: null, isGiftCard: false },
        { variantId: 'g', isGiftCard: true },
      ]),
    ).toEqual(['a']);
  });
});
