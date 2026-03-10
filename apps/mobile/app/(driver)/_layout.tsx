import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { ClipboardList, Map, Trash2, User } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import { t } from '@/lib/translations';

const ACCENT = '#111827';

export default function DriverLayout() {
  const { user, isLoading } = useAuth();
  const { isMultiRole } = useMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <TopBar accentColor={ACCENT} onMenuPress={() => setSidebarOpen(true)} />
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <AnimatedTabBar {...props} />}
        >
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
            name="skips"
            options={{
              title: t.tabs.skips,
              tabBarIcon: ({ color }) => <Trash2 size={22} color={color} />,
            }}
          />
          <Tabs.Screen name="earnings" options={{ href: null }} />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profils',
              tabBarIcon: ({ color }) => <User size={22} color={color} />,
            }}
          />
          <Tabs.Screen name="vehicles" options={{ href: null }} />
        </Tabs>
      </View>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="driver"
        accentColor={ACCENT}
        isMultiRole={isMultiRole}
      />
    </View>
  );
}
