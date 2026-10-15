import { router } from 'expo-router';
import { useEffect } from 'react';

import { Button, Card, ListItem, Text } from '@/ui';

import { SubScreen } from '../components/SubScreen';
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
      title="Mijn voorraad"
      subtitle="Vul zelf in hoeveel je gebruikt. We schatten wanneer het op is, alleen op basis van wat jij hier invult."
      footer={<Button label="Product toevoegen" fullWidth onPress={() => router.push('/shop/stock/edit')} />}
    >
      {rows.length === 0 ? (
        <Text tone="muted">Nog niets toegevoegd. Voeg je pot creatine of whey toe en we laten weten wanneer hij bijna leeg is.</Text>
      ) : (
        <Card style={{ padding: 0 }}>
          {rows.map(({ item, est }) => (
            <ListItem
              key={item.id}
              title={item.productTitle}
              subtitle={est.isEmpty ? 'Waarschijnlijk op' : `Op rond ${new Date(est.runsOutOn).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}`}
              value={`~${est.daysLeft} d`}
              onPress={() => router.push({ pathname: '/shop/stock/edit', params: { id: item.id } })}
            />
          ))}
        </Card>
      )}
    </SubScreen>
  );
}
