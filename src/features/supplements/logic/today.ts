import type { SupplementIntake, SupplementWithSchedules } from '../data/types';
import { occurrencesOn, type DayContext, type Occurrence } from './schedule';
import { stockView, type StockView } from './stock';

/** One row in the "Vandaag" list. Pure view model. */
export interface TodayRow {
  occurrence: Occurrence;
  supplement: SupplementWithSchedules;
  intake: SupplementIntake | null;
  stock: StockView;
}

export function buildTodayRows(
  items: readonly SupplementWithSchedules[],
  intakes: readonly SupplementIntake[],
  date: string,
  ctx: DayContext = {},
): TodayRow[] {
  const byId = new Map(items.map((s) => [s.id, s]));
  const intakeByKey = new Map(intakes.map((i) => [`${i.supplement_id}|${i.scheduled_for}`, i]));
  const schedules = items.flatMap((s) => s.schedules);
  return occurrencesOn(schedules, date, ctx).flatMap((occurrence) => {
    const supplement = byId.get(occurrence.supplementId);
    if (!supplement) return [];
    return [
      {
        occurrence,
        supplement,
        intake: intakeByKey.get(`${occurrence.supplementId}|${occurrence.scheduledFor}`) ?? null,
        stock: stockView(supplement, supplement.schedules),
      },
    ];
  });
}

/** The first moment today that is not marked yet (for the Vandaag card). */
export function nextOpenRow(rows: readonly TodayRow[]): TodayRow | null {
  return rows.find((r) => r.intake === null) ?? null;
}

/** Stock list for the "Voorraad" block: only supplements with a count, fewest days first. */
export function stockRows(items: readonly SupplementWithSchedules[]): { supplement: SupplementWithSchedules; stock: StockView }[] {
  return items
    .filter((s) => s.units_left !== null)
    .map((supplement) => ({ supplement, stock: stockView(supplement, supplement.schedules) }))
    .sort((a, b) => (a.stock.daysLeft ?? Infinity) - (b.stock.daysLeft ?? Infinity) || a.supplement.name.localeCompare(b.supplement.name, 'nl'));
}
