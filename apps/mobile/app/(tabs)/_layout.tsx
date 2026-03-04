import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useMode, AppMode } from '@/lib/mode-context';
import {
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/lib/translations';
import {
  Home,
  Package,
  Truck,
  User,
  ClipboardList,
  Map,
  Wallet,
  Inbox,
  LayoutGrid,
  ShoppingCart,
  Store,
} from 'lucide-react-native';

// ── Mode pill switcher ───────────────────────────────────────────────────────
const MODE_LABELS: Record<AppMode, string> = {
  buyer: t.mode.buyer,
  seller: t.mode.seller,
  driver: t.mode.driver,
};

function ModeSwitcherIcon({ mode, active }: { mode: AppMode; active: boolean }) {
  const color = active ? '#ffffff' : '#374151';
  const size = 14;
  if (mode === 'buyer') return <ShoppingCart size={size} color={color} />;
  if (mode === 'seller') return <Store size={size} color={color} />;
  return <Truck size={size} color={color} />;
}

const MODE_HOME: Record<AppMode, string> = {
  driver: '/(tabs)/jobs',
  seller: '/(tabs)/incoming',
  buyer: '/(tabs)/home',
};

function ModeSwitcher() {
  const { mode, setMode, availableModes } = useMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function handleSwitch(m: AppMode) {
    if (m === mode) return;
    setMode(m);
    router.replace(MODE_HOME[m] as any);
  }

  return (
    <View style={[styles.switcherWrapper, { paddingTop: insets.top }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.switcher}
      >
        {availableModes.map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => handleSwitch(m)}
            style={[styles.pill, mode === m && styles.pillActive]}
          >
            <ModeSwitcherIcon mode={m} active={mode === m} />
            <Text style={[styles.pillText, mode === m && styles.pillTextActive]}>
              {MODE_LABELS[m]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Tab layout ───────────────────────────────────────────────────────────────
export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const { mode, isMultiRole } = useMode();
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

  const tabBarStyle = {
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  };

  // ── DRIVER mode tabs ──────────────────────────────────────────────────────
  if (mode === 'driver') {
    return (
      <View style={{ flex: 1 }}>
        {isMultiRole && <ModeSwitcher />}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#dc2626',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarStyle,
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
          {/* Hide buyer/seller tabs in driver mode */}
          <Tabs.Screen name="home" options={{ href: null }} />
          <Tabs.Screen name="orders" options={{ href: null }} />
          <Tabs.Screen name="incoming" options={{ href: null }} />
          <Tabs.Screen name="catalog" options={{ href: null }} />
        </Tabs>
      </View>
    );
  }

  // ── SELLER mode tabs ──────────────────────────────────────────────────────
  if (mode === 'seller') {
    return (
      <View style={{ flex: 1 }}>
        {isMultiRole && <ModeSwitcher />}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#16a34a',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarStyle,
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
          {/* Hide buyer/driver tabs in seller mode */}
          <Tabs.Screen name="home" options={{ href: null }} />
          <Tabs.Screen name="orders" options={{ href: null }} />
          <Tabs.Screen name="jobs" options={{ href: null }} />
          <Tabs.Screen name="active" options={{ href: null }} />
          <Tabs.Screen name="earnings" options={{ href: null }} />
        </Tabs>
      </View>
    );
  }

  // ── BUYER mode tabs (default) ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {isMultiRole && <ModeSwitcher />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#dc2626',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle,
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
        {/* Hide driver/seller tabs in buyer mode */}
        <Tabs.Screen name="jobs" options={{ href: null }} />
        <Tabs.Screen name="active" options={{ href: null }} />
        <Tabs.Screen name="earnings" options={{ href: null }} />
        <Tabs.Screen name="incoming" options={{ href: null }} />
        <Tabs.Screen name="catalog" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  switcherWrapper: {
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  switcher: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  pillTextActive: {
    color: '#ffffff',
  },
});
