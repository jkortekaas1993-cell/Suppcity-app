import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useRepositories } from '@/lib/db';
import { Button, Card, haptics, IconButton, LiveDot, Screen, SectionLabel, SegmentBar, StatTile, Text, useTheme } from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from './activeWorkoutStore';
import { WeeklyGoalPicker } from './components/BadgesSection';
import { useFocusQuery } from './components/useFocusQuery';
import { formatClockNl, formatLongDateNl, formatSignedPct, formatTonnes } from './logic/format';
import { estimateRoutineMinutes, nextRoutine } from './logic/routines';
import { daysBetween, weekGoalProgress, weekVolume } from './logic/week';
import { loadWeeklyGoal, saveWeeklyGoal } from './services/badges';

export interface VandaagScreenProps {
  /**
   * At most ONE smart card from outside the tracker (e.g. shop ReorderCard).
   * Composed by the route file, so the tracker never imports other features.
   */
  smartCard?: ReactNode;
  /** Optional supplement-reminder card (supplements feature), shown above the smart card. */
  supplementCard?: ReactNode;
}

const RECENT_WORKOUTS = 60;
const HERO_NAMES = 3;

/**
 * Vandaag tab: weekly goal, the next workout as the hero with one big start button,
 * two stat tiles, then the slots for cards from other features.
 */
