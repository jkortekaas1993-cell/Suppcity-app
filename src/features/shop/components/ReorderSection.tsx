import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatMoney, getCustomerAccount, useCustomerSession } from '@/lib/shopify';
import { Button, Card, Text, useTheme } from '@/ui';

import { reorder } from '../actions/reorder';
import { productCount } from '../logic/format';
import { useAsync } from '../state/useAsync';
import { Notice } from './Notice';

/** "Opnieuw bestellen" at the top of the Shop tab: only when signed in with past orders. */
export function ReorderSection() {
  const { space } = useTheme();
  const session = useCustomerSession();
  const signedIn = session === 'signedIn';
  const orders = useAsync(async () => (signedIn ? (await getCustomerAccount()).orders({ first: 1 }) : null), [signedIn]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const last = orders.data?.items[0];
  if (!signedIn || !last) return null;

  const items = last.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Card padding={0} gap={0}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md + 2 }}>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text variant="eyebrow" tone="accent">
            Opnieuw bestellen
          </Text>
          <Text variant="bodyStrong">Je vorige bestelling · {productCount(items)}</Text>
          <Text variant="caption" tone="tertiary" tnum>
            {formatMoney(last.total)} · in 2 tikken klaar
          </Text>
        </View>
        <Button
          label="Bestel"
          size="sm"
          loading={busy}
          accessibilityHint="Zet je vorige bestelling in de winkelwagen"
          onPress={async () => {
            setBusy(true);
            const res = await reorder(last);
            setBusy(false);
            if (res.ok) router.push('/shop/cart');
            else setMessage(res.message);
          }}
        />
      </View>
      {message ? (
        <View style={{ padding: space.md, paddingTop: 0 }}>
          <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} />
        </View>
      ) : null}
    </Card>
  );
}
