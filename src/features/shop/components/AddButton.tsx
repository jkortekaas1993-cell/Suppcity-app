import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HIT_SLOP_MIN, Icon, PressableScale, radius, useTheme } from '@/ui';

/** Visual size of the "+" (mockup Shop.dc.html); the touch area is 48 via hitSlop. */
const SIZE = 38;
/** How long the check stays before it turns back into "+". */
const DONE_MS = 1400;

/**
 * Accent "+" on a product tile. `onAdd` resolves true when the product went into the cart:
 * the "+" then briefly becomes a check with a small pop (static swap with reduce motion).
 * Resolves false when nothing was added (e.g. the product page opened to pick a variant).
 */
export function AddButton({
  accessibilityLabel,
  onAdd,
}: {
  accessibilityLabel: string;
  onAdd: () => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const scale = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  async function press() {
    if (state !== 'idle') return;
    setState('busy');
    const added = await onAdd();
    if (!mounted.current) return;
    if (!added) {
      setState('idle');
      return;
    }
    setState('done');
    AccessibilityInfo.announceForAccessibility('Toegevoegd aan winkelwagen');
    if (!reduceMotion) {
      scale.set(withSequence(withTiming(0.6, { duration: 0 }), withSpring(1, { damping: 9, stiffness: 260 })));
    }
    timer.current = setTimeout(() => {
      if (mounted.current) setState('idle');
    }, DONE_MS);
  }

  const slop = (HIT_SLOP_MIN - SIZE) / 2;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: state === 'busy', disabled: state !== 'idle' }}
      disabled={state !== 'idle'}
      haptic="light"
      hitSlop={slop}
      onPress={() => void press()}
      style={({ pressed }) => ({
        width: SIZE,
        height: SIZE,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.accentPressed : colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {state === 'busy' ? (
        <ActivityIndicator size="small" color={colors.onAccent} />
      ) : (
        <Animated.View style={iconStyle}>
          <Icon
            name={state === 'done' ? 'check' : 'plus'}
            size={state === 'done' ? 20 : 22}
            color={colors.onAccent}
            strokeWidth={state === 'done' ? 3 : 2.4}
          />
        </Animated.View>
      )}
    </PressableScale>
  );
}
