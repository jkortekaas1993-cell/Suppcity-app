/**
 * Supp City design tokens: the ONE source for colour, spacing, radii, motion and fonts.
 * Direction: "Gym floor at night" (docs/design/README.md). Only your numbers light up, in turquoise.
 *
 * Rules:
 * - Screens read tokens via `useTheme()`; never hard-code hex values.
 * - The brand accent lives in ONE constant (`ACCENT`). Its tints sit right next to it; if the owner
 *   delivers the exact logo hex, change `ACCENT` and re-check the tints in the same PR.
 * - Turquoise is only for: the primary action, live state (running workout/timer), completed sets.
 *   Never on exercise names or headings.
 */

/** Brand accent (Supp City logo turquoise). The single swap point. */
export const ACCENT = '#1FC7B6';

/** Tints derived from ACCENT (approved mockup values). Re-check these when ACCENT changes. */
const accentTints = {
  accentPressed: '#19AE9F',
  accentText: '#4FE0D0',
  accentMuted: '#0E2F2C',
  accentBorder: '#1F4D48',
} as const;

export type ColorScheme = 'dark' | 'light';

export interface ThemeColors {
  /** App background. */
  bg0: string;
  /** Cards, sheets. */
  bg1: string;
  /** Inputs, raised controls, icon wells. */
  bg2: string;
  /** Tracks (progress, segments), selected segment. */
  bg3: string;
  /** Hairlines and card borders. */
  border: string;
  /** Focused/emphasised borders (inputs, unchecked boxes). */
  borderStrong: string;
  /** Primary text. */
  text1: string;
  /** Secondary text (eyebrows, labels). */
  text2: string;
  /** Tertiary text (meta lines, units, inactive tabs). */
  text3: string;
  accent: string;
  accentPressed: string;
  /** Accent used as TEXT on dark (links, eyebrows in hero cards). */
  accentText: string;
  /** Accent-tinted surface (completed set rows, hero gradient start). */
  accentMuted: string;
  accentBorder: string;
  /** Text/icons on an accent fill. */
  onAccent: string;
  success: string;
  /** PR gold. */
  gold: string;
  goldMuted: string;
  goldBorder: string;
  error: string;
  errorMuted: string;
  /** Translucent bar background (tab bar). */
  barBg: string;
  /** Dimmed backdrop behind sheets and dialogs. */
  scrim: string;
  /** Categorical data series, in order. Series 0 is always the accent. */
  data: readonly [string, string, string, string, string];

  // Legacy aliases (release 1 names). Kept so existing screens compile; prefer the names above.
  /** @deprecated use bg0 */
  background: string;
  /** @deprecated use bg1 */
  surface: string;
  /** @deprecated use bg2 */
  surfaceRaised: string;
  /** @deprecated use text1 */
  text: string;
  /** @deprecated use text2 (secondary) or text3 (tertiary) */
  textMuted: string;
  /** @deprecated use onAccent */
  textOnAccent: string;
  /** @deprecated use error */
  danger: string;
  /** @deprecated use gold */
  warning: string;
}

type CoreColors = Omit<
  ThemeColors,
  'background' | 'surface' | 'surfaceRaised' | 'text' | 'textMuted' | 'textOnAccent' | 'danger' | 'warning'
>;

function withAliases(c: CoreColors): ThemeColors {
  return {
    ...c,
    background: c.bg0,
    surface: c.bg1,
    surfaceRaised: c.bg2,
    text: c.text1,
    textMuted: c.text2,
    textOnAccent: c.onAccent,
    danger: c.error,
    warning: c.gold,
  };
}

const dark: CoreColors = {
  bg0: '#08090A',
  bg1: '#111416',
  bg2: '#1A1E21',
  bg3: '#252B2F',
  border: '#2C3338',
  borderStrong: '#3A434A',
  text1: '#F2F4F3',
  text2: '#A7B0B5',
  text3: '#7E8990',
  accent: ACCENT,
  ...accentTints,
  onAccent: '#08090A',
  success: '#3DD68C',
  gold: '#F5B544',
  goldMuted: '#2E2410',
  goldBorder: '#5A4A22',
  error: '#FF6166',
  errorMuted: '#3A1517',
  barBg: 'rgba(8,9,10,0.94)',
  scrim: 'rgba(0,0,0,0.6)',
  data: [ACCENT, '#A594FF', '#F2B33D', '#FF7F6E', '#4EA8F5'],
};

/**
 * Placeholder light palette: NOT designed or reviewed, not used in v1 (dark only).
 * It exists so the token structure already supports a second scheme.
 */
const light: CoreColors = {
  bg0: '#F4F5F4',
  bg1: '#FFFFFF',
  bg2: '#ECEEEE',
  bg3: '#DDE1E2',
  border: '#D5DADC',
  borderStrong: '#B9C1C5',
  text1: '#0B0D0E',
  text2: '#4A555B',
  text3: '#68747B',
  accent: ACCENT,
  accentPressed: accentTints.accentPressed,
  accentText: '#0B8C80',
  accentMuted: '#DDF5F2',
  accentBorder: '#A6E3DC',
  onAccent: '#08090A',
  success: '#1E9E62',
  gold: '#B07A12',
  goldMuted: '#FBF0DA',
  goldBorder: '#E8CF95',
  error: '#D93A40',
  errorMuted: '#FBE3E4',
  barBg: 'rgba(244,245,244,0.94)',
  scrim: 'rgba(11,13,14,0.4)',
  data: [ACCENT, '#6E5BD9', '#C98A12', '#E0563F', '#2D7FD0'],
};

export const colors: Record<ColorScheme, ThemeColors> = {
  dark: withAliases(dark),
  light: withAliases(light),
};

/**
 * 4pt grid. Legacy keys keep their release-1 values.
 * xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48
 */
export const space = { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Layout constants taken 1:1 from the mockups. */
export const layout = {
  /** Horizontal screen gutter. */
  screenPadding: 20,
  /** Vertical gap between blocks on a screen. */
  screenGap: 16,
  /** Default card padding. */
  cardPadding: 14,
  /** Hero card padding. */
  heroPadding: 20,
  /** Set row height in the workout logger. */
  setRowHeight: 56,
  /** Primary button height. */
  buttonHeight: 52,
} as const;

export const radius = {
  /** Tiny tags, chart legend swatches. */
  xs: 4,
  /** Inputs, small buttons, check boxes. */
  sm: 8,
  /** Big buttons. */
  control: 10,
  /** Cards, tiles. */
  md: 12,
  /** Hero cards, bottom panels, medal tiles. */
  lg: 16,
  /** Celebration card (PR). */
  xl: 20,
  pill: 999,
} as const;

/** Minimum touch target (sweaty hands, gloves). Smaller visuals get hitSlop up to this. */
export const HIT_SLOP_MIN = 48;
/** Absolute minimum for secondary controls (Apple HIG). */
export const TOUCH_MIN = 44;

export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  /** Pressed scale for buttons and tappable cards. */
  pressScale: 0.97,
  /** Live dot pulse half-period. */
  pulse: 700,
} as const;

/** Font family names as registered by `useFonts` (see fonts.ts). */
export const fontFamily = {
  condensedSemiBold: 'BarlowCondensed_600SemiBold',
  condensedBold: 'BarlowCondensed_700Bold',
  condensedExtraBold: 'BarlowCondensed_800ExtraBold',
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semiBold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
} as const;

export type FontFamilyKey = keyof typeof fontFamily;
