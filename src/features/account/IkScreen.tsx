import { router, type Href } from 'expo-router';
import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { formatDateNl, Notice, useAsync } from '@/features/shop';
import { useCustomerSession } from '@/lib/shopify';
import { authNotice } from '@/lib/supabase';
import { Appear, Button, Card, Icon, ListRow, Screen, Text, useTheme } from '@/ui';

import { initialsFor, profileMeta } from './profile';
import { loadProfileName, signIn, signOut } from './services/session';

export interface IkScreenProps {
  /**
   * Points card for signed-in users (the points feature's PointsPanel), composed by the
   * route file so account does not depend on points internals.
   */
  pointsSlot?: ReactNode;
  /** Milestones block (tracker's BadgesSection). Shown for everyone: badges are local. */
  badgesSlot?: ReactNode;
  /** Monthly challenge card: release 2b. Leave empty in 2a. */
  challengeSlot?: ReactNode;
  /** ISO date of the first local data / account creation, for "Lid sinds oktober 2026". */
  memberSince?: string | null;
  /** Number of finished workouts, for "47 workouts". */
  workoutCount?: number | null;
  /** Route of the supplement schedule (built by another builder). */
  supplementsHref?: Href;
  /**
   * The supplements feature's own row (SupplementsLink), composed by the route file.
   * Replaces the plain "Mijn supplementen" row. The supplement schedule also shows the
   * stock, so Ik has no separate "Voorraadteller" row any more (the route stays, reachable
   * from the ReorderCard, the cart and order details).
   */
  supplementsRow?: (props: { divider: boolean }) => ReactNode;
}

/**
 * Sign-out copy (ADR-15): trainingen are in the account and leave the device; the
 * supplement schedule is local only and stays, hidden until this account signs in again.
 */
export const SIGN_OUT_MESSAGE =
  'Je trainingen worden eerst opgeslagen in je account en daarna van dit toestel gewist. ' +
  'Je supplementenschema blijft alleen op dit toestel bewaard en is weer te zien als je opnieuw inlogt.';

/**
 * Ik tab (mockup Ik.dc.html, design round 3): avatar on the accent gradient with name and
 * "Lid sinds …", the points card, milestones, menu rows, sign-out and account deletion.
 * The cards enter one after another (Appear).
 */
