import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EXERCISE_SEED_BY_SLUG } from '@/content/exercises.nl';
import { useRepositories } from '@/lib/db';
import { Button, Card, ListItem, Text, useTheme } from '@/ui';

import { Chip, Row, Stat, BarChart } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { useFocusQuery } from '../components/useFocusQuery';
import { EQUIPMENT_LABELS_NL, MUSCLE_LABELS_NL } from '../components/labels';
import { formatDateNl, formatKg, formatNumberNl, formatShortDateNl } from '../logic/format';
import { exerciseProgress, type ProgressPoint } from '../logic/progress';
import { bestSet } from '../logic/summary';

type Metric = 'e1rm' | 'bestWeightKg' | 'volumeKg';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'e1rm', label: 'Geschat 1RM' },
  { key: 'bestWeightKg', label: 'Gewicht' },
  { key: 'volumeKg', label: 'Volume' },
];
const CHART_POINTS = 12;

export function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const router = useRouter();
  const { space } = useTheme();
  const [metric, setMetric] = useState<Metric>('e1rm');

  const load = useCallback(async () => {
    const exercise = await repos.exercises.get(id);
    const history = await repos.sets.completedHistory([id]);
    const points = exerciseProgress(
      history.map((h) => ({
        workoutId: h.workout_id,
        startedAt: h.started_at,
        setType: h.set_type,
        weightKg: h.weight_kg,
        reps: h.reps,
      })),
    );
    const best = bestSet(
      history.filter((h) => h.set_type !== 'warmup').map((h) => ({ weightKg: h.weight_kg, reps: h.reps, at: h.started_at })),
    );
    const pr = await repos.sets.personalRecords(id);
    return { exercise, points, best, pr };
  }, [repos, id]);
  const { data } = useFocusQuery(load);

  const exercise = data?.exercise;
  const seed = exercise?.slug ? EXERCISE_SEED_BY_SLUG.get(exercise.slug) : undefined;
  const points: ProgressPoint[] = data?.points ?? [];
  const recent = points.slice(-CHART_POINTS);

  return (
    <StackScreen title={exercise?.name_nl ?? 'Oefening'}>
      {exercise ? (
        <Card>
          <Text tone="muted">
            {MUSCLE_LABELS_NL[exercise.primary_muscle]} · {EQUIPMENT_LABELS_NL[exercise.equipment]}
            {exercise.is_custom ? ' · Eigen oefening' : ''}
          </Text>
          {seed ? <Text>{seed.description_nl}</Text> : null}
          {exercise.equipment === 'barbell' ? (
            <Button
              label="Platencalculator"
              variant="secondary"
              onPress={() => {
                const w = data?.best?.weightKg;
                router.push(w ? `/workout/platen?kg=${w}` : '/workout/platen');
              }}
            />
          ) : null}
        </Card>
      ) : null}

      <Card eyebrow="Records">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, columnGap: space.lg }}>
          <Stat label="Zwaarste set" value={data?.pr.heaviest ? formatKg(data.pr.heaviest.weight_kg) : '–'} />
          <Stat label="Geschat 1RM" value={data?.pr.bestE1rm ? formatKg(data.pr.bestE1rm, 1) : '–'} />
        </View>
        {data?.best ? (
          <Text variant="caption" tone="muted">
            Beste set: {formatNumberNl(data.best.weightKg ?? 0, 2)} kg × {data.best.reps} ({formatDateNl(data.best.at)})
          </Text>
        ) : null}
      </Card>

      <Card eyebrow="Voortgang">
        {recent.length < 2 ? (
          <Text tone="muted">Log deze oefening in minstens twee trainingen om je voortgang te zien.</Text>
        ) : (
          <>
            <Row>
              {METRICS.map((m) => (
                <Chip key={m.key} label={m.label} selected={metric === m.key} onPress={() => setMetric(m.key)} />
              ))}
            </Row>
            <BarChart
              values={recent.map((p) => p[metric])}
              labels={recent.map((p) => formatShortDateNl(p.startedAt))}
              accessibilityLabel={`Voortgang ${METRICS.find((m) => m.key === metric)?.label ?? ''}, laatste ${recent.length} trainingen`}
            />
          </>
        )}
      </Card>

      {points.length > 0 ? (
        <Card eyebrow="Per training">
          {[...points]
            .reverse()
            .slice(0, 20)
            .map((p) => (
              <ListItem
                key={p.workoutId}
                title={`${formatNumberNl(p.bestWeightKg, 2)} kg × ${p.bestReps}`}
                subtitle={`${formatDateNl(p.startedAt)} · volume ${formatKg(p.volumeKg, 0)}`}
                value={formatKg(p.e1rm, 1)}
                onPress={() => router.push(`/workout/${p.workoutId}`)}
              />
            ))}
        </Card>
      ) : null}
    </StackScreen>
  );
}
