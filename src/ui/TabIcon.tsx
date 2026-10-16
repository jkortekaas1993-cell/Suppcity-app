import { Icon, type IconName } from './icons';

export type TabIconName = 'vandaag' | 'trainen' | 'shop' | 'ik';

const MAP: Record<TabIconName, IconName> = { vandaag: 'home', trainen: 'dumbbell', shop: 'bag', ik: 'user' };

/** Tab glyph: filled when the tab is active. Thin wrapper over `Icon` (release-1 API kept). */
export function TabIcon({
  name,
  color,
  size = 24,
  focused = false,
}: {
  name: TabIconName;
  color: string;
  size?: number;
  focused?: boolean;
}) {
  return <Icon name={MAP[name]} color={color} size={size} filled={focused} />;
}
