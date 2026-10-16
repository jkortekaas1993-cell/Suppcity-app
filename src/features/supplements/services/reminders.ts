import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import type { SqlDb } from '@/lib/db';

import type { SupplementRepository } from '../data/supplementRepository';
import {
  ACTION_LATER,
  ACTION_TAKEN,
  planReminders,
  parseReminderData,
  REMINDER_CATEGORY,
  REMINDER_ID_PREFIX,
  SNOOZE_MINUTES,
  toExpoWeekday,
  type PlannedReminder,
  type ReminderData,
} from '../logic/reminderPlan';
import { localIsoDate, slotKey } from '../logic/schedule';
import { notifySupplementsChanged, sharedRepository } from './store';

/**
 * Supplement reminders via expo-notifications.
 *
 * Only when BOTH are true: the OS permission is granted AND the user switched on
 * "Supplementherinneringen" on the supplements screen. That choice is a separate,
 * local, timestamped preference (`supplements.reminders` in app_state), next to the
 * tracker's notification choices; withdrawing it cancels every pending reminder.
 */

export interface ReminderPrefs {
  enabled: boolean;
  decidedAt: string | null;
}

const PREFS_KEY = 'supplements.reminders';
const SNOOZE_ID_PREFIX = 'suppsnooze-';

export async function loadReminderPrefs(repo: SupplementRepository): Promise<ReminderPrefs> {
  const raw = await repo.getSetting<Partial<ReminderPrefs>>(PREFS_KEY).catch(() => null);
  return { enabled: raw?.enabled === true, decidedAt: typeof raw?.decidedAt === 'string' ? raw.decidedAt : null };
}

async function permissionStatus(): Promise<string> {
  try {
    return (await Notifications.getPermissionsAsync()).status;
  } catch {
    return 'denied';
  }
}

export async function osPermissionGranted(): Promise<boolean> {
  return (await permissionStatus()) === 'granted';
}

/**
 * The switch on the supplements screen. Turning it on asks the OS for permission
 * when it was never asked (this is an explicit user action). Returns the new state.
 */
export async function setRemindersEnabled(
  repo: SupplementRepository,
  enabled: boolean,
): Promise<{ prefs: ReminderPrefs; permission: 'granted' | 'denied' }> {
  let granted = await osPermissionGranted();
  if (enabled && !granted) {
    try {
      granted = (await Notifications.requestPermissionsAsync()).status === 'granted';
    } catch {
      granted = false;
    }
  }
  const prefs: ReminderPrefs = { enabled: enabled && granted, decidedAt: new Date().toISOString() };
  await repo.setSetting(PREFS_KEY, prefs);
  await rescheduleSupplementReminders(repo);
  return { prefs, permission: granted ? 'granted' : 'denied' };
}

async function ensureCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      { identifier: ACTION_TAKEN, buttonTitle: 'Ingenomen', options: { opensAppToForeground: false } },
      { identifier: ACTION_LATER, buttonTitle: 'Later', options: { opensAppToForeground: false } },
    ]);
  } catch {
    // Categories are a nicety; reminders still work without action buttons.
  }
}

function triggerFor(r: PlannedReminder): Notifications.NotificationTriggerInput {
  const t = r.trigger;
  if (t.kind === 'daily') {
    const daily: Notifications.DailyTriggerInput = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute };
    return daily;
  }
  const weekly: Notifications.WeeklyTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: toExpoWeekday(t.weekday),
    hour: t.hour,
    minute: t.minute,
  };
  return weekly;
}

async function cancelOurs(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pending
      .filter((p) => p.identifier.startsWith(REMINDER_ID_PREFIX))
      .map((p) => Notifications.cancelScheduledNotificationAsync(p.identifier).catch(() => undefined)),
  );
}

let replanning: Promise<void> | null = null;

