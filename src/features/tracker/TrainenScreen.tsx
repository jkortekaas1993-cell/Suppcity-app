import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useRepositories } from '@/lib/db';
import { Button, Card, ListItem, Screen, Text, useTheme } from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from './activeWorkoutStore';
import { useFocusQuery } from './components/useFocusQuery';
import { formatKg } from './logic/format';
import { nextRoutine } from './logic/routines';
import { workoutSubtitle } from './screens/HistoryScreen';
import { loadRecords } from './screens/PrListScreen';

/**
 * Trainen tab: routines, history and PRs.
 * HARD RULE: 100% free of ads, products and the shop. Do not import shop/points here.
 */
export function TrainenScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const workout = useActiveWorkout();
  const actions = useActiveWorkoutActions();
  const { space } = useTheme();
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const [routines, history, records, last] = await Promise.all([
      repos.routines.list(),
      repos.workouts.historyWithStats({ limit: 5 }),
      loadRecords(repos, 5),
      repos.workouts.lastFinished(),
    ]);
    const next = nextRoutine(
      routines.map((r) => ({ ...r, programSlug: r.program_slug })),
      last?.routine_id ?? null,
    );
    return { routines, history, records, nextId: next?.id ?? null };
  }, [repos]);
  const { data } = useFocusQuery(load);

  const startEmpty = async () => {
    setStarting(true);
    try {
      if (!workout) await actions.startEmpty();
      router.push('/workout');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen title="Trainen" subtitle="Log je sets. Geen reclame, geen afleiding.">
      <Card eyebrow={workout ? 'Bezig' : 'Snel starten'} highlighted={workout !== null}>
        {workout ? (
          <Button label="Ga verder met training" fullWidth onPress={() => router.push('/workout')} />
        ) : (
          <Button label="Lege training starten" fullWidth loading={starting} onPress={() => void startEmpty()} />
        )}
      </Card>

      <Card eyebrow="Routines">
        {data && data.routines.length === 0 ? (
          <Text tone="muted">Nog geen routines. Kies een kant-en-klaar schema of maak er zelf een.</Text>
        ) : null}
        <View>
          {(data?.routines ?? []).map((r) => (
            <ListItem
              key={r.id}
              title={r.name}
              subtitle={r.id === data?.nextId ? 'Volgende' : undefined}
              onPress={() => router.push(`/routine/${r.id}`)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button label="Schema's" variant="secondary" onPress={() => router.push('/routine/schemas')} />
          <Button label="Nieuwe routine" variant="secondary" onPress={() => router.push('/routine/nieuw')} />
        </View>
      </Card>

      <Card eyebrow="Historie">
        {data && data.history.length === 0 ? <Text tone="muted">Je afgeronde trainingen verschijnen hier.</Text> : null}
        <View>
          {(data?.history ?? []).map((w) => (
            <ListItem
              key={w.id}
              title={w.title}
              subtitle={workoutSubtitle(w)}
              value={formatKg(w.volume_kg, 0)}
              onPress={() => router.push(`/workout/${w.id}`)}
            />
          ))}
        </View>
        {data && data.history.length > 0 ? (
          <Button label="Alle trainingen" variant="ghost" onPress={() => router.push('/workout/historie')} />
        ) : null}
      </Card>

      <Card eyebrow="Records">
        {data && data.records.length === 0 ? <Text tone="muted">Nog geen records. Die komen vanzelf.</Text> : null}
        <View>
          {(data?.records ?? []).map((r) => (
            <ListItem
              key={r.exerciseId}
              title={r.name}
              subtitle={r.heaviest}
              value={r.e1rm}
              onPress={() => router.push(`/exercise/${encodeURIComponent(r.exerciseId)}`)}
            />
          ))}
        </View>
        {data && data.records.length > 0 ? (
          <Button label="Alle records" variant="ghost" onPress={() => router.push('/workout/records')} />
        ) : null}
      </Card>

      <Card eyebrow="Tools">
        <View>
          <ListItem title="Oefeningen" subtitle="Bibliotheek en eigen oefeningen" onPress={() => router.push('/exercise/picker?mode=browse')} />
          <ListItem title="Platencalculator" subtitle="Welke schijven per kant" onPress={() => router.push('/workout/platen')} />
          <ListItem title="Importeren en exporteren" subtitle="Hevy, Strong, CSV" onPress={() => router.push('/workout/data')} />
        </View>
      </Card>
    </Screen>
  );
}
