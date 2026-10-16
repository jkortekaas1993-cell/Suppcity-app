import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { useRepositories } from '@/lib/db';
import { Button, Card, EmptyState, ListRow, Pill, Screen, SectionLabel, Text } from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from './activeWorkoutStore';
import { useFocusQuery } from './components/useFocusQuery';
import { formatNumberNl } from './logic/format';
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

  const routines = data?.routines ?? [];
  const history = data?.history ?? [];
  const records = data?.records ?? [];

  return (
    <Screen title="Trainen" subtitle="Log je sets. Geen reclame, geen afleiding.">
      {workout ? (
        <Button label="Ga verder met training" icon="play" size="lg" fullWidth onPress={() => router.push('/workout')} />
      ) : (
        <Button label="Lege training starten" icon="play" size="lg" fullWidth loading={starting} onPress={() => void startEmpty()} />
      )}

      <SectionLabel label="Routines" action={{ label: "Schema's", onPress: () => router.push('/routine/schemas'), accessibilityLabel: "Kant-en-klare schema's" }} />
      {data && routines.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Nog geen routines"
          body="Kies een kant-en-klaar schema of maak er zelf een."
          action={{ label: "Schema's bekijken", onPress: () => router.push('/routine/schemas'), variant: 'secondary' }}
        />
      ) : (
        <Card padding={0} gap={0}>
          {routines.map((r, i) => (
            <ListRow
              key={r.id}
              title={r.name}
              leading="dumbbell"
              trailing={r.id === data?.nextId ? <Pill label="Volgende" /> : undefined}
              chevron
              divider={i < routines.length - 1}
              onPress={() => router.push(`/routine/${r.id}`)}
              accessibilityLabel={r.id === data?.nextId ? `${r.name}, volgende training` : r.name}
            />
          ))}
        </Card>
      )}
      <Button label="+ Nieuwe routine" variant="link" onPress={() => router.push('/routine/nieuw')} />

      <SectionLabel
        label="Historie"
        action={history.length > 0 ? { label: 'Alles', onPress: () => router.push('/workout/historie'), accessibilityLabel: 'Alle trainingen' } : undefined}
      />
      {data && history.length === 0 ? (
        <Card>
          <Text tone="secondary">Je afgeronde trainingen verschijnen hier.</Text>
        </Card>
      ) : (
        <Card padding={0} gap={0}>
          {history.map((w, i) => (
            <ListRow
              key={w.id}
              title={w.title}
              subtitle={workoutSubtitle(w)}
              value={`${formatNumberNl(w.volume_kg, 0)} kg`}
              divider={i < history.length - 1}
              onPress={() => router.push(`/workout/${w.id}`)}
            />
          ))}
        </Card>
      )}

      <SectionLabel
        label="Records"
        action={records.length > 0 ? { label: 'Alles', onPress: () => router.push('/workout/records'), accessibilityLabel: 'Alle records' } : undefined}
      />
      {data && records.length === 0 ? (
        <Card>
          <Text tone="secondary">Nog geen records. Die komen vanzelf.</Text>
        </Card>
      ) : (
        <Card padding={0} gap={0}>
          {records.map((r, i) => (
            <ListRow
              key={r.exerciseId}
              title={r.name}
              subtitle={r.heaviest}
              value={r.e1rm}
              leading="trophy"
              divider={i < records.length - 1}
              onPress={() => router.push(`/exercise/${encodeURIComponent(r.exerciseId)}`)}
              accessibilityLabel={`${r.name}, zwaarste set ${r.heaviest}, geschat 1RM ${r.e1rm}`}
            />
          ))}
        </Card>
      )}

      <SectionLabel label="Tools" />
      <Card padding={0} gap={0}>
        <ListRow
          title="Oefeningen"
          subtitle="Bibliotheek en eigen oefeningen"
          leading="search"
          divider
          onPress={() => router.push('/exercise/picker?mode=browse')}
        />
        <ListRow
          title="Platencalculator"
          subtitle="Welke schijven per kant"
          leading="dumbbell"
          divider
          onPress={() => router.push('/workout/platen')}
        />
        <ListRow
          title="Importeren en exporteren"
          subtitle="Hevy, Strong, CSV"
          leading="share"
          onPress={() => router.push('/workout/data')}
        />
      </Card>
    </Screen>
  );
}
