import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useRepositories } from '@/lib/db';
import { Button, Card, Icon, Text, useTheme } from '@/ui';

import { addDays, localIsoDate } from './logic/schedule';
import { buildTodayRows, nextOpenRow, type TodayRow } from './logic/today';
import { notifySupplementsChanged, useSupplementRepository, useSupplementsVersion } from './services/store';

/**
 * Vandaag card (Main.dc.html): the next supplement of today that is not ticked off,
 * with one "Ingenomen" button. Renders nothing when nothing is open today.
 */
export function SupplementTodayCard() {
  const { colors, radius, space } = useTheme();
  const repo = useSupplementRepository();
  const repos = useRepositories();
  const version = useSupplementsVersion();
  const [row, setRow] = useState<TodayRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const date = localIsoDate(new Date());
      const [items, intakes, last] = await Promise.all([
        repo.list(),
        repo.intakesBetween(`${date}T00:00`, `${addDays(date, 1)}T00:00`),
        repos.workouts.history({ limit: 1 }).catch(() => []),
      ]);
      const workedOut = last.some((w) => localIsoDate(new Date(w.started_at)) === date);
      setRow(nextOpenRow(buildTodayRows(items, intakes, date, { workedOut })));
    } catch {
      setRow(null);
    }
  }, [repo, repos]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    void load();
  }, [load, version]);

  if (!row) return null;
  const { supplement, occurrence } = row;
  const title = supplement.dose_text ? `${supplement.name} · ${supplement.dose_text}` : supplement.name;

  return (
    <Card onPress={() => router.push('/supplements')} accessibilityLabel={`Supplement: ${title}, vandaag ${occurrence.time}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.control,
            backgroundColor: colors.bg2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="pill" size={20} color={colors.text2} />
        </View>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" tone="tertiary" tnum>
            Vandaag {occurrence.time}
          </Text>
        </View>
        <Button
          label="Ingenomen"
          variant="secondary"
          size="sm"
          loading={busy}
          haptic="light"
          onPress={async () => {
            setBusy(true);
            try {
              await repo.setIntake({
                supplementId: occurrence.supplementId,
                scheduleId: occurrence.scheduleId,
                scheduledFor: occurrence.scheduledFor,
                status: 'taken',
              });
              notifySupplementsChanged();
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Card>
  );
}
