import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { ActiveWorkoutBar } from '@/features/tracker';
import { TabIcon, useTheme } from '@/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      initialRouteName="vandaag"
      // The active-workout bar is rendered above the tab bar on every tab.
      tabBar={(props) => (
        <View>
          <ActiveWorkoutBar />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="vandaag"
        options={{ title: 'Vandaag', tabBarIcon: ({ color }) => <TabIcon name="vandaag" color={color} /> }}
      />
      <Tabs.Screen
        name="trainen"
        options={{ title: 'Trainen', tabBarIcon: ({ color }) => <TabIcon name="trainen" color={color} /> }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: 'Shop', tabBarIcon: ({ color }) => <TabIcon name="shop" color={color} /> }}
      />
      <Tabs.Screen
        name="ik"
        options={{ title: 'Ik', tabBarIcon: ({ color }) => <TabIcon name="ik" color={color} /> }}
      />
    </Tabs>
  );
}
