import { View } from 'react-native';

import { Icon, type IconName } from './icons';
import { Text } from './Text';
import type { ThemeColors } from './tokens';
import { useTheme } from './ThemeProvider';

export type PillTone = 'accent' | 'gold' | 'success' | 'neutral' | 'danger';

function pillColors(c: ThemeColors, tone: PillTone): { bg: string; fg: string } {
  switch (tone) {
    case 'accent':
      return { bg: c.accentMuted, fg: c.accentText };
    case 'gold':
      return { bg: c.goldMuted, fg: c.gold };
    case 'success':
      return { bg: c.bg2, fg: c.success };
    case 'danger':
      return { bg: c.errorMuted, fg: c.error };
    case 'neutral':
      return { bg: c.bg2, fg: c.text2 };
  }
}

export interface PillProps {
  label: string;
  /** accent = live/new for you ("Bestseller", "Bezig"); gold = PR / achievement. */
  tone?: PillTone;
  icon?: IconName;
  /** sm 20 (on product images), md 26 (celebration: "NIEUW PERSOONLIJK RECORD", uppercase). */
  size?: 'sm' | 'md';
  testID?: string;
}

/** Non-interactive status label. For a filter the user taps, use Chip. */
export function Pill({ label, tone = 'neutral', icon, size = 'sm', testID }: PillProps) {
  const { colors, space } = useTheme();
  const { bg, fg } = pillColors(colors, tone);
  const h = size === 'sm' ? 20 : 26;
  return (
    <View
      testID={testID}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + 2,
        height: h,
        paddingHorizontal: size === 'sm' ? space.sm : space.md,
        borderRadius: h / 2,
        backgroundColor: bg,
      }}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 12 : 14} color={fg} filled /> : null}
      <Text
        variant={size === 'md' ? 'eyebrow' : 'micro'}
        style={{ color: fg, fontSize: size === 'md' ? 12 : 11, letterSpacing: size === 'md' ? 1.2 : 0 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export interface BadgeProps {
  /** Count to show; nothing renders for 0. */
  count: number;
  max?: number;
  /** Screen-reader text is the parent's job (e.g. "Winkelwagen, 1 product"). */
  testID?: string;
}

/** Small count bubble, absolutely positioned on the top-right of its parent (cart icon). */
export function Badge({ count, max = 99, testID }: BadgeProps) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
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
      }}
    >
      <Text variant="micro" tnum style={{ color: colors.onAccent, fontSize: 11, lineHeight: 13 }}>
        {label}
      </Text>
    </View>
  );
}
