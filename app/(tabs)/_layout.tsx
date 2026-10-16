import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { ActiveWorkoutBar } from '@/features/tracker';
import { haptics, TabIcon, Text, useTheme, type TabIconName } from '@/ui';

const TABS: { name: TabIconName; title: string }[] = [
  { name: 'vandaag', title: 'Vandaag' },
  { name: 'trainen', title: 'Trainen' },
  { name: 'shop', title: 'Shop' },
  { name: 'ik', title: 'Ik' },
];

export default function TabsLayout() {
  const { colors, type } = useTheme();
  const ios = Platform.OS === 'ios';
  return (
    <Tabs
      initialRouteName="vandaag"
      // The active-workout bar is rendered above the tab bar on every tab. The bar stack stays in
      // the layout flow (not absolute) so no screen content is ever hidden behind it.
      tabBar={(props) => (
        <View>
          <ActiveWorkoutBar />
          <BottomTabBar {...props} />
        </View>
      )}
      screenListeners={{ tabPress: () => haptics.selection() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: {
          backgroundColor: ios ? colors.barBg : colors.bg0,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarBackground: ios
          ? () => <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
          : undefined,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ color, focused }) => <TabIcon name={t.name} color={color} focused={focused} />,
            tabBarLabel: ({ color, focused }) => (
              <Text
                style={[
                  focused ? type.button : type.micro,
                  { color, fontSize: 11, lineHeight: 14, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {t.title}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
