/**
 * Dutch number/time formatting without Intl (deterministic on Hermes and in tests).
 */

/** 1234.5 -> "1.234,5"; trailing zeros trimmed; max `decimals` places. */
export function formatNumberNl(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '–';
  const negative = value < 0;
  const f = 10 ** decimals;
  const rounded = Math.round((Math.abs(value) + Number.EPSILON) * f) / f;
  const [intPart = '0', fracPart = ''] = rounded.toFixed(decimals).split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = fracPart.replace(/0+$/, '');
  return `${negative ? '-' : ''}${withThousands}${frac ? `,${frac}` : ''}`;
}

export function formatKg(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '–';
  return `${formatNumberNl(value, decimals)} kg`;
}

/** 65_000 -> "1:05"; 3_725_000 -> "1:02:05". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Rest timer display, rounding up so "0:00" only shows when done. */
export function formatCountdown(ms: number): string {
  return formatElapsed(Math.ceil(Math.max(0, ms) / 1000) * 1000);
}

/** 4_500_000 -> "1 u 15 min"; 600_000 -> "10 min". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} u` : `${h} u ${m} min`;
}

const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] as const;
const DAYS_NL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'] as const;

/** "wo 15 okt 2026" in local time. */
export function formatDateNl(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return `${DAYS_NL[d.getDay()]} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`;
}

/** "15 okt" in local time (chart labels). */
export function formatShortDateNl(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`;
}

/**
 * Parses a user-typed weight/reps value: accepts "62,5" and "62.5".
 * Returns null for empty or invalid input.
 */
export function parseDecimalInput(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
