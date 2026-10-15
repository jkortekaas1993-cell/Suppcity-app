import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, useWindowDimensions, View } from 'react-native';

import { formatMoney, getStorefront } from '@/lib/shopify';
import { Button, Card, ListItem, Text, useTheme } from '@/ui';

import { Chip } from '../components/Chip';
import { LoadState } from '../components/LoadState';
import { Notice } from '../components/Notice';
import { Stepper } from '../components/Stepper';
import { SubScreen } from '../components/SubScreen';
import { approvedClaimsFor } from '../logic/claims';
import { productFacts, productPageUrl } from '../logic/productInfo';
import { cartStore, useCart } from '../state/cartStore';
import { useAsync } from '../state/useAsync';

export function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { space, radius, colors } = useTheme();
  const { width } = useWindowDimensions();
  const product = useAsync(() => getStorefront().product(String(handle)), [handle]);
  const { busy, error } = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const p = product.data;
  useEffect(() => {
    if (p && !variantId) setVariantId((p.variants.find((v) => v.available) ?? p.variants[0])?.id ?? null);
  }, [p, variantId]);

  const variant = p?.variants.find((v) => v.id === variantId) ?? null;
  // Hard rule 4: only approved, verbatim claim sentences.
  const claims = p ? approvedClaimsFor(p.claimIds) : [];
  // C1: the free-text Shopify description is never shown in the app (may hold
  // unapproved claims). Only name, variant, price, contents and approved claims.
  const facts = p ? productFacts(p, variant) : [];
  const images = variant?.image ? [variant.image, ...(p?.images ?? []).filter((i) => i.url !== variant.image?.url)] : (p?.images ?? []);

  const footer = p ? (
    <>
      {added ? (
        <Notice
          message="Toegevoegd aan je winkelwagen."
          action={{ label: 'Naar winkelwagen', onPress: () => router.push('/shop/cart') }}
          onDismiss={() => setAdded(false)}
        />
      ) : null}
      {error ? <Notice message={error} tone="danger" onDismiss={cartStore.dismissMessages} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Stepper label={`Aantal ${p.title}`} value={quantity} min={1} onChange={setQuantity} />
        <View style={{ flex: 1 }}>
          <Button
            label={variant?.available ? 'In winkelwagen' : 'Uitverkocht'}
            fullWidth
            loading={busy}
            disabled={!variant?.available}
            onPress={async () => {
              if (!variant) return;
              const ok = await cartStore.add([{ variantId: variant.id, quantity }]);
              setAdded(ok);
            }}
          />
        </View>
      </View>
    </>
  ) : undefined;

  return (
    <SubScreen title={p?.title ?? 'Product'} footer={footer}>
      <LoadState loading={product.loading} error={product.error} onRetry={product.reload} />
      {!product.loading && !product.error && !p ? <Text tone="muted">Dit product is niet meer beschikbaar.</Text> : null}
      {p ? (
        <>
          {images.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {images.map((img) => (
                <Image
                  key={img.url}
                  source={{ uri: img.url }}
                  accessibilityLabel={img.alt}
                  resizeMode="contain"
                  style={{
                    width: width - space.lg * 2,
                    height: width - space.lg * 2,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceRaised,
                  }}
                />
              ))}
            </ScrollView>
          ) : null}

          {variant ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <Text variant="metric">{formatMoney(variant.price)}</Text>
              {variant.compareAtPrice && variant.compareAtPrice.cents > variant.price.cents ? (
                <Text tone="muted" style={{ textDecorationLine: 'line-through' }}>
                  {formatMoney(variant.compareAtPrice)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!p.hasOnlyDefaultVariant && p.variants.length > 0 ? (
            <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
              <Text variant="label" tone="muted">
                Kies variant
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {p.variants.map((v) => (
                  <Chip
                    key={v.id}
                    label={v.available ? v.title : `${v.title} · uitverkocht`}
                    selected={v.id === variantId}
                    onPress={() => setVariantId(v.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {claims.length > 0 ? (
            <Card eyebrow="Goed om te weten">
              {claims.map((c) => (
                <Text key={c}>{c}</Text>
              ))}
            </Card>
          ) : null}

          {facts.length > 0 ? (
            <Card style={{ padding: 0 }}>
              {facts.map((f) => (
                <ListItem key={f.label} title={f.label} value={f.value} />
              ))}
            </Card>
          ) : null}

          <Text
            tone="muted"
            accessibilityRole="link"
            accessibilityHint="Opent suppcity.nl in je browser"
            style={{ paddingVertical: space.md }}
            onPress={() => void Linking.openURL(productPageUrl(p)).catch(() => undefined)}
          >
            Volledige productinformatie op suppcity.nl ›
          </Text>
          {p.vendor ? (
            <Text variant="caption" tone="muted">
              Merk: {p.vendor}
            </Text>
          ) : null}
        </>
      ) : null}
    </SubScreen>
  );
}
