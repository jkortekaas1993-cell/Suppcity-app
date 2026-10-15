import * as Notifications from 'expo-notifications';

import type { AppStateRepository } from '@/lib/db';

import {
  decide,
  needsPermission,
  normalisePrefs,
  NOTIFICATION_PREFS_KEY,
  type NotificationChoices,
  type NotificationPrefs,
} from '../logic/notificationPrefs';

/**
 * expo-notifications wiring for the tracker (ADR-9, C3). The only place that calls
 * requestPermissionsAsync is `saveChoicesAndAsk`, triggered from the summary card.
 */
let handlerInstalled = false;

/** Show local notifications (rest timer) also while the app is in the foreground. */
export function installForegroundNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    handlerInstalled = false;
  }
}

export async function loadNotificationPrefs(appState: AppStateRepository): Promise<NotificationPrefs> {
  return normalisePrefs(await appState.get<unknown>(NOTIFICATION_PREFS_KEY).catch(() => null));
}

export async function osPermissionGranted(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

/** Stores the choices and, only if something was chosen, asks the OS for permission. */
export async function saveChoicesAndAsk(appState: AppStateRepository, choices: NotificationChoices): Promise<NotificationPrefs> {
  let permission: NotificationPrefs['permission'] = 'undetermined';
  if (needsPermission(choices)) {
    try {
      const res = await Notifications.requestPermissionsAsync();
      permission = res.status === 'granted' ? 'granted' : 'denied';
    } catch {
      permission = 'denied';
    }
  }
  const prefs = decide(choices, permission, new Date().toISOString());
  await appState.set(NOTIFICATION_PREFS_KEY, prefs);
  return prefs;
}

/** "Niet nu": remember the answer without asking the OS. */
export async function declineNotifications(appState: AppStateRepository): Promise<NotificationPrefs> {
  const prefs = decide({ restTimer: false, orderStatus: false, restock: false, promotions: false }, 'undetermined', new Date().toISOString());
  await appState.set(NOTIFICATION_PREFS_KEY, prefs);
  return prefs;
}
