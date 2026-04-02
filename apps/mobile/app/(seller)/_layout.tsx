import { Tabs } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { Home, Inbox, LayoutGrid, FileText, User, Wallet } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useUnreadCount } from '@/lib/use-unread-count';
import { useOpenQuoteCount } from '@/lib/use-open-quote-count';

const ACCENT = '#111827';

export default function SellerLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useUnreadCount();
  const openQuoteCount = useOpenQuoteCount();

  // Seller home renders its own greeting header — no layout TopBar or padding on that screen
  const isHome = pathname === '/(seller)/home' || pathname === '/home';
  const isQuotes = pathname.includes('/quotes');
  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback((props: BottomTabBarProps) => <AnimatedTabBar {...props} />, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
    } else if (!isLoading && user && !user.canSell) {
      // User is logged in but not an approved seller — send to buyer home
      router.replace('/(buyer)/home');
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
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        paddingTop: isHome || isQuotes ? 0 : insets.top,
      }}
    >
      {!isHome && !isQuotes && (
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
            name="incoming"
            options={{
              title: t.tabs.incoming,
              tabBarIcon: ({ color }) => <Inbox size={22} color={color} />,
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
            name="earnings"
            options={{
              title: t.tabs.earnings,
              tabBarIcon: ({ color }) => <Wallet size={22} color={color} />,
            }}
          />
          <Tabs.Screen name="order/[id]" options={{ href: null }} />
          <Tabs.Screen name="catalog.tsx.bak" options={{ href: null }} />
          <Tabs.Screen
            name="quotes"
            options={{
              title: t.tabs.quotes,
              tabBarIcon: ({ color }) => <FileText size={22} color={color} />,
              tabBarBadge: openQuoteCount > 0 ? openQuoteCount : undefined,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t.tabs.profile,
              tabBarIcon: ({ color }) => <User size={22} color={color} />,
            }}
          />
        </Tabs>
      </View>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="seller"
        accentColor={ACCENT}
      />
    </View>
  );
}
