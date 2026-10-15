import { useLocalSearchParams } from 'expo-router';

import { getStorefront } from '@/lib/shopify';
import { Text } from '@/ui';

import { LoadState } from '../components/LoadState';
import { ProductList } from '../components/ProductList';
import { SubScreen } from '../components/SubScreen';
import { useAsync } from '../state/useAsync';

export function CollectionScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const result = useAsync(() => getStorefront().collectionProducts(String(handle), { first: 50 }), [handle]);
  const data = result.data;
  return (
    <SubScreen title={data?.collection.title ?? 'Categorie'} subtitle={data?.collection.description || undefined}>
      <LoadState loading={result.loading} error={result.error} onRetry={result.reload} />
      {!result.loading && !result.error && !data ? <Text tone="muted">Deze categorie bestaat niet meer.</Text> : null}
      {data && data.products.items.length === 0 ? <Text tone="muted">Nog geen producten in deze categorie.</Text> : null}
      {data && data.products.items.length > 0 ? <ProductList products={data.products.items} /> : null}
    </SubScreen>
  );
}
