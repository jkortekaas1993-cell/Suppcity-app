import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Icon, PressableScale, radius, Text, useTheme } from '@/ui';

import { reorderVariant } from './actions/reorder';
import { Notice } from './components/Notice';
import { pickMostUrgent, type ExternalReorderSignal } from './logic/reorderPick';
import { itemsToRemind, localIsoDate } from './logic/stock';
import { stockStore, useStock } from './state/stockStore';

export interface ReorderCardProps {
  /**
   * Extra "running low" signals from outside the shop (the supplement schedule), wired by
   * the route file. Hard rule 1: only variant, name and days left; never intake data.
   */
  loadExternalSignals?: () => Promise<ExternalReorderSignal[]>;
  /** Where an external signal's details live (default: the supplement schedule). */
  externalHref?: Href;
}

/**
 * Smart card for the Vandaag tab (mockup Main.dc.html, bottom card): icon tile,
 * "<product> bijna op", "Nog ~5 dagen", link "Bestel". Based only on what the user
 * entered in the stock counter or the supplement schedule (hard rule 1). Renders the most
 * urgent item over both sources (one per variant); a short invite when nothing is tracked
 * and there is no external source; nothing when no item is due.
 */
export function ReorderCard({ loadExternalSignals, externalHref = '/supplements' }: ReorderCardProps = {}) {
  const { colors, space } = useTheme();
  const { items, loaded } = useStock();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [external, setExternal] = useState<ExternalReorderSignal[] | null>(loadExternalSignals ? null : []);

  useEffect(() => {
    void stockStore.load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loadExternalSignals) return;
      let active = true;
      loadExternalSignals()
        .catch(() => [])
        .then((signals) => {
          if (active) setExternal(signals);
        });
      return () => {
        active = false;
      };
    }, [loadExternalSignals]),
  );

  if (!loaded || external === null) return null;

  const row = (
    title: string,
    meta: string,
    action: { label: string; hint: string; onPress: () => void },
    details?: { href: Href; label: string },
  ) => (
    <Card padding={0} gap={0}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingLeft: space.md + 2, paddingRight: space.xs }}>
        <PressableScale
          disabled={!details}
          haptic="selection"
          onPress={details ? () => router.push(details.href) : undefined}
          accessibilityRole={details ? 'button' : undefined}
          accessibilityLabel={details ? `${title}. ${meta}` : undefined}
          accessibilityHint={details?.label}
          containerStyle={{ flex: 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 }}
        >
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
        </PressableScale>
        <Button label={action.label} variant="link" size="sm" loading={busy} accessibilityHint={action.hint} onPress={action.onPress} />
      </View>
      {message ? (
        <View style={{ padding: space.md, paddingTop: 0 }}>
          <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} />
        </View>
      ) : null}
    </Card>
  );

  if (items.length === 0 && !loadExternalSignals) {
    return row('Houd je voorraad bij', 'We laten weten wanneer je pot bijna leeg is', {
      label: 'Instellen',
      hint: 'Opent de voorraadteller',
      onPress: () => router.push('/shop/stock'),
    });
  }

  const pick = pickMostUrgent(itemsToRemind(items, localIsoDate(new Date())), external);
  if (!pick) return null;

  const order = async (variantId: string | null) => {
    if (!variantId) {
      router.push('/shop');
      return;
    }
    setBusy(true);
    const res = await reorderVariant(variantId);
    setBusy(false);
    if (res.ok) router.push('/shop/cart');
    else setMessage(res.message);
  };
  const daysText = (days: number) => `Nog ~${days} ${days === 1 ? 'dag' : 'dagen'}`;

  if (pick.source === 'external') {
    const { signal } = pick;
    const empty = signal.daysLeft <= 0;
    return row(
      empty ? `${signal.productTitle} is op` : `${signal.productTitle} bijna op`,
      empty ? 'Waarschijnlijk op' : daysText(signal.daysLeft),
      { label: 'Bestel', hint: `Zet ${signal.productTitle} in je winkelwagen`, onPress: () => void order(signal.variantGid) },
      { href: externalHref, label: 'Opent je supplementen' },
    );
  }

  const { item, estimate } = pick;
  return row(
    estimate.isEmpty ? `${item.productTitle} is op` : `${item.productTitle} bijna op`,
    estimate.isEmpty ? 'Waarschijnlijk op' : daysText(estimate.daysLeft),
    {
      label: 'Bestel',
      hint: item.variantId ? `Zet ${item.productTitle} in je winkelwagen` : 'Opent de shop',
      onPress: () => void order(item.variantId),
    },
    { href: '/shop/stock', label: 'Opent de voorraadteller' },
  );
}
