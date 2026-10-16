import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { formatMoney, type ProductSummary } from '@/lib/shopify';
import { Glow, haptics, motion, Pill, PressableScale, radius, Text, useTheme } from '@/ui';

import { cartStore } from '../state/cartStore';
import { AddButton } from './AddButton';
import { ProductImage } from './ProductImage';

const openProduct = (handle: string) => router.push({ pathname: '/shop/product/[handle]', params: { handle } });

/** How far the packshot lifts while the tile is pressed (mockup note m_shop). */
const LIFT = 4;

/**
 * Grid tile (mockup Shop.dc.html): packshot on a softly lit well, brand eyebrow, name,
 * price (tabular) and the accent "+". The "+" adds the product straight to the cart when it
 * has a single variant in stock (it then turns into a check); otherwise it opens the product
 * so the user can pick a flavour.
 */
export function ProductTile({ product, bestseller = false }: { product: ProductSummary; bestseller?: boolean }) {
  const { colors, space } = useTheme();
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  const price = formatMoney(product.priceFrom);

  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.get() }] }));

  async function add(): Promise<boolean> {
    if (!product.quickAddVariantId) {
      openProduct(product.handle);
      return false;
    }
    const ok = await cartStore.add([{ variantId: product.quickAddVariantId, quantity: 1 }]);
    if (ok) haptics.success();
    return ok;
  }

  return (
    <View style={{ flex: 1, gap: space.sm }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[product.vendor, product.title, product.available ? price : 'uitverkocht'].filter(Boolean).join(', ')}
        haptic={false}
        onPress={() => openProduct(product.handle)}
        onPressIn={() => {
          if (!reduceMotion) lift.set(withTiming(LIFT, { duration: motion.base }));
        }}
        onPressOut={() => {
          lift.set(withTiming(0, { duration: motion.slow }));
        }}
        style={{ gap: space.xs + 2 }}
      >
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.bg1,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* ≈ radial-gradient(70% 70% at 50% 40%, teal-tinted centre → bg1) from the mockup. */}
          <Glow intensity={0.1} style={{ position: 'absolute', left: '-20%', right: '-20%', top: '-30%', height: '140%' }} />
          {/* Hairline top highlight (colors.highlight). */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 1, backgroundColor: colors.highlight }}
          />
          <Animated.View
            style={[
              // No shadow here: an alpha-following shadow on every grid tile renders offscreen on iOS.
              { width: '84%' },
              liftStyle,
            ]}
          >
            <ProductImageSlot product={product} />
          </Animated.View>
          {bestseller || !product.available ? (
            <View style={{ position: 'absolute', top: space.sm + 2, left: space.sm + 2 }}>
              {product.available ? <Pill label="Bestseller" tone="accent" /> : <Pill label="Uitverkocht" tone="neutral" />}
            </View>
          ) : null}
        </View>
        {product.vendor ? (
          <Text variant="eyebrow" tone="tertiary" numberOfLines={1} style={{ letterSpacing: 1.4 }}>
            {product.vendor}
          </Text>
        ) : null}
        <Text variant="bodyStrong" numberOfLines={2} style={{ lineHeight: 19 }}>
          {product.title}
        </Text>
      </PressableScale>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <Text variant="bodyStrong" tnum style={{ fontSize: 16 }}>
          {price}
        </Text>
        {product.available ? (
          <AddButton
            accessibilityLabel={
              product.quickAddVariantId ? `${product.title} toevoegen aan winkelwagen` : `${product.title}: kies een variant`
            }
            onAdd={add}
          />
        ) : null}
      </View>
    </View>
  );
}

// Split out so the image re-mounts per product (its load state is per URL).
function ProductImageSlot({ product }: { product: ProductSummary }) {
  return <ProductImage key={product.image?.url ?? product.id} image={product.image} bordered={false} transparent />;
}
