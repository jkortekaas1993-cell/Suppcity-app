import { Button, Card, Screen, Text } from '@/ui';

import { activeWorkout, useActiveWorkout } from './activeWorkoutStore';

/** Placeholder. Trainen tab is 100% ad- and shop-free (blueprint). */
export function TrainenScreen() {
  const workout = useActiveWorkout();
  return (
    <Screen title="Trainen" subtitle="Log je sets. Geen reclame, geen afleiding.">
      <Card eyebrow="Snel starten" highlighted={workout !== null}>
        <Text>Start een lege training of kies een routine.</Text>
        {workout ? (
          <Button label="Training afronden" variant="secondary" onPress={() => activeWorkout.finish()} />
        ) : (
          <Button
            label="Lege training starten"
            onPress={() =>
              activeWorkout.start({
                workoutId: 'placeholder',
                title: 'Lege training',
                startedAt: Date.now(),
                restEndsAt: null,
              })
            }
          />
        )}
      </Card>
      <Card eyebrow="Routines">
        <Text tone="muted">Nog geen routines. Kant-en-klare schema&apos;s volgen hier.</Text>
      </Card>
    </Screen>
  );
}
