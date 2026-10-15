/**
 * Supp City design tokens.
 * Direction: "gym floor at night" — near-black chalk-grey surfaces, one turquoise
 * accent (from the logo), heavy uppercase headings, tabular numbers for weights.
 * The accent is reserved for the ONE primary action or live state per screen.
 */

const palette = {
  ink950: '#0B0D0E',
  ink900: '#121517',
  ink850: '#181C1F',
  ink800: '#20262A',
  ink700: '#2C3439',
  ink500: '#5B676E',
  ink400: '#86929A',
  chalk50: '#F4F3EF',
  chalk100: '#ECEAE4',
  chalk200: '#DEDBD2',
  chalk300: '#C9C5BA',
  white: '#FFFFFF',
  teal400: '#1FC7B6',
  teal500: '#14A99A',
  teal600: '#0E8C80',
  red500: '#E5484D',
  amber500: '#F2A33A',
} as const;

export type ColorScheme = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  textOnAccent: string;
  accent: string;
  accentPressed: string;
  danger: string;
  warning: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  dark: {
    background: palette.ink950,
    surface: palette.ink900,
    surfaceRaised: palette.ink850,
    border: palette.ink700,
    text: palette.chalk50,
    textMuted: palette.ink400,
    textOnAccent: palette.ink950,
    accent: palette.teal400,
    accentPressed: palette.teal500,
    danger: palette.red500,
    warning: palette.amber500,
  },
  light: {
    background: palette.chalk100,
    surface: palette.chalk50,
    surfaceRaised: palette.white,
    border: palette.chalk300,
    text: palette.ink950,
    textMuted: palette.ink500,
    textOnAccent: palette.ink950,
    accent: palette.teal500,
    accentPressed: palette.teal600,
    danger: palette.red500,
    warning: palette.amber500,
  },
};

/** 4pt grid. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Squared-off corners: tough, not bubbly. */
export const radius = { sm: 4, md: 8, lg: 12, pill: 999 } as const;

/** Minimum touch target (sweaty hands, gloves). */
export const HIT_SLOP_MIN = 48;

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  space: typeof space;
  radius: typeof radius;
}

export function makeTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: colors[scheme], space, radius };
}
