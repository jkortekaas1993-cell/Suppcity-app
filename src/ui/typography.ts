import type { TextStyle } from 'react-native';

import { fontFamily, type FontFamilyKey } from './tokens';

/** Tabular figures: use on EVERY weight, reps, timer, price and count. */
export const tnum: TextStyle = { fontVariant: ['tabular-nums'] };

interface VariantSpec {
  family: FontFamilyKey;
  /** System-font weight used while Barlow is not (yet) loaded. */
  fallbackWeight: NonNullable<TextStyle['fontWeight']>;
  style: TextStyle;
}

/**
 * Type scale (values from the approved mockups).
 * Barlow Condensed = display, hero numbers, UPPERCASE titles. Barlow = UI and body.
 */
const spec = {
  /** Screen title: "TIJD OM TE TILLEN", "VOORTGANG". 40/42 condensed, uppercase. */
  display: {
    family: 'condensedExtraBold',
    fallbackWeight: '900',
    style: { fontSize: 40, lineHeight: 42, textTransform: 'uppercase' },
  },
  /** The big number: e1RM on Voortgang (48). Override fontSize for the PR card (96). Tabular. */
  hero: {
    family: 'condensedExtraBold',
    fallbackWeight: '900',
    style: { fontSize: 48, lineHeight: 50, fontVariant: ['tabular-nums'] },
  },
  /** Card/sub-screen title: "PUSH A", "MIJN SUPPLEMENTEN". 28/30 condensed, uppercase. */
  title: {
    family: 'condensedExtraBold',
    fallbackWeight: '800',
    style: { fontSize: 28, lineHeight: 30, textTransform: 'uppercase' },
  },
  /** Stat tile number: 32/34 condensed, tabular. */
  metric: {
    family: 'condensedExtraBold',
    fallbackWeight: '800',
    style: { fontSize: 32, lineHeight: 34, fontVariant: ['tabular-nums'] },
  },
  /** Exercise name, card heading. 17/22 Barlow bold. */
  heading: {
    family: 'bold',
    fallbackWeight: '700',
    style: { fontSize: 17, lineHeight: 22 },
  },
  /** Body copy. 15/21. */
  body: {
    family: 'regular',
    fallbackWeight: '400',
    style: { fontSize: 15, lineHeight: 21 },
  },
  /** List row title, button-ish text. 15/20 semibold. */
  bodyStrong: {
    family: 'semiBold',
    fallbackWeight: '600',
    style: { fontSize: 15, lineHeight: 20 },
  },
  /** Meta line under a title. 13/18. */
  caption: {
    family: 'regular',
    fallbackWeight: '400',
    style: { fontSize: 13, lineHeight: 18 },
  },
  /** Small uppercase label above content: "WEEKDOEL", "VOLGENDE TRAINING". */
  eyebrow: {
    family: 'bold',
    fallbackWeight: '700',
    style: { fontSize: 11, lineHeight: 14, letterSpacing: 1.6, textTransform: 'uppercase' },
  },
  /** Button labels. */
  button: {
    family: 'bold',
    fallbackWeight: '700',
    style: { fontSize: 16, lineHeight: 20 },
  },
  /** Tab labels, chart axes, badge counts. 11/14. */
  micro: {
    family: 'semiBold',
    fallbackWeight: '600',
    style: { fontSize: 11, lineHeight: 14 },
  },
  /** @deprecated release-1 name for `eyebrow` (slightly larger). */
  label: {
    family: 'bold',
    fallbackWeight: '700',
    style: { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  },
} satisfies Record<string, VariantSpec>;

export type TypographyVariant = keyof typeof spec;
export type Typography = Record<TypographyVariant, TextStyle>;

/**
 * Resolve the scale. With `fontsLoaded` the Barlow families are used (no fontWeight: on Android a
 * custom family plus fontWeight can fall back to the system font). Without, the system font with
 * the fallback weight, so the app looks right even if font loading failed or timed out.
 */
export function makeTypography(fontsLoaded: boolean): Typography {
  const out = {} as Typography;
  for (const key of Object.keys(spec) as TypographyVariant[]) {
    const s: VariantSpec = spec[key];
    out[key] = fontsLoaded
      ? { ...s.style, fontFamily: fontFamily[s.family] }
      : { ...s.style, fontWeight: s.fallbackWeight };
  }
  return out;
}

/** Static scale with Barlow (kept for release-1 imports). Prefer `useTheme().type`. */
export const typography: Typography = makeTypography(true);
