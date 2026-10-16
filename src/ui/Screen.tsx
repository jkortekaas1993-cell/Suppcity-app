import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from './IconButton';
import { Text } from './Text';
import { layout } from './tokens';
import { useTheme } from './ThemeProvider';

export interface ScreenProps {
  /** Screen title. Tab screens: big condensed "display"; with onBack: smaller "title". */
  title?: string;
  /** Small uppercase line ABOVE the title ("VRIJDAG 16 OKTOBER"). */
  eyebrow?: string;
  /** One muted line under the title. */
  subtitle?: string;
  /** Right side of the header (Avatar, IconButton with cart badge). */
  headerRight?: ReactNode;
  /** Shows a back chevron left of the title (pushed screens). */
  onBack?: () => void;
  /** Sticky area under the scroll content (e.g. one primary Button). Not scrolled. */
  footer?: ReactNode;
  children?: ReactNode;
  /** Default true. Use false for screens that own a FlatList. */
  scroll?: boolean;
  /** Horizontal 20pt gutter (default true). */
  padded?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  testID?: string;
}

/**
 * Standard screen: safe area, bg0, 20pt gutter, 16pt rhythm between blocks, header with
 * eyebrow/title/right accessory. Every screen starts here.
 */
export function Screen({
  title,
  eyebrow,
  subtitle,
  headerRight,
  onBack,
  footer,
  children,
  scroll = true,
  padded = true,
  refreshControl,
  testID,
}: ScreenProps) {
  const { colors, space } = useTheme();
  const gutter = padded ? layout.screenPadding : 0;
  const hasHeader = title !== undefined || eyebrow !== undefined || headerRight !== undefined || onBack !== undefined;

  const header = hasHeader ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: onBack ? 'center' : 'flex-start',
        gap: onBack ? space.xs : space.md,
        paddingTop: space.md,
        marginLeft: onBack ? -(space.md + 2) : 0,
      }}
    >
      {onBack ? <IconButton icon="chevron-left" accessibilityLabel="Terug" onPress={onBack} color={colors.text1} /> : null}
      <View style={{ flex: 1, gap: space.xs }}>
        {eyebrow ? (
          <Text variant="eyebrow" tone="tertiary">
            {eyebrow}
          </Text>
        ) : null}
        {title !== undefined ? (
          <Text variant={onBack ? 'title' : 'display'} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
      </View>
      {headerRight}
    </View>
  ) : null;

  const body = (
    <View
      style={{
        flex: scroll ? undefined : 1,
        paddingHorizontal: gutter,
        paddingBottom: scroll ? space.xxl : 0,
        gap: layout.screenGap,
      }}
    >
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView testID={testID} edges={['top']} style={{ flex: 1, backgroundColor: colors.bg0 }}>
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          indicatorStyle="white"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: gutter,
            paddingTop: space.md,
            paddingBottom: space.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bg0,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
