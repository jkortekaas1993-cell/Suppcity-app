import { useMemo } from 'react';
import { View } from 'react-native';

import { newId, useRepositories } from '@/lib/db';
import { Button, Card, ListItem, Text, useTheme } from '@/ui';

import { useAdultConfirmation, usePoints, useRedeem } from './hooks';
import { PENDING_REDEMPTION_KEY, type PendingRedemption, type PendingRedemptionStore } from './redeemFlow';
import { ADULT_CONFIRM_TEXT, canAfford, formatEuroCents, ledgerLabel, POINTS_RULES_TEXT } from './service';

/**
 * Minimal points section for the Ik tab (signed-in users only): balance, redeem
 * tiers and recent history. Secondary buttons only: the Ik tab owns its accent action.
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

  if (adult.confirmed === false) {
    // One-time, calm 18+ step (hard rule 5). The server stores its own timestamp.
    return (
      <Card eyebrow="Punten">
        <Text>{ADULT_CONFIRM_TEXT}</Text>
        <Text variant="caption" tone="muted">
          {POINTS_RULES_TEXT} Je bevestigt dit één keer; trainen werkt altijd, ook zonder punten.
        </Text>
        {adult.error ? <Text tone="danger">{adult.error}</Text> : null}
        <Button variant="secondary" label="Ik ben 18 jaar of ouder" loading={adult.busy} onPress={() => void adult.confirm()} />
      </Card>
    );
  }

  return (
    <>
      <Card eyebrow="Punten">
        <Text variant="metric" style={{ fontVariant: ['tabular-nums'] }}>
          {points.balance}
        </Text>
        <Text variant="caption" tone="muted">
          {POINTS_RULES_TEXT}
        </Text>
        {points.error ? <Text tone="danger">{points.error}</Text> : null}
        {state.status === 'done' ? (
          <Text>
            Je kortingscode: <Text variant="heading">{state.result.code}</Text> (
            {formatEuroCents(state.result.valueCents)} korting vanaf {formatEuroCents(state.result.minOrderCents)}, geldig
            tot {new Date(state.result.expiresAt).toLocaleDateString('nl-NL')})
          </Text>
        ) : null}
        {state.status === 'error' ? <Text tone="danger">{state.message}</Text> : null}
      </Card>

      <Card eyebrow="Inwisselen" style={{ padding: 0 }}>
        {points.tiers.map((tier) => (
          <View key={tier.id}>
            <ListItem
              title={`${formatEuroCents(tier.value_cents)} korting`}
              subtitle={`Bij een bestelling vanaf ${formatEuroCents(tier.min_order_cents)}`}
              value={`${tier.points} pt`}
            />
            {canAfford(points.balance, tier) ? (
              <View style={{ padding: space.md }}>
                <Button
                  variant="secondary"
                  label={`Wissel ${tier.points} punten in`}
                  loading={state.status === 'busy' && state.tierId === tier.id}
                  disabled={state.status === 'busy'}
                  onPress={() => void redeem(tier.id)}
                />
              </View>
            ) : null}
          </View>
        ))}
      </Card>

      <Card eyebrow="Geschiedenis" style={{ padding: 0 }}>
        {points.history.length === 0 && !points.loading ? (
          <Text tone="muted" style={{ padding: space.lg }}>
            Nog geen punten.
          </Text>
        ) : null}
        {points.history.slice(0, 10).map((e) => (
          <ListItem
            key={e.id}
            title={ledgerLabel(e)}
            subtitle={new Date(e.created_at).toLocaleDateString('nl-NL')}
            value={`${e.points > 0 ? '+' : ''}${e.points}`}
          />
        ))}
      </Card>
    </>
  );
}
