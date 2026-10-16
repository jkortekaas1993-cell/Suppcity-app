import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { useTheme } from '../ThemeProvider';

// The app icon itself (rounded), so the logo in the app is pixel-identical to the home screen.
const MARK = require('../../../assets/brand/mark.png') as number;

export interface BrandMarkProps {
  /** Edge length in px. Default 36 (screen header). */
  size?: number;
  /** Set for a meaningful logo (e.g. a header without other brand text); omit when decorative. */
  accessibilityLabel?: string;
  style?: StyleProp<ImageStyle>;
}

/** The Supp City logo tile. Header of Vandaag, the points card, the PR moment. */
export function BrandMark({ size = 36, accessibilityLabel, style }: BrandMarkProps) {
  const { colors } = useTheme();
  const decorative = accessibilityLabel === undefined;
  return (
    <Image
      source={MARK}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          borderWidth: 1,
          borderColor: colors.highlight,
        },
        style,
      ]}
    />
  );
}
