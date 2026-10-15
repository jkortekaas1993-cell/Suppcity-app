import { router } from 'expo-router';

import { LoadState, SubScreen, useAsync } from '@/features/shop';
import { formatMoney, getCustomerAccount, orderStatusLabel } from '@/lib/shopify';
import { Card, ListItem, Text } from '@/ui';

const dateNl = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

export function OrdersScreen() {
  const orders = useAsync(async () => (await getCustomerAccount()).orders({ first: 50 }), []);
  const items = orders.data?.items ?? [];
  return (
    <SubScreen title="Mijn bestellingen">
      <LoadState loading={orders.loading} error={orders.error} onRetry={orders.reload} />
      {!orders.loading && !orders.error && items.length === 0 ? <Text tone="muted">Je hebt nog geen bestellingen.</Text> : null}
      {items.length > 0 ? (
        <Card style={{ padding: 0 }}>
          {items.map((o) => (
            <ListItem
              key={o.id}
              title={`${o.name} · ${dateNl(o.processedAt)}`}
              subtitle={orderStatusLabel(o)}
              value={formatMoney(o.total)}
              onPress={() => router.push({ pathname: '/account/orders/[id]', params: { id: o.id } })}
            />
          ))}
        </Card>
      ) : null}
    </SubScreen>
  );
}
