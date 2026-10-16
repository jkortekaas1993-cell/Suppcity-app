import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRepositories } from '@/lib/db';
import {
  Appear,
  BrandMark,
  Breathe,
  Button,
  Card,
  Glow,
  haptics,
  IconButton,
  LiveDot,
  Ring,
  Screen,
  Skyline,
  StatTile,
  Text,
  useTheme,
} from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from './activeWorkoutStore';
import { WeeklyGoalPicker } from './components/BadgesSection';
import { useFocusQuery } from './components/useFocusQuery';
import { formatClockNl, formatLongDateNl, formatNumberNl, formatSignedPct, formatTonnes } from './logic/format';
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
  /**
   * "Volume week" tile from the progress feature (same numbers as Voortgang). When absent
   * the tracker's own week-volume tile is shown.
   */
  weekVolumeTile?: ReactNode;
}

const RECENT_WORKOUTS = 60;
const HERO_NAMES = 3;

/** Time-of-day greeting for the header ("Goedemiddag"). No name: the tracker has none. */
function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

/** Small number well inside the hero card (mockup: dark translucent tile). */
function HeroStat({ label, value, accessibilityLabel }: { label: string; value: string; accessibilityLabel?: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      style={{ flex: 1, padding: space.sm + 2, borderRadius: radius.md, overflow: 'hidden' }}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg0, opacity: 0.55 }]} />
      <Text variant="micro" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="heading" tnum numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: 18 }}>
        {value}
      </Text>
    </View>
  );
}

/** "± 55 min" tag in the hero card's top-right corner. */
function HeroTag({ label, accessibilityLabel }: { label: string; accessibilityLabel: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{
        height: 24,
        paddingHorizontal: space.sm + 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg0, opacity: 0.6 }]} />
      <Text variant="micro" tone="secondary" tnum style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Vandaag tab (design round 3, Main.dc.html): logo header over a faint skyline and glow, a big
 * condensed headline, the next workout as the hero card with ONE breathing start button, the
 * weekly-goal ring next to the week volume, then the slots for cards from other features.
 * Cards enter staggered; every animation respects "reduce motion" (in the primitives).
 */
