import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { useRepositories, type Equipment, type MuscleGroup } from '@/lib/db';
import { Button, Card, ListItem, Text, useTheme } from '@/ui';

import { useActiveWorkoutActions } from '../activeWorkoutStore';
import { Chip, Row, TextField } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { useFocusQuery } from '../components/useFocusQuery';
import { EQUIPMENT_LABELS_NL, MUSCLE_FILTERS, MUSCLE_LABELS_NL } from '../components/labels';
import { pickerResult } from '../pickerResult';

/**
 * Exercise library + picker.
 * - mode "workout" (default): adds to the active workout.
 * - mode "routine": hands the id back to the routine editor via pickerResult.
 * - mode "browse": opens the exercise detail.
 */
export function ExercisePickerScreen() {
  const { mode } = useLocalSearchParams<{ mode?: 'workout' | 'routine' | 'browse' }>();
  const repos = useRepositories();
  const actions = useActiveWorkoutActions();
  const router = useRouter();
  const { space } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('full_body');
  const [newEquipment, setNewEquipment] = useState<Equipment>('other');

  const load = useCallback(() => repos.exercises.list(), [repos]);
  const { data, reload } = useFocusQuery(load);

  const visible = useMemo(() => {
    const muscles = MUSCLE_FILTERS.find((f) => f.label === filter)?.muscles;
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (e) => (!muscles || muscles.includes(e.primary_muscle)) && (!q || e.name_nl.toLowerCase().includes(q)),
    );
  }, [data, filter, search]);

  const choose = (id: string) => {
    if (mode === 'browse') {
      router.push(`/exercise/${encodeURIComponent(id)}`);
      return;
    }
    if (mode === 'routine') pickerResult.set(id);
    else void actions.addExercise(id);
    router.back();
  };

  const createCustom = async () => {
    const name = search.trim();
    if (!name) return;
    const e = await repos.exercises.createCustom({
      slug: null,
      name_nl: name,
      primary_muscle: newMuscle,
      secondary_muscles: [],
      equipment: newEquipment,
      is_custom: true,
    });
    setCreating(false);
    reload();
    choose(e.id);
  };

  return (
    <StackScreen title={mode === 'browse' ? 'Oefeningen' : 'Kies oefening'}>
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Zoek oefening"
        accessibilityLabel="Zoek oefening"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <Row>
        {MUSCLE_FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} selected={filter === f.label} onPress={() => setFilter(filter === f.label ? null : f.label)} />
        ))}
      </Row>

      {creating ? (
        <Card eyebrow="Eigen oefening">
          <Text variant="heading">{search.trim() || 'Typ eerst een naam in het zoekveld'}</Text>
          <Text variant="label" tone="muted">
            Spiergroep
          </Text>
          <Row>
            {(Object.keys(MUSCLE_LABELS_NL) as MuscleGroup[]).map((m) => (
              <Chip key={m} label={MUSCLE_LABELS_NL[m]} selected={newMuscle === m} onPress={() => setNewMuscle(m)} />
            ))}
          </Row>
          <Text variant="label" tone="muted">
            Materiaal
          </Text>
          <Row>
            {(Object.keys(EQUIPMENT_LABELS_NL) as Equipment[]).map((q) => (
              <Chip key={q} label={EQUIPMENT_LABELS_NL[q]} selected={newEquipment === q} onPress={() => setNewEquipment(q)} />
            ))}
          </Row>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Annuleren" variant="ghost" onPress={() => setCreating(false)} />
            <Button label="Opslaan" disabled={!search.trim()} onPress={() => void createCustom()} />
          </View>
        </Card>
      ) : (
        <Button label="+ Eigen oefening" variant="secondary" onPress={() => setCreating(true)} />
      )}

      <View>
        {visible.map((e) => (
          <ListItem
            key={e.id}
            title={e.name_nl}
            subtitle={`${MUSCLE_LABELS_NL[e.primary_muscle]} · ${EQUIPMENT_LABELS_NL[e.equipment]}${e.is_custom ? ' · eigen' : ''}`}
            onPress={() => choose(e.id)}
          />
        ))}
        {data && visible.length === 0 ? <Text tone="muted">Niets gevonden. Maak een eigen oefening aan.</Text> : null}
      </View>
    </StackScreen>
  );
}
