import { Tabs } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { Home, ClipboardList, Map, User, Wallet } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useUnreadCount } from '@/lib/use-unread-count';

const ACCENT = '#111827';

export default function DriverLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useUnreadCount();

  // Hide the global TopBar on these screens because they implement their own headers (e.g. back buttons) or are full-screen maps.
  const HIDE_TOPBAR_ROUTES = [
    '/home',
    '/vehicles',
    '/schedule',
    '/skips',
    '/(driver)/home',
    '/(driver)/vehicles',
    '/(driver)/schedule',
    '/(driver)/skips',
    '/earnings',
    '/(driver)/earnings',
  ];
  const shouldHideTopBar = HIDE_TOPBAR_ROUTES.some(
    (route) => pathname.startsWith(route) || pathname === route,
  );

  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback((props: BottomTabBarProps) => <AnimatedTabBar {...props} />, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: shouldHideTopBar ? 0 : insets.top }}
    >
      {!shouldHideTopBar && (
        <TopBar
          accentColor={ACCENT}
          onMenuPress={() => setSidebarOpen(true)}
          unreadCount={unreadCount}
        />
      )}
      <View style={{ flex: 1 }}>
        <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
          <Tabs.Screen
            name="home"
            options={{
              title: 'Sākums',
              tabBarIcon: ({ color }) => <Home size={22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="jobs"
            options={{
              title: t.tabs.jobs,
              tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="active"
            options={{
              title: t.tabs.active,
              tabBarIcon: ({ color }) => <Map size={22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="earnings"
            options={{
              title: t.tabs.earnings,
              tabBarIcon: ({ color }) => <Wallet size={22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t.tabs.profile,
              tabBarIcon: ({ color }) => <User size={22} color={color} />,
            }}
          />
          <Tabs.Screen name="skips" options={{ href: null }} />
          <Tabs.Screen name="vehicles" options={{ href: null }} />
          <Tabs.Screen name="schedule" options={{ href: null }} />
        </Tabs>
      </View>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="driver"
        accentColor={ACCENT}
      />
    </View>
  );
}
