import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Card, Icon, LineChart, Text, useTheme } from '@/ui';

import { loadTopExercise } from './data/loaders';
import { useProgressQuery } from './data/useProgressQuery';
import { filterByPeriod, summarizeExercise, trendSentence } from './logic/exerciseStats';
import { formatNumberNl, formatSigned } from './logic/format';

const ENTRY_PERIOD = '3m' as const;

/**
 * Small card for Trainen / Vandaag that opens Voortgang. Shows the e1RM trend (last
 * 3 months) of the most-trained exercise. Local data only (hard rule 1).
 */
export function ProgressEntryCard({ testID = 'progress-entry-card' }: { testID?: string }) {
  const router = useRouter();
  const { colors, space } = useTheme();
  const { data, loading } = useProgressQuery(loadTopExercise);
  const open = () => router.push('/progress');

  if (loading && data === undefined) return null;

  if (!data) {
    return (
      <Card eyebrow="Voortgang" onPress={open} accessibilityLabel="Voortgang openen" testID={testID}>
        <Text variant="caption" tone="secondary">
          Rond een training af, dan zie je hier hoe je sterker wordt.
        </Text>
      </Card>
    );
  }

  const summary = summarizeExercise(filterByPeriod(data.sessions, ENTRY_PERIOD, new Date()));
  const latest = summary.latestE1rm;
  const delta = summary.deltaE1rm;
  const sentence = trendSentence(data.exercise.name, summary, ENTRY_PERIOD);

  return (
    <Card
      eyebrow="Voortgang"
      onPress={open}
      accessibilityLabel={`Voortgang openen. ${sentence}`}
      testID={testID}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <Text variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
          {data.exercise.name}
        </Text>
        <Icon name="chevron-right" size={18} color={colors.text3} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
        <Text variant="metric">{latest === null ? '–' : formatNumberNl(latest)}</Text>
        <Text variant="caption" tone="secondary">
          kg geschat 1RM
        </Text>
        {delta !== null ? (
          <Text variant="caption" tone={delta > 0.5 ? 'success' : 'tertiary'} tnum>
            {formatSigned(delta)} kg · 3 mnd
          </Text>
        ) : null}
      </View>
      {summary.points.length > 1 ? (
        <LineChart
          data={summary.points.map((p) => ({ value: p.value, pr: p.pr }))}
          height={64}
          accessibilityLabel={sentence}
        />
      ) : null}
    </Card>
  );
}
