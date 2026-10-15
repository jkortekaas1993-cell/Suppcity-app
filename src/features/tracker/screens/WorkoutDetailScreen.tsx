import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, View } from 'react-native';

import { useRepositories, type Exercise, type WorkoutSet } from '@/lib/db';
import { Button, Card, ListItem, Text, useTheme } from '@/ui';

import { IconButton, Stat } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { useFocusQuery } from '../components/useFocusQuery';
import { formatDateNl, formatDuration, formatKg, formatNumberNl } from '../logic/format';
import { epley1rm } from '../logic/oneRepMax';
import { PR_LABELS_NL } from '../logic/prs';
import { buildWorkoutReport } from '../services/workoutSummary';

/** Detail of a finished workout; with ?klaar=1 it doubles as the finish summary. */
export function WorkoutDetailScreen() {
  const { id, klaar } = useLocalSearchParams<{ id: string; klaar?: string }>();
  const repos = useRepositories();
  const router = useRouter();
  const { space } = useTheme();
  const justFinished = klaar === '1';

  const load = useCallback(async () => {
    const found = await repos.workouts.get(id);
    if (!found) return null;
    const report = await buildWorkoutReport(repos, id);
    const exercises = new Map<string, Exercise>();
    for (const s of found.sets) {
      if (!exercises.has(s.exercise_id)) {
        const e = await repos.exercises.get(s.exercise_id);
        if (e) exercises.set(e.id, e);
      }
    }
    return { ...found, report, exercises };
  }, [repos, id]);
  const { data, loading } = useFocusQuery(load);

  if (loading && !data) return <StackScreen title="Training">{null}</StackScreen>;
  if (!data) {
    return (
      <StackScreen title="Training">
        <Text tone="muted">Deze training bestaat niet meer.</Text>
      </StackScreen>
    );
  }

  const { workout, sets, report, exercises } = data;
  const groups: { exerciseId: string; sets: WorkoutSet[] }[] = [];
  for (const s of sets) {
    if (s.completed_at === null) continue;
    const g = groups.find((x) => x.exerciseId === s.exercise_id);
    if (g) g.sets.push(s);
    else groups.push({ exerciseId: s.exercise_id, sets: [s] });
  }

  const remove = () =>
    Alert.alert('Training verwijderen?', 'Deze training en alle sets worden verwijderd.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () => {
          void repos.workouts.softDelete(workout.id).then(() => router.back());
        },
      },
    ]);

  return (
    <StackScreen
      title={justFinished ? 'Klaar!' : 'Training'}
      right={<IconButton glyph="×" label="Training verwijderen" tone="danger" onPress={remove} />}
      footer={justFinished ? <Button label="Klaar" fullWidth onPress={() => router.replace('/trainen')} /> : undefined}
    >
      <View style={{ gap: space.xs }}>
        <Text variant="title">{workout.title}</Text>
        <Text tone="muted">{formatDateNl(workout.started_at)}</Text>
      </View>

      {report ? (
        <Card highlighted={justFinished} eyebrow="Samenvatting">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, columnGap: space.lg }}>
            <Stat label="Duur" value={formatDuration(report.summary.durationMs)} />
            <Stat label="Volume" value={formatKg(report.summary.volumeKg, 0)} />
            <Stat label="Sets" value={String(report.summary.completedSets)} />
            <Stat label="PR's" value={String(report.prs.length)} />
          </View>
        </Card>
      ) : null}

      {report && report.prs.length > 0 ? (
        <Card eyebrow="Persoonlijke records">
          {report.prs.map((pr, i) => (
            <View key={`${pr.exerciseId}-${pr.kind}-${i}`} style={{ gap: space.xxs }}>
              <Text variant="heading">{pr.exerciseName}</Text>
              <Text tone="muted">
                {PR_LABELS_NL[pr.kind]}:{' '}
                {pr.kind === 'most_reps_at_weight'
                  ? `${pr.value} reps op ${formatKg(pr.weightKg)} (was ${pr.previous})`
                  : `${formatKg(pr.value, 1)} (was ${formatKg(pr.previous, 1)})`}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {groups.map((g) => {
        const name = exercises.get(g.exerciseId)?.name_nl ?? 'Oefening';
        let working = 0;
        return (
          <Card key={g.exerciseId}>
            <Text
              variant="heading"
              tone="accent"
              accessibilityRole="link"
              onPress={() => router.push(`/exercise/${encodeURIComponent(g.exerciseId)}`)}
            >
              {name}
            </Text>
            {g.sets.map((s) => {
              const label = s.set_type === 'warmup' ? 'W' : s.set_type === 'dropset' ? 'D' : String(++working);
              const e = epley1rm(s.weight_kg, s.reps);
              return (
                <ListItem
                  key={s.id}
                  title={`${formatNumberNl(s.weight_kg ?? 0, 2)} kg × ${s.reps ?? 0}`}
                  subtitle={e !== null && s.set_type !== 'warmup' ? `Geschat 1RM ${formatKg(e, 1)}` : undefined}
                  leading={
                    <Text variant="heading" tone="muted" style={{ width: 24 }}>
                      {label}
                    </Text>
                  }
                />
              );
            })}
          </Card>
        );
      })}
    </StackScreen>
  );
}
