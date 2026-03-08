import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { Home, Package, User } from 'lucide-react-native';
import { ModeSwitcher } from '@/components/ui/ModeSwitcher';
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

export default function BuyerLayout() {
  const { user, isLoading } = useAuth();
  const { isMultiRole } = useMode();
  const router = useRouter();

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
      {isMultiRole && <ModeSwitcher />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#dc2626',
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
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
        {/* Accessible via quick-action, not shown in tab bar */}
        <Tabs.Screen name="catalog" options={{ href: null }} />
        <Tabs.Screen name="order-request" options={{ href: null }} />
        <Tabs.Screen name="order/[id]" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}