export function VandaagScreen({ smartCard, supplementCard, weekVolumeTile }: VandaagScreenProps) {
  const repos = useRepositories();
  const router = useRouter();
  const workout = useActiveWorkout();
  const actions = useActiveWorkoutActions();
  const { colors, layout, radius, space } = useTheme();
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
    let plan: { names: string[]; exerciseCount: number; setCount: number; minutes: number } | null = null;
    if (next) {
      const found = await repos.routines.get(next.id);
      const exercises = found?.exercises ?? [];
      const names: string[] = [];
      for (const e of exercises.slice(0, HERO_NAMES)) {
        const ex = await repos.exercises.get(e.exercise_id);
        if (ex) names.push(ex.name_nl);
      }
      plan = {
        names,
        exerciseCount: exercises.length,
        setCount: exercises.reduce((n, e) => n + Math.max(0, e.target_sets), 0),
        minutes: estimateRoutineMinutes(exercises),
      };
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
  // "Vorige keer" in the hero: the volume of the last finished session of the next routine.
  const nextId = data?.next?.id ?? null;
  const lastOfRoutine = nextId ? (data?.recent ?? []).find((w) => w.routine_id === nextId) : undefined;
  // A workout is "planned today" when there is a next routine and nothing was trained today yet.
  const plannedToday = Boolean(data?.next && data.plan) && sinceLast !== 0;
  // Mount the cards once the data is there, so the entrance plays with real content.
  const ready = data !== undefined || workout !== null;

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
  const toGo = progress.goal - progress.done;
  const goalStatus = progress.reached ? 'Gehaald, sterk bezig' : `Nog ${toGo} te gaan`;

  const heroTitle = { fontSize: 30, lineHeight: 32 } as const;

  return (
    <Screen>
      {/* Header over the faint skyline and the turquoise glow (both decorative). */}
      <View style={{ paddingTop: space.md }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: -layout.screenPadding, right: -layout.screenPadding, top: 0 }}>
          <Glow intensity={0.22} style={{ position: 'absolute', left: -60, right: -60, top: -120, height: 300 }} />
          <View style={{ height: 230, justifyContent: 'flex-end', overflow: 'hidden' }}>
            <Skyline opacity={0.1} style={{ width: '100%' }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, flexShrink: 1 }}>
            <BrandMark accessibilityLabel="Supp City" />
            <View style={{ flexShrink: 1 }}>
              <Text variant="caption" tone="secondary" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                {formatLongDateNl(today)}
              </Text>
              <Text variant="heading" style={{ fontSize: 16, lineHeight: 20 }} numberOfLines={1}>
                {greeting(today)}
              </Text>
            </View>
          </View>
          <IconButton icon="user" variant="outline" accessibilityLabel="Profiel" onPress={() => router.push('/ik')} />
        </View>
      </View>

      <Text variant="display" accessibilityRole="header" style={{ fontSize: 44, lineHeight: 44, marginTop: space.xs }}>
        {workout ? 'Training bezig.' : 'Tijd om te tillen.'}
        {'\n'}
        <Text variant="display" tone="accent" style={{ fontSize: 44, lineHeight: 44, color: colors.accent }}>
          {workout ? 'Ga door.' : "Let's go."}
        </Text>
      </Text>

      {ready ? (
        <Appear index={0}>
          {workout ? (
            <Card variant="hero" skyline eyebrow="Training bezig" padding={18} gap={14}>
              <View style={{ gap: space.xs }}>
                <Text variant="title" style={heroTitle} numberOfLines={2}>
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
            <Card variant="hero" skyline padding={18} gap={14}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                <Text variant="eyebrow" tone="accent" style={{ letterSpacing: 1.8, flexShrink: 1 }} numberOfLines={1}>
                  {plannedToday ? 'Training van vandaag' : 'Volgende training'}
                </Text>
                {data.plan.minutes > 0 ? (
                  <HeroTag label={`± ${data.plan.minutes} min`} accessibilityLabel={`Ongeveer ${data.plan.minutes} minuten`} />
                ) : null}
              </View>
              <View style={{ gap: space.xs }}>
                <Text variant="title" style={heroTitle} numberOfLines={2}>
                  {data.next.name}
                </Text>
                {data.plan.names.length > 0 ? (
                  <Text tone="secondary" numberOfLines={2} style={{ fontSize: 14 }}>
                    {data.plan.names.join(' · ')}
                    {data.plan.exerciseCount > data.plan.names.length ? ` · +${data.plan.exerciseCount - data.plan.names.length}` : ''}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <HeroStat label="Oefeningen" value={String(data.plan.exerciseCount)} />
                {data.plan.setCount > 0 ? <HeroStat label="Sets" value={String(data.plan.setCount)} /> : null}
                {lastOfRoutine && lastOfRoutine.volume_kg > 0 ? (
                  <HeroStat
                    label="Vorige keer"
                    value={`${formatNumberNl(lastOfRoutine.volume_kg, 0)} kg`}
                    accessibilityLabel={`Vorige keer ${formatNumberNl(lastOfRoutine.volume_kg, 0)} kilo volume`}
                  />
                ) : sinceLast !== null ? (
                  <HeroStat
                    label="Sinds vorige"
                    value={`${sinceLast} d`}
                    accessibilityLabel={`${sinceLast} ${sinceLast === 1 ? 'dag' : 'dagen'} sinds je vorige training`}
                  />
                ) : null}
              </View>
              <View style={{ gap: space.xs }}>
                <Breathe active={plannedToday && !busy} radius={radius.control}>
                  <Button
                    label="Start training"
                    icon="play"
                    size="lg"
                    fullWidth
                    loading={busy}
                    onPress={() => {
                      const id = data.next?.id;
                      if (id) void run(() => actions.startFromRoutine(id));
                    }}
                  />
                </Breathe>
                <Button label="Lege training" variant="ghost" fullWidth onPress={() => void run(() => actions.startEmpty())} />
              </View>
            </Card>
          ) : (
            <Card variant="hero" skyline eyebrow="Eerste training" padding={18} gap={14}>
              <View style={{ gap: space.xs }}>
                <Text variant="title" style={heroTitle}>
                  Klaar voor de start?
                </Text>
                <Text tone="secondary">Kies een kant-en-klaar schema of begin meteen met een lege training.</Text>
              </View>
              <View style={{ gap: space.xs }}>
                <Button label="Start training" icon="play" size="lg" fullWidth loading={busy} onPress={() => void run(() => actions.startEmpty())} />
                <Button label="Kies een schema" variant="link" fullWidth onPress={() => router.push('/routine/schemas')} />
              </View>
            </Card>
          )}
        </Appear>
      ) : null}

      {ready ? (
        <Appear index={1} style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.sm + 2 }}>
            {/* Weekly goal: a ring, never a daily streak. Tap to change the goal. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Weekdoel: ${goalLine}. ${goalStatus}. ${thisMonth} ${thisMonth === 1 ? 'training' : 'trainingen'} deze maand.`}
              accessibilityHint={editingGoal ? 'Tik om te sluiten' : 'Tik om je weekdoel aan te passen'}
              accessibilityState={{ expanded: editingGoal }}
              onPress={() => {
                haptics.selection();
                setEditingGoal((v) => !v);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: layout.cardPadding,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: editingGoal ? colors.borderStrong : colors.border,
                backgroundColor: pressed ? colors.bg2 : colors.bg1,
              })}
            >
              <Ring progress={progress.goal > 0 ? progress.filled / progress.goal : 0} size={56} strokeWidth={7} animateIn>
                <Text variant="metric" style={{ fontSize: 18, lineHeight: 20 }} maxFontSizeMultiplier={1.2}>
                  {progress.done}/{progress.goal}
                </Text>
              </Ring>
              <View style={{ flex: 1, gap: space.xxs }}>
                <Text variant="eyebrow" tone="secondary" style={{ letterSpacing: 1.4 }} numberOfLines={1}>
                  Weekdoel
                </Text>
                <Text variant="bodyStrong" tone={progress.reached ? 'success' : 'default'} style={{ fontSize: 14, lineHeight: 18 }}>
                  {progress.reached ? 'Gehaald' : `Nog ${toGo} te gaan`}
                </Text>
                <Text variant="caption" tone="tertiary" tnum style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                  {thisMonth} deze maand
                </Text>
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              {weekVolumeTile ?? (
                <StatTile
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
              )}
            </View>
          </View>
          {editingGoal ? (
            <View style={{ gap: space.sm }}>
              <Text variant="caption" tone="secondary">
                Hoe vaak per week wil je trainen? Een gemiste dag is geen probleem: alleen de week telt.
              </Text>
              <WeeklyGoalPicker value={progress.goal} onChange={(g) => void changeGoal(g)} />
            </View>
          ) : null}
        </Appear>
      ) : null}

      {ready && supplementCard ? <Appear index={2}>{supplementCard}</Appear> : null}
      {ready && smartCard ? <Appear index={supplementCard ? 3 : 2}>{smartCard}</Appear> : null}
    </Screen>
  );
}