export function IkScreen({
  pointsSlot,
  badgesSlot,
  challengeSlot,
  memberSince,
  workoutCount,
  supplementsHref = '/supplements',
  supplementsRow,
}: IkScreenProps) {
  const { colors, space } = useTheme();
  const session = useCustomerSession();
  const signedIn = session === 'signedIn';
  const name = useAsync(() => (signedIn ? loadProfileName() : Promise.resolve(null)), [signedIn]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sessionNotice = useSyncExternalStore(authNotice.subscribe, authNotice.get, authNotice.get);

  async function onSignIn() {
    setBusy(true);
    setMessage(null);
    const res = await signIn();
    setBusy(false);
    if (res.status === 'failed') setMessage(res.message);
    if (res.status === 'signed_in' && res.message) setMessage(res.message);
  }

  async function onSignOut(force = false) {
    setBusy(true);
    setMessage(null);
    const res = await signOut({ force });
    setBusy(false);
    if (res.status === 'unsynced') {
      Alert.alert(
        'Niet alles is gesynchroniseerd',
        'Je trainingen konden niet worden opgeslagen in je account. Als je nu uitlogt, worden ze van dit toestel verwijderd.',
        [
          { text: 'Ingelogd blijven', style: 'cancel' },
          { text: 'Toch uitloggen', style: 'destructive', onPress: () => void onSignOut(true) },
        ],
      );
    }
  }

  function confirmSignOut() {
    Alert.alert('Uitloggen?', SIGN_OUT_MESSAGE, [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Uitloggen', style: 'destructive', onPress: () => void onSignOut() },
    ]);
  }

  const initials = initialsFor(name.data ?? null);
  const meta = profileMeta({
    signedIn,
    memberSince: memberSince ? formatDateNl(memberSince, 'monthYear') : null,
    workoutCount: workoutCount ?? null,
  });

  const rows: { title: string; subtitle?: string; href: Href; show: boolean; render?: (p: { divider: boolean }) => ReactNode }[] = [
    { title: 'Mijn supplementen', href: supplementsHref, show: true, render: supplementsRow },
    { title: 'Bestellingen', href: '/account/orders', show: signedIn },
    { title: 'PT-code koppelen', href: '/account/pt-code', show: signedIn },
    { title: 'Privacy en toestemmingen', href: '/account/privacy', show: true },
    // CSV export + import is the tracker's Data screen (hard rule 9).
    { title: 'Data exporteren', subtitle: 'CSV van je trainingen en supplementen', href: '/workout/data', show: true },
  ];
  const visible = rows.filter((r) => r.show);

  return (
    <Screen>
      <Appear index={0} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md + 2, paddingTop: space.md }}>
        <LinearGradient
          colors={[colors.accent, colors.accentPressed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          accessible={Boolean(name.data)}
          accessibilityLabel={name.data ? `Profiel van ${name.data}` : undefined}
          style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}
        >
          {initials ? (
            <Text variant="title" style={{ color: colors.onAccent, fontSize: 24, lineHeight: 28 }} maxFontSizeMultiplier={1.2}>
              {initials}
            </Text>
          ) : (
            <Icon name="user" size={26} color={colors.onAccent} />
          )}
        </LinearGradient>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {name.data ?? 'Jouw profiel'}
          </Text>
          <Text variant="caption" tone="tertiary" tnum>
            {meta}
          </Text>
        </View>
      </Appear>

      {!signedIn ? (
        <Appear index={1}>
          <Card eyebrow="Account">
            <Text tone="secondary">Log in met je Supp City-account voor bestellingen, punten en een back-up van je trainingen.</Text>
            <Button
              label="Inloggen met Supp City"
              size="lg"
              fullWidth
              loading={busy || session === 'unknown'}
              onPress={onSignIn}
            />
          </Card>
        </Appear>
      ) : null}

      {message ? <Notice message={message} onDismiss={() => setMessage(null)} /> : null}
      {sessionNotice && !message ? (
        signedIn ? (
          <Notice
            message={sessionNotice}
            action={{ label: 'Log opnieuw in', onPress: () => void onSignIn() }}
            onDismiss={() => authNotice.set(null)}
          />
        ) : (
          <Notice message={sessionNotice} onDismiss={() => authNotice.set(null)} />
        )
      ) : null}

      {signedIn && pointsSlot ? (
        <Appear index={1} style={{ gap: space.lg }}>
          {pointsSlot}
        </Appear>
      ) : null}
      {challengeSlot ? <Appear index={2}>{challengeSlot}</Appear> : null}
      {badgesSlot ? <Appear index={3}>{badgesSlot}</Appear> : null}

      <Appear index={4}>
        <Card padding={0} gap={0}>
          {visible.map((r, i) =>
            r.render ? (
              <Fragment key={r.title}>{r.render({ divider: i < visible.length - 1 })}</Fragment>
            ) : (
              <ListRow
                key={r.title}
                title={r.title}
                subtitle={r.subtitle}
                divider={i < visible.length - 1}
                onPress={() => router.push(r.href)}
              />
            ),
          )}
        </Card>
      </Appear>

      {signedIn ? (
        <Appear index={5}>
          <Card padding={0} gap={0}>
            <ListRow
              title="Uitloggen"
              subtitle={name.data ? `Ingelogd als ${name.data}` : 'Eén account voor suppcity.nl en de app'}
              chevron={false}
              divider
              onPress={busy ? undefined : confirmSignOut}
              accessibilityHint="Je trainingen worden eerst opgeslagen in je account"
            />
            <ListRow
              title="Account verwijderen"
              subtitle="Definitief, direct in de app"
              destructive
              onPress={() => router.push('/account/delete')}
            />
          </Card>
        </Appear>
      ) : null}
    </Screen>
  );
}
