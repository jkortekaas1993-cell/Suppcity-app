import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { newId, useRepositories } from '@/lib/db';
import { BrandMark, Button, Card, elevation, ListRow, radius, SectionLabel, Sheen, Skyline, Text, useTheme } from '@/ui';

import { APPROVED_TIERS_FALLBACK, bestAffordableTier, nextTier } from './display';
import { useAdultConfirmation, usePoints, useRedeem } from './hooks';
import { PENDING_REDEMPTION_KEY, type PendingRedemption, type PendingRedemptionStore } from './redeemFlow';
import { ADULT_CONFIRM_TEXT, canAfford, formatEuroCents, ledgerLabel, POINTS_RULES_TEXT } from './service';

const dateNl = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

/** Points card height (mockup Ik.dc.html). */
const CARD_HEIGHT = 196;

/**
 * Points card for the Ik tab (mockup Ik.dc.html, design round 3): a dark premium card like
 * a bank card, with the logo, the balance in big condensed figures, the points still needed
 * for the next discount with a progress line, a faint skyline and a slow sheen.
 * "Inwisselen" opens the tiers and the history below the card. Signed-in users only.
 * UI only: the numbers come from usePoints and the server decides (hard rule 5).
 */
export function PointsPanel() {
  const { colors, space } = useTheme();
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
  const toNext = next
    ? `Nog ${next.missing.toLocaleString('nl-NL')} punten tot ${formatEuroCents(next.tier.value_cents)} korting`
    : best
      ? `= ${formatEuroCents(best.value_cents)} korting`
      : '';
  // Progress toward the next reward (full once the top tier is within reach).
  const progress = next ? Math.min(1, Math.max(0, points.balance / next.tier.points)) : best ? 1 : 0;

  return (
    <>
      <LinearGradient
        // ≈ linear-gradient(145deg, #1A1F22 0%, #0B0D0E 70%) from the mockup, in theme colours.
        colors={[colors.bg2, colors.bg0]}
        locations={[0, 0.7]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          minHeight: CARD_HEIGHT,
          borderRadius: radius.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          padding: space.lg + 2,
          justifyContent: 'space-between',
          gap: space.md,
          ...elevation.hero,
        }}
      >
        <Skyline opacity={0.22} style={{ position: 'absolute', left: 0, right: 0, bottom: -1, width: '100%' }} />
        <Sheen />
        {/* Hairline top highlight: the "lit from above" edge of the premium cards. */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 1, backgroundColor: colors.highlight }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
            <BrandMark size={28} />
            <Text variant="eyebrow" style={{ fontSize: 12, letterSpacing: 2 }} numberOfLines={1} accessibilityRole="header">
              Supp City punten
            </Text>
          </View>
          <Button
            label={open ? 'Sluiten' : 'Inwisselen'}
            variant="link"
            size="sm"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((o) => !o)}
            style={{ marginRight: -space.md }}
          />
        </View>

        <View style={{ gap: space.xxs }} accessible accessibilityLabel={`${balance} punten. ${toNext}`}>
          <Text variant="hero" style={{ fontSize: 52, lineHeight: 54 }}>
            {points.loading && points.balance === 0 ? '–' : balance}
          </Text>
          {toNext ? (
            <Text variant="caption" tone="secondary" tnum>
              {toNext}
            </Text>
          ) : null}
        </View>

        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Voortgang naar je volgende korting"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          style={{ height: 6, borderRadius: 3, backgroundColor: colors.bg3, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[colors.accentPressed, colors.accent]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ width: `${progress * 100}%`, height: 6, borderRadius: 3 }}
          />
        </View>
      </LinearGradient>

      {points.error || state.status === 'done' || state.status === 'error' ? (
        <Card>
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
      ) : null}

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
