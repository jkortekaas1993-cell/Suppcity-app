import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback. Every call is fire-and-forget and silently does nothing when haptics are
 * unavailable (web, simulator, old Android, low-power mode).
 *
 * When to use:
 * - light: a primary button press, ticking off a set.
 * - medium: finishing a workout, rest timer done.
 * - success: a PR, a badge, a completed weekly goal.
 * - selection: chips, segmented controls, steppers.
 */
function safe(run: () => Promise<unknown>): void {
  if (Platform.OS === 'web') return;
  try {
    run().catch(() => undefined);
  } catch {
    // Native module missing: ignore.
  }
}

export const haptics = {
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  selection: () => safe(() => Haptics.selectionAsync()),
} as const;

export type HapticKind = keyof typeof haptics;
