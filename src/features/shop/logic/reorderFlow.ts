import type { NewCartLine, OrderSummary, VariantAvailability } from '@/lib/shopify';

import { planReorder, reorderableVariantIds, skippedNotice } from './reorder';

export type ReorderOutcome = { ok: true; notice: string | null } | { ok: false; message: string };

export interface ReorderDeps {
  availability(variantIds: string[]): Promise<Map<string, VariantAvailability>>;
  /** ADDS to the current cart (never replaces or empties it). */
  addToCart(lines: NewCartLine[], notice: string | null): Promise<boolean>;
  cartError(): string | null;
  errorMessage(error: unknown): string;
}

/**
 * Put the lines of a past order (or one variant) INTO the cart, skipping what's sold out.
 * Whatever was already in the cart stays; the caller then opens the cart. Pure flow,
 * wired to Storefront + cartStore in actions/reorder.ts.
 */
export async function runReorder(order: Pick<OrderSummary, 'lines'>, deps: ReorderDeps): Promise<ReorderOutcome> {
  try {
    const availability = await deps.availability(reorderableVariantIds(order.lines));
    const plan = planReorder(order.lines, availability);
    const notice = skippedNotice(plan.skipped);
    if (plan.lines.length === 0) {
      return { ok: false, message: notice ?? 'Geen van deze producten is nu leverbaar.' };
    }
    const ok = await deps.addToCart(plan.lines, notice);
    return ok ? { ok: true, notice } : { ok: false, message: deps.cartError() ?? 'Opnieuw bestellen lukte niet.' };
  } catch (error) {
    return { ok: false, message: deps.errorMessage(error) };
  }
}

/** One variant as an order line (ReorderCard "Bestel", stock counter). */
export function singleVariantOrder(variantId: string): Pick<OrderSummary, 'lines'> {
  return {
    lines: [
      { id: variantId, title: '', variantTitle: null, quantity: 1, variantId, productId: null, image: null, total: null, isGiftCard: false },
    ],
  };
}
