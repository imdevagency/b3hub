import { Tabs } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { Home, ClipboardList, User } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useUnreadCount } from '@/lib/use-unread-count';

const ACCENT = '#111827';

export default function BuyerLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useUnreadCount();
  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback((props: BottomTabBarProps) => <AnimatedTabBar {...props} />, []);

  // Home tab is full-screen map — no TopBar or status-bar padding
  const isHome = pathname === '/(buyer)/home' || pathname === '/home';
  const isDetailScreen =
    pathname.includes('/rfq/') ||
    pathname.includes('/project/') ||
    pathname.includes('/transport-job/') ||
    pathname.includes('/framework-contract/') ||
    pathname.includes('/skip-order/');
  const hideTopBar = isHome || isDetailScreen;

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
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: hideTopBar ? 0 : insets.top }}>
      {!hideTopBar && (
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
              title: t.tabs.home,
              tabBarIcon: ({ color }) => <Home size={22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="orders"
            options={{
              title: t.tabs.activity,
              tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} />,
              tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            }}
          />
          <Tabs.Screen
            name="catalog"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t.tabs.account,
              tabBarIcon: ({ color }) => <User size={22} color={color} />,
            }}
          />
          <Tabs.Screen name="order/[id]" options={{ href: null }} />
          <Tabs.Screen name="skip-order/[id]" options={{ href: null }} />
          <Tabs.Screen name="rfq/[id]" options={{ href: null }} />
          <Tabs.Screen name="invoices" options={{ href: null }} />
          <Tabs.Screen name="containers" options={{ href: null }} />
          <Tabs.Screen name="certificates" options={{ href: null }} />
          <Tabs.Screen name="projects" options={{ href: null }} />
          <Tabs.Screen name="project/[id]" options={{ href: null }} />
          <Tabs.Screen name="team" options={{ href: null }} />
          <Tabs.Screen name="transport-job/[id]" options={{ href: null }} />
          <Tabs.Screen name="framework-contracts" options={{ href: null }} />
          <Tabs.Screen name="framework-contract/[id]" options={{ href: null }} />
        </Tabs>
      </View>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="buyer"
        accentColor={ACCENT}
      />
    </View>
  );
}
