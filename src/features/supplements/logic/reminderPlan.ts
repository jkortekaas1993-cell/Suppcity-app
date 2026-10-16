import { daysFromMask, isValidTime, parseTime, type ScheduleLike } from './schedule';

/**
 * Turns supplement schedules into a set of repeating local notifications. Pure.
 *
 * - One notification per (time, weekday); supplements due at the same moment share it.
 * - A time whose content is identical on all seven days becomes ONE daily trigger.
 * - iOS keeps at most 64 pending local notifications per app. We use at most
 *   `REMINDER_BUDGET` so the rest timer and a "Later" snooze always fit.
 * - Lock-screen privacy (review L8): by default the text is only "Tijd voor je
 *   supplementen"; names and doses are shown in the app. Only when the user switched on
 *   "Toon namen in meldingen" the body is "Herinnering: <name> (<the user's own dose>)".
 * - Text is neutral either way (hard rule 4): no effect words, no advice.
 */

export const IOS_PENDING_LIMIT = 64;
/** Leaves room for the rest timer (1) and snoozes. */
export const REMINDER_BUDGET = 60;

export const REMINDER_CATEGORY = 'supplement-reminder';
export const ACTION_TAKEN = 'supplement-taken';
export const ACTION_LATER = 'supplement-later';
export const SNOOZE_MINUTES = 30;
export const REMINDER_ID_PREFIX = 'supp-';
export const REMINDER_TITLE = 'Supp City';
/** Default body: nothing about what or how much (visible on the lock screen). */
export const NEUTRAL_REMINDER_BODY = 'Tijd voor je supplementen';

export interface ReminderSupplement {
  id: string;
  name: string;
  dose_text: string;
}

export type ReminderTrigger = { kind: 'daily'; hour: number; minute: number } | { kind: 'weekly'; weekday: number; hour: number; minute: number };

export interface PlannedReminder {
  /** Stable identifier, so re-planning replaces instead of duplicating. */
  id: string;
  /** For `kind: 'weekly'`: 0 = Monday ... 6 = Sunday (convert with `toExpoWeekday`). */
  trigger: ReminderTrigger;
  title: string;
  body: string;
  data: ReminderData;
}

export interface ReminderData {
  kind: 'supplement-reminder';
  scheduleIds: string[];
  time: string;
  /** Set on a "Later" snooze: the local date the original reminder was for. */
  date?: string;
}

export interface ReminderPlan {
  reminders: PlannedReminder[];
  /** Moments that did not fit the budget (oldest weekday/time order kept). */
  dropped: number;
}

/** expo-notifications weekly trigger weekday: 1 = Sunday, 2 = Monday ... 7 = Saturday. */
export function toExpoWeekday(isoWeekday0: number): number {
  return ((isoWeekday0 + 1) % 7) + 1;
}

/** "Creatine (5 g)" or "Creatine" when the user left the dose empty. */
export function reminderLabel(s: Pick<ReminderSupplement, 'name' | 'dose_text'>): string {
  const name = s.name.trim();
  const dose = s.dose_text.trim();
  return dose ? `${name} (${dose})` : name;
}

export function reminderBody(items: readonly Pick<ReminderSupplement, 'name' | 'dose_text'>[]): string {
  return `Herinnering: ${items.map(reminderLabel).join(', ')}`;
}

/** Words the app itself must never put in a reminder (effect/health language, hard rule 4). */
export const FORBIDDEN_REMINDER_WORDS = [
  'kracht',
  'herstel',
  'spiergroei',
  'spiermassa',
  'energie',
  'prestatie',
  'gezond',
  'immuun',
  'vetverbranding',
  'afvallen',
  'boost',
  'advies',
  'aanbevolen',
] as const;

/** True when app-authored copy contains none of the forbidden words. */
export function isNeutralCopy(text: string): boolean {
  const t = text.toLowerCase();
  return FORBIDDEN_REMINDER_WORDS.every((w) => !t.includes(w));
}

