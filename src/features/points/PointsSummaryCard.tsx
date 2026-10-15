import { POINTS } from '@/lib/config/constants';
import { Card, Text } from '@/ui';

/** Widget for the Vandaag tab. Placeholder. */
export function PointsSummaryCard() {
  return (
    <Card eyebrow="Punten">
      <Text variant="metric">0</Text>
      <Text variant="caption" tone="muted">
        Punten per euro en voor max. {POINTS.maxWorkoutsRewardedPerWeek} trainingen per week. Vanaf 18 jaar.
      </Text>
    </Card>
  );
}
