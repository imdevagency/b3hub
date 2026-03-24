import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder, SkipHireOrder, ApiTransportJob } from '@/lib/api';
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
import { ScreenContainer } from '@/components/ui/ScreenContainer';

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
  PENDING: 'Gaida apstiprin\u0101jumu',
  CONFIRMED: 'Apstiprin\u0101ts',
  PROCESSING: 'Apstr\u0101d\u0113',
  LOADING: 'Iekrau\u0161ana',
  DISPATCHED: 'Nos\u016bt\u012bts',
  DELIVERING: 'Pieg\u0101d\u0113',
  DELIVERED: 'Pieg\u0101d\u0101ts',
  CANCELLED: 'Atcelts',
};

const STATUS_DOT: Record<string, string> = {
  PENDING: '#9ca3af',
  CONFIRMED: '#fff',
  PROCESSING: '#e5e7eb',
  LOADING: '#e5e7eb',
  DISPATCHED: '#86efac',
  DELIVERING: '#86efac',
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
    label: 'Materi\u0101li',
    sub: 'Smiltis, grants, \u0161\u0137embas',
    route: '/(buyer)/catalog',
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
    label: 'Utiliz\u0101cija',
    sub: 'Atkritumu izve\u0161ana',
    route: '/disposal',
  },
  {
    id: 'freight',
    icon: Truck,
    label: 'Transports',
    sub: 'Kravu p\u0101rvad\u0101\u0161ana',
    route: '/transport',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labr\u012bt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

const TAB_H = 52;

// ── Screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [transportOrders, setTransportOrders] = useState<ApiTransportJob[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const hasActive =
      orders.some((o) => ACTIVE_STATUSES.has(o.status)) ||
      skipOrders.some((o) => SKIP_ACTIVE_STATUSES.has(o.status)) ||
      transportOrders.some((o) => TJ_ACTIVE_STATUSES.has(o.status));
    if (!hasActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, skipOrders, transportOrders]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      Promise.all([
        api.orders.myOrders(token).catch(() => [] as ApiOrder[]),
        api.skipHire.myOrders(token).catch(() => [] as SkipHireOrder[]),
        api.transportJobs.myRequests(token).catch(() => [] as ApiTransportJob[]),
      ]).then(([mats, skips, reqs]) => {
        setOrders(mats as ApiOrder[]);
        setSkipOrders(skips as SkipHireOrder[]);
        setTransportOrders(reqs as ApiTransportJob[]);
      });
      api.notifications
        .unreadCount(token)
        .then((res) => setUnreadCount(res.count))
        .catch(() => {});
    }, [token]),
  );

  type RecentItem = {
    id: string;
    num: string;
    sub: string;
    status: string;
    kind: 'mat' | 'skip' | 'transport';
  };

  const activeItem = (() => {
    const mat = orders.find((o) => ACTIVE_STATUSES.has(o.status));
    if (mat)
      return {
        id: mat.id,
        num: `#${mat.orderNumber}`,
        sub: mat.deliveryCity ?? '\u2014',
        status: STATUS_LABEL[mat.status] ?? mat.status,
        dotColor: STATUS_DOT[mat.status] ?? '#e5e7eb',
        kind: 'mat' as const,
      };
    const skip = skipOrders.find((o) => SKIP_ACTIVE_STATUSES.has(o.status));
    if (skip)
      return {
        id: skip.id,
        num: `#${skip.orderNumber}`,
        sub: skip.location ?? '\u2014',
        status: skip.status,
        dotColor: '#86efac',
        kind: 'skip' as const,
      };
    const tj = transportOrders.find((o) => TJ_ACTIVE_STATUSES.has(o.status));
    if (tj)
      return {
        id: tj.id,
        num: `#${tj.jobNumber}`,
        sub: tj.pickupCity ?? '\u2014',
        status: tj.status,
        dotColor: '#86efac',
        kind: 'transport' as const,
      };
    return null;
  })();

  const activeCount =
    orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length +
    skipOrders.filter((o) => SKIP_ACTIVE_STATUSES.has(o.status)).length +
    transportOrders.filter((o) => TJ_ACTIVE_STATUSES.has(o.status)).length;

  const recentItems: RecentItem[] = [];
  orders
    .filter((o) => !ACTIVE_STATUSES.has(o.status))
    .forEach((o) =>
      recentItems.push({
        id: o.id,
        num: `#${o.orderNumber}`,
        sub: o.deliveryCity ?? '\u2014',
        status: STATUS_LABEL[o.status] ?? o.status,
        kind: 'mat',
      }),
    );
  skipOrders
    .filter((o) => !SKIP_ACTIVE_STATUSES.has(o.status))
    .forEach((o) =>
      recentItems.push({
        id: o.id,
        num: `#${o.orderNumber}`,
        sub: o.location ?? '\u2014',
        status: o.status,
        kind: 'skip',
      }),
    );
  transportOrders
    .filter((o) => !TJ_ACTIVE_STATUSES.has(o.status))
    .forEach((o) =>
      recentItems.push({
        id: o.id,
        num: `#${o.jobNumber}`,
        sub: o.pickupCity ?? '\u2014',
        status: o.status,
        kind: 'transport',
      }),
    );
  const recentOrders = recentItems.slice(0, 4);
  const totalOrders = orders.length + skipOrders.length + transportOrders.length;

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
    <ScreenContainer topInset={0} bg="#ffffff">
      {/* ─── Top bar ─────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            setSidebarOpen(true);
          }}
          activeOpacity={0.8}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.firstName?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={s.greetLabel}>{greeting()}</Text>
          <Text style={s.greetName} numberOfLines={1}>
            {user?.firstName ?? 'Lietot\u0101js'}
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
          <Bell size={20} color="#111827" />
          {unreadCount > 0 && <View style={s.bellDot} />}
        </TouchableOpacity>
      </View>

      {/* ─── Scroll ──────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: TAB_H + insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active order — inverted black card */}
        {activeItem && (
          <TouchableOpacity style={s.activeCard} onPress={navToActive} activeOpacity={0.9}>
            <View style={s.dotWrap}>
              <Animated.View
                style={[
                  s.dotRing,
                  { backgroundColor: activeItem.dotColor, transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={[s.dot, { backgroundColor: activeItem.dotColor }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.activeTag}>
                {activeCount > 1
                  ? `${activeCount} akt\u012bvie pas\u016bt\u012bjumi`
                  : 'Akt\u012bvs pas\u016bt\u012bjums'}
              </Text>
              <Text style={s.activeNum}>
                {activeCount > 1 ? 'Skat\u012bt visus' : activeItem.num}
              </Text>
              {activeCount === 1 && (
                <Text style={s.activeSub}>
                  {activeItem.status} \u00B7 {activeItem.sub}
                </Text>
              )}
            </View>
            <View style={s.activeArrow}>
              <ChevronRight size={16} color="#111827" />
            </View>
          </TouchableOpacity>
        )}

        {/* Services */}
        <Text style={s.sectionTitle}>Pakalpojumi</Text>
        <View style={s.serviceGrid}>
          {SERVICES.map((svc) => {
            const Icon = svc.icon;
            return (
              <TouchableOpacity
                key={svc.id}
                style={s.serviceCard}
                onPress={() => {
                  haptics.light();
                  router.push(svc.route as any);
                }}
                activeOpacity={0.78}
              >
                <View style={s.serviceIconBox}>
                  <Icon size={20} color="#111827" />
                </View>
                <Text style={s.serviceLabel}>{svc.label}</Text>
                <Text style={s.serviceSub} numberOfLines={2}>
                  {svc.sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent orders */}
        {recentOrders.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>P\u0113d\u0113jie pas\u016bt\u012bjumi</Text>
              <TouchableOpacity onPress={() => router.push('/(buyer)/orders' as any)}>
                <Text style={s.seeAll}>Visi</Text>
              </TouchableOpacity>
            </View>
            <View style={s.recentList}>
              {recentOrders.map((item, i) => {
                const Icon =
                  item.kind === 'skip' ? Trash2 : item.kind === 'transport' ? Truck : Package;
                const route =
                  item.kind === 'skip'
                    ? `/(buyer)/skip-order/${item.id}`
                    : item.kind === 'transport'
                      ? `/(buyer)/transport-job/${item.id}`
                      : `/(buyer)/order/${item.id}`;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.recentRow, i < recentOrders.length - 1 && s.recentBorder]}
                    onPress={() => {
                      haptics.light();
                      router.push(route as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={s.recentIconBox}>
                      <Icon size={14} color="#6b7280" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentNum}>{item.num}</Text>
                      <Text style={s.recentSub} numberOfLines={1}>
                        {item.sub}
                      </Text>
                    </View>
                    <Text style={s.recentStatus}>{item.status}</Text>
                    <ChevronRight size={13} color="#d1d5db" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* All orders button */}
        {totalOrders > 4 && (
          <TouchableOpacity
            style={s.allBtn}
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/orders' as any);
            }}
            activeOpacity={0.8}
          >
            <Text style={s.allBtnText}>Visi pas\u016bt\u012bjumi ({totalOrders})</Text>
            <ChevronRight size={15} color="#374151" />
          </TouchableOpacity>
        )}

        {/* Empty state */}
        {totalOrders === 0 && (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <ClipboardList size={28} color="#9ca3af" />
            </View>
            <Text style={s.emptyTitle}>{'Nav pasūtījumu'}</Text>
            <Text style={s.emptySub}>{'Izvēlieties pakalpojumu un veiciet pirmo pasūtījumu'}</Text>
            <TouchableOpacity
              style={s.emptyCta}
              onPress={() => {
                haptics.light();
                router.push('/order-request-new' as any);
              }}
              activeOpacity={0.85}
            >
              <Text style={s.emptyCtaText}>{'Sākt pasūtījumu'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role="buyer"
        accentColor="#111827"
      />
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  greetLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500', lineHeight: 17 },
  greetName: { fontSize: 19, fontWeight: '800', color: '#111827', letterSpacing: -0.4 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#f9fafb',
  },

  scroll: { paddingHorizontal: 16, gap: 16, paddingTop: 4 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -4,
  },
  seeAll: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // Active order
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, opacity: 0.35 },
  activeTag: { fontSize: 12, color: '#9ca3af', fontWeight: '500', marginBottom: 4 },
  activeNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 22,
    letterSpacing: -0.4,
  },
  activeSub: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  activeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Services 2x2 grid
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 0,
  },
  serviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  serviceLabel: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 20 },
  serviceSub: { fontSize: 13, color: '#6b7280', lineHeight: 18 },

  // Recent orders
  recentList: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  recentBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  recentIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentNum: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  recentSub: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginTop: 2 },
  recentStatus: { fontSize: 12, color: '#475569', fontWeight: '500' },

  // All orders button
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 0,
  },
  allBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30, // Make it fully rounded
    backgroundColor: '#f3f4f6', // Remove borders, change background
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptySub: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  emptyCta: {
    marginTop: 6,
    backgroundColor: '#111827',
    borderRadius: 16, // Smoother corners for CTA
    paddingHorizontal: 28,
    paddingVertical: 16, // Taller touch target
  },
  emptyCtaText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
