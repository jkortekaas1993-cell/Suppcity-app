import { View } from 'react-native';

import { EmptyState, StatTile, Text, useTheme } from '@/ui';

import { formatDuration, formatNumberNl, formatSigned, formatVolume, roundTo } from '../logic/format';
import type { WeekSummary } from '../logic/week';
import { MuscleSetsCard } from './MuscleSetsCard';

type Direction = 'up' | 'down' | 'flat';
const direction = (d: number): Direction => (d > 0 ? 'up' : d < 0 ? 'down' : 'flat');

/** Voortgang → Week: this ISO week vs. last week, plus sets per muscle group. */
export function WeekView({ week, loading }: { week: WeekSummary | undefined; loading: boolean }) {
  const { space } = useTheme();
  if (!week) return loading ? null : <WeekEmpty />;
  const { current: cur, previous: prev, delta } = week;
  if (cur.workouts === 0 && prev.workouts === 0) return <WeekEmpty />;

  const vol = formatVolume(cur.volumeKg);
  const dur = formatDuration(cur.durationMin);
  const prevDur = formatDuration(prev.durationMin);
  const pct = week.volumeChangePct;
  const versus = (v: string) => `vorige week ${v}`;

  return (
    <View style={{ gap: space.md }}>
      <Text variant="caption" tone="tertiary">
        Deze week (vanaf maandag), vergeleken met vorige week.
      </Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Trainingen"
            value={formatNumberNl(cur.workouts)}
            caption={versus(formatNumberNl(prev.workouts))}
            delta={{ label: formatSigned(delta.workouts), direction: direction(delta.workouts) }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Sets"
            value={formatNumberNl(cur.sets)}
            caption={versus(formatNumberNl(prev.sets))}
            delta={{ label: formatSigned(delta.sets), direction: direction(delta.sets) }}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Duur"
            value={dur.value}
            unit={dur.unit}
            caption={versus(`${prevDur.value} ${prevDur.unit}`)}
            delta={{
              label: `${formatSigned(delta.durationMin)} min`,
              direction: direction(roundTo(delta.durationMin)),
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            label="Volume"
            value={vol.value}
            unit={vol.unit}
            caption={versus(`${formatVolume(prev.volumeKg).value} ${formatVolume(prev.volumeKg).unit}`)}
            delta={
              pct !== null
                ? { label: `${formatSigned(pct)}%`, direction: direction(roundTo(pct)) }
                : { label: `${formatSigned(delta.volumeKg)} kg`, direction: direction(roundTo(delta.volumeKg)) }
            }
          />
        </View>
      </View>
      <MuscleSetsCard muscles={week.muscles} />
    </View>
  );
}

function WeekEmpty() {
  return (
    <EmptyState
      icon="calendar"
      title="Nog geen trainingen deze week"
      body="Na je eerste training van de week zie je hier je trainingen, sets, duur en volume, vergeleken met vorige week."
      testID="progress-week-empty"
    />
  );
}
