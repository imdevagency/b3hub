import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useMode, AppMode } from '@/lib/mode-context';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { t } from '@/lib/translations';

// ── Mode pill switcher ───────────────────────────────────────────────────────
const MODE_LABELS: Record<AppMode, string> = {
  buyer: t.mode.buyer,
  seller: t.mode.seller,
  driver: t.mode.driver,
};

const MODE_ICONS: Record<AppMode, string> = {
  buyer: '🛒',
  seller: '📦',
  driver: '🚛',
};

function ModeSwitcher() {
  const { mode, setMode, availableModes } = useMode();

  return (
    <View style={styles.switcher}>
      {availableModes.map((m) => (
        <TouchableOpacity
          key={m}
          onPress={() => setMode(m)}
          style={[styles.pill, mode === m && styles.pillActive]}
        >
          <Text style={[styles.pillText, mode === m && styles.pillTextActive]}>
            {MODE_ICONS[m]} {MODE_LABELS[m]}
          </Text>
        </TouchableOpacity>
      ))}
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
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18 }}>{focused ? '📋' : '📄'}</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="active"
            options={{
              title: t.tabs.active,
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18 }}>{focused ? '🗺️' : '🗺'}</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="earnings"
            options={{
              title: t.tabs.earnings,
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18 }}>{focused ? '💰' : '💵'}</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t.tabs.profile,
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18 }}>{focused ? '👤' : '👥'}</Text>
              ),
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
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18 }}>{focused ? '📥' : '📨'}</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="catalog"
            options={{
              title: t.tabs.catalog,
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18 }}>{focused ? '📦' : '📫'}</Text>
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t.tabs.profile,
              tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 18 }}>{focused ? '👤' : '👥'}</Text>
              ),
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
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 18 }}>{focused ? '🏠' : '🏡'}</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: t.tabs.orders,
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 18 }}>{focused ? '🚛' : '🚚'}</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 18 }}>{focused ? '👤' : '👥'}</Text>
            ),
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
  switcher: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
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
