import { Tabs } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { ClipboardList, Map, User, Wallet } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import { t } from '@/lib/translations';
import { useUnreadCount } from '@/lib/use-unread-count';

const ACCENT = '#111827';

export default function DriverLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useUnreadCount();
  // eslint-disable-next-line react/display-name
  const renderTabBar = useCallback((props: any) => <AnimatedTabBar {...props} />, []);

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
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: insets.top }}>
      <TopBar
        accentColor={ACCENT}
        onMenuPress={() => setSidebarOpen(true)}
        unreadCount={unreadCount}
      />
      <View style={{ flex: 1 }}>
        <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
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
