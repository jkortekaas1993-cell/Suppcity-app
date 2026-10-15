import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text, useTheme } from '@/ui';

import { useActiveWorkout } from './activeWorkoutStore';

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface ActiveWorkoutBarProps {
  onPress?: () => void;
}

/**
 * STUB. Sits directly above the tab bar on every tab while a workout is active.
 * Tracker builder owns this: tap opens the full-screen workout, show rest timer.
 */
export function ActiveWorkoutBar({ onPress }: ActiveWorkoutBarProps) {
  const workout = useActiveWorkout();
  const { colors, space } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!workout) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [workout]);

  if (!workout) return null;

  const resting = workout.restEndsAt !== null && workout.restEndsAt > now;

  return (
    <Pressable
      testID="active-workout-bar"
      accessibilityRole="button"
      accessibilityLabel={`Actieve training ${workout.title}, openen`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        backgroundColor: colors.surfaceRaised,
        borderTopWidth: 2,
        borderTopColor: colors.accent,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
      <View style={{ flex: 1 }}>
        <Text variant="label" tone="accent">
          {resting ? 'Rust' : 'Bezig'}
        </Text>
        <Text variant="heading" numberOfLines={1}>
          {workout.title}
        </Text>
      </View>
      <Text variant="metric" style={{ fontSize: 22 }}>
        {formatElapsed(resting && workout.restEndsAt ? workout.restEndsAt - now : now - workout.startedAt)}
      </Text>
    </Pressable>
  );
}
