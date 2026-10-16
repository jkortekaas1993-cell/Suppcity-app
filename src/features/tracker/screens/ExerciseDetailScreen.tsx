import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EXERCISE_SEED_BY_SLUG } from '@/content/exercises.nl';
import { useRepositories } from '@/lib/db';
import { Button, Card, LineChart, ListRow, SectionLabel, Segmented, StatTile, Text, useTheme } from '@/ui';

import { EQUIPMENT_LABELS_NL, MUSCLE_LABELS_NL } from '../components/labels';
import { StackScreen } from '../components/StackScreen';
import { useFocusQuery } from '../components/useFocusQuery';
import { formatDateNl, formatKg, formatNumberNl, formatShortDateNl } from '../logic/format';
import { exerciseProgress, type ProgressPoint } from '../logic/progress';
import { bestSet } from '../logic/summary';

type Metric = 'e1rm' | 'bestWeightKg' | 'volumeKg';
const METRICS: { value: Metric; label: string; legend: string }[] = [
  { value: 'e1rm', label: '1RM', legend: 'Geschat 1RM (kg)' },
  { value: 'bestWeightKg', label: 'Gewicht', legend: 'Zwaarste set (kg)' },
  { value: 'volumeKg', label: 'Volume', legend: 'Volume per training (kg)' },
];
const CHART_POINTS = 12;

/** Marks the points that beat every earlier point (gold PR dots). */
function withPrs(values: number[]): { value: number; pr: boolean }[] {
  let best = -Infinity;
  return values.map((v, i) => {
    const pr = i > 0 && v > best;
    best = Math.max(best, v);
    return { value: v, pr };
  });
}

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
  const m = METRICS.find((x) => x.value === metric) ?? METRICS[0];
  const series = recent.map((p) => p[metric]);
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <StackScreen
      title={exercise?.name_nl ?? 'Oefening'}
      subtitle={
        exercise
          ? `${MUSCLE_LABELS_NL[exercise.primary_muscle]} · ${EQUIPMENT_LABELS_NL[exercise.equipment]}${exercise.is_custom ? ' · Eigen oefening' : ''}`
          : undefined
      }
    >
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <StatTile
          label="Zwaarste set"
          value={data?.pr.heaviest ? formatNumberNl(data.pr.heaviest.weight_kg ?? 0, 2) : '–'}
          unit={data?.pr.heaviest ? `kg × ${data.pr.heaviest.reps ?? 0}` : undefined}
        />
        <StatTile label="Geschat 1RM" value={data?.pr.bestE1rm ? formatNumberNl(data.pr.bestE1rm, 1) : '–'} unit={data?.pr.bestE1rm ? 'kg' : undefined} />
      </View>
      {data?.best ? (
        <Text variant="caption" tone="tertiary" tnum>
          Beste set: {formatNumberNl(data.best.weightKg ?? 0, 2)} kg × {data.best.reps} ({formatDateNl(data.best.at)})
        </Text>
      ) : null}

      <SectionLabel label="Voortgang" />
      {recent.length < 2 || !m ? (
        <Card>
          <Text tone="secondary">Log deze oefening in minstens twee trainingen om je voortgang te zien.</Text>
        </Card>
      ) : (
        <Card gap={space.md}>
          <Segmented accessibilityLabel="Grafiek" options={METRICS} value={metric} onChange={setMetric} />
          <LineChart
            data={withPrs(series)}
            xLabels={recent.map((p, i) => (i === 0 || i === recent.length - 1 || i === Math.floor(recent.length / 2) ? formatShortDateNl(p.startedAt) : ''))}
            formatY={(v) => formatNumberNl(v, 0)}
            legend={m.legend}
            accessibilityLabel={`${m.legend} over de laatste ${recent.length} trainingen: van ${formatNumberNl(first ?? 0, 0)} naar ${formatNumberNl(last ?? 0, 0)}`}
          />
        </Card>
      )}

      {seed || exercise?.equipment === 'barbell' ? (
        <Card>
          {seed ? <Text>{seed.description_nl}</Text> : null}
          {exercise?.equipment === 'barbell' ? (
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

      {points.length > 0 ? (
        <>
          <SectionLabel label="Per training" />
          <Card padding={0} gap={0}>
            {[...points]
              .reverse()
              .slice(0, 20)
              .map((p, i, list) => (
                <ListRow
                  key={p.workoutId}
                  title={`${formatNumberNl(p.bestWeightKg, 2)} kg × ${p.bestReps}`}
                  subtitle={`${formatDateNl(p.startedAt)} · volume ${formatKg(p.volumeKg, 0)}`}
                  value={`1RM ~${formatNumberNl(p.e1rm, 1)}`}
                  valueTone="secondary"
                  divider={i < list.length - 1}
                  onPress={() => router.push(`/workout/${p.workoutId}`)}
                />
              ))}
          </Card>
        </>
      ) : null}
    </StackScreen>
  );
}
