import type { StockEstimate, StockItemInput } from './stock';

/**
 * A "running low" signal from outside the stock counter (the supplement schedule).
 * Hard rule 1: ONLY variant, the user's own name and days left. No intake data.
 */
export interface ExternalReorderSignal {
  variantGid: string;
  productTitle: string;
  daysLeft: number;
}

export type ReorderPick =
  | { source: 'stock'; item: StockItemInput; estimate: StockEstimate }
  | { source: 'external'; signal: ExternalReorderSignal };

interface Normalised {
  pick: ReorderPick;
  variantId: string | null;
  daysLeft: number;
}

/**
 * The single most urgent item for the Vandaag ReorderCard: fewest days left across the
 * stock counter's due items and the external signals. When both sources track the same
 * variant it is shown once, with the most urgent (lowest) estimate. Ties prefer the
 * stock counter (it has the user's own reminder setting). Null when nothing is due.
 */
export function pickMostUrgent(
  stockDue: readonly { item: StockItemInput; estimate: StockEstimate }[],
  external: readonly ExternalReorderSignal[],
): ReorderPick | null {
  const all: Normalised[] = [
    ...stockDue.map((d) => ({
      pick: { source: 'stock', item: d.item, estimate: d.estimate } as const,
      variantId: d.item.variantId,
      daysLeft: d.estimate.daysLeft,
    })),
    ...external
      .filter((s) => Number.isFinite(s.daysLeft))
      .map((s) => ({ pick: { source: 'external', signal: s } as const, variantId: s.variantGid, daysLeft: Math.max(0, s.daysLeft) })),
  ];

  // Dedupe by variant: keep the lowest days left (stable, so stock wins ties).
  const byVariant = new Map<string, Normalised>();
  const rest: Normalised[] = [];
  for (const n of all) {
    if (!n.variantId) {
      rest.push(n);
      continue;
    }
    const seen = byVariant.get(n.variantId);
    if (!seen || n.daysLeft < seen.daysLeft) byVariant.set(n.variantId, n);
  }
  const candidates = [...byVariant.values(), ...rest];
  let best: Normalised | null = null;
  for (const c of candidates) {
    if (
      !best ||
      c.daysLeft < best.daysLeft ||
      (c.daysLeft === best.daysLeft && c.pick.source === 'stock' && best.pick.source !== 'stock')
    )
      best = c;
  }
  return best?.pick ?? null;
}
