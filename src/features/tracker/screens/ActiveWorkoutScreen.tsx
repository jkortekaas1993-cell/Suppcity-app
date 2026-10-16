import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useRepositories, type Exercise } from '@/lib/db';
import type { SetType } from '@/lib/db/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  haptics,
  Icon,
  IconButton,
  LiveDot,
  ProgressBar,
  Ring,
  Text,
  useActionSheet,
  useTheme,
} from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from '../activeWorkoutStore';
import { EQUIPMENT_LABELS_NL, MUSCLE_LABELS_NL } from '../components/labels';
import { NumberField, TextField } from '../components/primitives';
import { useFocusQuery } from '../components/useFocusQuery';
import { completedSetCount, type ActiveExercise, type ActiveSet } from '../logic/activeWorkoutReducer';
import { formatCountdown, formatElapsed, formatNumberNl } from '../logic/format';
import { formatRepRange } from '../logic/routines';
import { workoutVolumeKg } from '../logic/summaryView';

/**
 * Full-screen active workout (design round 3, Workout.dc.html). Training only: no commercial
 * elements here (hard rule; see CLAUDE.md "Trainen ... 100% free of ads and the shop").
 * Motion: the rest ring counts down live with a soft glow (tick haptic in the last 3 s); ticking
 * a set draws the check and briefly lights the row. All of it is off with "reduce motion".
 */

const REST_OPTIONS = [0, 60, 90, 120, 180, 240];
const SET_TYPE_ORDER: SetType[] = ['normal', 'warmup', 'dropset', 'failure'];
const SET_TYPE_SHORT: Record<SetType, string> = { normal: '', warmup: 'W', dropset: 'D', failure: 'F' };
const SET_TYPE_NAMES: Record<SetType, string> = { normal: 'normaal', warmup: 'warming-up', dropset: 'dropset', failure: 'tot falen' };

/** Column widths of the set grid (mockup: 36 · 1fr · 64 · 52 · 44). */
const COL = { set: 36, kg: 64, reps: 52, check: 44 } as const;
const ROW_PAD = 14;
/** Rest ring on the hero card (mockup: 150 px, 10 px stroke). */
const REST_RING = 150;
/** Tick haptic on each of the last seconds of the rest timer. */
const REST_TICK_SECONDS = 3;
/** Length of the check path below (m5 12 5 5 9-10), rounded up, for the draw-in dash. */
const CHECK_LENGTH = 22;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function restLabel(seconds: number): string {
  return seconds > 0 ? `Rust ${formatElapsed(seconds * 1000)}` : 'Rust uit';
}

function spokenDuration(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts = [];
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minuut' : 'minuten'}`);
  if (s > 0 || m === 0) parts.push(`${s} ${s === 1 ? 'seconde' : 'seconden'}`);
  return parts.join(' ');
}

function previousText(prev: { weightKg: number | null; reps: number | null } | undefined): string {
  if (!prev || (prev.weightKg === null && prev.reps === null)) return '–';
  return `${formatNumberNl(prev.weightKg ?? 0, 2)} × ${prev.reps ?? '–'}`;
}

