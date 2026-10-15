import { getStorefront, userMessageFor, type OrderSummary } from '@/lib/shopify';

import { planReorder, reorderableVariantIds, skippedNotice } from '../logic/reorder';
import { cartStore } from '../state/cartStore';

export type ReorderOutcome = { ok: true; notice: string | null } | { ok: false; message: string };

/** Put the lines of a past order into a new cart, skipping what's sold out. */
export async function reorder(order: Pick<OrderSummary, 'lines'>): Promise<ReorderOutcome> {
  try {
    const availability = await getStorefront().variantAvailability(reorderableVariantIds(order.lines));
    const plan = planReorder(order.lines, availability);
    const notice = skippedNotice(plan.skipped);
    if (plan.lines.length === 0) {
      return { ok: false, message: notice ?? 'Geen van deze producten is nu leverbaar.' };
    }
    const ok = await cartStore.replaceWith(plan.lines, notice);
    return ok ? { ok: true, notice } : { ok: false, message: cartStore.get().error ?? 'Opnieuw bestellen lukte niet.' };
  } catch (error) {
    return { ok: false, message: userMessageFor(error) };
  }
}

/** Reorder a single variant (stock counter card). */
export async function reorderVariant(variantId: string): Promise<ReorderOutcome> {
  return reorder({
    lines: [
      { id: variantId, title: '', variantTitle: null, quantity: 1, variantId, productId: null, image: null, total: null, isGiftCard: false },
    ],
  });
}
