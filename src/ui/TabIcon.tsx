import { View } from 'react-native';

export type TabIconName = 'vandaag' | 'trainen' | 'shop' | 'ik';

/**
 * Geometric tab glyphs drawn with Views (no icon-font dependency).
 * Swap for a custom SVG icon set later without touching the tab layout.
 */
export function TabIcon({ name, color, size = 22 }: { name: TabIconName; color: string; size?: number }) {
  const u = size / 22;
  switch (name) {
    case 'vandaag':
      return (
        <View style={{ width: size, height: size, borderWidth: 2 * u, borderColor: color, borderRadius: 3 * u }}>
          <View style={{ height: 5 * u, backgroundColor: color }} />
        </View>
      );
    case 'trainen':
      // Barbell
      return (
        <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 4 * u, height: 14 * u, backgroundColor: color, borderRadius: 1 }} />
          <View style={{ flex: 1, height: 3 * u, backgroundColor: color }} />
          <View style={{ width: 4 * u, height: 14 * u, backgroundColor: color, borderRadius: 1 }} />
        </View>
      );
    case 'shop':
      // Tub
      return (
        <View style={{ width: size, height: size, alignItems: 'center' }}>
          <View style={{ width: 14 * u, height: 4 * u, backgroundColor: color, borderRadius: 1 }} />
          <View
            style={{
              width: 18 * u,
              flex: 1,
              marginTop: 1 * u,
              borderWidth: 2 * u,
              borderColor: color,
              borderRadius: 3 * u,
            }}
          />
        </View>
      );
    case 'ik':
      return (
        <View style={{ width: size, height: size, alignItems: 'center', gap: 2 * u }}>
          <View style={{ width: 9 * u, height: 9 * u, borderRadius: 5 * u, borderWidth: 2 * u, borderColor: color }} />
          <View
            style={{
              width: 18 * u,
              flex: 1,
              borderTopLeftRadius: 9 * u,
              borderTopRightRadius: 9 * u,
              borderWidth: 2 * u,
              borderBottomWidth: 0,
              borderColor: color,
            }}
          />
        </View>
      );
  }
}
