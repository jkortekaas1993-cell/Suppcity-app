import { useLocalSearchParams } from 'expo-router';

import { getStorefront } from '@/lib/shopify';
import { EmptyState, Text } from '@/ui';

import { LoadState } from '../components/LoadState';
import { ProductGrid } from '../components/ProductGrid';
import { SubScreen } from '../components/SubScreen';
import { useAsync } from '../state/useAsync';

export function CollectionScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const result = useAsync(() => getStorefront().collectionProducts(String(handle), { first: 50 }), [handle]);
  const data = result.data;
  return (
    <SubScreen title={data?.collection.title ?? 'Categorie'} subtitle={data?.collection.description || undefined}>
      <LoadState loading={result.loading} error={result.error} onRetry={result.reload} />
      {!result.loading && !result.error && !data ? <Text tone="secondary">Deze categorie bestaat niet meer.</Text> : null}
      {data && data.products.items.length === 0 ? <EmptyState icon="bag" title="Nog geen producten" body="In deze categorie staat nu niets." /> : null}
      {data && data.products.items.length > 0 ? <ProductGrid products={data.products.items} /> : null}
    </SubScreen>
  );
}
