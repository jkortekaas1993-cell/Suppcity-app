import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Chip, EmptyState, Icon, LineChart, ListRow, StatTile, Text, useTheme } from '@/ui';

import { loadExerciseOptions, loadExerciseSessions } from '../data/loaders';
import type { ReadDb } from '../data/queries';
import { useProgressQuery } from '../data/useProgressQuery';
import {
  filterByPeriod,
  monthLabels,
  PERIODS,
  summarizeExercise,
  trendSentence,
  type ProgressPeriod,
} from '../logic/exerciseStats';
import { formatKg, formatNumberNl, formatSigned, formatVolume } from '../logic/format';
import type { WeekSummary } from '../logic/week';
import { MuscleSetsCard } from './MuscleSetsCard';

/** Voortgang → Oefening: e1RM over time for one exercise, plus heaviest set and best volume. */
export function ExerciseView({ week }: { week: WeekSummary | undefined }) {
  const router = useRouter();
  const { space } = useTheme();
  const options = useProgressQuery(loadExerciseOptions);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [period, setPeriod] = useState<ProgressPeriod>('6m');

  const list = options.data ?? [];
  const exercise = list.find((o) => o.id === selected) ?? list[0];
  const exerciseId = exercise?.id ?? null;

  const loadSessions = useCallback(
    async (db: ReadDb, uid: string | null) => ({
      id: exerciseId,
      sessions: exerciseId ? await loadExerciseSessions(db, exerciseId, uid) : [],
    }),
    [exerciseId],
  );
  const sessionsQuery = useProgressQuery(loadSessions);
  const sessions = sessionsQuery.data?.id === exerciseId ? sessionsQuery.data.sessions : undefined;

  const summary = useMemo(
    () => (sessions ? summarizeExercise(filterByPeriod(sessions, period, new Date())) : undefined),
    [sessions, period],
  );

  if (options.loading && !options.data) return null;

  if (!exercise) {
    return (
      <EmptyState
        icon="trend-up"
        title="Nog geen voortgang"
        body="Rond je eerste training af. Daarna zie je hier per oefening je geschat 1RM, je zwaarste set en je beste volume."
        action={{ label: 'Naar Trainen', onPress: () => router.push('/trainen') }}
        testID="progress-exercise-empty"
      />
    );
  }

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? '';
  const points = summary?.points ?? [];
  const delta = summary?.deltaE1rm ?? null;
  const volume = summary?.bestVolumeKg != null ? formatVolume(summary.bestVolumeKg) : null;

  return (
    <View style={{ gap: space.md }}>
      <Card gap={10}>
        <ExerciseHeader
          name={exercise.name}
          periodLabel={periodLabel}
          open={pickerOpen}
          onToggle={() => setPickerOpen((o) => !o)}
        />
        {pickerOpen ? (
          <Card variant="inset" padding={0}>
            {list.map((o, i) => (
              <ListRow
                key={o.id}
                title={o.name}
                subtitle={`${formatNumberNl(o.workouts)} ${o.workouts === 1 ? 'training' : 'trainingen'}`}
                trailing={o.id === exercise.id ? <Icon name="check" size={18} /> : undefined}
                divider={i < list.length - 1}
                accessibilityLabel={`${o.name}, ${o.workouts} trainingen${o.id === exercise.id ? ', gekozen' : ''}`}
                onPress={() => {
                  setSelected(o.id);
                  setPickerOpen(false);
                }}
              />
            ))}
          </Card>
        ) : (
          <>
            <E1rmHeadline value={summary?.latestE1rm ?? null} delta={delta} />
            <ChartBlock exerciseName={exercise.name} period={period} summary={summary} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {PERIODS.map((p) => (
                <Chip key={p.value} label={p.label} selected={p.value === period} onPress={() => setPeriod(p.value)} />
              ))}
            </View>
          </>
        )}
      </Card>

      {points.length > 0 || summary?.heaviest ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <StatTile
              label="Zwaarste set"
              value={summary?.heaviest ? formatKg(summary.heaviest.weightKg) : '–'}
              unit={summary?.heaviest ? `kg × ${summary.heaviest.reps}` : undefined}
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatTile label="Beste volume" value={volume?.value ?? '–'} unit={volume?.unit} caption="per training" />
          </View>
        </View>
      ) : null}

      <MuscleSetsCard muscles={week?.muscles} />
    </View>
  );
}

function ExerciseHeader({
  name,
  periodLabel,
  open,
  onToggle,
}: {
  name: string;
  periodLabel: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { colors, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Oefening: ${name}. Kies een andere oefening`}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: 44, flexShrink: 1 }}
      >
        <Text variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text2} />
      </Pressable>
      <Text variant="caption" tone="tertiary">
        {periodLabel}
      </Text>
    </View>
  );
}

function E1rmHeadline({ value, delta }: { value: number | null; delta: number | null }) {
  const { space } = useTheme();
  const shownDelta = delta !== null ? formatSigned(delta) : null;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}
      accessible
      accessibilityLabel={
        value === null
          ? 'Nog geen geschat 1RM in deze periode'
          : `Geschat 1RM ${formatNumberNl(value)} kilo${shownDelta ? `, ${shownDelta} kilo in deze periode` : ''}`
      }
    >
      <Text variant="hero">{value === null ? '–' : formatNumberNl(value)}</Text>
      <Text variant="body" tone="secondary">
        kg geschat 1RM
      </Text>
      {shownDelta ? (
        <Text variant="bodyStrong" tone={delta !== null && delta > 0.5 ? 'success' : 'tertiary'} tnum>
          {shownDelta} kg
        </Text>
      ) : null}
    </View>
  );
}

function ChartBlock({
  exerciseName,
  period,
  summary,
}: {
  exerciseName: string;
  period: ProgressPeriod;
  summary: ReturnType<typeof summarizeExercise> | undefined;
}) {
  const { space } = useTheme();
  if (!summary) return <View style={{ height: 150 }} />;
  const { points } = summary;
  if (points.length < 2) {
    return (
      <Text variant="caption" tone="tertiary" style={{ paddingVertical: space.md }}>
        {points.length === 0
          ? 'Geen sets van 1–10 herhalingen in deze periode. Kies een langere periode of train deze oefening opnieuw.'
          : 'Train deze oefening nog een keer, dan zie je hier je lijn.'}
      </Text>
    );
  }
  return (
    <LineChart
      data={points.map((p) => ({ value: p.value, pr: p.pr }))}
      xLabels={monthLabels(points.map((p) => p.startedAt))}
      legend="Geschat 1RM"
      accessibilityLabel={trendSentence(exerciseName, summary, period)}
      testID="progress-e1rm-chart"
    />
  );
}
