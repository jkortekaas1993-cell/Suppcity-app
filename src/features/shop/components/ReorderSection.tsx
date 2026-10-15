import { router } from 'expo-router';
import { useState } from 'react';

import { getCustomerAccount, useCustomerSession, formatMoney } from '@/lib/shopify';
import { Button, Card, Text } from '@/ui';

import { reorder } from '../actions/reorder';
import { useAsync } from '../state/useAsync';
import { Notice } from './Notice';

const dateNl = (iso: string) =>
  new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

/** "Opnieuw bestellen" at the top of the Shop tab: only when signed in with past orders. */
export function ReorderSection() {
  const session = useCustomerSession();
  const signedIn = session === 'signedIn';
  const orders = useAsync(async () => (signedIn ? (await getCustomerAccount()).orders({ first: 1 }) : null), [signedIn]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const last = orders.data?.items[0];
  if (!signedIn || !last) return null;

  const itemSummary = last.lines
    .slice(0, 3)
    .map((l) => `${l.quantity}× ${l.title}`)
    .join(', ');

  return (
    <Card eyebrow="Opnieuw bestellen" highlighted>
      <Text variant="heading">
        {last.name} · {dateNl(last.processedAt)}
      </Text>
      <Text tone="muted">
        {itemSummary}
        {last.lines.length > 3 ? ` en ${last.lines.length - 3} meer` : ''} · {formatMoney(last.total)}
      </Text>
      {message ? <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} /> : null}
      <Button
        label="Zet in winkelwagen"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const res = await reorder(last);
          setBusy(false);
          if (res.ok) router.push('/shop/cart');
          else setMessage(res.message);
        }}
      />
    </Card>
  );
}
