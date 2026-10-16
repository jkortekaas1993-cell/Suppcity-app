import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { getStorefront, type Page, type ProductSummary } from '@/lib/shopify';
import { Button, Chip, EmptyState, layout, Screen, useTheme } from '@/ui';

import { CartButton } from './components/CartButton';
import { LoadState } from './components/LoadState';
import { ProductGrid } from './components/ProductGrid';
import { ReorderSection } from './components/ReorderSection';
import { SearchField } from './components/SearchField';
import { WelcomeCard } from './components/WelcomeCard';
import { cartStore } from './state/cartStore';
import { useAsync } from './state/useAsync';

const PAGE = 24;
/** Tiles marked "Bestseller" at the top of the unfiltered list (sorted BEST_SELLING by Shopify). */
const BESTSELLER_TILES = 2;
const SEARCH_DEBOUNCE_MS = 350;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Shop tab (mockup Shop.dc.html): title + cart, search, "Opnieuw bestellen", category chips
 * (selected is light), two-column packshot grid.
 */
export function ShopScreen() {
  const { space } = useTheme();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const [category, setCategory] = useState<string | null>(null);
  const [more, setMore] = useState<ProductSummary[]>([]);
  const [cursor, setCursor] = useState<Page<ProductSummary> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const collections = useAsync(() => getStorefront().collections(), []);
  const products = useAsync(async (): Promise<Page<ProductSummary>> => {
    const sf = getStorefront();
    if (query) return sf.products({ first: PAGE, query });
    if (category) {
      const res = await sf.collectionProducts(category, { first: 50 });
      return res?.products ?? { items: [], hasNextPage: false, endCursor: null };
    }
    return sf.products({ first: PAGE });
  }, [query, category]);

  useEffect(() => {
    void cartStore.load();
  }, []);

  // A new filter starts a new list.
  useEffect(() => {
    setMore([]);
    setCursor(null);
  }, [query, category]);

  const page = cursor ?? products.data;
  const all = [...(products.data?.items ?? []), ...more];
  const filtered = query !== '' || category !== null;
  const canLoadMore = !category && page?.hasNextPage === true;

  return (
    <Screen title="Shop" headerRight={<CartButton />}>
      <SearchField value={search} onChangeText={setSearch} />

      {!filtered ? <ReorderSection /> : null}
      {!filtered ? <WelcomeCard /> : null}

      {collections.data && collections.data.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Categorieën"
          style={{ marginHorizontal: -layout.screenPadding, flexGrow: 0 }}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: layout.screenPadding, paddingVertical: space.xs }}
        >
          <Chip label="Alles" selected={category === null} onPress={() => setCategory(null)} />
          {collections.data.map((c) => (
            <Chip key={c.id} label={c.title} selected={category === c.handle} onPress={() => setCategory(c.handle)} />
          ))}
        </ScrollView>
      ) : null}

      <LoadState loading={products.loading} error={products.error} onRetry={products.reload} />
      {!products.loading && !products.error && all.length === 0 ? (
        <EmptyState
          icon="search"
          title={query ? 'Niets gevonden' : 'Nog geen producten'}
          body={query ? `Geen producten voor "${query}". Probeer een andere zoekterm.` : 'In deze categorie staat nu niets.'}
        />
      ) : null}
      {!products.loading && all.length > 0 ? <ProductGrid products={all} bestsellers={filtered ? 0 : BESTSELLER_TILES} /> : null}

      {!products.loading && canLoadMore && page ? (
        <View style={{ alignItems: 'center' }}>
          <Button
            label="Meer laden"
            variant="secondary"
            loading={loadingMore}
            onPress={async () => {
              setLoadingMore(true);
              try {
                const next = await getStorefront().products({ first: PAGE, after: page.endCursor, query: query || undefined });
                setMore((m) => [...m, ...next.items]);
                setCursor(next);
              } catch {
                // Keep the current list; the button stays available to retry.
              } finally {
                setLoadingMore(false);
              }
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}
