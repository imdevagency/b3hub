import { Tabs } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { Home, FolderKanban, FileText, MoreHorizontal, MessageCircle } from 'lucide-react-native';
import { AnimatedTabBar } from '@/components/ui/AnimatedTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { t } from '@/lib/translations';
import { useNotifications } from '@/lib/notifications-context';
import { TopBar } from '@/components/ui/TopBar';
import { HeaderProvider, useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

function ConstructionLayoutContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount, chatUnreadCount } = useNotifications();
  const { config } = useHeaderConfig();
  const renderTabBar = useCallback((props: BottomTabBarProps) => <AnimatedTabBar {...props} />, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
      return;
    }
    if (!isLoading && user) {
      const companyFeatures: string[] = (user as any).companyFeatures ?? [];
      const companyType: string | undefined = (user as any).company?.companyType;
      if (companyType !== 'CONSTRUCTION' || !companyFeatures.includes('CONSTRUCTION_MANAGEMENT')) {
        router.replace('/(buyer)/home');
      }
    }
  }, [user, isLoading, router]);

  const avatarBtn = (
    <TouchableOpacity
      style={ls.avatarBtn}
      activeOpacity={0.85}
      onPress={() => {
        haptics.light();
        router.push('/(construction)/more');
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
      {config !== null && <TopBar title="" unreadCount={unreadCount} leftElement={avatarBtn} />}
      <Tabs initialRouteName="home" screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
        <Tabs.Screen
          name="home"
          options={{
            title: t.tabs.home,
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: 'Projekti',
            tabBarIcon: ({ color }) => <FolderKanban size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="daily-reports"
          options={{
            title: 'Atskaites',
            tabBarIcon: ({ color }) => <FileText size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Ziņojumi',
            tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} />,
            tabBarBadge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t.tabs.more,
            tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} />,
          }}
        />
        {/* Hidden screens */}
        <Tabs.Screen name="daily-report-new" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

export default function ConstructionLayout() {
  return (
    <HeaderProvider>
      <ConstructionLayoutContent />
    </HeaderProvider>
  );
}

const ls = StyleSheet.create({
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
