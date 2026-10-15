import {
  canSendPromotion,
  decide,
  DEFAULT_CHOICES,
  needsPermission,
  normalisePrefs,
  NOT_ASKED,
  restTimerAllowed,
  shouldOfferNotificationCard,
} from '../notificationPrefs';

describe('notification choices (ADR-9, C3)', () => {
  it('offers the card only in the summary of a finished workout, once', () => {
    expect(shouldOfferNotificationCard(NOT_ASKED, true)).toBe(true);
    expect(shouldOfferNotificationCard(NOT_ASKED, false)).toBe(false);
    expect(shouldOfferNotificationCard(decide(DEFAULT_CHOICES, 'denied', 't'), true)).toBe(false);
  });

  it('promotions are a separate opt-in, default off', () => {
    expect(DEFAULT_CHOICES.promotions).toBe(false);
    expect(DEFAULT_CHOICES.restTimer).toBe(true);
  });

  it('asks the OS only when something was chosen', () => {
    expect(needsPermission({ restTimer: false, orderStatus: false, restock: false, promotions: false })).toBe(false);
    expect(needsPermission({ restTimer: true, orderStatus: false, restock: false, promotions: false })).toBe(true);
  });

  it('rest timer needs both the choice and OS permission', () => {
    const on = decide({ ...DEFAULT_CHOICES }, 'granted', 't');
    expect(restTimerAllowed(on, true)).toBe(true);
    expect(restTimerAllowed(on, false)).toBe(false);
    expect(restTimerAllowed({ ...on, restTimer: false }, true)).toBe(false);
    expect(restTimerAllowed(NOT_ASKED, true)).toBe(false);
  });

  it('max one promotion per week, never without opt-in', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const opted = decide({ ...DEFAULT_CHOICES, promotions: true }, 'granted', 't');
    expect(canSendPromotion(decide(DEFAULT_CHOICES, 'granted', 't'), true, null, now)).toBe(false);
    expect(canSendPromotion(opted, true, null, now)).toBe(true);
    expect(canSendPromotion(opted, true, '2026-10-10T12:00:00Z', now)).toBe(false);
    expect(canSendPromotion(opted, true, '2026-10-08T12:00:00Z', now)).toBe(true);
    expect(canSendPromotion(opted, false, null, now)).toBe(false);
  });

  it('normalises stored values defensively', () => {
    expect(normalisePrefs(null)).toEqual(NOT_ASKED);
    expect(normalisePrefs({ asked: true, restTimer: 'yes', permission: 'weird' })).toMatchObject({ asked: true, restTimer: false, permission: 'undetermined' });
  });
});
