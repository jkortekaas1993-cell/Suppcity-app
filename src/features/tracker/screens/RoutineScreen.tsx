import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';

import { useRepositories, type Exercise, type NewRow, type RoutineExercise } from '@/lib/db';
import { Button, Card, Text, useTheme } from '@/ui';

import { useActiveWorkout, useActiveWorkoutActions } from '../activeWorkoutStore';
import { IconButton, NumberField, TextField } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { formatElapsed } from '../logic/format';
import { formatRepRange } from '../logic/routines';
import { pickerResult } from '../pickerResult';

type Item = NewRow<RoutineExercise> & { name: string };

/** View + edit a routine; `id === "nieuw"` creates one. */
export function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nieuw';
  const repos = useRepositories();
  const router = useRouter();
  const active = useActiveWorkout();
  const actions = useActiveWorkoutActions();
  const { space } = useTheme();

  const [name, setName] = useState('');
  const [programSlug, setProgramSlug] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState(isNew);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    void (async () => {
      const found = await repos.routines.get(id);
      if (!alive || !found) {
        setLoaded(true);
        return;
      }
      const names = new Map<string, Exercise | null>();
      for (const e of found.exercises) names.set(e.exercise_id, await repos.exercises.get(e.exercise_id));
      if (!alive) return;
      setName(found.routine.name);
      setProgramSlug(found.routine.program_slug);
      setItems(found.exercises.map((e) => ({ ...e, name: names.get(e.exercise_id)?.name_nl ?? 'Oefening' })));
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [repos, id, isNew]);

  // Receive an exercise picked in the picker.
  useFocusEffect(
    useCallback(() => {
      const picked = pickerResult.take();
      if (!picked) return;
      void repos.exercises.get(picked).then((e) => {
        if (!e) return;
        setItems((prev) =>
          prev.some((x) => x.exercise_id === e.id)
            ? prev
            : [
                ...prev,
                {
                  routine_id: '',
                  exercise_id: e.id,
                  position: prev.length,
                  target_sets: 3,
                  target_reps_min: 8,
                  target_reps_max: 12,
                  rest_seconds: 90,
                  name: e.name_nl,
                },
              ],
        );
      });
    }, [repos]),
  );

  const patch = (index: number, p: Partial<Item>) => setItems((prev) => prev.map((x, i) => (i === index ? { ...x, ...p } : x)));
  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Naam ontbreekt', 'Geef je routine een naam.');
      return;
    }
    setSaving(true);
    try {
      const rows = items.map(({ name: _n, id: _id, ...rest }, i) => ({ ...rest, position: i }));
      if (isNew) {
        const position = (await repos.routines.maxPosition()) + 1;
        const r = await repos.routines.create({ name: trimmed, notes: null, program_slug: null, position }, rows);
        router.replace(`/routine/${r.id}`);
      } else {
        await repos.routines.update(id, { name: trimmed });
        await repos.routines.replaceExercises(
          id,
          rows.map((r) => ({ ...r, routine_id: id })),
        );
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Routine verwijderen?', 'Je trainingshistorie blijft bewaard.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () => {
          void repos.routines.softDelete(id).then(() => router.back());
        },
      },
    ]);

  const start = async () => {
    if (active) {
      router.push('/workout');
      return;
    }
    await actions.startFromRoutine(id);
    router.push('/workout');
  };

  if (!loaded) return <StackScreen title="Routine">{null}</StackScreen>;

  return (
    <StackScreen
      title={isNew ? 'Nieuwe routine' : editing ? 'Routine bewerken' : name}
      right={
        !isNew && !editing ? (
          <IconButton glyph="✎" label="Routine bewerken" onPress={() => setEditing(true)} />
        ) : undefined
      }
      footer={
        editing ? (
          <Button label="Opslaan" fullWidth loading={saving} onPress={() => void save()} />
        ) : (
          <Button
            label={active ? 'Naar actieve training' : 'Start deze routine'}
            fullWidth
            disabled={items.length === 0}
            onPress={() => void start()}
          />
        )
      }
    >
      {editing ? (
        <TextField value={name} onChangeText={setName} placeholder="Naam van de routine" accessibilityLabel="Naam van de routine" />
      ) : programSlug ? (
        <Text tone="muted">Uit een kant-en-klaar schema.</Text>
      ) : null}

      {items.length === 0 ? <Text tone="muted">Nog geen oefeningen.</Text> : null}

      {items.map((item, i) => (
        <Card key={`${item.exercise_id}-${i}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text variant="heading" style={{ flex: 1 }}>
              {item.name}
            </Text>
            {editing ? (
              <>
                <IconButton glyph="↑" label="Omhoog" disabled={i === 0} onPress={() => move(i, -1)} />
                <IconButton glyph="↓" label="Omlaag" disabled={i === items.length - 1} onPress={() => move(i, 1)} />
                <IconButton
                  glyph="×"
                  label="Verwijderen"
                  tone="danger"
                  onPress={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                />
              </>
            ) : null}
          </View>
          {editing ? (
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <Field label="Sets">
                <NumberField
                  value={item.target_sets}
                  decimals={0}
                  accessibilityLabel="Aantal sets"
                  onChange={(v) => patch(i, { target_sets: Math.max(1, v ?? 1) })}
                />
              </Field>
              <Field label="Reps min">
                <NumberField value={item.target_reps_min} decimals={0} accessibilityLabel="Minimaal aantal herhalingen" onChange={(v) => patch(i, { target_reps_min: v })} />
              </Field>
              <Field label="Reps max">
                <NumberField value={item.target_reps_max} decimals={0} accessibilityLabel="Maximaal aantal herhalingen" onChange={(v) => patch(i, { target_reps_max: v })} />
              </Field>
              <Field label="Rust (s)">
                <NumberField value={item.rest_seconds} decimals={0} accessibilityLabel="Rust in seconden" onChange={(v) => patch(i, { rest_seconds: Math.max(0, v ?? 0) })} />
              </Field>
            </View>
          ) : (
            <Text tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
              {item.target_sets} × {formatRepRange(item.target_reps_min, item.target_reps_max) || '–'} · rust{' '}
              {formatElapsed(item.rest_seconds * 1000)}
            </Text>
          )}
        </Card>
      ))}

      {editing ? (
        <>
          <Button label="+ Oefening toevoegen" variant="secondary" fullWidth onPress={() => router.push('/exercise/picker?mode=routine')} />
          {!isNew ? <Button label="Routine verwijderen" variant="ghost" onPress={remove} /> : null}
        </>
      ) : null}
    </StackScreen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="label" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row' }}>{children}</View>
    </View>
  );
}
