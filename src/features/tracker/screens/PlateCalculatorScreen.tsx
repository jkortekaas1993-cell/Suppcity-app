import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, Segmented, Text, useTheme } from '@/ui';

import { NumberField } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { formatKg, formatNumberNl } from '../logic/format';
import { calculatePlates, DEFAULT_BAR_KG, DEFAULT_PLATES_KG } from '../logic/plates';

const BARS = ['20', '15', '10'] as const;

export function PlateCalculatorScreen() {
  const { kg } = useLocalSearchParams<{ kg?: string }>();
  const initial = kg ? Number(kg) : 60;
  const [target, setTarget] = useState<number | null>(Number.isFinite(initial) ? initial : 60);
  const [bar, setBar] = useState(DEFAULT_BAR_KG);
  const { colors, space, radius } = useTheme();
  const result = calculatePlates(target ?? 0, { barKg: bar, platesKg: DEFAULT_PLATES_KG });
  const maxPlate = DEFAULT_PLATES_KG[0] ?? 25;

  return (
    <StackScreen title="Platencalculator">
      <Card eyebrow="Totaalgewicht (kg)" gap={space.md}>
        <View style={{ flexDirection: 'row' }}>
          <NumberField
            value={target}
            onChange={setTarget}
            decimals={2}
            accessibilityLabel="Totaalgewicht in kilo"
            placeholder="kg"
            style={{ flex: 1, minHeight: 56, fontSize: 28, lineHeight: 32 }}
          />
        </View>
        <Text variant="eyebrow" tone="tertiary">
          Stang
        </Text>
        <Segmented
          accessibilityLabel="Gewicht van de stang"
          options={BARS.map((b) => ({ value: b, label: `${b} kg` }))}
          value={String(bar) as (typeof BARS)[number]}
          onChange={(v) => setBar(Number(v))}
        />
      </Card>

      <Card eyebrow="Per kant">
        {result.perSide.length === 0 ? (
          <Text tone="secondary">Alleen de stang ({formatKg(bar)}).</Text>
        ) : (
          <>
            <View
              accessible
              accessibilityLabel={`Per kant: ${result.perSide.map((p) => `${p.count} keer ${formatNumberNl(p.plateKg, 2)} kilo`).join(', ')}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs, minHeight: 120 }}
            >
              <View style={{ width: 24, height: 10, backgroundColor: colors.text3 }} />
              {result.perSide.flatMap((p) =>
                Array.from({ length: p.count }, (_, i) => (
                  <View
                    key={`${p.plateKg}-${i}`}
                    style={{
                      width: 14,
                      height: 40 + (p.plateKg / maxPlate) * 80,
                      borderRadius: radius.xs,
                      backgroundColor: colors.text2,
                      opacity: 0.55 + (p.plateKg / maxPlate) * 0.45,
                    }}
                  />
                )),
              )}
              <View style={{ flex: 1, height: 10, backgroundColor: colors.text3 }} />
            </View>
            {result.perSide.map((p) => (
              <Text key={p.plateKg} variant="heading" tnum>
                {p.count} × {formatNumberNl(p.plateKg, 2)} kg
              </Text>
            ))}
          </>
        )}
        {result.remainderKg !== 0 && (target ?? 0) > 0 ? (
          <Text tone="gold">
            {result.remainderKg < 0
              ? `Lichter dan de stang. Minimaal ${formatKg(bar)}.`
              : `Niet exact te laden: ${formatKg(result.loadedKg)} (${formatKg(result.remainderKg)} minder).`}
          </Text>
        ) : null}
      </Card>
    </StackScreen>
  );
}
