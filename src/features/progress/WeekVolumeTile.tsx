import { useRouter } from 'expo-router';

import { StatTile } from '@/ui';

import { formatSigned, formatVolume } from './logic/format';
import { useWeekSummary } from './useWeekSummary';

/**
 * "Volume week" tile for Vandaag (mockup Main.dc.html): this ISO week's volume and the
 * change vs. last week, from the same numbers as Voortgang. Tapping opens Voortgang.
 * Local only (hard rule 1).
 */
export function WeekVolumeTile() {
  const router = useRouter();
  const { data } = useWeekSummary();
  const kg = data?.current.volumeKg ?? 0;
  const { value, unit } = formatVolume(kg);
  const pct = data?.volumeChangePct ?? null;
  const rounded = pct === null ? null : Math.round(pct);
  const deltaLabel = rounded === null ? null : `${formatSigned(rounded)}% t.o.v. vorige week`;

  return (
    <StatTile
      size="lg"
      label="Volume week"
      value={data ? value : '–'}
      unit={data ? unit : undefined}
      delta={
        deltaLabel && rounded !== null
          ? { label: deltaLabel, direction: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat' }
          : undefined
      }
      caption={deltaLabel ? undefined : 'deze week'}
      onPress={() => router.push('/progress')}
      accessibilityLabel={`Volume deze week: ${data ? `${value} ${unit}` : 'nog niet geladen'}${deltaLabel ? `, ${deltaLabel}` : ''}. Opent Voortgang.`}
      testID="week-volume-tile"
    />
  );
}
