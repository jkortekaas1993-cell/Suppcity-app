import { View } from 'react-native';

import { Button } from './Button';
import { Icon, type IconName } from './icons';
import { Text } from './Text';
import { radius } from './tokens';
import { useTheme } from './ThemeProvider';

export interface EmptyStateProps {
  icon?: IconName;
  /** Short, positive: "Nog geen trainingen". */
  title: string;
  /** One or two sentences on what to do next. */
  body?: string;
  /** The next step. Primary by default; use 'secondary' when the screen already has a primary. */
  action?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' };
  /** Show inside a card (default) or bare. */
  bare?: boolean;
  testID?: string;
}

/** Shown instead of an empty list. Always offer the next step when there is one. */
export function EmptyState({ icon, title, body, action, bare = false, testID }: EmptyStateProps) {
  const { colors, space } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        { alignItems: 'center', gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.lg },
        bare
          ? null
          : { backgroundColor: colors.bg1, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md },
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            backgroundColor: colors.bg2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={26} color={colors.text2} />
        </View>
      ) : null}
      <View style={{ gap: space.xs, alignItems: 'center' }}>
        <Text variant="heading" align="center" accessibilityRole="header">
          {title}
        </Text>
        {body ? (
          <Text variant="caption" tone="secondary" align="center" style={{ maxWidth: 300 }}>
            {body}
          </Text>
        ) : null}
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} variant={action.variant ?? 'primary'} /> : null}
    </View>
  );
}

export interface AvatarProps {
  /** One or two letters ("JK"). */
  initials: string;
  /** 44 (header), 56 (profile). */
  size?: number;
  accessibilityLabel?: string;
}

/** Initials circle (no photos in v1). */
export function Avatar({ initials, size = 44, accessibilityLabel }: AvatarProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: size >= 56 ? colors.bg2 : colors.bg1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="title" style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.44) }}>
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
