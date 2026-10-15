import { useRouter } from 'expo-router';
import { useState } from 'react';

import { PROGRAMS } from '@/content/programs';
import { useRepositories } from '@/lib/db';
import { Button, Card, Text } from '@/ui';

import { StackScreen } from '../components/StackScreen';
import { addProgramAsRoutines } from '../services/programs';

/** Ready-made programs. Pure training content (no products or supplement advice). */
export function ProgramsScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const add = async (slug: string) => {
    setBusy(slug);
    try {
      await addProgramAsRoutines(repos, slug);
      router.back();
    } finally {
      setBusy(null);
    }
  };

  return (
    <StackScreen title="Schema's">
      {PROGRAMS.map((p) => (
        <Card key={p.slug} eyebrow={`${p.level === 'beginner' ? 'Beginner' : 'Gevorderd'} · ${p.days.length} dagen`}>
          <Text variant="heading">{p.name}</Text>
          <Text tone="muted">{p.description}</Text>
          {p.days.map((d) => (
            <Text key={d.name} variant="caption" tone="muted">
              {d.name}: {d.exercises.length} oefeningen
            </Text>
          ))}
          <Button label="Toevoegen aan mijn routines" variant="secondary" loading={busy === p.slug} onPress={() => void add(p.slug)} />
        </Card>
      ))}
    </StackScreen>
  );
}
