import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { FileText, Inbox, LayoutGrid, User } from 'lucide-react-native';
import { ModeSwitcher } from '@/components/ui/ModeSwitcher';
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

export default function SellerLayout() {
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
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      {isMultiRole && <ModeSwitcher />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#16a34a',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: TAB_BAR,
          tabBarLabelStyle: TAB_LABEL_STYLE,
        }}
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
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
