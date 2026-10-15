import {
  estimateStock,
  itemsToRemind,
  localIsoDate,
  parseDecimal,
  reorderPrompt,
  totalServings,
  validateStockInput,
  type StockItemInput,
} from '../logic/stock';

const creatine: StockItemInput = {
  id: '1',
  productTitle: 'Creatine',
  variantId: 'v1',
  packageAmount: 500,
  servingAmount: 5,
  unit: 'g',
  servingsPerDay: 1,
  packages: 1,
  startedOn: '2026-10-01',
  remindDaysBefore: 7,
};

describe('stock estimate (user input only, hard rule 1)', () => {
  it('counts servings per package', () => {
    expect(totalServings(creatine)).toBe(100);
    expect(totalServings({ packageAmount: 1000, servingAmount: 30, packages: 2 })).toBe(66);
    expect(totalServings({ packageAmount: 0.3, servingAmount: 0.1, packages: 1 })).toBe(3);
  });

  it('uses nothing on the start day', () => {
    const e = estimateStock(creatine, '2026-10-01');
    expect(e.servingsLeft).toBe(100);
    expect(e.daysLeft).toBe(100);
    expect(e.runsOutOn).toBe('2027-01-09');
    expect(e.shouldRemind).toBe(false);
  });

  it('counts down per elapsed day and crosses months/DST safely', () => {
    const e = estimateStock({ ...creatine, servingsPerDay: 2 }, '2026-11-15');
    // 45 days elapsed × 2 = 90 used → 10 left → 5 days.
    expect(e.servingsLeft).toBe(10);
    expect(e.daysLeft).toBe(5);
    expect(e.runsOutOn).toBe('2026-11-20');
    expect(e.shouldRemind).toBe(true);
  });

  it('supports fractional servings per day', () => {
    const e = estimateStock({ ...creatine, servingsPerDay: 1.5 }, '2026-10-11');
    expect(e.servingsLeft).toBe(85);
    expect(e.daysLeft).toBe(56);
  });

  it('never goes negative and flags empty', () => {
    const e = estimateStock(creatine, '2027-06-01');
    expect(e.servingsLeft).toBe(0);
    expect(e.daysLeft).toBe(0);
    expect(e.isEmpty).toBe(true);
  });

  it('treats a future start date as full', () => {
    expect(estimateStock(creatine, '2026-09-20').daysLeft).toBe(100);
  });

  it('lists reminders soonest first', () => {
    const later = { ...creatine, id: '2', productTitle: 'Whey', startedOn: '2026-10-10' };
    const soon = { ...creatine, id: '3', productTitle: 'Omega', startedOn: '2026-07-01' };
    const result = itemsToRemind([later, creatine, soon], '2026-10-05');
    expect(result.map((r) => r.item.id)).toEqual(['3']);
    expect(itemsToRemind([later, soon, { ...soon, id: '4', startedOn: '2026-06-01' }], '2026-10-05').map((r) => r.item.id)).toEqual([
      '4',
      '3',
    ]);
  });

  it('writes the Vandaag prompt', () => {
    expect(reorderPrompt('Creatine', { daysLeft: 12 })).toBe('Nog ~12 dagen Creatine. Opnieuw bestellen?');
    expect(reorderPrompt('Creatine', { daysLeft: 1 })).toBe('Nog ~1 dag Creatine. Opnieuw bestellen?');
    expect(reorderPrompt('Creatine', { daysLeft: 0 })).toBe('Creatine is waarschijnlijk op. Opnieuw bestellen?');
  });
});

describe('stock input validation', () => {
  it('accepts valid input', () => {
    expect(validateStockInput(creatine)).toEqual([]);
  });
  it('rejects bad values', () => {
    expect(
      validateStockInput({ ...creatine, packageAmount: 0, servingsPerDay: 0, packages: 1.5, startedOn: '1-10-2026', remindDaysBefore: -1 }),
    ).toEqual(['package_amount', 'servings_per_day', 'packages', 'started_on', 'remind_days']);
    expect(validateStockInput({ ...creatine, servingAmount: 600 })).toEqual(['serving_larger_than_package']);
  });
  it('parses Dutch decimals', () => {
    expect(parseDecimal('2,5')).toBe(2.5);
    expect(parseDecimal(' 30 ')).toBe(30);
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('-1')).toBeNaN();
  });
  it('formats local dates', () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
