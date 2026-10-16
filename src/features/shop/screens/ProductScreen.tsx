import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, useWindowDimensions, View } from 'react-native';

import { formatMoney, getStorefront } from '@/lib/shopify';
import { Button, Card, layout, ListRow, Pill, SectionLabel, Text, useTheme } from '@/ui';

import { LoadState } from '../components/LoadState';
import { Notice } from '../components/Notice';
import { OptionChip } from '../components/OptionChip';
import { ProductImage } from '../components/ProductImage';
import { Stepper } from '../components/Stepper';
import { SubScreen } from '../components/SubScreen';
import { approvedClaimsFor } from '../logic/claims';
import { productFacts, productPageUrl } from '../logic/productInfo';
import { defaultVariantId, isSoldOut, sellableVariants, variantGroupLabel } from '../logic/variants';
import { cartStore, useCart } from '../state/cartStore';
import { useAsync } from '../state/useAsync';

export function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const product = useAsync(() => getStorefront().product(String(handle)), [handle]);
  const { busy, error } = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const p = product.data;
  useEffect(() => {
    if (p && !variantId) setVariantId(defaultVariantId(p));
  }, [p, variantId]);

  // Sold-out flavours are hidden (owner's choice); "Uitverkocht" only when everything is.
  const options = p ? sellableVariants(p) : [];
  const soldOut = p ? isSoldOut(p) : false;
  const variant = options.find((v) => v.id === variantId) ?? null;
  const shown = variant ?? p?.variants[0] ?? null;
  // Hard rule 4: only approved, verbatim claim sentences.
  const claims = p ? approvedClaimsFor(p.claimIds) : [];
  // ADR-13 / C1: the free-text Shopify description is never shown in the app (may hold
  // unapproved claims). Only name, variant, price, contents and approved claims.
  const facts = p ? productFacts(p, shown) : [];
  const images = shown?.image ? [shown.image, ...(p?.images ?? []).filter((i) => i.url !== shown.image?.url)] : (p?.images ?? []);
  const imageSize = width - layout.screenPadding * 2;

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
        {!soldOut ? <Stepper label={`Aantal ${p.title}`} value={quantity} min={1} onChange={setQuantity} /> : null}
        <View style={{ flex: 1 }}>
          <Button
            label={soldOut ? 'Uitverkocht' : 'In winkelwagen'}
            size="lg"
            fullWidth
            loading={busy}
            disabled={soldOut || !variant}
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
    <SubScreen title={p?.title ?? 'Product'} eyebrow={p?.vendor ?? undefined} footer={footer}>
      <LoadState loading={product.loading} error={product.error} onRetry={product.reload} />
      {!product.loading && !product.error && !p ? <Text tone="secondary">Dit product is niet meer beschikbaar.</Text> : null}
      {p ? (
        <>
          {images.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              accessibilityLabel={`Productfoto's, ${images.length}`}
              contentContainerStyle={{ gap: 0 }}
            >
              {images.map((img) => (
                <ProductImage key={img.url} image={img} size={imageSize} />
              ))}
            </ScrollView>
          ) : (
            <ProductImage key={images[0]?.url ?? 'none'} image={images[0] ?? null} size={imageSize} />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.md, flexWrap: 'wrap' }}>
            {shown ? <Text variant="metric">{formatMoney(shown.price)}</Text> : null}
            {shown?.compareAtPrice && shown.compareAtPrice.cents > shown.price.cents ? (
              <Text tone="tertiary" tnum style={{ textDecorationLine: 'line-through' }}>
                {formatMoney(shown.compareAtPrice)}
              </Text>
            ) : null}
            {soldOut ? <Pill label="Uitverkocht" tone="neutral" /> : null}
          </View>

          {!p.hasOnlyDefaultVariant && options.length > 0 ? (
            <View style={{ gap: space.sm + 2 }}>
              <SectionLabel label={`Kies ${variantGroupLabel(p).toLowerCase()}`} />
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {options.map((v) => (
                  <OptionChip key={v.id} label={v.title} selected={v.id === variantId} onPress={() => setVariantId(v.id)} />
                ))}
              </View>
            </View>
          ) : null}

          {claims.length > 0 ? (
            <Card eyebrow="Goed om te weten">
              {claims.map((c) => (
                <Text key={c} tone="secondary">
                  {c}
                </Text>
              ))}
            </Card>
          ) : null}

          {facts.length > 0 ? (
            <Card padding={0} gap={0}>
              {facts.map((f, i) => (
                <ListRow key={f.label} title={f.label} value={f.value} divider={i < facts.length - 1} />
              ))}
            </Card>
          ) : null}

          <Button
            label="Volledige productinformatie op suppcity.nl"
            variant="link"
            size="sm"
            icon="share"
            accessibilityRole="link"
            accessibilityHint="Opent suppcity.nl in je browser"
            onPress={() => void Linking.openURL(productPageUrl(p)).catch(() => undefined)}
            style={{ marginLeft: -space.md }}
          />
        </>
      ) : null}
    </SubScreen>
  );
}
