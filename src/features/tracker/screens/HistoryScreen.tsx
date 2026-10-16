import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { useRepositories, type WorkoutListItem } from '@/lib/db';
import { Button, Card, ListRow, Text } from '@/ui';

import { StackScreen } from '../components/StackScreen';
import { useFocusQuery } from '../components/useFocusQuery';
import { formatDateNl, formatDuration, formatNumberNl } from '../logic/format';

const PAGE = 30;

export function workoutSubtitle(w: WorkoutListItem): string {
  const parts = [formatDateNl(w.started_at)];
  if (w.ended_at) parts.push(formatDuration(Date.parse(w.ended_at) - Date.parse(w.started_at)));
  parts.push(`${w.set_count} sets`);
  return parts.join(' · ');
}

export function HistoryScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const [more, setMore] = useState<WorkoutListItem[]>([]);
  const [end, setEnd] = useState(false);

  const load = useCallback(async () => {
    setMore([]);
    const first = await repos.workouts.historyWithStats({ limit: PAGE });
    setEnd(first.length < PAGE);
    return first;
  }, [repos]);
  const { data } = useFocusQuery(load);
  const items = [...(data ?? []), ...more];

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    const next = await repos.workouts.historyWithStats({ limit: PAGE, before: last.started_at });
    setMore((m) => [...m, ...next]);
    if (next.length < PAGE) setEnd(true);
  };

  return (
    <StackScreen title="Historie">
      {data && items.length === 0 ? <Text tone="secondary">Nog geen afgeronde trainingen.</Text> : null}
      {items.length > 0 ? (
        <Card padding={0} gap={0}>
          {items.map((w, i) => (
            <ListRow
              key={w.id}
              title={w.title}
              subtitle={workoutSubtitle(w)}
              value={`${formatNumberNl(w.volume_kg, 0)} kg`}
              divider={i < items.length - 1}
              onPress={() => router.push(`/workout/${w.id}`)}
            />
          ))}
        </Card>
      ) : null}
      {!end && items.length > 0 ? <Button label="Meer laden" variant="secondary" fullWidth onPress={() => void loadMore()} /> : null}
    </StackScreen>
  );
}
