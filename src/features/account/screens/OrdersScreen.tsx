import { router } from 'expo-router';

import { formatDateNl, LoadState, SubScreen, useAsync } from '@/features/shop';
import { formatMoney, getCustomerAccount, orderStatusLabel } from '@/lib/shopify';
import { Card, EmptyState, ListRow } from '@/ui';

export function OrdersScreen() {
  const orders = useAsync(async () => (await getCustomerAccount()).orders({ first: 50 }), []);
  const items = orders.data?.items ?? [];
  return (
    <SubScreen title="Bestellingen" fallback="/ik">
      <LoadState loading={orders.loading} error={orders.error} onRetry={orders.reload} />
      {!orders.loading && !orders.error && items.length === 0 ? (
        <EmptyState
          icon="bag"
          title="Nog geen bestellingen"
          body="Bestellingen uit de app en van suppcity.nl komen hier samen."
          action={{ label: 'Naar de shop', onPress: () => router.replace('/shop') }}
        />
      ) : null}
      {items.length > 0 ? (
        <Card padding={0} gap={0}>
          {items.map((o, i) => (
            <ListRow
              key={o.id}
              title={`Bestelling ${o.name}`}
              subtitle={`${formatDateNl(o.processedAt, 'short')} · ${orderStatusLabel(o)}`}
              value={formatMoney(o.total)}
              divider={i < items.length - 1}
              onPress={() => router.push({ pathname: '/account/orders/[id]', params: { id: o.id } })}
            />
          ))}
        </Card>
      ) : null}
    </SubScreen>
  );
}
