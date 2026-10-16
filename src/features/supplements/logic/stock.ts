import { intakesPerWeek, type ScheduleLike } from './schedule';

/**
 * Supplement stock ("voorraad") logic. Pure.
 *
 * Units are servings ("porties") as the user typed them: one intake = one unit.
 * Days left = units left / planned intakes per day (from the user's own schedule).
 */

/** At or below this many days the bar turns gold and the shop may be told "bijna op". */
export const LOW_STOCK_DAYS = 7;

export interface SupplementStockInput {
  units_left: number | null;
  units_per_pack: number | null;
}

export interface StockView {
  /** Whole days left (floor), null when unknown (no count or no schedule). */
  daysLeft: number | null;
  /** 0..1 of a full pack, null when the pack size is unknown. */
  fraction: number | null;
  low: boolean;
  empty: boolean;
}

export function stockView(s: SupplementStockInput, schedules: readonly Pick<ScheduleLike, 'days_mask'>[]): StockView {
  const perWeek = intakesPerWeek(schedules);
  const left = s.units_left;
  const daysLeft = left === null || perWeek === 0 ? null : Math.floor((left * 7) / perWeek);
  const fraction =
    left === null || s.units_per_pack === null || s.units_per_pack <= 0 ? null : Math.min(1, Math.max(0, left / s.units_per_pack));
  return {
    daysLeft,
    fraction,
    low: daysLeft !== null && daysLeft <= LOW_STOCK_DAYS,
    empty: left !== null && left <= 0,
  };
}

/** New units_left after an intake changes state. Never below zero; null stays null. */
export function applyIntakeDelta(unitsLeft: number | null, wasTaken: boolean, isTaken: boolean): number | null {
  if (unitsLeft === null || wasTaken === isTaken) return unitsLeft;
  return isTaken ? Math.max(0, unitsLeft - 1) : unitsLeft + 1;
}

/** "~6 dagen", "~1 dag", "op". */
export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'op';
  return days === 1 ? '~1 dag' : `~${days} dagen`;
}

/** What the shop's ReorderCard may know: only "almost out for variant X" (hard rule 1). */
export interface SupplementReorderSignal {
  variantGid: string;
  /** The name the user gave the supplement, for the card text. */
  productTitle: string;
  daysLeft: number;
}

export interface ReorderCandidate extends SupplementStockInput {
  name: string;
  shopify_variant_gid: string | null;
  schedules: readonly Pick<ScheduleLike, 'days_mask'>[];
}

/**
 * Linked supplements that are almost out, most urgent first. Carries no intake log,
 * no times and no schedule: only variant, name and days left.
 */
export function reorderSignals(items: readonly ReorderCandidate[], thresholdDays = LOW_STOCK_DAYS): SupplementReorderSignal[] {
  const out: SupplementReorderSignal[] = [];
  for (const it of items) {
    if (!it.shopify_variant_gid) continue;
    const v = stockView(it, it.schedules);
    if (v.daysLeft === null || v.daysLeft > thresholdDays) continue;
    out.push({ variantGid: it.shopify_variant_gid, productTitle: it.name, daysLeft: v.daysLeft });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.productTitle.localeCompare(b.productTitle));
}
