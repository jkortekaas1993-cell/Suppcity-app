import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { formatMoney, getCustomerAccount, useCustomerSession, type ShopImage } from '@/lib/shopify';
import { Appear, Card, elevation, HIT_SLOP_MIN, PressableScale, radius, Text, useTheme } from '@/ui';

import { reorder } from '../actions/reorder';
import { productCount } from '../logic/format';
import { useAsync } from '../state/useAsync';
import { Notice } from './Notice';
import { ProductImage } from './ProductImage';

/** Packshot size on the banner (mockup: 160 px, bleeding off the right and bottom edge). */
const SHOT = 150;
/** Visual height of the dark pill; the touch area is 48 via hitSlop. */
const PILL_H = 34;

/**
 * "Opnieuw bestellen" banner at the top of the Shop tab (mockup Shop.dc.html): the Supp City
 * brand card with the logo skyline, dark text, a dark pill "In 2 tikken klaar →" (the screen's
 * one accent action) and the last order's packshot floating on the right.
 * Only when signed in with past orders.
 */
export function ReorderSection() {
  const { colors, space } = useTheme();
  const session = useCustomerSession();
  const signedIn = session === 'signedIn';
  const orders = useAsync(async () => (signedIn ? (await getCustomerAccount()).orders({ first: 1 }) : null), [signedIn]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const last = orders.data?.items[0];
  if (!signedIn || !last) return null;

  const items = last.lines.reduce((n, l) => n + l.quantity, 0);
  const image = last.lines.find((l) => l.image !== null)?.image ?? null;

  async function onReorder() {
    if (!last) return;
    setBusy(true);
    const res = await reorder(last);
    setBusy(false);
    if (res.ok) router.push('/shop/cart');
    else setMessage(res.message);
  }

  const slop = (HIT_SLOP_MIN - PILL_H) / 2;

  return (
    <Appear index={0} style={{ gap: space.md }}>
      <Card variant="brand" skyline eyebrow="Opnieuw bestellen" padding={space.lg + 2} gap={space.xs} style={{ minHeight: 150 }}>
        {image ? <FloatingShot image={image} /> : null}
        <View style={{ maxWidth: image ? 200 : undefined, gap: space.xs }}>
          <Text variant="title" style={{ color: colors.onAccent, fontSize: 26, lineHeight: 26 }} accessibilityRole="header">
            Je vorige bestelling
          </Text>
          <Text variant="caption" tnum style={{ color: colors.onAccent }}>
            {productCount(items)} · {formatMoney(last.total)}
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="In 2 tikken klaar"
          accessibilityHint="Zet je vorige bestelling in de winkelwagen"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          hitSlop={slop}
          onPress={() => void onReorder()}
          containerStyle={{ alignSelf: 'flex-start', marginTop: space.xs + 2 }}
          style={({ pressed }) => ({
            height: PILL_H,
            minWidth: 150,
            paddingHorizontal: space.md + 2,
            borderRadius: radius.pill,
            backgroundColor: colors.onAccent,
            opacity: pressed ? 0.85 : 1,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.text1} />
          ) : (
            <Text variant="button" style={{ color: colors.text1, fontSize: 13 }} numberOfLines={1}>
              In 2 tikken klaar →
            </Text>
          )}
        </PressableScale>
      </Card>
      {message ? <Notice message={message} tone="danger" onDismiss={() => setMessage(null)} /> : null}
    </Appear>
  );
}

/**
 * The last order's packshot on the right of the banner, floating slowly up and down
 * (4 px, 3 s period). Still with reduce motion. Decorative: the banner text says it all.
 */
function FloatingShot({ image }: { image: ShopImage }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.set(0);
      return;
    }
    t.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * t.get() }] }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: 'absolute',
          right: -6,
          bottom: -14,
          width: SHOT,
          height: SHOT,
          // iOS: drop shadow under the packshot (follows its alpha). No Android box elevation.
          ...elevation.hero,
          elevation: 0,
        },
        float,
      ]}
    >
      <ProductImage image={{ ...image, alt: '' }} size={SHOT} bordered={false} transparent />
    </Animated.View>
  );
}
