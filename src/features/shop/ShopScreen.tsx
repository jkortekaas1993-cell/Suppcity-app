import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { getStorefront, type Page, type ProductSummary } from '@/lib/shopify';
import { Button, Screen, Text, useTheme } from '@/ui';

import { CartButton } from './components/CartButton';
import { Chip } from './components/Chip';
import { LoadState } from './components/LoadState';
import { ProductList } from './components/ProductList';
import { ReorderSection } from './components/ReorderSection';
import { WelcomeCard } from './components/WelcomeCard';
import { cartStore } from './state/cartStore';
import { useAsync } from './state/useAsync';

/** Shop tab: reorder → welcome card → collections → best sellers. */
export function ShopScreen() {
  const { space } = useTheme();
  const collections = useAsync(() => getStorefront().collections(), []);
  const products = useAsync(() => getStorefront().products({ first: 24 }), []);
  const [more, setMore] = useState<ProductSummary[]>([]);
  const [cursor, setCursor] = useState<Page<ProductSummary> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    void cartStore.load();
  }, []);

  const page = cursor ?? products.data;
  const all = [...(products.data?.items ?? []), ...more];

  return (
    <Screen title="Shop" subtitle="Bestel direct bij Supp City.">
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <CartButton />
        <Button label="Mijn voorraad" variant="ghost" onPress={() => router.push('/shop/stock')} />
      </View>

      <ReorderSection />
      <WelcomeCard />

      {collections.data && collections.data.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">
            Categorieën
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {collections.data.map((c) => (
              <Chip
                key={c.id}
                label={c.title}
                selected={false}
                onPress={() => router.push({ pathname: '/shop/collection/[handle]', params: { handle: c.handle } })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <LoadState loading={products.loading} error={products.error} onRetry={products.reload} />
      {all.length > 0 ? <ProductList eyebrow="Populair" products={all} /> : null}
      {page?.hasNextPage ? (
        <Button
          label="Meer laden"
          variant="secondary"
          loading={loadingMore}
          onPress={async () => {
            setLoadingMore(true);
            try {
              const next = await getStorefront().products({ first: 24, after: page.endCursor });
              setMore((m) => [...m, ...next.items]);
              setCursor(next);
            } catch {
              // Keep the current list; the button stays available to retry.
            } finally {
              setLoadingMore(false);
            }
          }}
        />
      ) : null}
    </Screen>
  );
}
