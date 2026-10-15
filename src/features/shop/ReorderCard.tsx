import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Text, useTheme } from '@/ui';

import { reorderVariant } from './actions/reorder';
import { Notice } from './components/Notice';
import { itemsToRemind, localIsoDate, reorderPrompt } from './logic/stock';
import { stockStore, useStock } from './state/stockStore';

/**
 * Widget for the Vandaag tab: "Nog ~X dagen <product>. Opnieuw bestellen?"
 * Based only on what the user entered in the stock counter (hard rule 1).
 * Renders the most urgent item; a short invite when nothing is tracked yet.
 */
export function ReorderCard() {
  const { space } = useTheme();
  const { items, loaded } = useStock();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void stockStore.load();
  }, []);

  if (!loaded) return null;

  if (items.length === 0) {
    return (
      <Card eyebrow="Voorraad">
        <Text tone="muted">Voeg je potten toe en we laten weten wanneer je bijna door je voorraad heen bent.</Text>
        <Button label="Voorraad instellen" variant="secondary" onPress={() => router.push('/shop/stock')} />
      </Card>
    );
  }

  const due = itemsToRemind(items, localIsoDate(new Date()))[0];
  if (!due) return null;
  const { item, estimate } = due;

  return (
    <Card eyebrow="Voorraad" highlighted>
      <Text variant="heading">{reorderPrompt(item.productTitle, estimate)}</Text>
      {message ? <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {item.variantId ? (
          <Button
            label="Opnieuw bestellen"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const res = await reorderVariant(item.variantId as string);
              setBusy(false);
              if (res.ok) router.push('/shop/cart');
              else setMessage(res.message);
            }}
          />
        ) : (
          <Button label="Naar de shop" onPress={() => router.push('/shop')} />
        )}
        <Button
          label="Aanpassen"
          variant="ghost"
          onPress={() => router.push({ pathname: '/shop/stock/edit', params: { id: item.id } })}
        />
      </View>
    </Card>
  );
}