/** The check mark draws itself when a set is ticked (static on mount and with reduce motion). */
function DrawnCheck({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const drawn = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      drawn.set(1);
      return;
    }
    drawn.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [reduceMotion, drawn]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - drawn.get()) }));
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <AnimatedPath
        d="m5 12 5 5 9-10"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${CHECK_LENGTH} ${CHECK_LENGTH}`}
        animatedProps={props}
      />
    </Svg>
  );
}

/** 36pt check box; afgevinkt = accent fill with a self-drawing check. Hit area 48. */
function CheckBox({ done, label, onPress }: { done: boolean; label: string; onPress: () => void }) {
  const { colors, radius } = useTheme();
  // Only animate a tick made on this screen; sets that were already done show a plain check.
  const wasDone = useRef(done);
  const animate = done && !wasDone.current;
  useEffect(() => {
    if (!done) wasDone.current = false;
  }, [done]);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: done }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: done ? (pressed ? colors.accentPressed : colors.accent) : pressed ? colors.bg3 : colors.bg2,
        borderWidth: done ? 0 : 1,
        borderColor: colors.borderStrong,
      })}
    >
      {done ? (
        animate ? (
          <DrawnCheck color={colors.onAccent} />
        ) : (
          <Icon name="check" size={18} color={colors.onAccent} strokeWidth={3} />
        )
      ) : null}
    </Pressable>
  );
}

/** Brief accent flash over a set row when it is ticked off. Nothing with reduce motion. */
function useRowFlash(done: boolean) {
  const reduceMotion = useReducedMotion();
  const flash = useSharedValue(0);
  const prev = useRef(done);
  useEffect(() => {
    if (done && !prev.current && !reduceMotion) {
      flash.set(0.28);
      flash.set(withTiming(0, { duration: 650, easing: Easing.out(Easing.quad) }));
    }
    prev.current = done;
  }, [done, reduceMotion, flash]);
  return useAnimatedStyle(() => ({ opacity: flash.get() }));
}

function SetRow({ exercise, set, index }: { exercise: ActiveExercise; set: ActiveSet; index: number }) {
  const actions = useActiveWorkoutActions();
  const { colors, layout, space } = useTheme();
  const done = set.completedAt !== null;
  const flashStyle = useRowFlash(done);
  const prev = exercise.previous[index];
  const workingNumber = exercise.sets.slice(0, index + 1).filter((s) => s.setType !== 'warmup').length;
  const label = SET_TYPE_SHORT[set.setType] || String(workingNumber);
  const nextType = SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(set.setType) + 1) % SET_TYPE_ORDER.length] ?? 'normal';
  const name = `Set ${index + 1}`;

  const confirmRemove = () =>
    Alert.alert(`${name} verwijderen?`, undefined, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: () => actions.removeSet(set.id) },
    ]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: layout.setRowHeight,
        paddingHorizontal: ROW_PAD,
        backgroundColor: done ? colors.accentMuted : 'transparent',
        borderTopWidth: index === 0 ? 0 : 1,
        borderTopColor: done ? colors.bg0 : colors.border,
      }}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.accent }, flashStyle]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, type ${SET_TYPE_NAMES[set.setType]}`}
        accessibilityHint="Tik om het type te wijzigen. Lang drukken om de set te verwijderen."
        accessibilityActions={[
          { name: 'activate', label: 'Type wijzigen' },
          { name: 'delete', label: 'Set verwijderen' },
        ]}
        onAccessibilityAction={(e: { nativeEvent: { actionName: string } }) => {
          if (e.nativeEvent.actionName === 'delete') confirmRemove();
          else actions.updateSet(set.id, { setType: nextType });
        }}
        onPress={() => {
          haptics.selection();
          actions.updateSet(set.id, { setType: nextType });
        }}
        onLongPress={confirmRemove}
        style={{ width: COL.set, minHeight: 48, justifyContent: 'center' }}
      >
        <Text
          variant="bodyStrong"
          tone={set.setType === 'normal' ? 'default' : 'tertiary'}
          tnum
          style={{ fontSize: set.setType === 'normal' ? 15 : 13 }}
        >
          {label}
        </Text>
      </Pressable>
      <Text
        tone="tertiary"
        tnum
        numberOfLines={1}
        style={{ flex: 1, fontSize: 14 }}
        accessibilityLabel={
          prev && (prev.weightKg !== null || prev.reps !== null)
            ? `Vorige keer ${formatNumberNl(prev.weightKg ?? 0, 2)} kilo, ${prev.reps ?? 0} herhalingen`
            : 'Geen vorige waarde'
        }
      >
        {previousText(prev)}
      </Text>
      <View style={{ width: COL.kg, alignItems: 'flex-end' }}>
        <NumberField
          accessibilityLabel={`Gewicht ${name.toLowerCase()} in kilo`}
          value={set.weightKg}
          decimals={2}
          align="right"
          placeholder={prev?.weightKg != null ? formatNumberNl(prev.weightKg, 2) : 'kg'}
          onChange={(v) => actions.updateSet(set.id, { weightKg: v })}
          done={done}
          style={{ width: 60 }}
        />
      </View>
      <View style={{ width: COL.reps, alignItems: 'flex-end' }}>
        <NumberField
          accessibilityLabel={`Herhalingen ${name.toLowerCase()}`}
          value={set.reps}
          decimals={0}
          align="right"
          placeholder={prev?.reps != null ? String(prev.reps) : '–'}
          onChange={(v) => actions.updateSet(set.id, { reps: v })}
          done={done}
          style={{ width: 48 }}
        />
      </View>
      <View style={{ width: COL.check, alignItems: 'center' }}>
        <CheckBox
          done={done}
          label={done ? `${name} niet meer afvinken` : `${name} afvinken`}
          onPress={() => {
            haptics.light();
            actions.toggleSet(set.id);
          }}
        />
      </View>
    </View>
  );
}

