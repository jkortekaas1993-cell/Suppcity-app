import { Pressable, View } from 'react-native';

import { HIT_SLOP_MIN, Icon, haptics, useTheme } from '@/ui';

import type { IntakeStatus } from '../data/types';

const BOX = 28;
const SLOP = (HIT_SLOP_MIN - BOX) / 2;

export interface IntakeCheckProps {
  status: IntakeStatus | null;
  /** e.g. "Creatine ingenomen" */
  accessibilityLabel: string;
  onPress: () => void;
}

/** 28pt check box (mockup): open → bg2 + strong border; taken → accent with a check; skipped → muted dash. */
export function IntakeCheck({ status, accessibilityLabel, onPress }: IntakeCheckProps) {
  const { colors, radius } = useTheme();
  const taken = status === 'taken';
  const skipped = status === 'skipped';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: taken }}
      hitSlop={{ top: SLOP, bottom: SLOP, left: SLOP, right: SLOP }}
      onPress={() => {
        haptics.light();
        onPress();
      }}
    >
      <View
        style={{
          width: BOX,
          height: BOX,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: taken ? colors.accent : colors.bg2,
          borderWidth: taken ? 0 : 1,
          borderColor: colors.borderStrong,
        }}
      >
        {taken ? <Icon name="check" size={16} color={colors.onAccent} /> : null}
        {skipped ? <Icon name="minus" size={16} color={colors.text3} /> : null}
      </View>
    </Pressable>
  );
}
