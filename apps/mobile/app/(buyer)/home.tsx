import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api';
import {
  HardHat,
  Trash2,
  Truck,
  Package,
  ChevronRight,
  Bell,
  ClipboardList,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { Sidebar } from '@/components/ui/Sidebar';

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'LOADING',
  'DISPATCHED',
  'DELIVERING',
]);

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida apstiprinājumu',
  CONFIRMED: 'Apstiprināts',
  PROCESSING: 'Apstrādē',
  LOADING: 'Iekraušana',
  DISPATCHED: 'Nosūtīts',
  DELIVERING: 'Piegādē',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: '#9ca3af',
  CONFIRMED: '#111827',
  PROCESSING: '#374151',
  LOADING: '#374151',
  DISPATCHED: '#059669',
  DELIVERING: '#059669',
};

const SERVICES = [
  {
    id: 'materials',
    icon: HardHat,
    label: 'Materiāli',
    sub: 'Smiltis, grants, šķembas',
    route: '/order-request',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    sub: 'Konteineru noma',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    sub: 'Atkritumu izvešana',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
    sub: 'Kravu pārvadāšana',
    route: '/transport',
  },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labrīt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

const TAB_H = 52;

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Service tile entrance animations
  const tileAnims = useRef(SERVICES.map(() => new Animated.Value(0))).current;
  const tileScales = useRef(SERVICES.map(() => new Animated.Value(1))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const activeCardScale = useRef(new Animated.Value(1)).current;

  // Staggered entrance on mount
  useEffect(() => {
    tileAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        delay: 80 + i * 70,
        useNativeDriver: true,
        tension: 75,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pulsing live dot on active order
  useEffect(() => {
    const hasActive = orders.some((o) => ACTIVE_STATUSES.has(o.status));
    if (!hasActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.orders.myOrders(token).then(setOrders).catch(() => setOrders([]));
      api.notifications
        .unreadCount(token)
        .then((res) => setUnreadCount(res.count))
        .catch(() => {});
    }, [token]),
  );

  const pressTile = (idx: number) => {
    Animated.sequence([
      Animated.spring(tileScales[idx], {
        toValue: 0.93,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(tileScales[idx], {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }),
    ]).start();
  };

  const activeOrder = orders.find((o) => ACTIVE_STATUSES.has(o.status)) ?? null;
  const recentOrders = orders.filter((o) => !ACTIVE_STATUSES.has(o.status)).slice(0, 3);

  return (
    <View style={s.root}>
      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => { haptics.light(); setSidebarOpen(true); }}
          activeOpacity={0.8}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.firstName?.[0]?.toUpperCase() ?? '?'}</Text>
            {unreadCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.greetingLabel}>{greeting()},</Text>
          <Text style={s.greetingName} numberOfLines={1}>
            {user?.firstName ?? 'Lietotājs'}
          </Text>
        </View>
        <TouchableOpacity
          style={s.bellBtn}
          onPress={() => {
            haptics.light();
            router.push('/notifications' as any);
          }}
          activeOpacity={0.75}
        >
          <Bell size={22} color="#111827" />
          {unreadCount > 0 && <View style={s.bellDot} />}
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: TAB_H + insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active order banner */}
        {activeOrder && (
          <Animated.View style={{ transform: [{ scale: activeCardScale }] }}>
            <TouchableOpacity
              style={s.activeCard}
              onPress={() => {
                haptics.light();
                router.push(`/(buyer)/order/${activeOrder.id}` as any);
              }}
              onPressIn={() =>
                Animated.spring(activeCardScale, {
                  toValue: 0.97,
                  useNativeDriver: true,
                  tension: 300,
                  friction: 8,
                }).start()
              }
              onPressOut={() =>
                Animated.spring(activeCardScale, {
                  toValue: 1,
                  useNativeDriver: true,
                  tension: 200,
                  friction: 8,
                }).start()
              }
              activeOpacity={1}
            >
              <View style={s.activeDotWrap}>
                <Animated.View
                  style={[
                    s.activeDotRing,
                    {
                      backgroundColor: STATUS_DOT[activeOrder.status] ?? '#9ca3af',
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                />
                <View
                  style={[s.activeDot, { backgroundColor: STATUS_DOT[activeOrder.status] ?? '#9ca3af' }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.activeLabel}>Aktīvs pasūtījums</Text>
                <Text style={s.activeNum}>#{activeOrder.orderNumber}</Text>
                <Text style={s.activeStatus}>
                  {STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
                </Text>
              </View>
              <ChevronRight size={18} color="#6b7280" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Quick services row — compact shortcuts, full detail lives on Services tab */}
        <Text style={s.sectionTitle}>Pakalpojumi</Text>
        <View style={s.quickRow}>
          {SERVICES.map((svc, idx) => {
            const Icon = svc.icon;
            return (
              <Animated.View
                key={svc.id}
                style={{
                  flex: 1,
                  opacity: tileAnims[idx],
                  transform: [{ scale: tileScales[idx] }],
                }}
              >
                <TouchableOpacity
                  style={s.quickTile}
                  onPress={() => {
                    haptics.light();
                    pressTile(idx);
                    setTimeout(() => router.push(svc.route as any), 70);
                  }}
                  activeOpacity={1}
                >
                  <View style={s.quickTileIcon}>
                    <Icon size={22} color="#111827" />
                  </View>
                  <Text style={s.quickTileLabel} numberOfLines={1}>{svc.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Recent orders */}
        {recentOrders.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Nesenie pasūtījumi</Text>
              <TouchableOpacity onPress={() => router.push('/(buyer)/orders' as any)}>
                <Text style={s.sectionCta}>Visi →</Text>
              </TouchableOpacity>
            </View>
            <View style={s.recentCard}>
              {recentOrders.map((o, i) => (
                <TouchableOpacity
                  key={o.id}
                  style={[s.recentRow, i < recentOrders.length - 1 && s.recentRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(buyer)/order/${o.id}` as any)}
                >
                  <View style={s.recentIcon}>
                    <Package size={13} color="#6b7280" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentNum}>#{o.orderNumber}</Text>
                    <Text style={s.recentCity} numberOfLines={1}>
                      {o.deliveryCity}
                    </Text>
                  </View>
                  <Text style={s.recentStatus}>{STATUS_LABEL[o.status] ?? o.status}</Text>
                  <ChevronRight size={14} color="#d1d5db" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Empty state */}
        {orders.length === 0 && (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <ClipboardList size={32} color="#9ca3af" />
            </View>
            <Text style={s.emptyTitle}>Nav aktīvu pasūtījumu</Text>
            <Text style={s.emptyDesc}>
              Izvēlieties pakalpojumu augstāk un veiciet pirmo pasūtījumu
            </Text>
          </View>
        )}

        {/* All orders link */}
        {orders.length > 3 && (
          <TouchableOpacity
            style={s.allOrdersBtn}
            onPress={() => router.push('/(buyer)/orders' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.allOrdersBtnText}>Skatīt visus pasūtījumus</Text>
            <ChevronRight size={16} color="#111827" />
          </TouchableOpacity>
        )}
      </ScrollView>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="buyer"
        accentColor="#111827"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#f2f2f7',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#f2f2f7',
  },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 12 },
  greetingLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    lineHeight: 24,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#f2f2f7',
  },

  // Scroll
  scroll: { paddingHorizontal: 16, gap: 12 },

  // Section labels
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#6b7280',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
    marginTop: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  sectionCta: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },

  // Active order card
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginTop: 8,
  },
  activeDotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  activeDotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, opacity: 0.3 },
  activeLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 1, lineHeight: 15 },
  activeNum: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#111827', lineHeight: 20 },
  activeStatus: { fontSize: 12, color: '#374151', marginTop: 2, lineHeight: 17 },

  // Quick services horizontal row
  quickRow: { flexDirection: 'row', gap: 8 },
  quickTile: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  quickTileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textAlign: 'center',
  },

  // Recent orders
  recentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentNum: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', color: '#111827', lineHeight: 18 },
  recentCity: { fontSize: 11, color: '#9ca3af', lineHeight: 16, marginTop: 1 },
  recentStatus: { fontSize: 11, color: '#6b7280', lineHeight: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },

  // All orders link
  allOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  allOrdersBtnText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
});
