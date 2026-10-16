import { router, type Href } from 'expo-router';
import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, View } from 'react-native';

import { formatDateNl, Notice, useAsync } from '@/features/shop';
import { useCustomerSession } from '@/lib/shopify';
import { authNotice } from '@/lib/supabase';
import { Avatar, Button, Card, Icon, ListRow, Screen, Text, useTheme } from '@/ui';

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

/** Ik tab (mockup Mijlpalen.dc.html): profile header, points, milestones, list rows, account deletion. */
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
    Alert.alert('Uitloggen?', 'Je trainingen worden eerst opgeslagen in je account en daarna van dit toestel gewist.', [
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md + 2, paddingTop: space.md }}>
        {initials ? (
          <Avatar initials={initials} size={56} accessibilityLabel={name.data ? `Profiel van ${name.data}` : undefined} />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bg2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="user" size={26} color={colors.text2} />
          </View>
        )}
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="title" accessibilityRole="header">
            Jouw profiel
          </Text>
          <Text variant="caption" tone="tertiary" tnum>
            {meta}
          </Text>
        </View>
      </View>

      {!signedIn ? (
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

      {signedIn ? (pointsSlot ?? null) : null}
      {challengeSlot ?? null}
      {badgesSlot ?? null}

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

      {signedIn ? (
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
      ) : null}
    </Screen>
  );
}
