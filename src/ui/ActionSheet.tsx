import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from './haptics';
import { Icon, type IconName } from './icons';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { layout, radius, TOUCH_MIN } from './tokens';

export interface ActionSheetOption {
  label: string;
  onPress: () => void;
  /** Red label: deleting, wiping. */
  destructive?: boolean;
  icon?: IconName;
  accessibilityHint?: string;
}

export interface ActionSheetConfig {
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  /** Label of the cancel row (always shown). */
  cancelLabel?: string;
}

export interface ActionSheetProps extends ActionSheetConfig {
  visible: boolean;
  /** Called on Annuleren, a tap on the backdrop, the Android back button, and after a choice. */
  onClose: () => void;
}

/**
 * Bottom sheet with a list of choices plus "Annuleren". Use it instead of `Alert.alert`
 * with more than three buttons: Android shows at most three alert buttons and silently
 * drops the rest. Touch targets >= 56 pt, haptic on choice, screen-reader friendly
 * (modal, header, buttons). The chosen action runs after the sheet has closed, so it may
 * open an Alert or navigate.
 */
export function ActionSheet({ visible, title, message, options, cancelLabel = 'Annuleren', onClose }: ActionSheetProps) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useRef<(() => void) | null>(null);

  const flush = useCallback(() => {
    const run = pending.current;
    pending.current = null;
    run?.();
  }, []);

  const choose = (option: ActionSheetOption) => {
    haptics.selection();
    pending.current = option.onPress;
    onClose();
    // iOS: run once the modal is gone (onDismiss); presenting an Alert during the
    // dismiss animation fails there. Android has no onDismiss.
    if (Platform.OS !== 'ios') setTimeout(flush, 0);
  };

  const row = (key: string, label: string, onPress: () => void, opts: { destructive?: boolean; icon?: IconName; hint?: string; bold?: boolean } = {}) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={opts.hint}
      style={({ pressed }) => ({
        minHeight: Math.max(TOUCH_MIN, 56),
        paddingHorizontal: layout.cardPadding + 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: pressed ? colors.bg2 : 'transparent',
      })}
    >
      {opts.icon ? <Icon name={opts.icon} size={20} color={opts.destructive ? colors.error : colors.text2} /> : null}
      <Text variant={opts.bold ? 'heading' : 'body'} tone={opts.destructive ? 'danger' : 'default'} style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={flush} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.bg1,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: space.sm,
            paddingBottom: Math.max(insets.bottom, space.md),
          }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.bg3, marginBottom: space.sm }} />
          {title || message ? (
            <View style={{ paddingHorizontal: layout.cardPadding + 2, paddingBottom: space.sm, gap: space.xs }}>
              {title ? (
                <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
                  {title}
                </Text>
              ) : null}
              {message ? (
                <Text variant="caption" tone="secondary">
                  {message}
                </Text>
              ) : null}
            </View>
          ) : null}
          {options.map((o, i) =>
            row(`o${i}`, o.label, () => choose(o), { destructive: o.destructive, icon: o.icon, hint: o.accessibilityHint }),
          )}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.xs }} />
          {row('cancel', cancelLabel, onClose, { bold: true })}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Imperative use, like `Alert.alert`:
 *   const sheet = useActionSheet();
 *   sheet.show({ title, options: [...] });
 *   return <>{...}{sheet.element}</>;
 */
export function useActionSheet(): { show: (config: ActionSheetConfig) => void; close: () => void; element: ReactNode } {
  const [config, setConfig] = useState<ActionSheetConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const show = useCallback((c: ActionSheetConfig) => {
    setConfig(c);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);
  const element = useMemo(
    () => (config ? <ActionSheet visible={visible} {...config} onClose={close} /> : null),
    [config, visible, close],
  );
  return { show, close, element };
}
