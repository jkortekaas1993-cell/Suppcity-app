import { getStorefront, userMessageFor, type OrderSummary } from '@/lib/shopify';

import { runReorder, singleVariantOrder, type ReorderDeps, type ReorderOutcome } from '../logic/reorderFlow';
import { cartStore } from '../state/cartStore';

export type { ReorderOutcome } from '../logic/reorderFlow';

const deps: ReorderDeps = {
  availability: (ids) => getStorefront().variantAvailability(ids),
  addToCart: (lines, notice) => cartStore.add(lines, notice),
  cartError: () => cartStore.get().error,
  errorMessage: userMessageFor,
};

/** Add the lines of a past order to the cart (the cart is never emptied). */
export function reorder(order: Pick<OrderSummary, 'lines'>): Promise<ReorderOutcome> {
  return runReorder(order, deps);
}

/** Add a single variant to the cart (ReorderCard "Bestel" on Vandaag, stock counter). */
export function reorderVariant(variantId: string): Promise<ReorderOutcome> {
  return runReorder(singleVariantOrder(variantId), deps);
}
