import { BarList, Card, SectionLabel, Text } from '@/ui';

import { formatNumberNl } from '../logic/format';
import { muscleLabel } from '../logic/muscles';
import type { MuscleSetCount } from '../logic/week';

/** "Sets per spiergroep · deze week": primary muscle 1 per set, secondary 0,5. */
export function MuscleSetsCard({ muscles }: { muscles: readonly MuscleSetCount[] | undefined }) {
  const items = (muscles ?? []).map((m) => ({
    label: muscleLabel(m.muscle),
    value: m.sets,
    valueLabel: formatNumberNl(m.sets, 1),
  }));
  return (
    <Card gap={10}>
      <SectionLabel label="Sets per spiergroep · deze week" />
      {items.length > 0 ? (
        <BarList items={items} unit="sets" labelWidth={92} testID="progress-muscle-bars" />
      ) : (
        <Text variant="caption" tone="tertiary">
          Nog geen sets deze week. Na je volgende training zie je hier welke spiergroepen je hebt getraind.
        </Text>
      )}
    </Card>
  );
}
