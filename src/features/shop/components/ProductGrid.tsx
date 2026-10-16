import { View } from 'react-native';

import type { ProductSummary } from '@/lib/shopify';
import { useTheme } from '@/ui';

import { ProductTile } from './ProductTile';

/** Two-column product grid (mockup Shop.dc.html). `bestsellers` marks the first n tiles. */
export function ProductGrid({ products, bestsellers = 0 }: { products: ProductSummary[]; bestsellers?: number }) {
  const { space } = useTheme();
  const rows: ProductSummary[][] = [];
  for (let i = 0; i < products.length; i += 2) rows.push(products.slice(i, i + 2));
  return (
    <View style={{ gap: space.xl }}>
      {rows.map((row, r) => (
        <View key={row[0]?.id ?? r} style={{ flexDirection: 'row', gap: space.md }}>
          {row.map((p, c) => (
            <ProductTile key={p.id} product={p} bestseller={r * 2 + c < bestsellers} />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}
