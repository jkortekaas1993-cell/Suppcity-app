import { TextInput, View } from 'react-native';

import { Icon, IconButton, radius, useTheme } from '@/ui';

/** Search input in the shop header area (44 high, bg2 well). */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Zoek whey, creatine, pre-workout…',
  autoFocus = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Focus on mount (the Shop opens the field from its header search button). */
  autoFocus?: boolean;
}) {
  const { colors, space, type } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm + 2,
        minHeight: 44,
        paddingLeft: space.md + 2,
        paddingRight: value ? space.xs : space.md + 2,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg2,
      }}
    >
      <Icon name="search" size={18} color={colors.text3} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        accessibilityLabel="Zoek producten"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        inputMode="search"
        style={{ ...type.body, flex: 1, color: colors.text1, paddingVertical: space.sm }}
      />
      {value ? (
        <IconButton icon="close" size={36} iconSize={18} accessibilityLabel="Zoekopdracht wissen" onPress={() => onChangeText('')} />
      ) : null}
    </View>
  );
}
