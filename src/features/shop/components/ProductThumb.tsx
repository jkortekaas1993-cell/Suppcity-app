import type { ShopImage } from '@/lib/shopify';
import { radius } from '@/ui';

import { ProductImage } from './ProductImage';

/** Small packshot for list rows (cart, orders). */
export function ProductThumb({ image, size = 56 }: { image: ShopImage | null; size?: number }) {
  return <ProductImage image={image} size={size} rounded={radius.control} />;
}
