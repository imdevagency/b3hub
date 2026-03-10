import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { ClipboardList, Map, Trash2 } from 'lucide-react-native';
import { TopBar } from '@/components/ui/TopBar';
import { Sidebar } from '@/components/ui/Sidebar';
import { t } from '@/lib/translations';

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

const ACCENT = '#111827';

export default function DriverLayout() {
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
        <ActivityIndicator size="large" color="#111827" />
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
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="vehicles" options={{ href: null }} />
      </Tabs>
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="driver"
        accentColor={ACCENT}
        isMultiRole={isMultiRole}
      />
    </SafeAreaView>
  );
}
