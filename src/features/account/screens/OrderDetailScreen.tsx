import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatDateNl, LoadState, Notice, ProductThumb, reorder, SubScreen, useAsync } from '@/features/shop';
import { formatMoney, getCustomerAccount, orderStatusLabel, type Money } from '@/lib/shopify';
import { Button, Card, Divider, Text, useTheme } from '@/ui';

function Row({ label, value }: { label: string; value: Money | null }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text tone="secondary">{label}</Text>
      <Text tnum>{formatMoney(value)}</Text>
    </View>
  );
}

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { space, colors } = useTheme();
  const order = useAsync(async () => (await getCustomerAccount()).order(String(id)), [id]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const o = order.data;

  return (
    <SubScreen
      title={o ? `Bestelling ${o.name}` : 'Bestelling'}
      // Explicit Intl options: `dateStyle` is not supported everywhere on Hermes/Android.
      subtitle={o ? `${formatDateNl(o.processedAt, 'long')} · ${orderStatusLabel(o)}` : undefined}
      fallback="/account/orders"
      footer={
        o ? (
          <>
            {message ? <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} /> : null}
            <Button
              label="Opnieuw bestellen"
              size="lg"
              fullWidth
              loading={busy}
              onPress={async () => {
                setBusy(true);
                const res = await reorder(o);
                setBusy(false);
                if (res.ok) router.push('/shop/cart');
                else setMessage(res.message);
              }}
            />
          </>
        ) : undefined
      }
    >
      <LoadState loading={order.loading} error={order.error} onRetry={order.reload} />
      {!order.loading && !order.error && !o ? <Text tone="secondary">Deze bestelling is niet gevonden.</Text> : null}
      {o ? (
        <>
          <Card padding={0} gap={0}>
            {o.lines.map((l, i) => (
              <View
                key={l.id}
                style={{
                  flexDirection: 'row',
                  gap: space.md,
                  padding: space.md + 2,
                  borderBottomWidth: i < o.lines.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <ProductThumb image={l.image} />
                <View style={{ flex: 1, gap: space.xxs }}>
                  <Text variant="bodyStrong">{l.title}</Text>
                  {l.variantTitle ? (
                    <Text variant="caption" tone="tertiary">
                      {l.variantTitle}
                    </Text>
                  ) : null}
                  <Text variant="caption" tone="secondary" tnum>
                    {l.quantity}×{l.total ? ` · ${formatMoney(l.total)}` : ''}
                  </Text>
                  {l.variantId && !l.isGiftCard ? (
                    <Button
                      label="Voorraadteller instellen"
                      variant="link"
                      size="sm"
                      style={{ marginLeft: -space.md }}
                      onPress={() =>
                        router.push({
                          pathname: '/shop/stock/edit',
                          params: { title: l.title, variantId: l.variantId ?? '' },
                        })
                      }
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
          <Card gap={space.sm + 2}>
            <Row label="Subtotaal" value={o.subtotal} />
            <Row label="Verzending" value={o.shipping} />
            <Row label="Btw" value={o.tax} />
            <Divider />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="heading">Totaal</Text>
              <Text variant="heading" tnum>
                {formatMoney(o.total)}
              </Text>
            </View>
          </Card>
        </>
      ) : null}
    </SubScreen>
  );
}
