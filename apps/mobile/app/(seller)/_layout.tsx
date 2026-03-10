import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { FileText, Inbox, LayoutGrid, Wallet } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import { t } from '@/lib/translations';

const ACCENT = '#111827';

export default function SellerLayout() {
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
            name="incoming"
            options={{
              title: t.tabs.incoming,
              tabBarIcon: ({ color }) => <Inbox size={22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="quotes"
            options={{
              title: t.tabs.quotes,
              tabBarIcon: ({ color }) => <FileText size={22} color={color} />,
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
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      </View>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="seller"
        accentColor={ACCENT}
        isMultiRole={isMultiRole}
      />
    </View>
  );
}
