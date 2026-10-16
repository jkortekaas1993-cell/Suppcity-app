import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { useRepositories, type Exercise, type WorkoutSet } from '@/lib/db';
import { Button, Card, haptics, Icon, IconButton, ListRow, Pill, SectionLabel, StatTile, Text, useTheme } from '@/ui';

import { BadgeMedal } from '../components/BadgesSection';
import { NotificationOptInCard } from '../components/NotificationOptInCard';
import { StackScreen } from '../components/StackScreen';
import { useFocusQuery } from '../components/useFocusQuery';
import type { BadgeDefinition } from '../logic/badges';
import { formatDateNl, formatElapsed, formatKg, formatNumberNl } from '../logic/format';
import { shouldOfferNotificationCard } from '../logic/notificationPrefs';
import { epley1rm } from '../logic/oneRepMax';
import { PR_LABELS_NL } from '../logic/prs';
import { pickHeadlinePr } from '../logic/summaryView';
import { weekGoalProgress } from '../logic/week';
import { loadNotificationPrefs } from '../notifications';
import { badgesFromWorkout, loadWeeklyGoal, syncBadges } from '../services/badges';
import { buildWorkoutReport, type WorkoutReport } from '../services/workoutSummary';

type ReportPr = WorkoutReport['prs'][number];

function prDetail(pr: ReportPr): string {
  switch (pr.kind) {
    case 'most_reps_at_weight':
      return `${pr.value} reps op ${formatKg(pr.weightKg)} (was ${pr.previous})`;
    case 'best_volume':
      return `${formatKg(pr.value, 0)} (was ${formatKg(pr.previous, 0)})`;
    default:
      return `${formatKg(pr.value, 1)} (was ${formatKg(pr.previous, 1)})`;
  }
}

/** Plain-text share message (an image card can come later). No product or health claims. */
function shareMessage(title: string, pr: ReportPr | null, volumeKg: number, sets: number): string {
  if (pr && pr.kind !== 'best_volume') {
    const e = epley1rm(pr.weightKg, pr.reps);
    const lift = `${formatNumberNl(pr.weightKg, 2)} kg × ${pr.reps}`;
    return `Nieuw persoonlijk record: ${pr.exerciseName} ${lift}${e !== null && pr.reps > 1 ? ` (geschat 1RM ${formatKg(e, 1)})` : ''}. Gelogd met de Supp City app.`;
  }
  return `${title} afgerond: ${sets} sets, ${formatNumberNl(volumeKg, 0)} kg volume. Gelogd met de Supp City app.`;
}

/** The gold PR card from PR.dc.html: big number, reps and estimated 1RM, Supp City mark. */
function PrCard({ pr }: { pr: ReportPr }) {
  const { colors, radius, space } = useTheme();
  const isVolume = pr.kind === 'best_volume';
  const isReps = pr.kind === 'most_reps_at_weight';
  const big = isVolume ? formatNumberNl(pr.value, 0) : isReps ? String(pr.value) : formatNumberNl(pr.kind === 'best_e1rm' ? pr.weightKg : pr.value, 2);
  const unit = isVolume ? 'KG' : isReps ? 'REPS' : 'KG';
  const e = epley1rm(pr.weightKg, pr.reps);
  const delta = pr.value - pr.previous;
  const deltaText = isReps ? `+${delta} reps` : `+${formatNumberNl(delta, isVolume ? 0 : 1)} kg`;
  let line: string;
  if (isVolume) line = 'meeste volume in één training';
  else if (isReps) line = `op ${formatKg(pr.weightKg)}`;
  else line = `× ${pr.reps} rep${pr.reps === 1 ? '' : 's'}${e !== null && pr.reps > 1 ? ` · geschat 1RM ${formatNumberNl(e, 0)} kg` : ''}`;

  return (
    <Card
      variant="gold"
      gap={space.sm + 2}
      style={{ alignItems: 'center', padding: space.xl }}
      accessible
      accessibilityLabel={`Nieuw persoonlijk record. ${pr.exerciseName}: ${big} ${unit === 'KG' ? 'kilo' : 'herhalingen'}, ${line}, ${deltaText}`}
    >
      <Pill label="Nieuw persoonlijk record" tone="gold" size="md" icon="star" />
      <Text variant="bodyStrong" tone="secondary" style={{ fontSize: 16 }} align="center">
        {pr.exerciseName}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm - 2 }}>
        <Text variant="hero" style={{ fontSize: 96, lineHeight: 92 }} adjustsFontSizeToFit numberOfLines={1}>
          {big}
        </Text>
        <Text variant="title" tone="gold" style={{ fontSize: 28, lineHeight: 30 }}>
          {unit}
        </Text>
      </View>
      <Text tone="secondary" tnum align="center" style={{ fontSize: 14 }}>
        {line} · <Text tone="success" tnum variant="bodyStrong" style={{ fontSize: 14 }}>{deltaText}</Text>
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs + 2 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.xs + 1,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="micro" tone="onAccent" style={{ fontSize: 11, lineHeight: 13 }}>
            SC
          </Text>
        </View>
        <Text variant="eyebrow" tone="tertiary" style={{ fontSize: 12 }}>
          Supp City
        </Text>
      </View>
    </Card>
  );
}

