import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { useRepositories } from '@/lib/db';
import { Button, Card, EmptyState, ListRow, ProgressBar, SectionLabel, Screen, Text, useTheme } from '@/ui';

import { IntakeCheck } from '../components/IntakeCheck';
import { WeekStrip } from '../components/WeekStrip';
import type { IntakeStatus, SupplementWithSchedules } from '../data/types';
import { DISCLAIMER } from '../copy';
import { addDays, localIsoDate, localTime, maskHas, scheduleLabel, weekdayOf, weekOf } from '../logic/schedule';
import { daysLeftLabel } from '../logic/stock';
import { buildTodayRows, stockRows, type TodayRow } from '../logic/today';
import { loadReminderPrefs, setRemindersEnabled, type ReminderPrefs } from '../services/reminders';
import { notifySupplementsChanged, useSupplementRepository, useSupplementsVersion } from '../services/store';

interface Loaded {
  items: SupplementWithSchedules[];
  rows: TodayRow[];
  trainingDates: Set<string>;
  isTrainingDay: boolean;
  prefs: ReminderPrefs;
}

/** "Mijn supplementen": week strip, today's list with check-off, stock bars, add button. */
export function SupplementsScreen() {
  const { colors, space } = useTheme();
  const repo = useSupplementRepository();
  const repos = useRepositories();
  const version = useSupplementsVersion();
  const [data, setData] = useState<Loaded | null>(null);
  const [today, setToday] = useState(() => localIsoDate(new Date()));
  const week = useMemo(() => weekOf(today), [today]);

  const load = useCallback(async () => {
    const now = new Date();
    const date = localIsoDate(now);
    setToday(date);
    const dates = weekOf(date);
    const [items, prefs, history, trainingMask] = await Promise.all([
      repo.list(),
      loadReminderPrefs(repo),
      repos.workouts.history({ limit: 30 }).catch(() => []),
      repo.getSetting<number>('supplements.trainingDays'),
    ]);
    // Logged workouts this week (local dates) + the user's own planned training weekdays.
    const logged = new Set(history.map((w) => localIsoDate(new Date(w.started_at))).filter((d) => dates.includes(d)));
    const trainingDates = new Set(dates.filter((d) => logged.has(d) || (trainingMask !== null && maskHas(trainingMask, weekdayOf(d)))));
    const intakes = await repo.intakesBetween(`${date}T00:00`, `${addDays(date, 1)}T00:00`);
    setData({
      items,
      prefs,
      trainingDates,
      isTrainingDay: trainingDates.has(date),
      rows: buildTodayRows(items, intakes, date, { workedOut: logged.has(date) }),
    });
  }, [repo, repos]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    void load();
  }, [load, version]);

  async function mark(row: TodayRow, status: IntakeStatus | null) {
    const { supplementId, scheduleId, scheduledFor } = row.occurrence;
    if (status === null) await repo.clearIntake(supplementId, scheduledFor);
    else await repo.setIntake({ supplementId, scheduleId, scheduledFor, status });
    notifySupplementsChanged();
  }

  function rowActions(row: TodayRow) {
    const name = row.supplement.name;
    Alert.alert(name, row.supplement.dose_text || undefined, [
      { text: 'Ingenomen', onPress: () => void mark(row, 'taken') },
      { text: 'Overgeslagen', onPress: () => void mark(row, 'skipped') },
      ...(row.intake ? [{ text: 'Markering wissen', onPress: () => void mark(row, null) }] : []),
      { text: 'Bewerken', onPress: () => router.push({ pathname: '/supplements/edit', params: { id: row.supplement.id } }) },
      { text: 'Annuleren', style: 'cancel' as const },
    ]);
  }

  async function toggleReminders(on: boolean) {
    const res = await setRemindersEnabled(repo, on);
    if (on && res.permission === 'denied') {
      Alert.alert('Meldingen staan uit', 'Zet meldingen voor Supp City aan in de instellingen van je telefoon om herinneringen te krijgen.');
    }
    notifySupplementsChanged();
  }

  const items = data?.items ?? [];
  const stock = stockRows(items);

  return (
    <Screen
      title="Mijn supplementen"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/vandaag'))}
      footer={
        <Button
          label="+ Supplement toevoegen"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={() => router.push('/supplements/edit')}
        />
      }
    >
      <WeekStrip dates={week} today={today} trainingDates={data?.trainingDates ?? new Set()} />

      {data && items.length === 0 ? (
        <EmptyState
          icon="pill"
          title="Nog geen supplementen"
          body="Zet erin wat jij gebruikt, met je eigen hoeveelheid en tijd. Dan kun je het hier afvinken en zie je wanneer een pot bijna leeg is."
        />
      ) : null}

      {items.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel label={data?.isTrainingDay ? 'Vandaag · trainingsdag' : 'Vandaag · rustdag'} />
          {data && data.rows.length === 0 ? (
            <Card>
              <Text tone="secondary">Vandaag staat er niets op je schema.</Text>
            </Card>
          ) : (
            <Card padding={0} gap={0}>
              {data?.rows.map((row, i) => {
                const { supplement, intake, stock: st, occurrence } = row;
                const title = supplement.dose_text ? `${supplement.name} · ${supplement.dose_text}` : supplement.name;
                const status = intake?.status ?? null;
                const subtitle =
                  status === 'taken' && intake?.taken_at
                    ? `${occurrence.time} · ingenomen ${localTime(new Date(intake.taken_at))}`
                    : status === 'skipped'
                      ? `${occurrence.time} · overgeslagen`
                      : `${occurrence.time} · ${scheduleLabel(supplement.schedules.find((s) => s.id === occurrence.scheduleId) ?? { days_mask: 0, mode: 'fixed' })}`;
                const value =
                  status !== null || supplement.units_left === null
                    ? undefined
                    : st.low && st.daysLeft !== null
                      ? daysLeftLabel(st.daysLeft)
                      : `${supplement.units_left} over`;
                return (
                  <ListRow
                    key={occurrence.scheduledFor + supplement.id}
                    title={title}
                    subtitle={subtitle}
                    value={value}
                    valueTone={st.low ? 'gold' : 'tertiary'}
                    done={status !== null}
                    divider={i < (data?.rows.length ?? 0) - 1}
                    leading={
                      <IntakeCheck
                        status={status}
                        accessibilityLabel={`${supplement.name} ingenomen`}
                        onPress={() => void mark(row, status === 'taken' ? null : 'taken')}
                      />
                    }
                    onPress={() => rowActions(row)}
                    chevron={false}
                    accessibilityHint="Meer opties: overslaan, wissen of bewerken"
                  />
                );
              })}
            </Card>
          )}
        </View>
      ) : null}

      {stock.length > 0 ? (
        <Card gap={space.md - 2}>
          <SectionLabel
            label="Voorraad"
            action={{ label: 'Opnieuw bestellen', onPress: () => router.push('/shop') }}
          />
          {stock.map(({ supplement, stock: st }) => (
            <View
              key={supplement.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md - 2 }}
              accessible
              accessibilityLabel={`${supplement.name}: ${st.daysLeft === null ? `${supplement.units_left} porties over` : `nog ongeveer ${st.daysLeft} dagen`}`}
            >
              <Text variant="caption" style={{ flex: 1, color: colors.text1 }} numberOfLines={1}>
                {supplement.name}
              </Text>
              <View style={{ width: 120 }}>
                <ProgressBar value={st.fraction ?? (st.empty ? 0 : 1)} height={6} tone={st.low ? 'gold' : 'accent'} />
              </View>
              <Text variant="caption" tone="secondary" tnum align="right" style={{ width: 54 }}>
                {st.daysLeft === null ? `${supplement.units_left}` : `${st.daysLeft} d`}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {items.length > 0 ? (
        <Card padding={0} gap={0}>
          {items.map((s, i) => (
            <ListRow
              key={s.id}
              title={s.name}
              subtitle={s.schedules.map((sc) => `${scheduleLabel(sc)} ${sc.time_local}`).join(' · ') || 'Geen schema'}
              leading="pill"
              divider={i < items.length - 1}
              onPress={() => router.push({ pathname: '/supplements/edit', params: { id: s.id } })}
            />
          ))}
        </Card>
      ) : null}

      {items.length > 0 ? (
        <Card padding={0} gap={0}>
          <ListRow
            title="Supplementherinneringen"
            subtitle={data?.prefs.enabled ? 'Melding op jouw tijden, met Ingenomen en Later' : 'Uit'}
            leading="calendar"
            trailing={
              <Switch
                accessibilityLabel="Supplementherinneringen"
                value={data?.prefs.enabled ?? false}
                onValueChange={(v: boolean) => void toggleReminders(v)}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            }
          />
        </Card>
      ) : null}

      <Text variant="caption" tone="tertiary">
        {DISCLAIMER}
      </Text>
    </Screen>
  );
}

