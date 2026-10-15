import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text, useTheme } from '@/ui';

import { useActiveWorkout } from './activeWorkoutStore';
import { formatCountdown, formatElapsed } from './logic/format';

export { formatElapsed } from './logic/format';

interface ActiveWorkoutBarProps {
  /** Defaults to opening the full-screen workout. */
  onPress?: () => void;
}

/**
 * Sits directly above the tab bar on every tab while a workout is active.
 * Shows elapsed time, or the rest countdown with a progress line while resting.
 * Training-only: never shows commercial content.
 */
export function ActiveWorkoutBar({ onPress }: ActiveWorkoutBarProps) {
  const workout = useActiveWorkout();
  const router = useRouter();
  const { colors, space } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  const active = workout !== null;
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!workout) return null;

  const restLeft = workout.restEndsAt !== null ? workout.restEndsAt - now : 0;
  const resting = restLeft > 0;
  const restTotal = (workout.restDurationSeconds ?? 0) * 1000;
  const progress = resting && restTotal > 0 ? Math.min(1, Math.max(0, 1 - restLeft / restTotal)) : 0;
  const time = resting ? formatCountdown(restLeft) : formatElapsed(now - workout.startedAt);

  return (
    <Pressable
      testID="active-workout-bar"
      accessibilityRole="button"
      accessibilityLabel={
        resting ? `Rust, nog ${time}. Training ${workout.title} openen` : `Actieve training ${workout.title}, ${time}, openen`
      }
      onPress={onPress ?? (() => router.push('/workout'))}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.border : colors.surfaceRaised,
        borderTopWidth: 2,
        borderTopColor: colors.accent,
      })}
    >
      {resting ? (
        <View
          style={{ position: 'absolute', top: -2, left: 0, height: 2, width: `${progress * 100}%`, backgroundColor: colors.text }}
        />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          minHeight: 56,
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
          {time}
        </Text>
      </View>
    </Pressable>
  );
}