export function VandaagScreen({ smartCard, supplementCard }: VandaagScreenProps) {
  const repos = useRepositories();
  const router = useRouter();
  const workout = useActiveWorkout();
  const actions = useActiveWorkoutActions();
  const { space } = useTheme();
  const [busy, setBusy] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  const load = useCallback(async () => {
    const [routines, last, recent, goal] = await Promise.all([
      repos.routines.list(),
      repos.workouts.lastFinished(),
      repos.workouts.historyWithStats({ limit: RECENT_WORKOUTS }),
      loadWeeklyGoal(repos.appState),
    ]);
    const next = nextRoutine(
      routines.map((r) => ({ ...r, programSlug: r.program_slug })),
      last?.routine_id ?? null,
    );
    let plan: { names: string[]; exerciseCount: number; minutes: number } | null = null;
    if (next) {
      const found = await repos.routines.get(next.id);
      const exercises = found?.exercises ?? [];
      const names: string[] = [];
      for (const e of exercises.slice(0, HERO_NAMES)) {
        const ex = await repos.exercises.get(e.exercise_id);
        if (ex) names.push(ex.name_nl);
      }
      plan = { names, exerciseCount: exercises.length, minutes: estimateRoutineMinutes(exercises) };
    }
    return { next, plan, last, recent, goal };
  }, [repos]);
  const { data, reload } = useFocusQuery(load);

  const now = Date.now();
  const progress = weekGoalProgress(
    (data?.recent ?? []).map((w) => w.started_at),
    now,
    data?.goal ?? 3,
  );
  const volume = weekVolume(
    (data?.recent ?? []).map((w) => ({ startedAt: w.started_at, volumeKg: w.volume_kg })),
    now,
  );
  const today = new Date(now);
  const thisMonth = (data?.recent ?? []).filter((w) => {
    const d = new Date(w.started_at);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }).length;
  const sinceLast = data?.last ? daysBetween(data.last.started_at, now) : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      router.push('/workout');
    } finally {
      setBusy(false);
    }
  };

  const changeGoal = async (goal: number) => {
    await saveWeeklyGoal(repos.appState, goal);
    reload();
  };

  const goalLine =
    progress.done > progress.goal
      ? `${progress.done} trainingen · doel ${progress.goal}`
      : `${progress.done} van ${progress.goal} training${progress.goal === 1 ? '' : 'en'}`;

  return (
    <Screen
      eyebrow={formatLongDateNl(today)}
      title="Tijd om te tillen"
      headerRight={<IconButton icon="user" variant="outline" accessibilityLabel="Profiel" onPress={() => router.push('/ik')} />}
    >
      {/* Weekly goal: segments, never a daily streak. Tap to change the goal. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Weekdoel: ${goalLine}`}
        accessibilityHint={editingGoal ? 'Tik om te sluiten' : 'Tik om je weekdoel aan te passen'}
        accessibilityState={{ expanded: editingGoal }}
        onPress={() => {
          haptics.selection();
          setEditingGoal((v) => !v);
        }}
        style={{ gap: space.sm, paddingVertical: space.xs }}
      >
        <SectionLabel label="Weekdoel" value={goalLine} />
        <SegmentBar total={progress.goal} filled={progress.filled} accessibilityLabel={`Weekdoel: ${goalLine}`} />
      </Pressable>
      {editingGoal ? (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" tone="secondary">
            Hoe vaak per week wil je trainen? Een gemiste dag is geen probleem: alleen de week telt.
          </Text>
          <WeeklyGoalPicker value={progress.goal} onChange={(g) => void changeGoal(g)} />
        </View>
      ) : null}

      {workout ? (
        <Card variant="hero" eyebrow="Training bezig">
          <View style={{ gap: space.xs }}>
            <Text variant="title" style={{ fontSize: 34, lineHeight: 36 }} numberOfLines={2}>
              {workout.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <LiveDot />
              <Text tone="secondary" tnum>
                Gestart om {formatClockNl(workout.startedAt)}
              </Text>
            </View>
          </View>
          <Button label="Ga verder" icon="play" size="lg" fullWidth onPress={() => router.push('/workout')} />
        </Card>
      ) : data?.next && data.plan ? (
        <Card variant="hero" eyebrow="Volgende training">
          <View style={{ gap: space.xs }}>
            <Text variant="title" style={{ fontSize: 34, lineHeight: 36 }} numberOfLines={2}>
              {data.next.name}
            </Text>
            {data.plan.names.length > 0 ? (
              <Text tone="secondary" numberOfLines={2} style={{ fontSize: 14 }}>
                {data.plan.names.join(' · ')}
                {data.plan.exerciseCount > data.plan.names.length ? ` · +${data.plan.exerciseCount - data.plan.names.length}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: space.xl }}>
            <StatTile bare size="sm" value={String(data.plan.exerciseCount)} caption="oefeningen" />
            {data.plan.minutes > 0 ? <StatTile bare size="sm" value={`~${data.plan.minutes}`} caption="minuten" /> : null}
            {sinceLast !== null ? (
              <StatTile
                bare
                size="sm"
                value={`${sinceLast} d`}
                caption="sinds vorige"
                accessibilityLabel={`${sinceLast} ${sinceLast === 1 ? 'dag' : 'dagen'} sinds je vorige training`}
              />
            ) : null}
          </View>
          <View style={{ gap: space.xs }}>
            <Button
              label="Start workout"
              icon="play"
              size="lg"
              fullWidth
              loading={busy}
              onPress={() => {
                const id = data.next?.id;
                if (id) void run(() => actions.startFromRoutine(id));
              }}
            />
            <Button label="Lege training" variant="ghost" fullWidth onPress={() => void run(() => actions.startEmpty())} />
          </View>
        </Card>
      ) : (
        <Card variant="hero" eyebrow="Eerste training">
          <View style={{ gap: space.xs }}>
            <Text variant="title" style={{ fontSize: 34, lineHeight: 36 }}>
              Klaar voor de start?
            </Text>
            <Text tone="secondary">Kies een kant-en-klaar schema of begin meteen met een lege training.</Text>
          </View>
          <View style={{ gap: space.xs }}>
            <Button label="Start workout" icon="play" size="lg" fullWidth loading={busy} onPress={() => void run(() => actions.startEmpty())} />
            <Button label="Kies een schema" variant="link" fullWidth onPress={() => router.push('/routine/schemas')} />
          </View>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <StatTile
          size="lg"
          label="Volume week"
          value={formatTonnes(volume.thisWeekKg)}
          unit="ton"
          delta={
            volume.changePct !== null
              ? {
                  label: `${formatSignedPct(volume.changePct)} t.o.v. vorige week`,
                  direction: volume.changePct > 0 ? 'up' : volume.changePct < 0 ? 'down' : 'flat',
                }
              : undefined
          }
          caption={volume.changePct === null ? 'deze week' : undefined}
        />
        <StatTile size="lg" label="Deze maand" value={String(thisMonth)} unit={thisMonth === 1 ? 'training' : 'trainingen'} />
      </View>

      {supplementCard ?? null}
      {smartCard ?? null}
    </Screen>
  );
}