function BadgeUnlockedRow({ badge }: { badge: BadgeDefinition }) {
  const { space } = useTheme();
  return (
    <Card accessible accessibilityLabel={`Badge ontgrendeld: ${badge.title}. ${badge.description}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <BadgeMedal badge={badge} earned size={44} />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="bodyStrong">Badge ontgrendeld: {badge.title}</Text>
          <Text variant="caption" tone="tertiary">
            {badge.description}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** Detail of a finished workout; with ?klaar=1 it is the finish summary / PR moment. */
export function WorkoutDetailScreen() {
  const { id, klaar } = useLocalSearchParams<{ id: string; klaar?: string }>();
  const repos = useRepositories();
  const router = useRouter();
  const { colors, space } = useTheme();
  const justFinished = klaar === '1';

  const load = useCallback(async () => {
    const found = await repos.workouts.get(id);
    if (!found) return null;
    const report = await buildWorkoutReport(repos, id);
    const exercises = new Map<string, Exercise>();
    for (const s of found.sets) {
      if (!exercises.has(s.exercise_id)) {
        const e = await repos.exercises.get(s.exercise_id);
        if (e) exercises.set(e.id, e);
      }
    }
    // "Badge ontgrendeld" only on the summary right after finishing, never when an old
    // workout is opened from the history. Recomputed locally; failures never block the summary.
    const badges = justFinished
      ? await syncBadges(repos)
          .then((r) => badgesFromWorkout(r.stored, id))
          .catch(() => [] as BadgeDefinition[])
      : [];
    let week: ReturnType<typeof weekGoalProgress> | null = null;
    if (justFinished) {
      const [goal, recent] = await Promise.all([loadWeeklyGoal(repos.appState), repos.workouts.historyWithStats({ limit: 20 })]);
      week = weekGoalProgress(
        recent.map((w) => w.started_at),
        Date.parse(found.workout.started_at),
        goal,
      );
    }
    return { ...found, report, exercises, badges, week };
  }, [repos, id, justFinished]);
  const { data, loading } = useFocusQuery(load);

  // ADR-9 / C3: offer notifications once, after the first finished workout.
  const [offerNotifications, setOfferNotifications] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!justFinished) return;
    void loadNotificationPrefs(repos.appState).then((p) => alive && setOfferNotifications(shouldOfferNotificationCard(p, justFinished)));
    return () => {
      alive = false;
    };
  }, [repos, justFinished]);

  // Celebrate once: success haptic for a PR, a badge or a reached weekly goal.
  const celebrated = useRef(false);
  useEffect(() => {
    if (!justFinished || !data || celebrated.current) return;
    celebrated.current = true;
    if ((data.report?.prs.length ?? 0) > 0 || data.badges.length > 0 || data.week?.reached) haptics.success();
  }, [data, justFinished]);

  if (loading && !data) return <StackScreen title="Training">{null}</StackScreen>;
  if (!data) {
    return (
      <StackScreen title="Training">
        <Text tone="secondary">Deze training bestaat niet meer.</Text>
      </StackScreen>
    );
  }

  const { workout, sets, report, exercises, badges, week } = data;
  const groups: { exerciseId: string; sets: WorkoutSet[] }[] = [];
  for (const s of sets) {
    if (s.completed_at === null) continue;
    const g = groups.find((x) => x.exerciseId === s.exercise_id);
    if (g) g.sets.push(s);
    else groups.push({ exerciseId: s.exercise_id, sets: [s] });
  }
  const headline = report ? pickHeadlinePr(report.prs) : null;
  const otherPrs = (report?.prs ?? []).filter((p) => p !== headline);

  const remove = () =>
    Alert.alert('Training verwijderen?', 'Deze training en alle sets worden verwijderd.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () => {
          void repos.workouts.softDelete(workout.id).then(() => router.back());
        },
      },
    ]);

  const share = () => {
    if (!report) return;
    void Share.share({ message: shareMessage(workout.title, headline, report.summary.volumeKg, report.summary.completedSets) }).catch(
      () => undefined,
    );
  };

  return (
    <StackScreen
      eyebrow={justFinished ? 'Workout voltooid' : formatDateNl(workout.started_at)}
      title={justFinished ? 'Sterk gedaan' : workout.title}
      subtitle={justFinished ? workout.title : undefined}
      hideBack={justFinished}
      right={
        justFinished ? undefined : (
          <IconButton icon="trash" accessibilityLabel="Training verwijderen" onPress={remove} color={colors.text2} />
        )
      }
      footer={
        justFinished ? (
          <>
            <Button label={headline ? 'Deel je PR-kaart' : 'Deel je training'} icon="share" size="lg" fullWidth onPress={share} />
            <Button label="Terug naar Vandaag" variant="secondary" fullWidth onPress={() => router.replace('/vandaag')} />
          </>
        ) : undefined
      }
    >
      {report ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <StatTile size="sm" value={formatElapsed(report.summary.durationMs)} caption="duur" />
          <StatTile size="sm" value={formatNumberNl(report.summary.volumeKg, 0)} caption="kg volume" />
          <StatTile size="sm" value={String(report.summary.completedSets)} caption="sets" />
        </View>
      ) : null}

      {headline ? <PrCard pr={headline} /> : null}

      {badges.map((b) => (
        <BadgeUnlockedRow key={b.id} badge={b} />
      ))}

      {week ? (
        <Card accessible accessibilityLabel={`Weekdoel: ${week.done} van ${week.goal} trainingen`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text tone="secondary" style={{ fontSize: 14 }}>
              Weekdoel
            </Text>
            <Text variant="bodyStrong" tone={week.reached ? 'success' : 'default'} tnum style={{ fontSize: 14 }}>
              {week.done} van {week.goal}
              {week.reached ? ' · gehaald' : ''}
            </Text>
          </View>
        </Card>
      ) : null}

      {offerNotifications ? <NotificationOptInCard onDone={() => setOfferNotifications(false)} /> : null}

      {otherPrs.length > 0 ? (
        <>
          <SectionLabel label={headline ? 'Meer records' : 'Persoonlijke records'} />
          <Card padding={0} gap={0}>
            {otherPrs.map((pr, i) => (
              <ListRow
                key={`${pr.exerciseId}-${pr.kind}-${i}`}
                title={pr.exerciseName}
                subtitle={`${PR_LABELS_NL[pr.kind]}: ${prDetail(pr)}`}
                leading={<Icon name="star" size={20} color={colors.gold} filled />}
                divider={i < otherPrs.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      {groups.length > 0 ? <SectionLabel label="Sets" /> : null}
      {groups.map((g) => {
        const name = exercises.get(g.exerciseId)?.name_nl ?? 'Oefening';
        let working = 0;
        return (
          <Card key={g.exerciseId} padding={0} gap={0}>
            <ListRow
              title={name}
              chevron
              divider
              onPress={() => router.push(`/exercise/${encodeURIComponent(g.exerciseId)}`)}
              accessibilityHint="Bekijk de oefening"
            />
            {g.sets.map((s, i) => {
              const label = s.set_type === 'warmup' ? 'W' : s.set_type === 'dropset' ? 'D' : s.set_type === 'failure' ? 'F' : String(++working);
              const e = epley1rm(s.weight_kg, s.reps);
              return (
                <ListRow
                  key={s.id}
                  title={`${formatNumberNl(s.weight_kg ?? 0, 2)} kg × ${s.reps ?? 0}`}
                  value={e !== null && s.set_type !== 'warmup' ? `1RM ~${formatNumberNl(e, 1)}` : undefined}
                  valueTone="tertiary"
                  divider={i < g.sets.length - 1}
                  leading={
                    <Text variant="bodyStrong" tone={s.set_type === 'normal' ? 'default' : 'tertiary'} tnum style={{ width: 24 }}>
                      {label}
                    </Text>
                  }
                />
              );
            })}
          </Card>
        );
      })}
    </StackScreen>
  );
}