/** Cancels and re-creates all repeating supplement reminders. Safe to call often. */
export function rescheduleSupplementReminders(repo: SupplementRepository): Promise<void> {
  const run = async () => {
    await cancelOurs();
    const prefs = await loadReminderPrefs(repo);
    if (!prefs.enabled || !(await osPermissionGranted())) return;
    await ensureCategory();
    const items = await repo.list();
    const plan = planReminders(
      items.flatMap((s) => s.schedules),
      items,
    );
    for (const r of plan.reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { ...r.data }, categoryIdentifier: REMINDER_CATEGORY, sound: true },
        trigger: triggerFor(r),
      }).catch(() => undefined);
    }
    await repo.setSetting('supplements.lastPlan', { scheduled: plan.reminders.length, dropped: plan.dropped, at: new Date().toISOString() });
  };
  // Serialise: two quick edits must not interleave cancel/schedule.
  const next = (replanning ?? Promise.resolve()).catch(() => undefined).then(run);
  replanning = next;
  return next;
}

/** Marks every supplement of a reminder as taken for the moment it fired. */
export async function markReminderTaken(repo: SupplementRepository, data: ReminderData, firedAt: Date): Promise<void> {
  const date = data.date ?? localIsoDate(firedAt);
  const items = await repo.list();
  const bySchedule = new Map(items.flatMap((s) => s.schedules.map((sc) => [sc.id, sc] as const)));
  for (const scheduleId of data.scheduleIds) {
    const sc = bySchedule.get(scheduleId);
    if (!sc) continue;
    await repo.setIntake({ supplementId: sc.supplement_id, scheduleId, scheduledFor: slotKey(date, data.time), status: 'taken' });
  }
  notifySupplementsChanged();
}

async function snooze(content: { title: string | null; body: string | null }, data: ReminderData, firedAt: Date): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `${SNOOZE_ID_PREFIX}${Date.now()}`,
    content: {
      title: content.title ?? '',
      body: content.body ?? '',
      data: { ...data, date: data.date ?? localIsoDate(firedAt) },
      categoryIdentifier: REMINDER_CATEGORY,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SNOOZE_MINUTES * 60, repeats: false },
  }).catch(() => undefined);
}

const handled = new Set<string>();

async function handleResponse(
  repo: SupplementRepository,
  response: Notifications.NotificationResponse,
  opts: { coldStart?: boolean } = {},
): Promise<void> {
  const req = response.notification.request;
  const data = parseReminderData(req.content.data);
  if (!data) return;
  const key = `${req.identifier}|${response.notification.date}|${response.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);
  const firedAt = new Date(response.notification.date);
  if (response.actionIdentifier === ACTION_TAKEN) {
    await markReminderTaken(repo, data, firedAt);
  } else if (response.actionIdentifier === ACTION_LATER) {
    await snooze(req.content, data, firedAt);
  } else if (!opts.coldStart) {
    router.push('/supplements');
  }
  await Notifications.dismissNotificationAsync(req.identifier).catch(() => undefined);
}

let subscription: { remove(): void } | null = null;

/**
 * App start (call once, after <DatabaseProvider> migrated): registers the
 * "Ingenomen"/"Later" category, listens for reminder actions and re-plans all
 * reminders. Returns a cleanup function.
 */
export async function initSupplementReminders(db?: SqlDb): Promise<() => void> {
  try {
    const repo = await sharedRepository({ db });
    await ensureCategory();
    if (!subscription) {
      subscription = Notifications.addNotificationResponseReceivedListener((r) => {
        void handleResponse(repo, r).catch(() => undefined);
      });
    }
    const last = await Notifications.getLastNotificationResponseAsync().catch(() => null);
    if (last) {
      await handleResponse(repo, last, { coldStart: true }).catch(() => undefined);
      await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    }
    await rescheduleSupplementReminders(repo);
  } catch {
    // Never block app start on reminders.
  }
  return () => {
    subscription?.remove();
    subscription = null;
  };
}

/** Cancels all supplement reminders and snoozes (logout / account deletion). */
export async function cancelAllSupplementReminders(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pending
      .filter((p) => p.identifier.startsWith(REMINDER_ID_PREFIX) || p.identifier.startsWith(SNOOZE_ID_PREFIX))
      .map((p) => Notifications.cancelScheduledNotificationAsync(p.identifier).catch(() => undefined)),
  );
}

/** After any edit on the schedule: refresh screens and re-plan reminders. */
export async function afterSupplementWrite(repo: SupplementRepository): Promise<void> {
  notifySupplementsChanged();
  await rescheduleSupplementReminders(repo).catch(() => undefined);
}
