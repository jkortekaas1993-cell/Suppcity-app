import { canCheckout, clampQuantity, lineChangeFor, normaliseDiscountCode } from '../logic/cart';

describe('cart helpers', () => {
  it('clamps quantities', () => {
    expect(clampQuantity(-3)).toBe(0);
    expect(clampQuantity(2.6)).toBe(3);
    expect(clampQuantity(99)).toBe(20);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });
  it('picks the right mutation', () => {
    const line = { id: 'l', quantity: 2 };
    expect(lineChangeFor(line, 2)).toEqual({ kind: 'noop' });
    expect(lineChangeFor(line, 0)).toEqual({ kind: 'remove', lineId: 'l' });
    expect(lineChangeFor(line, 3)).toEqual({ kind: 'update', lineId: 'l', quantity: 3 });
  });
  it('blocks checkout for empty carts or unavailable lines', () => {
    expect(canCheckout(null)).toBe(false);
    expect(canCheckout({ totalQuantity: 0, lines: [] })).toBe(false);
    const base = { id: 'l', quantity: 1, variantId: 'v', variantTitle: null, productTitle: 'P', productHandle: 'p', image: null };
    const money = { cents: 100, currencyCode: 'EUR' };
    const ok = { ...base, unitPrice: money, lineTotal: money, available: true };
    expect(canCheckout({ totalQuantity: 1, lines: [ok] })).toBe(true);
    expect(canCheckout({ totalQuantity: 1, lines: [{ ...ok, available: false }] })).toBe(false);
  });
  it('normalises discount codes', () => {
    expect(normaliseDiscountCode(' app10 ')).toBe('APP10');
    expect(normaliseDiscountCode('')).toBeNull();
    expect(normaliseDiscountCode(undefined)).toBeNull();
  });
});
