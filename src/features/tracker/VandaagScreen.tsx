import { Card, Screen, Text } from '@/ui';
import { PointsSummaryCard } from '@/features/points';
import { ReorderCard } from '@/features/shop';

/**
 * Placeholder. "Vandaag" is owned by the Tracker builder and composes widgets
 * exported by other features (via their public index only).
 */
export function VandaagScreen() {
  return (
    <Screen title="Vandaag" subtitle="Je training en voorraad in één oogopslag.">
      <Card eyebrow="Volgende training">
        <Text>Nog geen schema gekozen.</Text>
      </Card>
      <ReorderCard />
      <PointsSummaryCard />
    </Screen>
  );
}
