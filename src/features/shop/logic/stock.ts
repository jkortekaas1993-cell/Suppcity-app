/**
 * Smart stock counter ("slimme voorraadteller").
 *
 * HARD RULE 1: the estimate uses ONLY what the user typed in about the product
 * (package contents, serving size, servings per day, start date). Never training,
 * body or health data. Do not add such inputs here.
 *
 * Mirrors the server table `stock_items` (servings_total, servings_per_day,
 * opened_at, remind_days_before) so Backend&Sync can sync it later.
 */
export interface StockItemInput {
  id: string;
  productTitle: string;
  /** Shopify variant gid, used for one-tap reorder. */
  variantId: string | null;
  /** Contents of one package, in `unit` (e.g. 1000 g, 90 capsules). */
  packageAmount: number;
  /** One serving, in the same unit (e.g. 5 g, 3 capsules). */
  servingAmount: number;
  unit: StockUnit;
  servingsPerDay: number;
  /** How many packages were opened/bought together. */
  packages: number;
  /** ISO date (YYYY-MM-DD) the user started using it. */
  startedOn: string;
  remindDaysBefore: number;
}

export type StockUnit = 'g' | 'ml' | 'stuks';

export const STOCK_UNITS: readonly StockUnit[] = ['g', 'ml', 'stuks'];

export interface StockEstimate {
  servingsTotal: number;
  servingsLeft: number;
  /** Whole days left, never negative. */
  daysLeft: number;
  /** ISO date when it's expected to run out. */
  runsOutOn: string;
  shouldRemind: boolean;
  isEmpty: boolean;
}

export type StockValidationError =
  | 'package_amount'
  | 'serving_amount'
  | 'serving_larger_than_package'
  | 'servings_per_day'
  | 'packages'
  | 'started_on'
  | 'remind_days';

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function utcDayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

function isoFromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Local calendar date as YYYY-MM-DD (the user's "today"). */
export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function validateStockInput(input: Omit<StockItemInput, 'id' | 'productTitle' | 'variantId'>): StockValidationError[] {
  const errors: StockValidationError[] = [];
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  if (!positive(input.packageAmount)) errors.push('package_amount');
  if (!positive(input.servingAmount)) errors.push('serving_amount');
  else if (positive(input.packageAmount) && input.servingAmount > input.packageAmount) errors.push('serving_larger_than_package');
  if (!positive(input.servingsPerDay) || input.servingsPerDay > 20) errors.push('servings_per_day');
  if (!Number.isInteger(input.packages) || input.packages < 1 || input.packages > 50) errors.push('packages');
  if (!ISO_DATE.test(input.startedOn) || Number.isNaN(utcDayNumber(input.startedOn))) errors.push('started_on');
  if (!Number.isInteger(input.remindDaysBefore) || input.remindDaysBefore < 0 || input.remindDaysBefore > 60)
    errors.push('remind_days');
  return errors;
}

export function totalServings(input: Pick<StockItemInput, 'packageAmount' | 'servingAmount' | 'packages'>): number {
  // Small epsilon so 1000/5 floating noise never loses a serving.
  return Math.floor((input.packageAmount * input.packages) / input.servingAmount + 1e-9);
}

/**
 * Estimate remaining stock on `today` (YYYY-MM-DD, local). The start day counts
 * as a usage day once it has passed: on the start day itself nothing is used yet.
 */
export function estimateStock(input: StockItemInput, today: string): StockEstimate {
  const servingsTotal = totalServings(input);
  const elapsedDays = Math.max(0, utcDayNumber(today) - utcDayNumber(input.startedOn));
  const used = elapsedDays * input.servingsPerDay;
  const servingsLeft = Math.max(0, servingsTotal - used);
  const daysLeft = Math.floor(servingsLeft / input.servingsPerDay + 1e-9);
  const runsOutOn = isoFromDayNumber(utcDayNumber(today) + daysLeft);
  return {
    servingsTotal,
    servingsLeft: Math.round(servingsLeft * 10) / 10,
    daysLeft,
    runsOutOn,
    shouldRemind: daysLeft <= input.remindDaysBefore,
    isEmpty: daysLeft === 0,
  };
}

/** Items to surface on Vandaag: due for a reminder, soonest first. */
export function itemsToRemind(
  items: readonly StockItemInput[],
  today: string,
): { item: StockItemInput; estimate: StockEstimate }[] {
  return items
    .map((item) => ({ item, estimate: estimateStock(item, today) }))
    .filter((x) => x.estimate.shouldRemind)
    .sort((a, b) => a.estimate.daysLeft - b.estimate.daysLeft);
}

/** "Nog ~12 dagen Creatine. Opnieuw bestellen?" */
export function reorderPrompt(productTitle: string, estimate: Pick<StockEstimate, 'daysLeft'>): string {
  if (estimate.daysLeft <= 0) return `${productTitle} is waarschijnlijk op. Opnieuw bestellen?`;
  const days = estimate.daysLeft === 1 ? 'dag' : 'dagen';
  return `Nog ~${estimate.daysLeft} ${days} ${productTitle}. Opnieuw bestellen?`;
}

export const STOCK_ERROR_NL: Record<StockValidationError, string> = {
  package_amount: 'Vul de inhoud van de verpakking in.',
  serving_amount: 'Vul de portiegrootte in.',
  serving_larger_than_package: 'Een portie kan niet groter zijn dan de verpakking.',
  servings_per_day: 'Kies tussen 0,5 en 20 porties per dag.',
  packages: 'Kies tussen 1 en 50 verpakkingen.',
  started_on: 'Gebruik een datum als 2026-10-15.',
  remind_days: 'Kies tussen 0 en 60 dagen.',
};

/** Parse Dutch number input ("2,5" or "2.5"). Returns NaN on garbage. */
export function parseDecimal(input: string): number {
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}
