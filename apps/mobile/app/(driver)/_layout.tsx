import { Tabs } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import {
  ClipboardList,
  Map,
  User,
  Wallet,
  CalendarDays,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react-native';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useActiveJob } from '@/lib/use-active-job';
import { useUnreadCount } from '@/lib/use-unread-count';
import { TopBar } from '@/components/ui/TopBar';
import { HeaderProvider, useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

function DriverLayoutContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasActiveJob } = useActiveJob();
  const unreadCount = useUnreadCount();
  const { config } = useHeaderConfig();

  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <AnimatedTabBar
        {...props}
        hiddenRouteAliases={{ active: 'home', jobs: 'home' }}
        onRoutePress={(routeName, defaultHandler) => {
          if (routeName === 'home' && hasActiveJob) {
            router.push('/(driver)/active');
          } else {
            defaultHandler();
          }
        }}
      />
    ),
    [hasActiveJob, router],
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
    } else if (!isLoading && user && !user.canTransport) {
      // User is logged in but not an approved driver — send to buyer home
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
        router.push('/(driver)/profile');
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
      {config !== null && (
        <TopBar
          title=""
          unreadCount={unreadCount}
          leftElement={avatarBtn}
          centerElement={config.centerElement}
        />
      )}
      <Tabs initialRouteName="home" screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
        <Tabs.Screen
          name="home"
          options={{
            title: hasActiveJob ? t.tabs.active : t.tabs.jobs,
            tabBarIcon: ({ color, focused }) => {
              if (hasActiveJob) {
                return (
                  <View>
                    <Map size={22} color="#059669" />
                    {!focused && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -6,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: '#059669',
                          borderWidth: 2,
                          borderColor: colors.white,
                        }}
                      />
                    )}
                  </View>
                );
              }
              return <ClipboardList size={22} color={color} />;
            },
          }}
        />
        <Tabs.Screen name="jobs" options={{ href: null }} />
        <Tabs.Screen name="active" options={{ href: null }} />
        <Tabs.Screen
          name="schedule"
          options={{
            title: t.tabs.schedule,
            tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="vehicles" options={{ href: null }} />
        <Tabs.Screen
          name="earnings"
          options={{
            title: t.tabs.earnings,
            tabBarIcon: ({ color }) => <Wallet size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Ziņojumi',
            tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} />,
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          }}
        />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen
          name="more"
          options={{
            title: t.tabs.more,
            tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="skips" options={{ href: null }} />
        <Tabs.Screen name="documents" options={{ href: null }} />
        <Tabs.Screen name="job-stat/[id]" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const ls = StyleSheet.create({
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
});

export default function DriverLayout() {
  return (
    <HeaderProvider>
      <DriverLayoutContent />
    </HeaderProvider>
  );
}
