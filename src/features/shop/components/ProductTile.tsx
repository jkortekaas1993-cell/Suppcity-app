import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { formatMoney, type ProductSummary } from '@/lib/shopify';
import { haptics, IconButton, Pill, PressableScale, Text, useTheme } from '@/ui';

import { cartStore } from '../state/cartStore';
import { ProductImage } from './ProductImage';

const openProduct = (handle: string) => router.push({ pathname: '/shop/product/[handle]', params: { handle } });

/**
 * Grid tile: packshot, brand eyebrow, name, price (tabular) and "+". The "+" adds the
 * product straight to the cart when it has a single variant in stock; otherwise it opens
 * the product so the user can pick a flavour.
 */
export function ProductTile({ product, bestseller = false }: { product: ProductSummary; bestseller?: boolean }) {
  const { colors, space } = useTheme();
  const [adding, setAdding] = useState(false);
  const price = formatMoney(product.priceFrom);

  async function add() {
    if (!product.quickAddVariantId) {
      openProduct(product.handle);
      return;
    }
    setAdding(true);
    const ok = await cartStore.add([{ variantId: product.quickAddVariantId, quantity: 1 }]);
    setAdding(false);
    if (ok) haptics.success();
  }

  return (
    <View style={{ flex: 1, gap: space.sm }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[product.vendor, product.title, product.available ? price : 'uitverkocht'].filter(Boolean).join(', ')}
        haptic={false}
        onPress={() => openProduct(product.handle)}
        style={{ gap: space.sm }}
      >
        <View>
          <ProductImageSlot product={product} />
          {bestseller || !product.available ? (
            <View style={{ position: 'absolute', top: space.sm, left: space.sm }}>
              {product.available ? <Pill label="Bestseller" tone="accent" /> : <Pill label="Uitverkocht" tone="neutral" />}
            </View>
          ) : null}
        </View>
        {product.vendor ? (
          <Text variant="eyebrow" tone="tertiary" numberOfLines={1} style={{ letterSpacing: 1.4 }}>
            {product.vendor}
          </Text>
        ) : null}
        <Text variant="bodyStrong" numberOfLines={2}>
          {product.title}
        </Text>
      </PressableScale>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <Text variant="bodyStrong" tnum style={{ fontSize: 16 }}>
          {price}
        </Text>
        {product.available ? (
          <IconButton
            icon="plus"
            variant="filled"
            size={36}
            iconSize={20}
            color={colors.accentText}
            disabled={adding}
            haptic="light"
            accessibilityLabel={
              product.quickAddVariantId ? `${product.title} toevoegen aan winkelwagen` : `${product.title}: kies een variant`
            }
            onPress={() => void add()}
          />
        ) : null}
      </View>
    </View>
  );
}

// Split out so the image re-mounts per product (its load state is per URL).
function ProductImageSlot({ product }: { product: ProductSummary }) {
  return <ProductImage key={product.image?.url ?? product.id} image={product.image} />;
}
