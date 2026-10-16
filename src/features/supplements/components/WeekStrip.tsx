import { View } from 'react-native';

import { Text, useTheme } from '@/ui';

import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../logic/schedule';

export interface WeekStripProps {
  /** Seven local dates, Monday first. */
  dates: readonly string[];
  today: string;
  /** Dates that are (planned or logged) training days. */
  trainingDates: ReadonlySet<string>;
}

const DOT = 36;

/** Mon–Sun strip: today filled, training days tinted, other past days grey, future days outlined. */
export function WeekStrip({ dates, today, trainingDates }: WeekStripProps) {
  const { colors, space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityRole="summary">
      {dates.map((date, i) => {
        const isToday = date === today;
        const training = trainingDates.has(date);
        const future = date > today;
        const bg = isToday ? colors.accent : training ? colors.accentMuted : future ? 'transparent' : colors.bg2;
        const fg = isToday ? colors.onAccent : training ? colors.accentText : future ? colors.text3 : colors.text2;
        const day = Number(date.slice(8, 10));
        return (
          <View
            key={date}
            style={{ alignItems: 'center', gap: space.xs + 2, flex: 1 }}
            accessible
            accessibilityLabel={`${WEEKDAY_LONG[i]} ${day}${isToday ? ', vandaag' : ''}${training ? ', trainingsdag' : ''}`}
          >
            <Text variant="micro" tone={isToday ? 'default' : 'tertiary'} style={{ fontWeight: isToday ? '700' : '600' }}>
              {WEEKDAY_SHORT[i]}
            </Text>
            <View
              style={{
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: bg,
                borderWidth: future && !training && !isToday ? 1 : 0,
                borderColor: colors.border,
              }}
            >
              <Text variant="bodyStrong" tnum style={{ color: fg, fontSize: 14, fontWeight: isToday ? '800' : '700' }}>
                {day}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
