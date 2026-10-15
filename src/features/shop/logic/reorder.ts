import type { NewCartLine, OrderLine, VariantAvailability } from '@/lib/shopify/models';

/**
 * "Opnieuw bestellen": turn the lines of a past order into new cart lines.
 * Pure: availability is looked up beforehand via Storefront `nodes(ids:)`.
 */
export type SkipReason = 'sold_out' | 'no_longer_sold' | 'gift_card';

export interface SkippedLine {
  title: string;
  reason: SkipReason;
}

export interface ReorderPlan {
  lines: NewCartLine[];
  skipped: SkippedLine[];
}

export function planReorder(
  orderLines: readonly Pick<OrderLine, 'title' | 'variantTitle' | 'variantId' | 'quantity' | 'isGiftCard'>[],
  availability: ReadonlyMap<string, VariantAvailability>,
): ReorderPlan {
  const quantities = new Map<string, number>();
  const skipped: SkippedLine[] = [];

  for (const line of orderLines) {
    const title = line.variantTitle ? `${line.title} (${line.variantTitle})` : line.title;
    if (line.isGiftCard) {
      skipped.push({ title, reason: 'gift_card' });
      continue;
    }
    if (!line.variantId || line.quantity <= 0) {
      skipped.push({ title, reason: 'no_longer_sold' });
      continue;
    }
    const info = availability.get(line.variantId);
    if (!info || !info.productTitle) {
      skipped.push({ title, reason: 'no_longer_sold' });
      continue;
    }
    if (!info.available) {
      skipped.push({ title, reason: 'sold_out' });
      continue;
    }
    // Same variant twice in one order (e.g. split lines) → one cart line.
    quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
  }

  return {
    lines: [...quantities.entries()].map(([variantId, quantity]) => ({ variantId, quantity })),
    skipped,
  };
}

/** Variant ids worth looking up (dedupe, drop nulls and gift cards). */
export function reorderableVariantIds(
  orderLines: readonly Pick<OrderLine, 'variantId' | 'isGiftCard'>[],
): string[] {
  const ids = new Set<string>();
  for (const l of orderLines) if (l.variantId && !l.isGiftCard) ids.add(l.variantId);
  return [...ids];
}

/** Dutch notice for the UI, e.g. "Niet toegevoegd: Creatine 500 g (uitverkocht)." */
export function skippedNotice(skipped: readonly SkippedLine[]): string | null {
  if (skipped.length === 0) return null;
  const label: Record<SkipReason, string> = {
    sold_out: 'uitverkocht',
    no_longer_sold: 'niet meer leverbaar',
    gift_card: 'cadeaubon',
  };
  return `Niet toegevoegd: ${skipped.map((s) => `${s.title} (${label[s.reason]})`).join(', ')}.`;
}
