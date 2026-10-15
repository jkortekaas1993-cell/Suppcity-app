import type { Cart, CartLine } from '@/lib/shopify/models';

/** Pure cart helpers used by the cart screen and badge. */
export const MAX_LINE_QUANTITY = 20;

export function clampQuantity(q: number): number {
  if (!Number.isFinite(q)) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.round(q)));
}

export type LineChange =
  | { kind: 'noop' }
  | { kind: 'remove'; lineId: string }
  | { kind: 'update'; lineId: string; quantity: number };

/** Decide which mutation a quantity stepper tap needs. */
export function lineChangeFor(line: Pick<CartLine, 'id' | 'quantity'>, requested: number): LineChange {
  const quantity = clampQuantity(requested);
  if (quantity === line.quantity) return { kind: 'noop' };
  if (quantity === 0) return { kind: 'remove', lineId: line.id };
  return { kind: 'update', lineId: line.id, quantity };
}

export function cartItemCount(cart: Pick<Cart, 'totalQuantity'> | null | undefined): number {
  return cart?.totalQuantity ?? 0;
}

/** Lines that became unavailable since they were added; checkout would reject them. */
export function unavailableLines(cart: Pick<Cart, 'lines'>): CartLine[] {
  return cart.lines.filter((l) => !l.available);
}

export function canCheckout(cart: Pick<Cart, 'lines' | 'totalQuantity'> | null | undefined): boolean {
  return !!cart && cart.totalQuantity > 0 && unavailableLines(cart).length === 0;
}

/** Normalise a discount code from config: trimmed, uppercase, or null when empty. */
export function normaliseDiscountCode(raw: string | undefined | null): string | null {
  const code = raw?.trim().toUpperCase();
  return code ? code : null;
}
