import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { formatMoney, preloadCheckout, presentCheckout } from '@/lib/shopify';
import { Button, Card, Text, useTheme } from '@/ui';

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
      <SubScreen title="Bedankt!" subtitle="Je bestelling is geplaatst. Je krijgt een bevestiging per e-mail.">
        <Button label="Verder winkelen" onPress={() => router.replace('/shop')} />
        <Button label="Voorraadteller instellen" variant="ghost" onPress={() => router.replace('/shop/stock')} />
      </SubScreen>
    );
  }

  const empty = !cart || cart.lines.length === 0;
  const blocked = cart ? unavailableLines(cart) : [];

  return (
    <SubScreen
      title="Winkelwagen"
      footer={
        empty ? undefined : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="heading">Totaal</Text>
              <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
                {formatMoney(cart.total)}
              </Text>
            </View>
            <Text variant="caption" tone="muted">
              Verzendkosten en eventuele kortingen zie je bij het afrekenen.
            </Text>
            <Button label="Afrekenen" fullWidth loading={opening} disabled={busy || !canCheckout(cart)} onPress={checkout} />
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
        <>
          <Text tone="muted">Je winkelwagen is leeg.</Text>
          <Button label="Naar de shop" variant="secondary" onPress={() => router.replace('/shop')} />
        </>
      ) : (
        <Card style={{ padding: 0 }}>
          {cart.lines.map((line) => (
            <View
              key={line.id}
              style={{
                flexDirection: 'row',
                gap: space.md,
                padding: space.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <ProductThumb image={line.image} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text variant="heading">{line.productTitle}</Text>
                {line.variantTitle ? <Text tone="muted">{line.variantTitle}</Text> : null}
                {!line.available ? <Text tone="danger">Uitverkocht</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Stepper
                    label={`Aantal ${line.productTitle}`}
                    value={line.quantity}
                    disabled={busy}
                    onChange={(q) => void cartStore.setQuantity(line, q)}
                  />
                  <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatMoney(line.lineTotal)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
      {cart && cart.discountCodes.some((d) => d.applicable) ? (
        <Text variant="caption" tone="accent">
          Kortingscode {cart.discountCodes.filter((d) => d.applicable).map((d) => d.code).join(', ')} is toegepast.
        </Text>
      ) : null}
    </SubScreen>
  );
}
