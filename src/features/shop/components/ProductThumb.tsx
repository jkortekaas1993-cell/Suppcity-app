import { Image, View } from 'react-native';

import type { ShopImage } from '@/lib/shopify';
import { useTheme } from '@/ui';

export function ProductThumb({ image, size = 56 }: { image: ShopImage | null; size?: number }) {
  const { colors, radius } = useTheme();
  const box = { width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised };
  if (!image) return <View style={box} accessibilityElementsHidden importantForAccessibility="no" />;
  return <Image source={{ uri: image.url }} accessibilityLabel={image.alt} resizeMode="contain" style={box} />;
}
