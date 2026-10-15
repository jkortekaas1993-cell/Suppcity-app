import { View } from 'react-native';

import { newId } from '@/lib/db';
import { Button, Card, ListItem, Text, useTheme } from '@/ui';

import { usePoints, useRedeem } from './hooks';
import { canAfford, formatEuroCents, ledgerLabel, POINTS_RULES_TEXT } from './service';

/**
 * Minimal points section for the Ik tab (signed-in users only): balance, redeem
 * tiers and recent history. Secondary buttons only: the Ik tab owns its accent action.
 */
export function PointsPanel() {
  const { space } = useTheme();
  const points = usePoints();
  const { state, redeem } = useRedeem(newId, undefined, points.refresh);

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
