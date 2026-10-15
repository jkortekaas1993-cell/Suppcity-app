import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, Text, useTheme } from '@/ui';

import { Chip, NumberField, Row } from '../components/primitives';
import { StackScreen } from '../components/StackScreen';
import { formatKg, formatNumberNl } from '../logic/format';
import { calculatePlates, DEFAULT_BAR_KG, DEFAULT_PLATES_KG } from '../logic/plates';

const BARS = [20, 15, 10];

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
      <Card eyebrow="Totaalgewicht (kg)">
        <View style={{ flexDirection: 'row' }}>
          <NumberField value={target} onChange={setTarget} decimals={2} accessibilityLabel="Totaalgewicht in kilo" placeholder="kg" />
        </View>
        <Text variant="label" tone="muted">
          Stang
        </Text>
        <Row>
          {BARS.map((b) => (
            <Chip key={b} label={`${b} kg`} selected={bar === b} onPress={() => setBar(b)} />
          ))}
        </Row>
      </Card>

      <Card eyebrow="Per kant">
        {result.perSide.length === 0 ? (
          <Text tone="muted">Alleen de stang ({formatKg(bar)}).</Text>
        ) : (
          <>
            <View
              accessible
              accessibilityLabel={`Per kant: ${result.perSide.map((p) => `${p.count} keer ${formatNumberNl(p.plateKg, 2)} kilo`).join(', ')}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs, minHeight: 120 }}
            >
              <View style={{ width: 24, height: 10, backgroundColor: colors.textMuted }} />
              {result.perSide.flatMap((p) =>
                Array.from({ length: p.count }, (_, i) => (
                  <View
                    key={`${p.plateKg}-${i}`}
                    style={{
                      width: 14,
                      height: 40 + (p.plateKg / maxPlate) * 80,
                      borderRadius: radius.sm,
                      backgroundColor: colors.accent,
                      opacity: 0.45 + (p.plateKg / maxPlate) * 0.55,
                    }}
                  />
                )),
              )}
              <View style={{ flex: 1, height: 10, backgroundColor: colors.textMuted }} />
            </View>
            {result.perSide.map((p) => (
              <Text key={p.plateKg} variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
                {p.count} × {formatNumberNl(p.plateKg, 2)} kg
              </Text>
            ))}
          </>
        )}
        {result.remainderKg !== 0 && (target ?? 0) > 0 ? (
          <Text tone="danger">
            {result.remainderKg < 0
              ? `Lichter dan de stang. Minimaal ${formatKg(bar)}.`
              : `Niet exact te laden: ${formatKg(result.loadedKg)} (${formatKg(result.remainderKg)} minder).`}
          </Text>
        ) : null}
      </Card>
    </StackScreen>
  );
}
