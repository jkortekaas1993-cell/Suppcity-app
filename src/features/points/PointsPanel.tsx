import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { newId, useRepositories } from '@/lib/db';
import { Button, Card, ListRow, SectionLabel, Text, useTheme } from '@/ui';

import { APPROVED_TIERS_FALLBACK, bestAffordableTier, nextTier } from './display';
import { useAdultConfirmation, usePoints, useRedeem } from './hooks';
import { PENDING_REDEMPTION_KEY, type PendingRedemption, type PendingRedemptionStore } from './redeemFlow';
import { ADULT_CONFIRM_TEXT, canAfford, formatEuroCents, ledgerLabel, POINTS_RULES_TEXT } from './service';

const dateNl = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Points card for the Ik tab (mockup Mijlpalen.dc.html): balance in big condensed
 * figures, "= €x korting" and "Inwisselen" (the Ik tab's one accent action). Inwisselen
 * opens the tiers and the history below the card. Signed-in users only.
 */
export function PointsPanel() {
  const { space } = useTheme();
  const repos = useRepositories();
  const points = usePoints();
  // The idempotency key survives an app restart (local app_state, wiped on sign-out).
  const pendingStore = useMemo<PendingRedemptionStore>(
    () => ({
      get: () => repos.appState.get<PendingRedemption>(PENDING_REDEMPTION_KEY),
      set: (p) => repos.appState.set(PENDING_REDEMPTION_KEY, p),
      clear: () => repos.appState.remove(PENDING_REDEMPTION_KEY),
    }),
    [repos],
  );
  const { state, redeem } = useRedeem(newId, pendingStore, undefined, points.refresh);
  const adult = useAdultConfirmation(undefined, points.refresh);
  const [open, setOpen] = useState(false);

  if (adult.confirmed === false) {
    // One-time, calm 18+ step (hard rule 5). The server stores its own timestamp.
    return (
      <Card eyebrow="Punten">
        <Text>{ADULT_CONFIRM_TEXT}</Text>
        <Text variant="caption" tone="tertiary">
          {POINTS_RULES_TEXT} Je bevestigt dit één keer; trainen werkt altijd, ook zonder punten.
        </Text>
        {adult.error ? <Text tone="danger">{adult.error}</Text> : null}
        <Button variant="secondary" size="sm" label="Ik ben 18 jaar of ouder" loading={adult.busy} onPress={() => void adult.confirm()} />
      </Card>
    );
  }

  const tiers = points.tiers.length > 0 ? points.tiers : APPROVED_TIERS_FALLBACK;
  const best = bestAffordableTier(points.balance, tiers);
  const next = nextTier(points.balance, tiers);
  const balance = points.balance.toLocaleString('nl-NL');
  const worth = best
    ? `= ${formatEuroCents(best.value_cents)} korting`
    : next
      ? `nog ${next.missing.toLocaleString('nl-NL')} tot ${formatEuroCents(next.tier.value_cents)}`
      : '';

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flex: 1, gap: space.xxs }} accessible accessibilityLabel={`${balance} punten ${worth}`}>
            <Text variant="eyebrow" tone="secondary">
              Punten
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm - 2, flexWrap: 'wrap' }}>
              <Text variant="metric" style={{ fontSize: 34, lineHeight: 36 }}>
                {points.loading && points.balance === 0 ? '–' : balance}
              </Text>
              {worth ? (
                <Text variant="caption" tone="tertiary" tnum>
                  {worth}
                </Text>
              ) : null}
            </View>
          </View>
          <Button
            label={open ? 'Sluiten' : 'Inwisselen'}
            variant={open ? 'secondary' : 'primary'}
            size="sm"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((o) => !o)}
          />
        </View>
        {points.error ? (
          <Text variant="caption" tone="danger">
            {points.error}
          </Text>
        ) : null}
        {state.status === 'done' ? (
          <Card variant="inset" gap={space.xs}>
            <Text variant="eyebrow" tone="secondary">
              Je kortingscode
            </Text>
            <Text variant="heading" tnum selectable>
              {state.result.code}
            </Text>
            <Text variant="caption" tone="tertiary" tnum>
              {formatEuroCents(state.result.valueCents)} korting vanaf {formatEuroCents(state.result.minOrderCents)}, geldig tot{' '}
              {dateNl(state.result.expiresAt)}
            </Text>
          </Card>
        ) : null}
        {state.status === 'error' ? (
          <Text variant="caption" tone="danger">
            {state.message}
          </Text>
        ) : null}
      </Card>

      {open ? (
        <>
          <Card padding={0} gap={0}>
            {points.tiers.map((tier, i) => (
              <ListRow
                key={tier.id}
                title={`${formatEuroCents(tier.value_cents)} korting`}
                subtitle={`${tier.points.toLocaleString('nl-NL')} punten · bij een bestelling vanaf ${formatEuroCents(tier.min_order_cents)}`}
                divider={i < points.tiers.length - 1}
                trailing={
                  canAfford(points.balance, tier) ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      label="Wissel in"
                      accessibilityLabel={`Wissel ${tier.points} punten in voor ${formatEuroCents(tier.value_cents)} korting`}
                      loading={state.status === 'busy' && state.tierId === tier.id}
                      disabled={state.status === 'busy'}
                      onPress={() => void redeem(tier.id)}
                    />
                  ) : undefined
                }
              />
            ))}
          </Card>
          <Text variant="caption" tone="tertiary">
            {POINTS_RULES_TEXT}
          </Text>

          <SectionLabel label="Geschiedenis" />
          <Card padding={0} gap={0}>
            {points.history.length === 0 && !points.loading ? (
              <Text tone="tertiary" style={{ padding: space.lg }}>
                Nog geen punten.
              </Text>
            ) : null}
            {points.history.slice(0, 10).map((e, i, list) => (
              <ListRow
                key={e.id}
                title={ledgerLabel(e)}
                subtitle={dateNl(e.created_at)}
                value={`${e.points > 0 ? '+' : ''}${e.points.toLocaleString('nl-NL')}`}
                valueTone={e.points > 0 ? 'success' : 'secondary'}
                divider={i < list.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}
