import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LiveBar } from '@/ui';

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
    <LiveBar
      testID="active-workout-bar"
      status={resting ? 'Rust' : 'Bezig'}
      title={workout.title}
      time={time}
      progress={resting ? progress : undefined}
      accessibilityLabel={
        resting ? `Rust, nog ${time}. Training ${workout.title} openen` : `Actieve training ${workout.title}, ${time}, openen`
      }
      onPress={onPress ?? (() => router.push('/workout'))}
    />
  );
}
