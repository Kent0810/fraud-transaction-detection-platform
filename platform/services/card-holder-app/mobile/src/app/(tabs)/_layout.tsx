import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useStore } from '@/data/store';
import { useColors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  // The tab bar always passes a color string (from tabBarActiveTintColor / InactiveTintColor).
  return <Ionicons name={name} color={color as string} size={size} />;
}

const icon = (name: IconName, active: IconName) =>
  function Icon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <TabIcon name={focused ? active : name} color={color} size={size} />;
  };

export default function TabLayout() {
  const c = useColors();
  const openAlerts = useStore().alerts.filter((a) => a.status === 'OPEN').length;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: c.surface, borderTopWidth: 0 },
        tabBarBadgeStyle: { backgroundColor: c.decline, fontSize: 11 },
        sceneStyle: { backgroundColor: c.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: icon('notifications-outline', 'notifications'),
          tabBarBadge: openAlerts > 0 ? openAlerts : undefined,
        }}
      />
      <Tabs.Screen name="budget" options={{ title: 'Budget', tabBarIcon: icon('pie-chart-outline', 'pie-chart') }} />
      <Tabs.Screen
        name="merchants"
        options={{ title: 'Merchants', tabBarIcon: icon('storefront-outline', 'storefront') }}
      />
    </Tabs>
  );
}
