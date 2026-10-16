import { View } from 'react-native';

import { Appear, Icon, SectionLabel, Segmented, Text, useTheme } from '@/ui';

import { useBadges } from '../hooks/useBadges';
import type { BadgeDefinition, BadgeView } from '../logic/badges';
import { formatDateNl } from '../logic/format';
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from '../logic/week';

const MEDAL = 64;
const PER_ROW = 4;

/** One medal tile: gold for strength records, turquoise tint for consistency, dashed when locked. */
export function BadgeMedal({ badge, earned, size = MEDAL }: { badge: BadgeDefinition; earned: boolean; size?: number }) {
  const { colors, radius } = useTheme();
  const gold = badge.tone === 'gold';
  const fg = !earned ? colors.borderStrong : gold ? colors.gold : colors.accentText;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: earned ? 'solid' : 'dashed',
        borderColor: !earned ? colors.borderStrong : gold ? colors.goldBorder : colors.accentBorder,
        backgroundColor: !earned ? colors.bg1 : gold ? colors.goldMuted : colors.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {badge.glyph ? (
        <Text
          variant="metric"
          style={{ fontSize: size >= MEDAL ? 22 : 16, lineHeight: size >= MEDAL ? 26 : 20, color: fg }}
          maxFontSizeMultiplier={1.2}
        >
          {badge.glyph}
        </Text>
      ) : (
        <Icon name={badge.icon ?? 'star'} size={size >= MEDAL ? 26 : 20} color={fg} />
      )}
    </View>
  );
}

function medalLabel(b: BadgeView): string {
  return b.earned
    ? `${b.title}, behaald${b.earnedAt ? ` op ${formatDateNl(b.earnedAt)}` : ''}. ${b.description}`
    : `${b.title}, nog niet behaald. ${b.description}`;
}

export interface BadgesSectionProps {
  /** Section header; default "Mijlpalen". */
  title?: string;
  testID?: string;
}

/**
 * Milestones grid for the Ik tab: all badges, 4 per row, earned ones lit.
 * Local only and purely symbolic (no points, no discounts).
 */
export function BadgesSection({ title = 'Mijlpalen', testID }: BadgesSectionProps) {
  const { badges, earnedCount, total } = useBadges();
  const { space } = useTheme();
  const rows: BadgeView[][] = [];
  for (let i = 0; i < badges.length; i += PER_ROW) rows.push(badges.slice(i, i + PER_ROW));

  return (
    <View testID={testID} style={{ gap: space.md }}>
      <SectionLabel label={`${title} · ${earnedCount} van ${total}`} />
      {rows.map((row, i) => (
        <Appear key={i} index={i} style={{ flexDirection: 'row', gap: space.sm + 2 }}>
          {row.map((b) => (
            <View
              key={b.id}
              accessible
              accessibilityLabel={medalLabel(b)}
              style={{ flex: 1, alignItems: 'center', gap: space.xs + 2 }}
            >
              <BadgeMedal badge={b} earned={b.earned} />
              <Text
                variant="micro"
                tone={b.earned ? 'secondary' : 'tertiary'}
                align="center"
                numberOfLines={2}
              >
                {b.title}
              </Text>
            </View>
          ))}
          {Array.from({ length: PER_ROW - row.length }, (_, j) => (
            <View key={`pad-${j}`} style={{ flex: 1 }} />
          ))}
        </Appear>
      ))}
    </View>
  );
}

/** 1–5 workouts per week. No daily streaks, no guilt: just the number you aim for. */
export function WeeklyGoalPicker({ value, onChange }: { value: number; onChange: (goal: number) => void }) {
  const options = Array.from({ length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 }, (_, i) => {
    const n = WEEKLY_GOAL_MIN + i;
    return { value: String(n), label: `${n}×` };
  });
  return (
    <Segmented
      accessibilityLabel="Weekdoel, aantal trainingen per week"
      options={options}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
    />
  );
}
