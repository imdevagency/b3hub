import { Tabs } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { ClipboardList, Map, User, Wallet, CalendarDays } from 'lucide-react-native';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useActiveJob } from '@/lib/use-active-job';

export default function DriverLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasActiveJob } = useActiveJob();

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
                          top: -3,
                          right: -5,
                          width: 9,
                          height: 9,
                          borderRadius: 5,
                          backgroundColor: '#059669',
                          borderWidth: 2,
                          borderColor: '#ffffff',
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
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="skips" options={{ href: null }} />
        <Tabs.Screen name="documents" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
