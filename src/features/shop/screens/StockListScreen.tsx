import { router } from 'expo-router';
import { useEffect } from 'react';

import { Button, Card, EmptyState, ListRow } from '@/ui';

import { SubScreen } from '../components/SubScreen';
import { formatDateNl } from '../logic/format';
import { estimateStock, localIsoDate } from '../logic/stock';
import { stockStore, useStock } from '../state/stockStore';

/** Overview of the user's supplements and estimated days left. */
export function StockListScreen() {
  const { items } = useStock();
  useEffect(() => {
    void stockStore.load();
  }, []);
  const today = localIsoDate(new Date());
  const rows = items
    .map((item) => ({ item, est: estimateStock(item, today) }))
    .sort((a, b) => a.est.daysLeft - b.est.daysLeft);

  return (
    <SubScreen
      title="Voorraadteller"
      subtitle="Vul zelf in hoeveel je gebruikt. We schatten wanneer het op is, alleen op basis van wat jij hier invult."
      footer={<Button label="Product toevoegen" icon="plus" size="lg" fullWidth onPress={() => router.push('/shop/stock/edit')} />}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="pill"
          title="Nog niets toegevoegd"
          body="Voeg je pot creatine of whey toe en we laten weten wanneer hij bijna leeg is."
        />
      ) : (
        <Card padding={0} gap={0}>
          {rows.map(({ item, est }, i) => (
            <ListRow
              key={item.id}
              title={item.productTitle}
              subtitle={est.isEmpty ? 'Waarschijnlijk op' : `Op rond ${formatDateNl(est.runsOutOn, 'dayMonth')}`}
              value={est.isEmpty ? 'Op' : `~${est.daysLeft} ${est.daysLeft === 1 ? 'dag' : 'dagen'}`}
              valueTone={est.shouldRemind ? 'gold' : 'secondary'}
              divider={i < rows.length - 1}
              onPress={() => router.push({ pathname: '/shop/stock/edit', params: { id: item.id } })}
            />
          ))}
        </Card>
      )}
    </SubScreen>
  );
}