interface Slot {
  weekday: number;
  time: string;
  scheduleIds: string[];
  supplementIds: string[];
}

export function planReminders(
  schedules: readonly ScheduleLike[],
  supplements: readonly ReminderSupplement[],
  budget: number = REMINDER_BUDGET,
  opts: { showNames?: boolean } = {},
): ReminderPlan {
  const byId = new Map(supplements.map((s) => [s.id, s]));
  // time -> weekday -> slot
  const slots = new Map<string, Map<number, Slot>>();
  for (const s of schedules) {
    if (!isValidTime(s.time_local) || !byId.has(s.supplement_id)) continue;
    for (const wd of daysFromMask(s.days_mask)) {
      const perDay = slots.get(s.time_local) ?? new Map<number, Slot>();
      slots.set(s.time_local, perDay);
      const slot = perDay.get(wd) ?? { weekday: wd, time: s.time_local, scheduleIds: [], supplementIds: [] };
      perDay.set(wd, slot);
      slot.scheduleIds.push(s.id);
      if (!slot.supplementIds.includes(s.supplement_id)) slot.supplementIds.push(s.supplement_id);
    }
  }

  const all: PlannedReminder[] = [];
  const times = [...slots.keys()].sort();
  for (const time of times) {
    const perDay = slots.get(time)!;
    const { hour, minute } = parseTime(time);
    const days = [...perDay.values()].sort((a, b) => a.weekday - b.weekday);
    const sig = (sl: Slot) => [...sl.scheduleIds].sort().join('|');
    const make = (sl: Slot, trigger: ReminderTrigger, id: string): PlannedReminder => {
      const items = sl.supplementIds
        .map((sid) => byId.get(sid)!)
        .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
      return {
        id,
        trigger,
        title: REMINDER_TITLE,
        body: opts.showNames === true ? reminderBody(items) : NEUTRAL_REMINDER_BODY,
        data: { kind: 'supplement-reminder', scheduleIds: [...sl.scheduleIds].sort(), time },
      };
    };
    const hhmm = time.replace(':', '');
    if (days.length === 7 && days.every((d) => sig(d) === sig(days[0]!))) {
      all.push(make(days[0]!, { kind: 'daily', hour, minute }, `${REMINDER_ID_PREFIX}d-${hhmm}`));
    } else {
      for (const d of days) all.push(make(d, { kind: 'weekly', weekday: d.weekday, hour, minute }, `${REMINDER_ID_PREFIX}w${d.weekday}-${hhmm}`));
    }
  }

  // Deterministic order for truncation: by weekday (daily first), then time.
  const order = (r: PlannedReminder) => (r.trigger.kind === 'daily' ? -1 : r.trigger.weekday) * 10_000 + r.trigger.hour * 60 + r.trigger.minute;
  all.sort((a, b) => order(a) - order(b));
  const max = Math.max(0, Math.min(budget, IOS_PENDING_LIMIT));
  return { reminders: all.slice(0, max), dropped: Math.max(0, all.length - max) };
}

/** Which notification ids to cancel and which to (re)schedule, given what is pending now. */
export function diffReminders(pendingIds: readonly string[], plan: readonly PlannedReminder[]): { cancel: string[]; schedule: PlannedReminder[] } {
  // Cancel all of ours and schedule the whole plan: content may have changed under the same id.
  const cancel = pendingIds.filter((id) => id.startsWith(REMINDER_ID_PREFIX));
  return { cancel, schedule: [...plan] };
}

/** Parses notification data safely (it comes back from the OS). */
export function parseReminderData(raw: unknown): ReminderData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== 'supplement-reminder' || typeof r.time !== 'string' || !isValidTime(r.time)) return null;
  if (!Array.isArray(r.scheduleIds) || !r.scheduleIds.every((x) => typeof x === 'string')) return null;
  const out: ReminderData = { kind: 'supplement-reminder', scheduleIds: r.scheduleIds as string[], time: r.time };
  if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) out.date = r.date;
  return out;
}
