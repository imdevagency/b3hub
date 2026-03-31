import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder, SkipHireOrder, ApiTransportJob } from '@/lib/api';
import { HardHat, Trash2, Truck, Package, ChevronRight, Bell, Menu } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { Sidebar } from '@/components/ui/Sidebar';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useToast } from '@/components/ui/Toast';
import { BaseMap } from '@/components/map/BaseMap';

// ── Status maps ───────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'LOADING',
  'DISPATCHED',
  'DELIVERING',
  'SHIPPED',
]);

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida apstiprinājumu',
  CONFIRMED: 'Apstiprināts',
  PROCESSING: 'Apstrādē',
  LOADING: 'Iekraušana',
  DISPATCHED: 'Nosūtīts',
  DELIVERING: 'Piegāde',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: '#fbbf24', // amber-400
  CONFIRMED: '#22c55e', // green-500
  PROCESSING: '#3b82f6', // blue-500
  LOADING: '#3b82f6',
  DISPATCHED: '#22c55e',
  DELIVERING: '#22c55e',
};

const SKIP_ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'DELIVERED']);
const TJ_ACTIVE_STATUSES = new Set([
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

// ── Services ──────────────────────────────────────────────────────────────

const SERVICES = [
  {
    id: 'materials',
    icon: HardHat,
    label: 'Materiāli',
    route: '/(buyer)/catalog',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    route: '/order',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
    route: '/transport',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_PANEL_H = SCREEN_HEIGHT * 0.5;

// ── Screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [transportOrders, setTransportOrders] = useState<ApiTransportJob[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const hasActive =
      orders.some((o) => ACTIVE_STATUSES.has(o.status)) ||
      skipOrders.some((o) => SKIP_ACTIVE_STATUSES.has(o.status)) ||
      transportOrders.some((o) => TJ_ACTIVE_STATUSES.has(o.status));
    if (!hasActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [orders, skipOrders, transportOrders]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      Promise.all([
        api.orders.myOrders(token).catch(() => {
          toast.error('Neizdevās ielādēt pasūtījumus');
          return [] as ApiOrder[];
        }),
        api.skipHire.myOrders(token).catch(() => [] as SkipHireOrder[]),
        api.transportJobs.myRequests(token).catch(() => [] as ApiTransportJob[]),
      ]).then(([mats, skips, reqs]) => {
        setOrders(mats as ApiOrder[]);
        setSkipOrders(skips as SkipHireOrder[]);
        setTransportOrders(reqs as ApiTransportJob[]);
        setLoading(false);
      });
      api.notifications
        .unreadCount(token)
        .then((res) => setUnreadCount(res.count))
        .catch(() => {});
    }, [token]),
  );

  type ActiveItem = {
    id: string;
    num: string;
    sub: string;
    status: string;
    dotColor: string;
    kind: 'mat' | 'skip' | 'transport';
    eta?: string;
  };

  const activeItem: ActiveItem | null = (() => {
    const mat = orders.find((o) => ACTIVE_STATUSES.has(o.status));
    if (mat) {
      const trackingJob = mat.transportJobs?.find((j: any) => TJ_ACTIVE_STATUSES.has(j.status));
      return {
        id: trackingJob ? trackingJob.id : mat.id,
        num: `#${mat.orderNumber}`,
        sub: mat.deliveryCity ?? '—',
        status: STATUS_LABEL[mat.status] ?? mat.status,
        dotColor: STATUS_DOT[mat.status] ?? '#22c55e',
        kind: trackingJob ? ('transport' as const) : ('mat' as const),
      };
    }
    const skip = skipOrders.find((o) => SKIP_ACTIVE_STATUSES.has(o.status));
    if (skip)
      return {
        id: skip.id,
        num: `#${skip.orderNumber}`,
        sub: skip.location ?? '—',
        status: skip.status === 'PENDING' ? 'Gaida apstiprinājumu' : skip.status,
        dotColor: '#f59e0b',
        kind: 'skip',
      };
    const tj = transportOrders.find((o) => TJ_ACTIVE_STATUSES.has(o.status));
    if (tj)
      return {
        id: tj.id,
        num: `#${tj.jobNumber}`,
        sub: tj.pickupCity ?? '—',
        status: tj.status === 'ACCEPTED' ? 'Pieņemts' : tj.status,
        dotColor: '#3b82f6',
        kind: 'transport',
      };
    return null;
  })();

  const activeCount =
    orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length +
    skipOrders.filter((o) => SKIP_ACTIVE_STATUSES.has(o.status)).length +
    transportOrders.filter((o) => TJ_ACTIVE_STATUSES.has(o.status)).length;

  const getRecentItems = () => {
    const items: any[] = [];
    orders
      .filter((o) => !ACTIVE_STATUSES.has(o.status))
      .forEach((o) =>
        items.push({
          id: o.id,
          num: `#${o.orderNumber}`,
          sub: o.deliveryCity ?? '—',
          status: STATUS_LABEL[o.status] ?? o.status,
          kind: 'mat',
          date: o.createdAt,
        }),
      );
    skipOrders
      .filter((o) => !SKIP_ACTIVE_STATUSES.has(o.status))
      .forEach((o) =>
        items.push({
          id: o.id,
          num: `#${o.orderNumber}`,
          sub: o.location ?? '—',
          status: o.status === 'COMPLETED' ? 'Pabeigts' : o.status,
          kind: 'skip',
          date: o.createdAt,
        }),
      );
    transportOrders
      .filter((o) => !TJ_ACTIVE_STATUSES.has(o.status))
      .forEach((o) =>
        items.push({
          id: o.id,
          num: `#${o.jobNumber}`,
          sub: o.deliveryCity ?? '—',
          status: o.status === 'DELIVERED' ? 'Piegādāts' : o.status,
          kind: 'transport',
          date: o.pickupDate,
        }),
      );
    items.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
    return items.slice(0, 5);
  };
  const recentOrders = getRecentItems();

  const isNewUser = recentOrders.length === 0 && activeCount === 0;

  const navToActive = () => {
    if (!activeItem) return;
    haptics.light();
    if (activeCount > 1) {
      router.push('/(buyer)/orders' as any);
      return;
    }
    const route =
      activeItem.kind === 'skip'
        ? `/(buyer)/skip-order/${activeItem.id}`
        : activeItem.kind === 'transport'
          ? `/(buyer)/transport-job/${activeItem.id}`
          : `/(buyer)/order/${activeItem.id}`;
    router.push(route as any);
  };

  return (
    <ScreenContainer topInset={0} bg="transparent">
      {/* ─── Map Background ──────────────────────────────── */}
      {/* Absolute fill map with padding so interactions work and Google logo is visible */}
      <View style={StyleSheet.absoluteFill}>
        <BaseMap
          showsUserLocation
          showsMyLocationButton={false}
          style={StyleSheet.absoluteFill}
          mapPadding={{
            top: insets.top + 60,
            bottom: BOTTOM_PANEL_H + 20,
            left: 0,
            right: 0,
          }}
        />
      </View>

      {/* ─── Header Buttons ──────────────────────────────── */}
      <View style={[s.headerButtons, { top: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setSidebarOpen(true);
          }}
          style={s.headerBtn}
        >
          <Menu size={24} color="#111827" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/notifications' as any)} style={s.headerBtn}>
          <Bell size={24} color="#111827" />
          {unreadCount > 0 && <View style={s.badge} />}
        </TouchableOpacity>
      </View>

      {/* ─── Active Order Float ──────────────────────────── */}
      {activeItem && (
        <View style={[s.activeFloatWrapper, { bottom: BOTTOM_PANEL_H + 16 }]}>
          <TouchableOpacity style={s.activePill} onPress={navToActive} activeOpacity={0.9}>
            <View style={s.activeIconBox}>
              <Animated.View
                style={[
                  s.pulseRing,
                  { transform: [{ scale: pulseAnim }], backgroundColor: activeItem.dotColor },
                ]}
              />
              <View style={[s.activeDot, { backgroundColor: activeItem.dotColor }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.activeStatus}>
                {activeCount > 1 ? `${activeCount} aktīvi pasūtījumi` : activeItem.status}
              </Text>
              <Text style={s.activeSub} numberOfLines={1}>
                {activeItem.sub}
              </Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Fixed Bottom Panel ──────────────────────────── */}
      <View style={[s.panel, { height: BOTTOM_PANEL_H, paddingBottom: insets.bottom }]}>
        {/* Services Row */}
        <Text style={s.sectionTitle}>Pakalpojumi</Text>
        <View style={s.servicesGrid}>
          {SERVICES.map((svc, i) => {
            const Icon = svc.icon;
            return (
              <TouchableOpacity
                key={`${svc.id}-${i}`}
                style={s.serviceCard}
                onPress={() => {
                  haptics.light();
                  router.push(svc.route as any);
                }}
                activeOpacity={0.8}
              >
                <Icon size={28} color="#111827" strokeWidth={2.5} />
                <Text style={s.serviceLabel}>{svc.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Activity */}
        <View style={s.divider} />
        <View style={s.recentHeader}>
          <Text style={s.sectionTitle}>Pēdējie pasūtījumi</Text>
          <TouchableOpacity onPress={() => router.push('/(buyer)/orders' as any)}>
            <Text style={s.seeAllLink}>Visi</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {recentOrders.length > 0 ? (
            recentOrders.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={s.recentRow}
                onPress={() => router.push(`/(buyer)/order/${item.id}` as any)}
              >
                <View style={s.recentIconSmall}>
                  <Package size={16} color="#6b7280" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentRowTitle}>{item.sub}</Text>
                  <Text style={s.recentRowSub}>
                    {item.status} • {item.num}
                  </Text>
                </View>
                <ChevronRight size={16} color="#d1d5db" />
              </TouchableOpacity>
            ))
          ) : loading ? (
            <View style={{ gap: 10, padding: 4 }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 52,
                    backgroundColor: '#f3f4f6',
                    borderRadius: 10,
                    opacity: 1 - i * 0.15,
                  }}
                />
              ))}
            </View>
          ) : isNewUser ? (
            <View style={s.onboardingCard}>
              <View style={s.onboardingIconRow}>
                <View style={s.onboardingIconBubble}>
                  <HardHat size={22} color="#111827" strokeWidth={2.5} />
                </View>
                <View style={s.onboardingIconBubble}>
                  <Package size={22} color="#111827" strokeWidth={2.5} />
                </View>
                <View style={s.onboardingIconBubble}>
                  <Trash2 size={22} color="#111827" strokeWidth={2.5} />
                </View>
                <View style={s.onboardingIconBubble}>
                  <Truck size={22} color="#111827" strokeWidth={2.5} />
                </View>
              </View>
              <Text style={s.onboardingTitle}>Sveicināti B3Hub!</Text>
              <Text style={s.onboardingSubtitle}>
                Pasūtiet celtniecības materiālus, konteinerus, transportu vai atkritumu izvešanu —
                viss vienā vietā.
              </Text>
              <TouchableOpacity
                style={s.onboardingBtn}
                onPress={() => {
                  haptics.light();
                  router.push('/(buyer)/catalog' as any);
                }}
                activeOpacity={0.85}
              >
                <Text style={s.onboardingBtnText}>Atvērt katalogu</Text>
                <ChevronRight size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={s.emptyRecent}>Pabeigti pasūtījumi parādīsies šeit</Text>
          )}
        </ScrollView>
      </View>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="buyer"
        accentColor="#111827"
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  headerButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 50,
    pointerEvents: 'box-none', // Allow touches to pass through the empty space
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },

  // Floating Active Order
  activeFloatWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 60,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    gap: 12,
  },
  activeIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  pulseRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.3,
  },
  activeStatus: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  activeSub: { color: '#9ca3af', fontSize: 13 },

  // Fixed Bottom Panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 20,
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
    rowGap: 12,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  serviceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 20,
    marginHorizontal: 20,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
    marginBottom: 8,
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  recentIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  recentRowSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyRecent: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 20,
    fontSize: 14,
  },

  // Onboarding card
  onboardingCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  onboardingIconRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  onboardingIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  onboardingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  onboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 6,
  },
  onboardingBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
