import { Tabs } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useMode, MODE_HOME } from '@/lib/mode-context';
import { Home, ClipboardList, User, ShoppingCart, LayoutGrid } from 'lucide-react-native';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useUnreadCount } from '@/lib/use-unread-count';

export default function BuyerLayout() {
  const { user, isLoading } = useAuth();
  const { availableModes } = useMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadCount();
  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback((props: BottomTabBarProps) => <AnimatedTabBar {...props} />, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
    } else if (!isLoading && user && !availableModes.includes('buyer')) {
      // Pure carrier or pure supplier — they have no buyer mode; send to their home
      const home = MODE_HOME[availableModes[0] ?? 'buyer'];
      router.replace(home as any);
    }
  }, [user, isLoading, availableModes]);

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
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
        <Tabs.Screen
          name="home"
          options={{
            title: t.tabs.home,
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="new-order"
          options={{
            title: t.tabs.order,
            tabBarIcon: ({ color }) => <ShoppingCart size={22} color={color} />,
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
            title: t.tabs.catalog,
            tabBarIcon: ({ color }) => <LayoutGrid size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="order/[id]" options={{ href: null }} />
        <Tabs.Screen name="skip-order/[id]" options={{ href: null }} />
        <Tabs.Screen name="rfq/[id]" options={{ href: null }} />
        <Tabs.Screen name="invoices" options={{ href: null }} />
        <Tabs.Screen name="certificates" options={{ href: null }} />
        <Tabs.Screen name="documents" options={{ href: null }} />
        <Tabs.Screen name="team" options={{ href: null }} />
        <Tabs.Screen name="transport-job/[id]" options={{ href: null }} />
        <Tabs.Screen name="framework-contracts" options={{ href: null }} />
        <Tabs.Screen name="framework-contract/[id]" options={{ href: null }} />
        <Tabs.Screen name="projects" options={{ href: null }} />
        <Tabs.Screen name="project/[id]" options={{ href: null }} />
        <Tabs.Screen name="project/new" options={{ href: null }} />
        <Tabs.Screen name="saved-addresses" options={{ href: null }} />
        <Tabs.Screen name="disputes" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
