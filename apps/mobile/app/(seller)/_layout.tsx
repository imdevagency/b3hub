import { Tabs } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { Inbox, User, Home, LayoutGrid, MoreHorizontal } from 'lucide-react-native';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useUnreadCount } from '@/lib/use-unread-count';
import { TopBar } from '@/components/ui/TopBar';
import { HeaderProvider, useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

function SellerLayoutContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadCount();
  const { config } = useHeaderConfig();
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

  // NOTE: Do NOT return early here — the <Tabs> navigator MUST always render so
  // expo-router can provide navigation context to all tab screens (including those
  // accessed via router.push that render before auth resolves). Show a full-screen
  // loading overlay instead.

  const avatarBtn = (
    <TouchableOpacity
      style={ls.avatarBtn}
      activeOpacity={0.85}
      onPress={() => {
        haptics.light();
        router.push('/(seller)/profile');
      }}
    >
      <Text style={ls.avatarBtnText}>
        {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgCard, paddingTop: insets.top }}>
      {isLoading && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            zIndex: 999,
          }}
        >
          <ActivityIndicator size="large" color="#111827" />
        </View>
      )}
      {config !== null && <TopBar title="" unreadCount={unreadCount} leftElement={avatarBtn} />}
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
          }}
        />
        <Tabs.Screen name="quotes" options={{ href: null }} />
        <Tabs.Screen
          name="catalog"
          options={{
            title: t.tabs.catalog,
            tabBarIcon: ({ color }) => <LayoutGrid size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="earnings" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen
          name="more"
          options={{
            title: t.tabs.more,
            tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} />,
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

const ls = StyleSheet.create({
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});

export default function SellerLayout() {
  return (
    <HeaderProvider>
      <SellerLayoutContent />
    </HeaderProvider>
  );
}
