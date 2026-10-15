import type { TextStyle } from 'react-native';

/**
 * Type scale. System font, but set with intent: display/title are heavy,
 * uppercase and tracked; numbers always use tabular figures so kg/reps columns line up.
 */
export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Weights, reps, timers. */
  metric: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
