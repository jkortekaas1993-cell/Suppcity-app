/**
 * Supplement schedule logic. Pure (no Expo / React imports), unit tested.
 *
 * Hard rule 4: the app never proposes a dose or a moment. Everything here only
 * replays what the user entered (days, time, dose text).
 *
 * Weekday convention: 0 = Monday ... 6 = Sunday (ISO weekday - 1).
 * `days_mask` bit i set = the schedule fires on weekday i.
 */

export type ScheduleMode = 'fixed' | 'training' | 'rest';

export const SCHEDULE_MODES: readonly ScheduleMode[] = ['fixed', 'training', 'rest'];

export const ALL_DAYS_MASK = 0b1111111;

/** Dutch two-letter weekday labels, Monday first. */
export const WEEKDAY_SHORT = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO'] as const;
export const WEEKDAY_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'] as const;

export interface ScheduleLike {
  id: string;
  supplement_id: string;
  days_mask: number;
  mode: ScheduleMode;
  time_local: string;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTime(t: string): boolean {
  return TIME_RE.test(t);
}

/** Accepts "8:00", "0800", "08.00" and normalises to "08:00"; null when invalid. */
export function normaliseTime(input: string): string | null {
  const s = input.trim().replace('.', ':');
  let m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) m = /^(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const t = `${m[1]!.padStart(2, '0')}:${m[2]}`;
  return isValidTime(t) ? t : null;
}

export function parseTime(t: string): { hour: number; minute: number } {
  const m = TIME_RE.exec(t);
  if (!m) throw new Error(`Invalid time: ${t}`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function maskHas(mask: number, weekday: number): boolean {
  return (mask & (1 << weekday)) !== 0;
}

export function maskFromDays(days: readonly number[]): number {
  return days.reduce((m, d) => (d >= 0 && d <= 6 ? m | (1 << d) : m), 0);
}

export function daysFromMask(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => maskHas(mask, d));
}

export function countDays(mask: number): number {
  return daysFromMask(mask & ALL_DAYS_MASK).length;
}

/** Weekdays on which a schedule of this mode fires, given the user's own training days. */
export function effectiveMask(mode: ScheduleMode, chosenDaysMask: number, trainingDaysMask: number): number {
  switch (mode) {
    case 'fixed':
      return chosenDaysMask & ALL_DAYS_MASK;
    case 'training':
      return trainingDaysMask & ALL_DAYS_MASK;
    case 'rest':
      return ~trainingDaysMask & ALL_DAYS_MASK;
  }
}

// --- local dates ---------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date 'YYYY-MM-DD' of a Date. */
export function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local 'HH:MM' of a Date. */
export function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateParts(iso: string): [number, number, number] {
  if (!DATE_RE.test(iso)) throw new Error(`Invalid date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

/** 0 = Monday ... 6 = Sunday for a 'YYYY-MM-DD' date. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = dateParts(iso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = dateParts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The seven dates (Monday first) of the week containing `iso`. */
export function weekOf(iso: string): string[] {
  const monday = addDays(iso, -weekdayOf(iso));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i));
}

/** Local planned moment key 'YYYY-MM-DDTHH:MM'. */
export function slotKey(date: string, time: string): string {
  return `${date}T${time}`;
}

// --- what is due ----------------------------------------------------------------

export interface DayContext {
  /** A workout was logged on this date (only shifts training/rest items for that day). */
  workedOut?: boolean;
}

/**
 * Is the schedule due on `date`? Fixed: its weekdays. Training/rest: its weekdays
 * (derived from the user's training days), and a logged workout on that date makes
 * it a training day for that date only.
 */
export function isDueOn(s: Pick<ScheduleLike, 'days_mask' | 'mode'>, date: string, ctx: DayContext = {}): boolean {
  const onMask = maskHas(s.days_mask, weekdayOf(date));
  if (s.mode === 'training') return onMask || ctx.workedOut === true;
  if (s.mode === 'rest') return onMask && ctx.workedOut !== true;
  return onMask;
}

export interface Occurrence {
  scheduleId: string;
  supplementId: string;
  date: string;
  time: string;
  /** 'YYYY-MM-DDTHH:MM' (local). Matches supplement_intakes.scheduled_for. */
  scheduledFor: string;
}

/** Due moments on one date, sorted by time then supplement id. */
export function occurrencesOn(schedules: readonly ScheduleLike[], date: string, ctx: DayContext = {}): Occurrence[] {
  return schedules
    .filter((s) => isValidTime(s.time_local) && isDueOn(s, date, ctx))
    .map((s) => ({
      scheduleId: s.id,
      supplementId: s.supplement_id,
      date,
      time: s.time_local,
      scheduledFor: slotKey(date, s.time_local),
    }))
    .sort((a, b) => a.time.localeCompare(b.time) || a.supplementId.localeCompare(b.supplementId));
}

/** Planned intakes per week for one supplement (sum over its schedules). */
export function intakesPerWeek(schedules: readonly Pick<ScheduleLike, 'days_mask'>[]): number {
  return schedules.reduce((n, s) => n + countDays(s.days_mask), 0);
}

const DAY_MS = 86_400_000;

/**
 * The user's training weekdays inferred from their own logged workouts: a weekday
 * counts when it had at least `minHits` workouts in the `weeks` weeks before `today`.
 * Only used to PREFILL the training-day chips; the user confirms or edits them.
 */
export function inferTrainingDays(
  workoutStarts: readonly string[],
  today: Date,
  opts: { weeks?: number; minHits?: number } = {},
): number {
  const weeks = opts.weeks ?? 4;
  const minHits = opts.minHits ?? 2;
  const since = today.getTime() - weeks * 7 * DAY_MS;
  const hits = [0, 0, 0, 0, 0, 0, 0];
  for (const s of workoutStarts) {
    const t = Date.parse(s);
    if (!Number.isFinite(t) || t < since || t > today.getTime()) continue;
    const wd = (new Date(t).getDay() + 6) % 7;
    hits[wd] = (hits[wd] ?? 0) + 1;
  }
  return maskFromDays(hits.flatMap((h, d) => (h >= minHits ? [d] : [])));
}

/** Short Dutch label for a schedule ("ma, wo, vr", "elke dag", "trainingsdagen"). */
export function scheduleLabel(s: Pick<ScheduleLike, 'days_mask' | 'mode'>): string {
  if (s.mode === 'training') return 'trainingsdagen';
  if (s.mode === 'rest') return 'rustdagen';
  const mask = s.days_mask & ALL_DAYS_MASK;
  if (mask === ALL_DAYS_MASK) return 'elke dag';
  if (mask === 0) return 'geen dagen';
  return daysFromMask(mask)
    .map((d) => WEEKDAY_SHORT[d]!.toLowerCase())
    .join(', ');
}
