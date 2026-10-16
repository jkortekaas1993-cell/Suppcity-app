import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { formatMoney, preloadCheckout, presentCheckout } from '@/lib/shopify';
import { Button, Card, EmptyState, Pill, Text, useTheme } from '@/ui';

import { Notice } from '../components/Notice';
import { ProductThumb } from '../components/ProductThumb';
import { Stepper } from '../components/Stepper';
import { SubScreen } from '../components/SubScreen';
import { canCheckout, unavailableLines } from '../logic/cart';
import { cartStore, useCart } from '../state/cartStore';

export function CartScreen() {
  const { space, colors } = useTheme();
  const { cart, busy, error, notice } = useCart();
  const [ordered, setOrdered] = useState(false);
  const [opening, setOpening] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    void cartStore.load();
    return () => cleanup.current?.();
  }, []);

  useEffect(() => {
    if (cart && cart.totalQuantity > 0) preloadCheckout(cart.checkoutUrl);
  }, [cart]);

  async function checkout() {
    setOpening(true);
    const url = await cartStore.prepareCheckout();
    setOpening(false);
    if (!url) return;
    cleanup.current?.();
    cleanup.current = presentCheckout(url, {
      onCompleted: () => {
        // Order placed: Shopify owns the order now; start with an empty cart.
        void cartStore.reset();
        setOrdered(true);
      },
      onClose: () => {
        cleanup.current?.();
        cleanup.current = null;
        // Refresh: discounts/quantities may have changed inside checkout.
        void cartStore.load();
      },
      onError: () => cartStore.set({ error: 'Afrekenen lukte niet. Probeer het opnieuw.' }),
    });
  }

  if (ordered) {
    return (
      <SubScreen title="Bedankt!">
        <EmptyState
          icon="check"
          title="Je bestelling is geplaatst"
          body="Je krijgt een bevestiging per e-mail."
          action={{ label: 'Verder winkelen', onPress: () => router.replace('/shop') }}
        />
        <Button label="Voorraadteller instellen" variant="ghost" onPress={() => router.replace('/shop/stock')} />
      </SubScreen>
    );
  }

  const empty = !cart || cart.lines.length === 0;
  const blocked = cart ? unavailableLines(cart) : [];
  const applied = cart ? cart.discountCodes.filter((d) => d.applicable).map((d) => d.code) : [];

  return (
    <SubScreen
      title="Winkelwagen"
      footer={
        empty ? undefined : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="heading">Totaal</Text>
              <Text variant="metric" style={{ fontSize: 28, lineHeight: 30 }} accessibilityLabel={`Totaal ${formatMoney(cart.total)}`}>
                {formatMoney(cart.total)}
              </Text>
            </View>
            <Text variant="caption" tone="tertiary">
              Verzendkosten en eventuele kortingen zie je bij het afrekenen.
            </Text>
            <Button
              label="Afrekenen"
              size="lg"
              fullWidth
              loading={opening}
              disabled={busy || !canCheckout(cart)}
              onPress={checkout}
            />
          </>
        )
      }
    >
      {notice ? <Notice message={notice} onDismiss={cartStore.dismissMessages} /> : null}
      {error ? <Notice message={error} tone="danger" onDismiss={cartStore.dismissMessages} /> : null}
      {blocked.length > 0 ? (
        <Notice tone="danger" message="Een of meer producten zijn uitverkocht. Verwijder ze om af te rekenen." />
      ) : null}

      {empty ? (
        <EmptyState
          icon="bag"
          title="Je winkelwagen is leeg"
          body="Kies iets uit de shop; je bestelling staat in een paar tikken klaar."
          action={{ label: 'Naar de shop', onPress: () => router.replace('/shop') }}
        />
      ) : (
        <Card padding={0} gap={0}>
          {cart.lines.map((line, i) => (
            <View
              key={line.id}
              style={{
                flexDirection: 'row',
                gap: space.md,
                padding: space.md + 2,
                borderBottomWidth: i < cart.lines.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <ProductThumb image={line.image} size={64} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {line.productTitle}
                </Text>
                {line.variantTitle ? (
                  <Text variant="caption" tone="tertiary">
                    {line.variantTitle}
                  </Text>
                ) : null}
                {!line.available ? <Pill label="Uitverkocht" tone="danger" /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
                  <Stepper
                    label={`Aantal ${line.productTitle}`}
                    value={line.quantity}
                    disabled={busy}
                    onChange={(q) => void cartStore.setQuantity(line, q)}
                  />
                  <Text variant="bodyStrong" tnum style={{ fontSize: 16 }}>
                    {formatMoney(line.lineTotal)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
      {applied.length > 0 ? <Pill label={`Kortingscode ${applied.join(', ')} toegepast`} tone="accent" icon="check" /> : null}
    </SubScreen>
  );
}
