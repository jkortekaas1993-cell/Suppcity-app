/**
 * nl-NL number formatting for the progress screens. Pure and deterministic (no Intl),
 * so tests give the same output on every runtime: "2.775", "108", "102,5", "18,4".
 */

/** Rounds without float noise (0.1 + 0.2). */
export function roundTo(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** "2.775", "102,5", "-3". Trailing zero decimals are dropped ("100" not "100,0"). */
export function formatNumberNl(value: number, maxDecimals = 0): string {
  if (!Number.isFinite(value)) return '–';
  const rounded = roundTo(value, maxDecimals);
  const negative = rounded < 0;
  const [intPart = '0', decPart] = Math.abs(rounded).toFixed(maxDecimals).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = decPart?.replace(/0+$/, '');
  return `${negative ? '-' : ''}${grouped}${decimals ? `,${decimals}` : ''}`;
}

/** Weight in kg: at most one decimal ("102,5"). */
export function formatKg(kg: number): string {
  return formatNumberNl(kg, 1);
}

/** Signed change: "+14", "-2,5", "0". */
export function formatSigned(value: number, maxDecimals = 0): string {
  const shown = formatNumberNl(value, maxDecimals);
  return roundTo(value, maxDecimals) > 0 ? `+${shown}` : shown;
}

/** Volume: kg below 10.000, else tonnes with one decimal ("18,4 ton"). */
export function formatVolume(kg: number): { value: string; unit: 'kg' | 'ton' } {
  if (Math.abs(kg) >= 10_000) return { value: formatNumberNl(kg / 1000, 1), unit: 'ton' };
  return { value: formatNumberNl(kg, 0), unit: 'kg' };
}

/** Training time: "45" min below an hour, else "1:05" u. */
export function formatDuration(minutes: number): { value: string; unit: 'min' | 'u' } {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return { value: String(total), unit: 'min' };
  const h = Math.floor(total / 60);
  const m = total % 60;
  return { value: `${h}:${String(m).padStart(2, '0')}`, unit: 'u' };
}

/** Dutch month abbreviations as in the mockup x-axis. */
export const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] as const;
