import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PROGRAMS } from '@/content/programs';
import { useRepositories } from '@/lib/db';
import { Button, Card, Text, useTheme } from '@/ui';

import { StackScreen } from '../components/StackScreen';
import { addProgramAsRoutines } from '../services/programs';

/** Ready-made programs. Pure training content (no products or supplement advice). */
export function ProgramsScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const { space } = useTheme();

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
        <Card key={p.slug} eyebrow={`${p.level === 'beginner' ? 'Beginner' : 'Gevorderd'} · ${p.days.length} dagen`} gap={space.md}>
          <View style={{ gap: space.xs }}>
            <Text variant="title" style={{ fontSize: 24, lineHeight: 26 }}>
              {p.name}
            </Text>
            <Text tone="secondary">{p.description}</Text>
          </View>
          <View style={{ gap: space.xxs }}>
            {p.days.map((d) => (
              <Text key={d.name} variant="caption" tone="tertiary" tnum>
                {d.name}: {d.exercises.length} oefeningen
              </Text>
            ))}
          </View>
          <Button label="Toevoegen aan mijn routines" variant="secondary" fullWidth loading={busy === p.slug} onPress={() => void add(p.slug)} />
        </Card>
      ))}
    </StackScreen>
  );
}
