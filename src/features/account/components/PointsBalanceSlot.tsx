import { POINTS } from '@/lib/config/constants';
import { useAsync } from '@/features/shop';
import { Card, Text } from '@/ui';

import { getAccountServices } from '../services/registry';

/**
 * Placeholder slot for the points balance. The points feature registers a
 * PointsBalanceSource (or replaces this component); until then nothing is shown
 * except the rules. Never derived from training/body data (hard rule 1).
 */
export function PointsBalanceSlot() {
  const source = getAccountServices().points;
  const balance = useAsync(async () => (source ? source.balance() : null), [source]);
  return (
    <Card eyebrow="Punten">
      {source && typeof balance.data === 'number' ? (
        <Text variant="metric">{balance.data}</Text>
      ) : (
        <Text tone="muted">Je puntensaldo verschijnt hier binnenkort.</Text>
      )}
      <Text variant="caption" tone="muted">
        Punten per euro en voor max. {POINTS.maxWorkoutsRewardedPerWeek} trainingen per week. Vanaf {POINTS.minimumAge} jaar.
      </Text>
    </Card>
  );
}
