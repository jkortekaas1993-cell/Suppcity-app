import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { Text, type TextProps } from '../Text';
import { motion } from '../tokens';

export interface CountUpProps extends Omit<TextProps, 'children'> {
  /** Start value (e.g. the previous record). */
  from: number;
  /** Final value. Screen readers always get this one. */
  to: number;
  /** Formats each frame's value, e.g. kg with one decimal in nl-NL. */
  format: (value: number) => string;
  /** Duration in ms. Default motion.draw. */
  duration?: number;
  /** Delay before counting, ms. */
  delay?: number;
}

/**
 * A number that counts from `from` to `to` (the PR moment: previous record → new record).
 * Shows the final value immediately with "reduce motion". Plain JS frames: it runs once,
 * for under a second, on one Text node.
 */
export function CountUp({ from, to, format, duration = motion.draw, delay = 0, ...text }: CountUpProps) {
  const [value, setValue] = useState(from);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce || from === to) {
        setValue(to);
        return;
      }
      timer = setTimeout(() => {
        const start = Date.now();
        const tick = () => {
          const p = Math.min(1, (Date.now() - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(from + (to - from) * eased);
          if (p < 1 && !cancelled) frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
      }, delay);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [from, to, duration, delay]);

  return (
    <Text {...text} accessibilityLabel={text.accessibilityLabel ?? format(to)}>
      {format(value)}
    </Text>
  );
}
