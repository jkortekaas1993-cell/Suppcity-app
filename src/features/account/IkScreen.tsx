import { router } from 'expo-router';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { useAsync, Notice } from '@/features/shop';
import { useCustomerSession } from '@/lib/shopify';
import { authNotice } from '@/lib/supabase';
import { Button, Card, ListItem, Screen, Text } from '@/ui';

import { loadProfileName, signIn, signOut } from './services/session';

export interface IkScreenProps {
  /**
   * Points section for signed-in users (the points feature's PointsPanel),
   * composed by the route file so account does not depend on points internals.
   */
  pointsSlot?: ReactNode;
}

/** Ik tab: account, orders, points, PT code, privacy, CSV export and account deletion. */
export function IkScreen({ pointsSlot }: IkScreenProps) {
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

  return (
    <Screen title="Ik" subtitle="Account, toestemmingen en je gegevens.">
      <Card eyebrow="Account">
        {signedIn ? (
          <>
            <Text variant="heading">{name.data ? `Hoi ${name.data}` : 'Je bent ingelogd'}</Text>
            <Text tone="muted">Eén account voor suppcity.nl en de app.</Text>
            <Text variant="caption" tone="muted">
              Bij uitloggen worden je trainingen eerst opgeslagen in je account en daarna van dit toestel gewist.
            </Text>
            <Button label="Uitloggen" variant="ghost" loading={busy} onPress={() => void onSignOut()} />
          </>
        ) : (
          <>
            <Text tone="muted">Je bent niet ingelogd. Trainen werkt ook zonder account.</Text>
            <Button label="Inloggen met Supp City" loading={busy || session === 'unknown'} onPress={onSignIn} />
          </>
        )}
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
      </Card>

      {signedIn ? (pointsSlot ?? null) : null}

      <Card eyebrow="Instellingen" style={{ padding: 0 }}>
        {signedIn ? (
          <ListItem title="Mijn bestellingen" subtitle="Bekijken en opnieuw bestellen" onPress={() => router.push('/account/orders')} />
        ) : null}
        <ListItem title="Mijn voorraad" subtitle="Herinnering voordat je pot leeg is" onPress={() => router.push('/shop/stock')} />
        <ListItem title="Toestemmingen" subtitle="Per onderdeel aan of uit, altijd intrekbaar" onPress={() => router.push('/account/privacy')} />
        {signedIn ? <ListItem title="PT-code koppelen" onPress={() => router.push('/account/pt-code')} /> : null}
        {/* CSV export + import is the tracker's Data screen (hard rule 9). */}
        <ListItem title="Gegevens exporteren" subtitle="CSV van al je trainingen" onPress={() => router.push('/workout/data')} />
        {signedIn ? (
          <ListItem title="Account verwijderen" subtitle="Definitief, direct in de app" onPress={() => router.push('/account/delete')} />
        ) : null}
      </Card>
    </Screen>
  );
}
