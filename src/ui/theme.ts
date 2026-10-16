import {
  colors,
  fontFamily,
  layout,
  motion,
  radius,
  space,
  type ColorScheme,
  type ThemeColors,
} from './tokens';
import { makeTypography, type Typography } from './typography';

export {
  ACCENT,
  BRAND_LIGHT,
  colors,
  elevation,
  fontFamily,
  HIT_SLOP_MIN,
  layout,
  motion,
  radius,
  space,
  TOUCH_MIN,
  type ColorScheme,
  type ThemeColors,
} from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  space: typeof space;
  radius: typeof radius;
  layout: typeof layout;
  motion: typeof motion;
  /** Resolved type scale (Barlow when loaded, system font otherwise). */
  type: Typography;
  /** Font family names, or undefined while Barlow is not loaded (use for SVG text). */
  fonts: { condensed?: string; regular?: string; semiBold?: string; bold?: string };
  fontsLoaded: boolean;
}

export function makeTheme(scheme: ColorScheme, fontsLoaded = false): Theme {
  return {
    scheme,
    colors: colors[scheme],
    space,
    radius,
    layout,
    motion,
    type: makeTypography(fontsLoaded),
    fonts: fontsLoaded
      ? {
          condensed: fontFamily.condensedExtraBold,
          regular: fontFamily.regular,
          semiBold: fontFamily.semiBold,
          bold: fontFamily.bold,
        }
      : {},
    fontsLoaded,
  };
}
