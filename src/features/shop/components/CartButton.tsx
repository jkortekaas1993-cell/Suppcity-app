import { router } from 'expo-router';

import { Button } from '@/ui';

import { cartItemCount } from '../logic/cart';
import { useCart } from '../state/cartStore';

export function CartButton() {
  const { cart } = useCart();
  const count = cartItemCount(cart);
  return (
    <Button
      label={count > 0 ? `Winkelwagen (${count})` : 'Winkelwagen'}
      variant="secondary"
      accessibilityLabel={`Winkelwagen, ${count} artikelen`}
      onPress={() => router.push('/shop/cart')}
    />
  );
}
