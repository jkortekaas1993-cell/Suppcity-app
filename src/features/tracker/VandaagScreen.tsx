import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';

import { useRepositories } from '@/lib/db';
import { Button, Card, Screen, Text } from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from './activeWorkoutStore';
import { useFocusQuery } from './components/useFocusQuery';
import { formatDateNl } from './logic/format';
import { nextRoutine } from './logic/routines';

export interface VandaagScreenProps {
  /**
   * At most ONE smart card from outside the tracker (e.g. shop ReorderCard).
   * Composed by the route file, so the tracker never imports other features.
   */
  smartCard?: ReactNode;
}

/** Vandaag tab: start a workout, the next planned routine, and one smart card slot. */
export function VandaagScreen({ smartCard }: VandaagScreenProps) {
  const repos = useRepositories();
  const router = useRouter();
  const workout = useActiveWorkout();
  const actions = useActiveWorkoutActions();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [routines, last] = await Promise.all([repos.routines.list(), repos.workouts.lastFinished()]);
    const next = nextRoutine(
      routines.map((r) => ({ ...r, programSlug: r.program_slug })),
      last?.routine_id ?? null,
    );
    return { next, last };
  }, [repos]);
  const { data } = useFocusQuery(load);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      router.push('/workout');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Vandaag" subtitle={data?.last ? `Laatste training: ${formatDateNl(data.last.started_at)}` : 'Klaar voor je eerste training?'}>
      {workout ? (
        <Card eyebrow="Bezig" highlighted>
          <Text variant="heading">{workout.title}</Text>
          <Button label="Ga verder met training" fullWidth onPress={() => router.push('/workout')} />
        </Card>
      ) : (
        <Card eyebrow="Volgende training" highlighted>
          {data?.next ? (
            <>
              <Text variant="title">{data.next.name}</Text>
              <Button
                label="Start workout"
                fullWidth
                loading={busy}
                onPress={() => {
                  const id = data.next?.id;
                  if (id) void run(() => actions.startFromRoutine(id));
                }}
              />
              <Button label="Lege training" variant="ghost" onPress={() => void run(() => actions.startEmpty())} />
            </>
          ) : (
            <>
              <Text tone="muted">Nog geen schema gekozen.</Text>
              <Button label="Start workout" fullWidth loading={busy} onPress={() => void run(() => actions.startEmpty())} />
              <Button label="Kies een schema" variant="ghost" onPress={() => router.push('/routine/schemas')} />
            </>
          )}
        </Card>
      )}
      {smartCard ?? null}
    </Screen>
  );
}
