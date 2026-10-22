import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../ctx/AppContext';
import { C, FONT_UR_BOLD } from '../../lib/theme';

export default function TabsLayout() {
  const { t, rtl } = useApp();
  const insets = useSafeAreaInsets();
  const icon = (name: React.ComponentProps<typeof Ionicons>['name'], outline: React.ComponentProps<typeof Ionicons>['name']) =>
    ({ color, focused }: { color: any; focused: boolean }) => <Ionicons name={focused ? name : outline} size={23} color={color} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.faint,
        tabBarLabelStyle: rtl ? { fontFamily: FONT_UR_BOLD, fontSize: 11, lineHeight: 22 } : { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.97)', borderTopColor: C.line, height: 58 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6), ...(Platform.OS === 'android' ? { elevation: 12 } : {}), flexDirection: rtl ? 'row-reverse' : 'row' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('navHome'), tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="orders" options={{ title: t('navOrders'), tabBarIcon: icon('cut', 'cut-outline') }} />
      <Tabs.Screen name="customers" options={{ title: t('navCustomers'), tabBarIcon: icon('people', 'people-outline') }} />
      <Tabs.Screen name="accounts" options={{ title: t('navAccounts'), tabBarIcon: icon('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('navSettings'), tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
