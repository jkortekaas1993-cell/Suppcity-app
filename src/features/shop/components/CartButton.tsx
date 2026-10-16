import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HIT_SLOP_MIN, Icon, motion, PressableScale, Text, TOUCH_MIN, useTheme } from '@/ui';

import { cartItemCount } from '../logic/cart';
import { productCount } from '../logic/format';
import { useCart } from '../state/cartStore';

/**
 * Round header button with the item count (mockup: top right of Shop). The count bubble
 * pops when something is added (not on the first load; static with reduce motion).
 */
export function CartButton() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { cart, loaded } = useCart();
  const count = cartItemCount(cart);
  const scale = useSharedValue(1);
  const prev = useRef<{ count: number; loaded: boolean }>({ count, loaded });

  useEffect(() => {
    const before = prev.current;
    prev.current = { count, loaded };
    if (reduceMotion || !before.loaded || !loaded || count <= before.count) return;
    scale.set(withSequence(withTiming(1.4, { duration: motion.fast }), withSpring(1, { damping: 9, stiffness: 260 })));
  }, [count, loaded, reduceMotion, scale]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const slop = (HIT_SLOP_MIN - TOUCH_MIN) / 2;
  const label = count > 99 ? '99+' : String(count);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Winkelwagen, ${productCount(count)}` : 'Winkelwagen, leeg'}
      haptic={false}
      hitSlop={slop}
      onPress={() => router.push('/shop/cart')}
      style={({ pressed }) => ({
        width: TOUCH_MIN,
        height: TOUCH_MIN,
        borderRadius: TOUCH_MIN / 2,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.bg2 : colors.bg1,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icon name="bag" size={20} color={colors.text1} />
      {count > 0 ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            },
            badgeStyle,
          ]}
        >
          <Text variant="micro" tnum style={{ color: colors.onAccent, fontSize: 11, lineHeight: 13 }}>
            {label}
          </Text>
        </Animated.View>
      ) : null}
    </PressableScale>
  );
}
