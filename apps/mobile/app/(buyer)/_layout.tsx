import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { Home, LayoutGrid, Package } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { t } from '@/lib/translations';

// Uber-style tab bar: no harsh border, soft upward shadow, taller for thumb comfort
const TAB_BAR = {
  backgroundColor: '#ffffff',
  borderTopWidth: 0,
  height: 62,
  paddingTop: 6,
  paddingBottom: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 20,
};

const TAB_LABEL_STYLE = { fontSize: 11, fontWeight: '600' as const };

const ACCENT = '#dc2626';

export default function BuyerLayout() {
  const { user, isLoading } = useAuth();
  const { isMultiRole } = useMode();
  const router = useRouter();
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
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <TopBar accentColor={ACCENT} onMenuPress={() => setSidebarOpen(true)} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: ACCENT,
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: TAB_BAR,
          tabBarLabelStyle: TAB_LABEL_STYLE,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: t.tabs.home,
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: t.tabs.orders,
            tabBarIcon: ({ color }) => <Package size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="catalog"
          options={{
            title: t.tabs.catalog,
            tabBarIcon: ({ color }) => <LayoutGrid size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="invoices" options={{ href: null }} />
        <Tabs.Screen name="order/[id]" options={{ href: null }} />
      </Tabs>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="buyer"
        accentColor={ACCENT}
        isMultiRole={isMultiRole}
      />
    </SafeAreaView>
  );
}