function ColumnHeader() {
  const { space } = useTheme();
  const head = (label: string, width: number | undefined, align: 'left' | 'right' = 'left') => (
    <Text variant="eyebrow" tone="tertiary" align={align} style={width ? { width, letterSpacing: 1.2 } : { flex: 1, letterSpacing: 1.2 }}>
      {label}
    </Text>
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: ROW_PAD, paddingBottom: space.xs + 2 }}
    >
      {head('Set', COL.set)}
      {head('Vorige', undefined)}
      {head('kg', COL.kg, 'right')}
      {head('Reps', COL.reps, 'right')}
      <View style={{ width: COL.check }} />
    </View>
  );
}

function ExerciseCard({
  exercise,
  meta,
  open,
  onToggle,
}: {
  exercise: ActiveExercise;
  meta: string;
  open: boolean;
  onToggle: () => void;
}) {
  const actions = useActiveWorkoutActions();
  const router = useRouter();
  const { colors, space } = useTheme();
  const [showRest, setShowRest] = useState(false);
  const sheet = useActionSheet();
  const doneCount = exercise.sets.filter((s) => s.completedAt !== null).length;
  const firstPrev = exercise.previous[0];

  if (!open) {
    const summary =
      doneCount > 0
        ? `${doneCount} van ${exercise.sets.length} sets klaar`
        : `${exercise.sets.length} set${exercise.sets.length === 1 ? '' : 's'}${firstPrev ? ` · vorige keer ${previousText(firstPrev)}` : ''}`;
    return (
      <Card onPress={onToggle} accessibilityLabel={`${exercise.name}, ${summary}`} accessibilityHint="Tik om sets te loggen">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text variant="heading">{exercise.name}</Text>
            <Text variant="caption" tone="tertiary" tnum>
              {summary}
            </Text>
          </View>
          {doneCount > 0 && doneCount === exercise.sets.length ? (
            <Icon name="check" size={20} color={colors.accentText} strokeWidth={2.5} />
          ) : (
            <Icon name="chevron-right" size={20} color={colors.text3} />
          )}
        </View>
      </Card>
    );
  }

  // Bottom sheet, not Alert.alert: Android drops alert buttons beyond three.
  const more = () =>
    sheet.show({
      title: exercise.name,
      options: [
        { label: showRest ? 'Rusttijd verbergen' : 'Rusttijd instellen', icon: 'timer', onPress: () => setShowRest((v) => !v) },
        { label: 'Oefening bekijken', icon: 'info', onPress: () => router.push(`/exercise/${encodeURIComponent(exercise.exerciseId)}`) },
        {
          label: 'Oefening verwijderen',
          icon: 'trash',
          destructive: true,
          onPress: () =>
            Alert.alert('Oefening verwijderen?', `${exercise.name} en de sets hiervan worden uit deze training gehaald.`, [
              { text: 'Annuleren', style: 'cancel' },
              { text: 'Verwijderen', style: 'destructive', onPress: () => actions.removeExercise(exercise.exerciseId) },
            ]),
        },
      ],
    });

  return (
    <Card padding={0} gap={0}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: ROW_PAD, paddingRight: space.xs, paddingTop: space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${exercise.name}, ${meta}`}
          accessibilityHint="Tik om in te klappen"
          onPress={onToggle}
          style={{ flex: 1, minHeight: 48, paddingTop: space.xs + 2, paddingBottom: space.sm + 2, gap: space.xxs }}
        >
          <Text variant="title" style={{ fontSize: 26, lineHeight: 28 }} numberOfLines={2}>
            {exercise.name}
          </Text>
          <Text variant="caption" tone="tertiary" tnum>
            {meta}
          </Text>
        </Pressable>
        <IconButton icon="more" accessibilityLabel={`Meer opties voor ${exercise.name}`} onPress={more} />
      </View>

      {showRest ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: ROW_PAD, paddingBottom: space.md }}
        >
          {REST_OPTIONS.map((s) => (
            <Chip
              key={s}
              label={s === 0 ? 'Uit' : formatElapsed(s * 1000)}
              selected={exercise.restSeconds === s}
              onPress={() => actions.setRestSeconds(exercise.exerciseId, s)}
            />
          ))}
        </ScrollView>
      ) : null}

      <ColumnHeader />
      {exercise.sets.map((set, i) => (
        <SetRow key={set.id} exercise={exercise} set={set} index={i} />
      ))}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <Button label="+ Set toevoegen" variant="link" fullWidth onPress={() => actions.addSet(exercise.exerciseId)} />
      </View>
      {sheet.element}
    </Card>
  );
}

interface NextSet {
  exerciseName: string;
  label: string;
  /** "Set 3 · 80 kg × 8" (falls back to "vorige keer" values when the set is still empty). */
  text: string;
  spoken: string;
}

/** The first open set of the workout: what comes after this rest. */
function findNextSet(exercises: readonly ActiveExercise[]): NextSet | null {
  for (const e of exercises) {
    const index = e.sets.findIndex((s) => s.completedAt === null);
    const set = e.sets[index];
    if (index < 0 || !set) continue;
    const prev = e.previous[index];
    const working = e.sets.slice(0, index + 1).filter((s) => s.setType !== 'warmup').length;
    const label = set.setType === 'warmup' ? 'Warming-up' : `Set ${working}`;
    const kg = set.weightKg ?? prev?.weightKg ?? null;
    const reps = set.reps ?? prev?.reps ?? null;
    const load =
      kg !== null && reps !== null
        ? `${formatNumberNl(kg, 2)} kg × ${reps}`
        : kg !== null
          ? `${formatNumberNl(kg, 2)} kg`
          : reps !== null
            ? `${reps} reps`
            : '';
    const spokenLoad =
      kg !== null || reps !== null
        ? `, ${kg !== null ? `${formatNumberNl(kg, 2)} kilo` : ''}${kg !== null && reps !== null ? ', ' : ''}${reps !== null ? `${reps} herhalingen` : ''}`
        : '';
    return {
      exerciseName: e.name,
      label,
      text: load ? `${label} · ${load}` : label,
      spoken: `Hierna: ${e.name}, ${label.toLowerCase()}${spokenLoad}`,
    };
  }
  return null;
}

/**
 * Rest timer as the hero card (mockup): a big glowing ring that counts down live, with the next
 * set and −15 s / +15 s beside it. Ticks on each of the last three seconds.
 */
function RestHero({ restEndsAt, total, now, next }: { restEndsAt: number; total: number; now: number; next: NextSet | null }) {
  const actions = useActiveWorkoutActions();
  const { radius, space } = useTheme();
  const left = Math.max(0, restEndsAt - now);
  const progress = total > 0 ? left / (total * 1000) : 0;
  const secondsLeft = Math.ceil(left / 1000);

  // Tick haptic in the last seconds (the store adds a firm one when rest is over).
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secondsLeft > 0 && secondsLeft <= REST_TICK_SECONDS && lastTick.current !== secondsLeft) {
      lastTick.current = secondsLeft;
      haptics.selection();
    }
  }, [secondsLeft]);

  return (
    <Card variant="hero" padding={18} style={{ borderRadius: radius.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg + 2 }}>
        <Ring
          progress={progress}
          size={REST_RING}
          strokeWidth={10}
          glow
          accessibilityLabel={`Rusttimer, ${spokenDuration(left)} over`}
        >
          <View style={{ alignItems: 'center' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text variant="hero" style={{ fontSize: 44, lineHeight: 46 }} maxFontSizeMultiplier={1.1}>
              {formatCountdown(left)}
            </Text>
            <Text variant="micro" tone="tertiary" style={{ fontSize: 12, letterSpacing: 1.2 }} maxFontSizeMultiplier={1.2}>
              RUST
            </Text>
          </View>
        </Ring>
        <View style={{ flex: 1, gap: space.sm + 2 }}>
          {next ? (
            <View accessible accessibilityLabel={next.spoken} style={{ gap: space.xxs }}>
              <Text variant="eyebrow" tone="accent">
                Hierna
              </Text>
              <Text variant="heading" tnum style={{ fontSize: 16, lineHeight: 20 }}>
                {next.text}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {next.exerciseName}
              </Text>
            </View>
          ) : (
            <Text variant="eyebrow" tone="accent">
              Rust
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Button
              label="−15 s"
              variant="secondary"
              size="sm"
              haptic="selection"
              onPress={() => actions.adjustRest(-15)}
              accessibilityLabel="15 seconden minder rust"
            />
            <Button
              label="+15 s"
              variant="secondary"
              size="sm"
              haptic="selection"
              onPress={() => actions.adjustRest(15)}
              accessibilityLabel="15 seconden meer rust"
            />
          </View>
          <Button
            label="Overslaan"
            variant="ghost"
            size="sm"
            onPress={() => actions.skipRest()}
            accessibilityLabel="Rust overslaan"
            style={{ marginLeft: -space.md }}
          />
        </View>
      </View>
    </Card>
  );
}

export function ActiveWorkoutScreen() {
  const workout = useActiveWorkout();
  const actions = useActiveWorkoutActions();
  const repos = useRepositories();
  const router = useRouter();
  const { colors, layout, space } = useTheme();
  const now = useNow(workout !== null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  const loadExercises = useCallback(async () => new Map<string, Exercise>((await repos.exercises.list()).map((e) => [e.id, e])), [repos]);
  const { data: library } = useFocusQuery(loadExercises);

  const minimise = () => (router.canGoBack() ? router.back() : router.replace('/vandaag'));

  if (!workout) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg0, padding: space.xl, gap: space.lg }}>
        <IconButton icon="chevron-down" accessibilityLabel="Sluiten" onPress={minimise} />
        <EmptyState
          icon="dumbbell"
          title="Geen actieve training"
          body="Start een lege training of kies een routine onder Trainen."
          action={{ label: 'Lege training starten', onPress: () => void actions.startEmpty() }}
        />
      </SafeAreaView>
    );
  }

  const done = completedSetCount(workout);
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const resting = workout.restEndsAt !== null && workout.restEndsAt > now;
  const volume = workoutVolumeKg(workout.exercises);
  // The "current" exercise (first with an open set) is expanded unless the user chose otherwise.
  const currentId = workout.exercises.find((e) => e.sets.some((s) => s.completedAt === null))?.exerciseId ?? workout.exercises[0]?.exerciseId;

  const finish = async () => {
    setBusy(true);
    try {
      const id = await actions.finish();
      if (id) {
        haptics.medium();
        router.replace(`/workout/${id}?klaar=1`);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmFinish = () => {
    if (done === 0) {
      Alert.alert('Nog geen sets afgevinkt', 'Vink minstens één set af, of verwijder deze training.', [
        { text: 'Doorgaan', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: () => {
            void actions.discard().then(minimise);
          },
        },
      ]);
      return;
    }
    const open = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completedAt === null).length, 0);
    Alert.alert(
      'Training afronden?',
      open > 0 ? `${open} niet-afgevinkte set${open === 1 ? '' : 's'} worden niet bewaard.` : 'Goed gewerkt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Afronden', onPress: () => void finish() },
      ],
    );
  };

  const confirmDiscard = () =>
    Alert.alert('Training verwijderen?', 'Alles van deze training wordt verwijderd.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () => {
          void actions.discard().then(minimise);
        },
      },
    ]);

  const metaFor = (e: ActiveExercise): string => {
    const ex = library?.get(e.exerciseId);
    const range = formatRepRange(e.targetRepsMin, e.targetRepsMax);
    const parts: string[] = [];
    if (ex) parts.push(EQUIPMENT_LABELS_NL[ex.equipment], MUSCLE_LABELS_NL[ex.primary_muscle]);
    if (range) parts.push(`${range} reps`);
    parts.push(restLabel(e.restSeconds));
    return parts.join(' · ');
  };

  const commitTitle = () => {
    actions.rename(title);
    setEditingTitle(false);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingTop: space.xs,
            paddingBottom: space.sm,
          }}
        >
          <IconButton icon="chevron-down" accessibilityLabel="Minimaliseren" onPress={minimise} color={colors.text2} />
          <View style={{ flex: 1, alignItems: 'center', gap: space.xxs }}>
            {editingTitle ? (
              <TextField
                autoFocus
                value={title}
                onChangeText={setTitle}
                accessibilityLabel="Naam van de training"
                returnKeyType="done"
                onSubmitEditing={commitTitle}
                onBlur={commitTitle}
                style={{ alignSelf: 'stretch', textAlign: 'center' }}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Training ${workout.title}`}
                accessibilityHint="Tik om de naam te wijzigen"
                onPress={() => {
                  setTitle(workout.title);
                  setEditingTitle(true);
                }}
                style={{ minHeight: 28, justifyContent: 'center' }}
              >
                <Text variant="heading" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
                  {workout.title}
                </Text>
              </Pressable>
            )}
            <View
              accessible
              accessibilityLabel={`Bezig, ${formatElapsed(now - workout.startedAt)}, ${done} van ${totalSets} sets afgevinkt, ${formatNumberNl(volume, 0)} kilo volume`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}
            >
              <LiveDot size={7} />
              <Text variant="caption" tone="tertiary" tnum style={{ fontSize: 12, lineHeight: 16 }}>
                {formatElapsed(now - workout.startedAt)} · {done} van {totalSets} sets · {formatNumberNl(volume, 0)} kg
              </Text>
            </View>
          </View>
          <Button label="Klaar" size="sm" loading={busy} onPress={confirmFinish} accessibilityLabel="Training afronden" />
        </View>
        <View style={{ marginHorizontal: layout.screenPadding }}>
          <ProgressBar value={totalSets > 0 ? done / totalSets : 0} />
        </View>

        {resting && workout.restEndsAt !== null ? (
          <View style={{ paddingHorizontal: layout.screenPadding, paddingTop: space.lg }}>
            <RestHero
              restEndsAt={workout.restEndsAt}
              total={workout.restDurationSeconds ?? 0}
              now={now}
              next={findNextSet(workout.exercises)}
            />
          </View>
        ) : null}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          indicatorStyle="white"
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: space.lg,
            gap: space.md + 2,
            paddingBottom: space.xxl,
          }}
        >
          {workout.exercises.length === 0 ? (
            <EmptyState icon="dumbbell" title="Nog geen oefeningen" body="Voeg je eerste oefening toe om sets te loggen." />
          ) : null}

          {workout.exercises.map((e) => (
            <ExerciseCard
              key={e.exerciseId}
              exercise={e}
              meta={metaFor(e)}
              open={openState[e.exerciseId] ?? e.exerciseId === currentId}
              onToggle={() =>
                setOpenState((prev) => ({ ...prev, [e.exerciseId]: !(prev[e.exerciseId] ?? e.exerciseId === currentId) }))
              }
            />
          ))}

          <Button label="Oefening toevoegen" icon="plus" variant="secondary" fullWidth onPress={() => router.push('/exercise/picker')} />
          <Button label="Training verwijderen" variant="ghost" fullWidth onPress={confirmDiscard} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
