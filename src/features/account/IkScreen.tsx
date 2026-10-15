import { router } from 'expo-router';
import { useState } from 'react';

import { useAsync, Notice } from '@/features/shop';
import { useCustomerSession } from '@/lib/shopify';
import { Button, Card, ListItem, Screen, Text } from '@/ui';

import { PointsBalanceSlot } from './components/PointsBalanceSlot';
import { loadProfileName, signIn, signOut } from './services/session';

/** Ik tab: account, orders, points slot, PT code, privacy and account deletion. */
export function IkScreen() {
  const session = useCustomerSession();
  const signedIn = session === 'signedIn';
  const name = useAsync(() => (signedIn ? loadProfileName() : Promise.resolve(null)), [signedIn]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true);
    setMessage(null);
    const res = await signIn();
    setBusy(false);
    if (res.status === 'failed') setMessage(res.message);
    if (res.status === 'signed_in' && res.message) setMessage(res.message);
  }

  return (
    <Screen title="Ik" subtitle="Account, toestemmingen en je gegevens.">
      <Card eyebrow="Account">
        {signedIn ? (
          <>
            <Text variant="heading">{name.data ? `Hoi ${name.data}` : 'Je bent ingelogd'}</Text>
            <Text tone="muted">Eén account voor suppcity.nl en de app.</Text>
            <Button label="Uitloggen" variant="ghost" onPress={() => void signOut()} />
          </>
        ) : (
          <>
            <Text tone="muted">Je bent niet ingelogd. Trainen werkt ook zonder account.</Text>
            <Button label="Inloggen met Supp City" loading={busy || session === 'unknown'} onPress={onSignIn} />
          </>
        )}
        {message ? <Notice message={message} onDismiss={() => setMessage(null)} /> : null}
      </Card>

      {signedIn ? <PointsBalanceSlot /> : null}

      <Card eyebrow="Instellingen" style={{ padding: 0 }}>
        {signedIn ? (
          <ListItem title="Mijn bestellingen" subtitle="Bekijken en opnieuw bestellen" onPress={() => router.push('/account/orders')} />
        ) : null}
        <ListItem title="Mijn voorraad" subtitle="Herinnering voordat je pot leeg is" onPress={() => router.push('/shop/stock')} />
        <ListItem title="Toestemmingen" subtitle="Per onderdeel aan of uit, altijd intrekbaar" onPress={() => router.push('/account/privacy')} />
        {signedIn ? <ListItem title="PT-code koppelen" onPress={() => router.push('/account/pt-code')} /> : null}
        {/* CSV export is owned by the Tracker builder (hard rule 9); link the route once it exists. */}
        <ListItem title="Gegevens exporteren" subtitle="CSV van al je trainingen" />
        {signedIn ? (
          <ListItem title="Account verwijderen" subtitle="Definitief, direct in de app" onPress={() => router.push('/account/delete')} />
        ) : null}
      </Card>
    </Screen>
  );
}
