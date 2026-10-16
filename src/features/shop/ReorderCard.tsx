import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Icon, radius, Text, useTheme } from '@/ui';

import { reorderVariant } from './actions/reorder';
import { Notice } from './components/Notice';
import { itemsToRemind, localIsoDate } from './logic/stock';
import { stockStore, useStock } from './state/stockStore';

/**
 * Smart card for the Vandaag tab (mockup Main.dc.html, bottom card): icon tile,
 * "<product> bijna op", "Nog ~5 dagen", link "Bestel". Based only on what the user
 * entered in the stock counter (hard rule 1). Renders the most urgent item; a short
 * invite when nothing is tracked yet; nothing when no item is due.
 */
export function ReorderCard() {
  const { colors, space } = useTheme();
  const { items, loaded } = useStock();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void stockStore.load();
  }, []);

  if (!loaded) return null;

  const row = (title: string, meta: string, action: { label: string; hint: string; onPress: () => void }) => (
    <Card padding={0} gap={0}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingLeft: space.md + 2, paddingRight: space.xs }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.control,
            backgroundColor: colors.bg2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="pill" size={20} color={colors.text2} />
        </View>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="caption" tone="tertiary" tnum>
            {meta}
          </Text>
        </View>
        <Button label={action.label} variant="link" size="sm" loading={busy} accessibilityHint={action.hint} onPress={action.onPress} />
      </View>
      {message ? (
        <View style={{ padding: space.md, paddingTop: 0 }}>
          <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} />
        </View>
      ) : null}
    </Card>
  );

  if (items.length === 0) {
    return row('Houd je voorraad bij', 'We laten weten wanneer je pot bijna leeg is', {
      label: 'Instellen',
      hint: 'Opent de voorraadteller',
      onPress: () => router.push('/shop/stock'),
    });
  }

  const due = itemsToRemind(items, localIsoDate(new Date()))[0];
  if (!due) return null;
  const { item, estimate } = due;
  const title = estimate.isEmpty ? `${item.productTitle} is op` : `${item.productTitle} bijna op`;
  const meta = estimate.isEmpty
    ? 'Waarschijnlijk op'
    : `Nog ~${estimate.daysLeft} ${estimate.daysLeft === 1 ? 'dag' : 'dagen'}`;

  return row(title, meta, {
    label: 'Bestel',
    hint: item.variantId ? `Zet ${item.productTitle} in je winkelwagen` : 'Opent de shop',
    onPress: async () => {
      if (!item.variantId) {
        router.push('/shop');
        return;
      }
      setBusy(true);
      const res = await reorderVariant(item.variantId);
      setBusy(false);
      if (res.ok) router.push('/shop/cart');
      else setMessage(res.message);
    },
  });
}
