import { Tabs, usePathname } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useMode, MODE_HOME } from '@/lib/mode-context';
import { Home, ClipboardList, User, Briefcase, MessageCircle } from 'lucide-react-native';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useUnreadCount } from '@/lib/use-unread-count';
import { TopBar } from '@/components/ui/TopBar';
import { HeaderProvider, useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

function BuyerLayoutContent() {
  const { user, isLoading } = useAuth();
  const { availableModes } = useMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadCount();
  const { config } = useHeaderConfig();
  const pathname = usePathname();
  // Routes that run edge-to-edge and should hide the tab bar + top bar (tracking, live maps, etc.)
  const isFullScreenRoute = /\/(order|skip-order|transport-job)\/[^/]/.test(pathname);
  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (isFullScreenRoute ? null : <AnimatedTabBar {...props} />),
    [isFullScreenRoute],
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
    } else if (!isLoading && user && user.userType === 'ADMIN') {
      // Admin users must use the web portal — no admin UI exists on mobile
      // (stays in place; a blocking overlay is rendered below)
    } else if (!isLoading && user && !availableModes.includes('BUYER')) {
      // Pure carrier or pure supplier — they have no buyer mode; send to their home
      const home = MODE_HOME[availableModes[0] ?? 'BUYER'];
      router.replace(home);
    }
  }, [user, isLoading, availableModes, router]);

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
        router.push('/(buyer)/profile');
      }}
    >
      <Text style={ls.avatarBtnText}>
        {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgCard,
        paddingTop: isFullScreenRoute ? 0 : insets.top,
      }}
    >
      {config !== null && !isFullScreenRoute && (
        <TopBar title="" unreadCount={unreadCount} leftElement={avatarBtn} />
      )}
      <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
        <Tabs.Screen
          name="home"
          options={{
            title: t.tabs.home,
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="new-order" options={{ href: null }} />
        <Tabs.Screen name="catalog" options={{ href: null }} />
        <Tabs.Screen
          name="orders"
          options={{
            title: t.tabs.activity,
            tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="business"
          options={{
            title: t.tabs.business,
            tabBarIcon: ({ color }) => <Briefcase size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Čati',
            tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
        {/* Detail screens — hidden from tab bar */}
        <Tabs.Screen name="order/[id]" options={{ href: null }} />
        <Tabs.Screen name="skip-order/[id]" options={{ href: null }} />
        <Tabs.Screen name="transport-job/[id]" options={{ href: null }} />
        <Tabs.Screen name="rfq/[id]" options={{ href: null }} />
        {/* (work) group — projects & contracts */}
        <Tabs.Screen name="(work)/framework-contracts" options={{ href: null }} />
        <Tabs.Screen name="(work)/framework-contract/[id]" options={{ href: null }} />
        <Tabs.Screen name="(work)/projects" options={{ href: null }} />
        <Tabs.Screen name="(work)/project/[id]" options={{ href: null }} />
        <Tabs.Screen name="(work)/project/new" options={{ href: null }} />
        {/* (account) group — company management */}
        <Tabs.Screen name="(account)/invoices" options={{ href: null }} />
        <Tabs.Screen name="(account)/certificates" options={{ href: null }} />
        <Tabs.Screen name="(account)/documents" options={{ href: null }} />
        <Tabs.Screen name="(account)/team" options={{ href: null }} />
        <Tabs.Screen name="(account)/saved-addresses" options={{ href: null }} />
        <Tabs.Screen name="(account)/disputes" options={{ href: null }} />
        <Tabs.Screen name="(account)/schedules" options={{ href: null }} />
        <Tabs.Screen name="(account)/field-passes" options={{ href: null }} />
        <Tabs.Screen name="(account)/analytics" options={{ href: null }} />
      </Tabs>
      {/* Loading overlay — rendered OVER Tabs so navigation context is always mounted */}
      {isLoading && (
        <View style={ls.loadingOverlay}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      )}
      {/* Admin guard overlay — admin users must use the web portal */}
      {!isLoading && user?.userType === 'ADMIN' && (
        <View style={ls.loadingOverlay}>
          <Text style={ls.adminTitle}>Administratora panelis</Text>
          <Text style={ls.adminSub}>Lūdzu izmantojiet tīmekļa portālu</Text>
          <TouchableOpacity
            style={ls.adminLogout}
            onPress={() => router.replace('/(auth)/welcome')}
            activeOpacity={0.8}
          >
            <Text style={ls.adminLogoutText}>Iziet</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const ls = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  adminTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  adminSub: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  adminLogout: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
  },
  adminLogoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
});

export default function BuyerLayout() {
  return (
    <HeaderProvider>
      <BuyerLayoutContent />
    </HeaderProvider>
  );
}
