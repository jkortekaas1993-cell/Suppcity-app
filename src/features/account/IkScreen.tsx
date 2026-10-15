import { Button, Card, ListItem, Screen, Text } from '@/ui';

/** Placeholder. Account, consents (hard rule 2), PT code, export, delete account (hard rule 3). */
export function IkScreen() {
  return (
    <Screen title="Ik" subtitle="Account, toestemmingen en je gegevens.">
      <Card eyebrow="Account">
        <Text tone="muted">Je bent niet ingelogd. Trainen werkt ook zonder account.</Text>
        <Button label="Inloggen met Supp City" />
      </Card>
      <Card eyebrow="Instellingen" style={{ padding: 0 }}>
        <ListItem title="Toestemmingen" subtitle="Per onderdeel aan of uit, altijd intrekbaar" />
        <ListItem title="PT-code koppelen" />
        <ListItem title="Gegevens exporteren" subtitle="CSV van al je trainingen" />
        <ListItem title="Account verwijderen" subtitle="Definitief, direct in de app" />
      </Card>
    </Screen>
  );
}
