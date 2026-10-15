import { router } from 'expo-router';

import { formatMoney, type ProductSummary } from '@/lib/shopify';
import { Card, ListItem, useTheme } from '@/ui';

import { ProductThumb } from './ProductThumb';

export function ProductList({ products, eyebrow }: { products: ProductSummary[]; eyebrow?: string }) {
  const { space } = useTheme();
  return (
    <Card eyebrow={eyebrow} style={{ padding: 0, paddingTop: eyebrow ? space.lg : 0 }}>
      {products.map((p) => (
        <ListItem
          key={p.id}
          title={p.title}
          subtitle={p.available ? `Vanaf ${formatMoney(p.priceFrom)}` : 'Uitverkocht'}
          leading={<ProductThumb image={p.image} />}
          onPress={() => router.push({ pathname: '/shop/product/[handle]', params: { handle: p.handle } })}
        />
      ))}
    </Card>
  );
}
