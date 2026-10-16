// Supp City design system. Import everything from '@/ui'. Catalogue: docs/design/README.md.

// Tokens and theme
export {
  ACCENT,
  colors,
  fontFamily,
  HIT_SLOP_MIN,
  layout,
  makeTheme,
  motion,
  radius,
  space,
  TOUCH_MIN,
  type ColorScheme,
  type Theme,
  type ThemeColors,
} from './theme';
export { ThemeProvider, useTheme } from './ThemeProvider';
export { makeTypography, tnum, typography, type Typography, type TypographyVariant } from './typography';
export { FONT_ASSETS, FONT_LOAD_TIMEOUT_MS } from './fonts';
export { haptics, type HapticKind } from './haptics';

// Icons
export { Icon, ICON_NAMES, type IconName, type IconProps } from './icons';
export { TabIcon, type TabIconName } from './TabIcon';

// Components
export {
  ActionSheet,
  useActionSheet,
  type ActionSheetConfig,
  type ActionSheetOption,
  type ActionSheetProps,
} from './ActionSheet';
export { Avatar, EmptyState, type AvatarProps, type EmptyStateProps } from './EmptyState';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { Card, type CardProps, type CardVariant } from './Card';
export { Chip, Segmented, type ChipProps, type SegmentedProps } from './Chip';
export { IconButton, type IconButtonProps } from './IconButton';
export { ListItem, type ListItemProps } from './ListItem';
export { ListRow, type ListRowProps } from './ListRow';
export { LiveBar, LiveDot, type LiveBarProps, type LiveDotProps } from './Live';
export { Badge, Pill, type BadgeProps, type PillProps, type PillTone } from './Pill';
export { PressableScale, type PressableScaleProps } from './PressableScale';
export {
  ProgressBar,
  Ring,
  SegmentBar,
  type ProgressBarProps,
  type ProgressTone,
  type RingProps,
  type SegmentBarProps,
} from './Progress';
export { Screen, type ScreenProps } from './Screen';
export { Divider, SectionLabel, type SectionLabelProps } from './SectionLabel';
export { StatTile, type StatTileProps } from './StatTile';
export { Text, toneColor, type TextProps, type TextTone } from './Text';

// Charts
export { BarList, LineChart, type BarListItem, type BarListProps, type LineChartProps, type LinePoint } from './charts';
