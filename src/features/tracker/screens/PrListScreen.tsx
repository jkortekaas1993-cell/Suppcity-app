import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useRepositories } from '@/lib/db';
import { Card, ListRow, Text } from '@/ui';

import { StackScreen } from '../components/StackScreen';
import { useFocusQuery } from '../components/useFocusQuery';
import { formatDateNl, formatKg, formatNumberNl } from '../logic/format';

/** All-time records per exercise. */
export function PrListScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const load = useCallback(() => loadRecords(repos), [repos]);
  const { data } = useFocusQuery(load);

  return (
    <StackScreen title="Records">
      {data && data.length === 0 ? <Text tone="secondary">Rond een training af om je records te zien.</Text> : null}
      {data && data.length > 0 ? (
        <Card padding={0} gap={0}>
          {data.map((r, i) => (
            <ListRow
              key={r.exerciseId}
              title={r.name}
              subtitle={`${r.heaviest} · laatst ${formatDateNl(r.lastAt)}`}
              value={r.e1rm}
              leading="trophy"
              divider={i < data.length - 1}
              onPress={() => router.push(`/exercise/${encodeURIComponent(r.exerciseId)}`)}
            />
          ))}
        </Card>
      ) : null}
    </StackScreen>
  );
}

export async function loadRecords(repos: ReturnType<typeof useRepositories>, limit?: number) {
  const list = await repos.sets.exercisesWithHistory();
  const out: { exerciseId: string; name: string; heaviest: string; e1rm: string; lastAt: string }[] = [];
  for (const row of limit ? list.slice(0, limit) : list) {
    const [exercise, pr] = await Promise.all([repos.exercises.get(row.exercise_id), repos.sets.personalRecords(row.exercise_id)]);
    if (!exercise || !pr.heaviest) continue;
    out.push({
      exerciseId: row.exercise_id,
      name: exercise.name_nl,
      heaviest: `${formatNumberNl(pr.heaviest.weight_kg ?? 0, 2)} kg × ${pr.heaviest.reps ?? 0}`,
      e1rm: pr.bestE1rm ? formatKg(pr.bestE1rm, 1) : '–',
      lastAt: row.last_started_at,
    });
  }
  return out;
}
