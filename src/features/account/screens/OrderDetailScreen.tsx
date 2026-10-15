import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LoadState, Notice, ProductThumb, reorder, SubScreen, useAsync } from '@/features/shop';
import { formatMoney, getCustomerAccount, orderStatusLabel, type Money } from '@/lib/shopify';
import { Button, Card, Text, useTheme } from '@/ui';

function Row({ label, value }: { label: string; value: Money | null }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text tone="muted">{label}</Text>
      <Text style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(value)}</Text>
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
      subtitle={o ? `${new Date(o.processedAt).toLocaleDateString('nl-NL', { dateStyle: 'long' })} · ${orderStatusLabel(o)}` : undefined}
      footer={
        o ? (
          <>
            {message ? <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} /> : null}
            <Button
              label="Opnieuw bestellen"
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
      {!order.loading && !order.error && !o ? <Text tone="muted">Deze bestelling is niet gevonden.</Text> : null}
      {o ? (
        <>
          <Card style={{ padding: 0 }}>
            {o.lines.map((l) => (
              <View
                key={l.id}
                style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <ProductThumb image={l.image} />
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text variant="heading">{l.title}</Text>
                  {l.variantTitle ? <Text tone="muted">{l.variantTitle}</Text> : null}
                  <Text tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                    {l.quantity}× {l.total ? `· ${formatMoney(l.total)}` : ''}
                  </Text>
                  {l.variantId && !l.isGiftCard ? (
                    <Button
                      label="Voorraadteller instellen"
                      variant="ghost"
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
          <Card>
            <Row label="Subtotaal" value={o.subtotal} />
            <Row label="Verzending" value={o.shipping} />
            <Row label="Btw" value={o.tax} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="heading">Totaal</Text>
              <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
                {formatMoney(o.total)}
              </Text>
            </View>
          </Card>
        </>
      ) : null}
    </SubScreen>
  );
}
