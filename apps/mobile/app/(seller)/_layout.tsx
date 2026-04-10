import { Tabs } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { Inbox, Briefcase, User, Home } from 'lucide-react-native';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useOpenQuoteCount } from '@/lib/use-open-quote-count';
import { useUnreadCount } from '@/lib/use-unread-count';

export default function SellerLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const openQuoteCount = useOpenQuoteCount();
  const unreadCount = useUnreadCount();
  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback((props: BottomTabBarProps) => <AnimatedTabBar {...props} />, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
    } else if (!isLoading && user && !user.canSell) {
      // User is logged in but not an approved seller — send to buyer home
      router.replace('/(buyer)/home');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  const combinedBadge = unreadCount + openQuoteCount;

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top }}>
      <Tabs initialRouteName="home" screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
        <Tabs.Screen
          name="home"
          options={{
            title: t.tabs.home,
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="incoming"
          options={{
            title: 'Pieprasījumi',
            tabBarIcon: ({ color }) => <Inbox size={22} color={color} />,
            tabBarBadge: combinedBadge > 0 ? combinedBadge : undefined,
          }}
        />
        <Tabs.Screen name="quotes" options={{ href: null }} />
        <Tabs.Screen
          name="business"
          options={{
            title: t.tabs.business,
            tabBarIcon: ({ color }) => <Briefcase size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="catalog" options={{ href: null }} />
        <Tabs.Screen name="earnings" options={{ href: null }} />
        <Tabs.Screen
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="documents" options={{ href: null }} />
        <Tabs.Screen name="framework-contracts" options={{ href: null }} />
        <Tabs.Screen name="framework-contract/[id]" options={{ href: null }} />
        <Tabs.Screen name="order/[id]" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
