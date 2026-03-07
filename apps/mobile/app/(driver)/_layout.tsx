import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { ClipboardList, Map, Trash2, Wallet, User } from 'lucide-react-native';
import { ModeSwitcher } from '@/components/ui/ModeSwitcher';
import { t } from '@/lib/translations';

const TAB_BAR = { borderTopColor: '#e5e7eb', backgroundColor: '#ffffff' };

export default function DriverLayout() {
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
        }}
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
        {/* Accessible via profile, not shown in tab bar */}
        <Tabs.Screen name="vehicles" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}
