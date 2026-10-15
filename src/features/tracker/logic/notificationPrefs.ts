/**
 * Notification choices (ADR-9, compliance C3). Pure.
 *
 * Permission is asked only after the first finished workout, from a calm card in the
 * workout summary with separate choices. Choices are stored locally (app_state).
 * Promotions ("acties") are a separate opt-in, default OFF, and capped at 1 per week.
 */
export interface NotificationPrefs {
  /** The card was answered (either way); never ask again automatically. */
  asked: boolean;
  restTimer: boolean;
  orderStatus: boolean;
  restock: boolean;
  /** Separate marketing opt-in; max 1 per week. Never derived from training data (hard rule 1). */
  promotions: boolean;
  /** OS permission result at the time of asking. */
  permission: 'granted' | 'denied' | 'undetermined';
  decidedAt: string | null;
}

export const NOTIFICATION_PREFS_KEY = 'notifications.prefs';

export const DEFAULT_CHOICES = { restTimer: true, orderStatus: true, restock: true, promotions: false } as const;

export const NOT_ASKED: NotificationPrefs = {
  asked: false,
  restTimer: false,
  orderStatus: false,
  restock: false,
  promotions: false,
  permission: 'undetermined',
  decidedAt: null,
};

export type NotificationChoices = Pick<NotificationPrefs, 'restTimer' | 'orderStatus' | 'restock' | 'promotions'>;

export function normalisePrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== 'object') return NOT_ASKED;
  const r = raw as Partial<NotificationPrefs>;
  const b = (v: unknown) => v === true;
  return {
    asked: b(r.asked),
    restTimer: b(r.restTimer),
    orderStatus: b(r.orderStatus),
    restock: b(r.restock),
    promotions: b(r.promotions),
    permission: r.permission === 'granted' || r.permission === 'denied' ? r.permission : 'undetermined',
    decidedAt: typeof r.decidedAt === 'string' ? r.decidedAt : null,
  };
}

/** Show the card in the summary of a just-finished workout, once. */
export function shouldOfferNotificationCard(prefs: NotificationPrefs, justFinished: boolean): boolean {
  return justFinished && !prefs.asked;
}

/** Ask the OS only when at least one kind of notification was chosen. */
export function needsPermission(choices: NotificationChoices): boolean {
  return choices.restTimer || choices.orderStatus || choices.restock || choices.promotions;
}

export function decide(choices: NotificationChoices, permission: NotificationPrefs['permission'], now: string): NotificationPrefs {
  return { asked: true, ...choices, permission, decidedAt: now };
}

/** Rest-timer notification only with the user's choice AND OS permission. */
export function restTimerAllowed(prefs: NotificationPrefs, osGranted: boolean): boolean {
  return prefs.restTimer && osGranted;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Promotion push: separate opt-in and at most one per 7 days. */
export function canSendPromotion(prefs: NotificationPrefs, osGranted: boolean, lastPromotionAt: string | null, now: Date): boolean {
  if (!prefs.promotions || !osGranted) return false;
  if (!lastPromotionAt) return true;
  const last = Date.parse(lastPromotionAt);
  return !Number.isFinite(last) || now.getTime() - last >= WEEK_MS;
}
