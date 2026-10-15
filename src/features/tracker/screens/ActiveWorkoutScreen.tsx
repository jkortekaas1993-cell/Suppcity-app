import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import type { SetType } from '@/lib/db/types';
import { Button, Card, Text, useTheme } from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from '../activeWorkoutStore';
import { Chip, IconButton, NumberField, Row, TextField } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { completedSetCount, type ActiveExercise, type ActiveSet } from '../logic/activeWorkoutReducer';
import { formatCountdown, formatElapsed, formatNumberNl } from '../logic/format';
import { formatRepRange } from '../logic/routines';

/**
 * Full-screen active workout. Training only: no commercial elements here
 * (hard rule; see CLAUDE.md "Trainen ... 100% free of ads and the shop").
 */

const REST_OPTIONS = [0, 60, 90, 120, 180, 240];
const SET_TYPE_ORDER: SetType[] = ['normal', 'warmup', 'dropset', 'failure'];
const SET_TYPE_SHORT: Record<SetType, string> = { normal: '', warmup: 'W', dropset: 'D', failure: 'F' };
const SET_TYPE_NAMES: Record<SetType, string> = { normal: 'normaal', warmup: 'warming-up', dropset: 'dropset', failure: 'tot falen' };

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function SetRow({ exercise, set, index }: { exercise: ActiveExercise; set: ActiveSet; index: number }) {
  const actions = useActiveWorkoutActions();
  const { colors, space, radius } = useTheme();
  const done = set.completedAt !== null;
  const prev = exercise.previous[index];
  const workingNumber = exercise.sets.slice(0, index + 1).filter((s) => s.setType !== 'warmup').length;
  const label = SET_TYPE_SHORT[set.setType] || String(workingNumber);
  const nextType = SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(set.setType) + 1) % SET_TYPE_ORDER.length] ?? 'normal';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingVertical: space.xxs,
        paddingHorizontal: space.xxs,
        borderRadius: radius.sm,
        backgroundColor: done ? colors.surfaceRaised : 'transparent',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Set ${index + 1}, type ${SET_TYPE_NAMES[set.setType]}. Tik om te wijzigen`}
        // Cycle normal → warmup → dropset → failure.
        onPress={() => actions.updateSet(set.id, { setType: nextType })}
        style={{ width: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text variant="heading" tone={set.setType === 'normal' ? 'default' : 'accent'}>
          {label}
        </Text>
      </Pressable>
      <Text
        variant="caption"
        tone="muted"
        numberOfLines={1}
        style={{ width: 68, textAlign: 'center', fontVariant: ['tabular-nums'] }}
        accessibilityLabel={prev ? `Vorige keer ${prev.weightKg ?? 0} kilo, ${prev.reps ?? 0} herhalingen` : 'Geen vorige waarde'}
      >
        {prev && (prev.weightKg !== null || prev.reps !== null)
          ? `${formatNumberNl(prev.weightKg ?? 0, 2)} × ${prev.reps ?? '–'}`
          : '–'}
      </Text>
      <NumberField
        accessibilityLabel={`Gewicht set ${index + 1} in kilo`}
        value={set.weightKg}
        decimals={2}
        placeholder={prev?.weightKg != null ? formatNumberNl(prev.weightKg, 2) : 'kg'}
        onChange={(v) => actions.updateSet(set.id, { weightKg: v })}
        done={done}
      />
      <NumberField
        accessibilityLabel={`Herhalingen set ${index + 1}`}
        value={set.reps}
        decimals={0}
        placeholder={prev?.reps != null ? String(prev.reps) : 'reps'}
        onChange={(v) => actions.updateSet(set.id, { reps: v })}
        done={done}
      />
      <IconButton
        glyph="✓"
        label={done ? `Set ${index + 1} niet meer afvinken` : `Set ${index + 1} afvinken`}
        active={done}
        onPress={() => actions.toggleSet(set.id)}
      />
      <IconButton glyph="×" label={`Set ${index + 1} verwijderen`} tone="danger" onPress={() => actions.removeSet(set.id)} />
    </View>
  );
}

function ExerciseBlock({ exercise }: { exercise: ActiveExercise }) {
  const actions = useActiveWorkoutActions();
  const router = useRouter();
  const { space } = useTheme();
  const [showRest, setShowRest] = useState(false);
  const range = formatRepRange(exercise.targetRepsMin, exercise.targetRepsMax);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Pressable
          style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
          accessibilityRole="link"
          onPress={() => router.push(`/exercise/${encodeURIComponent(exercise.exerciseId)}`)}
        >
          <Text variant="heading" tone="accent">
            {exercise.name}
          </Text>
          <Text variant="caption" tone="muted">
            {range ? `Doel ${range} reps · ` : ''}Rust {exercise.restSeconds > 0 ? formatElapsed(exercise.restSeconds * 1000) : 'uit'}
          </Text>
        </Pressable>
        <IconButton glyph="◷" label="Rusttijd instellen" active={showRest} onPress={() => setShowRest((v) => !v)} />
        <IconButton
          glyph="⋯"
          label="Oefening verwijderen"
          onPress={() =>
            Alert.alert('Oefening verwijderen?', `${exercise.name} en de sets hiervan worden uit deze training gehaald.`, [
              { text: 'Annuleren', style: 'cancel' },
              { text: 'Verwijderen', style: 'destructive', onPress: () => actions.removeExercise(exercise.exerciseId) },
            ])
          }
        />
      </View>

      {showRest ? (
        <Row>
          {REST_OPTIONS.map((s) => (
            <Chip
              key={s}
              label={s === 0 ? 'Uit' : formatElapsed(s * 1000)}
              selected={exercise.restSeconds === s}
              onPress={() => actions.setRestSeconds(exercise.exerciseId, s)}
            />
          ))}
        </Row>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.xs, paddingHorizontal: space.xxs }}>
        <Text variant="label" tone="muted" style={{ width: 32, textAlign: 'center' }}>
          Set
        </Text>
        <Text variant="label" tone="muted" style={{ width: 68, textAlign: 'center' }}>
          Vorige
        </Text>
        <Text variant="label" tone="muted" style={{ flex: 1, textAlign: 'center' }}>
          Kg
        </Text>
        <Text variant="label" tone="muted" style={{ flex: 1, textAlign: 'center' }}>
          Reps
        </Text>
        <View style={{ width: 48 * 2 + space.xs }} />
      </View>

      {exercise.sets.map((set, i) => (
        <SetRow key={set.id} exercise={exercise} set={set} index={i} />
      ))}

      <Button label="+ Set toevoegen" variant="ghost" fullWidth onPress={() => actions.addSet(exercise.exerciseId)} />
    </Card>
  );
}

function RestPanel({ restEndsAt, now }: { restEndsAt: number; now: number }) {
  const actions = useActiveWorkoutActions();
  const { space } = useTheme();
  return (
    <Card highlighted eyebrow="Rust">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text variant="metric" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {formatCountdown(restEndsAt - now)}
        </Text>
        <IconButton glyph="−15" label="15 seconden minder rust" onPress={() => actions.adjustRest(-15)} />
        <IconButton glyph="+15" label="15 seconden meer rust" onPress={() => actions.adjustRest(15)} />
        <Button label="Overslaan" variant="secondary" onPress={() => actions.skipRest()} />
      </View>
    </Card>
  );
}

export function ActiveWorkoutScreen() {
  const workout = useActiveWorkout();
  const actions = useActiveWorkoutActions();
  const router = useRouter();
  const { space } = useTheme();
  const now = useNow(workout !== null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  if (!workout) {
    return (
      <StackScreen title="Training">
        <Card eyebrow="Geen actieve training">
          <Text tone="muted">Start een lege training of kies een routine onder Trainen.</Text>
          <Button
            label="Lege training starten"
            onPress={() => {
              void actions.startEmpty();
            }}
          />
        </Card>
      </StackScreen>
    );
  }

  const done = completedSetCount(workout);
  const resting = workout.restEndsAt !== null && workout.restEndsAt > now;

  const finish = async () => {
    setBusy(true);
    try {
      const id = await actions.finish();
      if (id) router.replace(`/workout/${id}?klaar=1`);
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
            void actions.discard().then(() => router.back());
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
          void actions.discard().then(() => router.back());
        },
      },
    ]);

  return (
    <StackScreen
      title={formatElapsed(now - workout.startedAt)}
      right={<IconButton glyph="×" label="Training verwijderen" tone="danger" onPress={confirmDiscard} />}
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Oefening toevoegen" variant="secondary" fullWidth onPress={() => router.push('/exercise/picker')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Afronden" fullWidth loading={busy} onPress={confirmFinish} />
          </View>
        </View>
      }
    >
      {editingTitle ? (
        <TextField
          autoFocus
          value={title}
          onChangeText={setTitle}
          accessibilityLabel="Naam van de training"
          returnKeyType="done"
          onSubmitEditing={() => {
            actions.rename(title);
            setEditingTitle(false);
          }}
          onBlur={() => {
            actions.rename(title);
            setEditingTitle(false);
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Tik om de naam te wijzigen"
          onPress={() => {
            setTitle(workout.title);
            setEditingTitle(true);
          }}
        >
          <Text variant="title">{workout.title}</Text>
          <Text variant="caption" tone="muted">
            {done} set{done === 1 ? '' : 's'} afgevinkt
          </Text>
        </Pressable>
      )}

      {resting && workout.restEndsAt !== null ? <RestPanel restEndsAt={workout.restEndsAt} now={now} /> : null}

      {workout.exercises.length === 0 ? (
        <Card>
          <Text tone="muted">Voeg je eerste oefening toe om sets te loggen.</Text>
        </Card>
      ) : null}

      {workout.exercises.map((e) => (
        <ExerciseBlock key={e.exerciseId} exercise={e} />
      ))}
    </StackScreen>
  );
}
