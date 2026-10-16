import { router } from 'expo-router';

import { IconButton } from '@/ui';

import { cartItemCount } from '../logic/cart';
import { productCount } from '../logic/format';
import { useCart } from '../state/cartStore';

/** Round header button with the item count (mockup: top right of Shop). */
export function CartButton() {
  const { cart } = useCart();
  const count = cartItemCount(cart);
  return (
    <IconButton
      icon="bag"
      variant="outline"
      iconSize={20}
      badge={count}
      accessibilityLabel={count > 0 ? `Winkelwagen, ${productCount(count)}` : 'Winkelwagen, leeg'}
      onPress={() => router.push('/shop/cart')}
    />
  );
}
