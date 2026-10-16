import { useState } from 'react';
import { Image, View } from 'react-native';

import type { ShopImage } from '@/lib/shopify';
import { Icon, radius as radii, useTheme } from '@/ui';

/**
 * Shopify packshot with a calm placeholder (bag icon on bg2) while loading, on error
 * or when the product has no image. Plain React Native Image: expo-image is not installed.
 */
export function ProductImage({
  image,
  size,
  rounded = radii.md,
  bordered = true,
}: {
  image: ShopImage | null;
  /** Fixed square size; omit to fill the parent width (aspect ratio 1). */
  size?: number;
  rounded?: number;
  bordered?: boolean;
}) {
  const { colors } = useTheme();
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const box = size !== undefined ? { width: size, height: size } : { width: '100%' as const, aspectRatio: 1 };
  const showPlaceholder = !image || state !== 'loaded';

  return (
    <View
      style={{
        ...box,
        borderRadius: rounded,
        borderWidth: bordered ? 1 : 0,
        borderColor: colors.border,
        backgroundColor: colors.bg2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showPlaceholder ? (
        <Icon name="bag" size={size !== undefined ? Math.max(16, Math.round(size * 0.36)) : 32} color={colors.borderStrong} />
      ) : null}
      {image && state !== 'error' ? (
        <Image
          source={{ uri: image.url }}
          accessibilityLabel={image.alt}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: state === 'loaded' ? 1 : 0 }}
        />
      ) : null}
    </View>
  );
}
