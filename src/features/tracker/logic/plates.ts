/**
 * Plate calculator. Works in hundredths of a kg (integers) to avoid float errors.
 */

export const DEFAULT_BAR_KG = 20;
export const DEFAULT_PLATES_KG: readonly number[] = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlateCount {
  plateKg: number;
  count: number;
}

export interface PlateResult {
  targetKg: number;
  barKg: number;
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: PlateCount[];
  /** Total weight that can actually be loaded (≤ target). */
  loadedKg: number;
  /** target − loaded. 0 when exact; negative when target is below the bar. */
  remainderKg: number;
}

const toCents = (kg: number): number => Math.round(kg * 100);
const fromCents = (c: number): number => c / 100;

export function calculatePlates(
  targetKg: number,
  options: { barKg?: number; platesKg?: readonly number[] } = {},
): PlateResult {
  const barKg = options.barKg ?? DEFAULT_BAR_KG;
  const plates = [...(options.platesKg ?? DEFAULT_PLATES_KG)].filter((p) => p > 0).sort((a, b) => b - a);
  const target = Number.isFinite(targetKg) ? targetKg : 0;

  const targetC = toCents(target);
  const barC = toCents(barKg);
  if (targetC <= barC) {
    return { targetKg: target, barKg, perSide: [], loadedKg: barKg, remainderKg: fromCents(targetC - barC) };
  }

  // Each plate goes on both sides, so solve for half the weight above the bar.
  let perSideC = Math.floor((targetC - barC) / 2);
  const perSide: PlateCount[] = [];
  for (const plate of plates) {
    const pc = toCents(plate);
    const count = Math.floor(perSideC / pc);
    if (count > 0) {
      perSide.push({ plateKg: plate, count });
      perSideC -= count * pc;
    }
  }
  const loadedC = barC + 2 * perSide.reduce((sum, p) => sum + toCents(p.plateKg) * p.count, 0);
  return { targetKg: target, barKg, perSide, loadedKg: fromCents(loadedC), remainderKg: fromCents(targetC - loadedC) };
}
