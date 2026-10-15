import { Button, Card, Screen, Text } from '@/ui';

/** Placeholder. Shop&Login builder: Storefront API catalog + Checkout Kit. */
export function ShopScreen() {
  return (
    <Screen title="Shop" subtitle="Bestel direct bij Supp City.">
      <Card eyebrow="Snel herbestellen">
        <Text tone="muted">Log in om je eerdere bestellingen te zien.</Text>
        <Button label="Inloggen" variant="secondary" disabled />
      </Card>
      <Card eyebrow="Assortiment">
        <Text tone="muted">Producten worden hier geladen.</Text>
      </Card>
    </Screen>
  );
}
