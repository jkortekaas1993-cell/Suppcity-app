import type { ReactNode } from 'react';

import { ListRow } from './ListRow';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Right-aligned value, rendered with tabular figures (e.g. "100 kg × 5"). */
  value?: string;
  leading?: ReactNode;
  onPress?: () => void;
  testID?: string;
}

/**
 * @deprecated Release-1 row. Use `ListRow` (same props plus chevron, done, trailing, icon wells).
 * Kept as a thin wrapper so existing screens compile: always draws a divider, no chevron.
 */
export function ListItem({ title, subtitle, value, leading, onPress, testID }: ListItemProps) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      value={value}
      leading={leading}
      onPress={onPress}
      testID={testID}
      divider
      chevron={false}
    />
  );
}
