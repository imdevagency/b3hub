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
  RefreshControl,
} from 'react-native';
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
  FileText,
  ChevronRight,
  Bell,
  AlertCircle,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TopBar } from '@/components/ui/TopBar';
// Guard: expo-linear-gradient requires a native build (not available in Expo Go)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let LinearGradient: React.ComponentType<any>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = ({ style, children }: { style?: object; children?: React.ReactNode }) =>
    React.createElement(View, { style }, children);
}
import { useToast } from '@/components/ui/Toast';

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
    id: 'transport',
    icon: Truck,
    label: 'Transports',
    route: '/transport',
  },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    route: '/disposal',
  },
  {
    id: 'container',
    icon: Package,
    label: 'Konteineri',
    route: '/order',
  },
  {
    id: 'rfq',
    icon: FileText,
    label: 'Cenu aptauja',
    route: '/order-request-new',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

// ── Screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [transportOrders, setTransportOrders] = useState<ApiTransportJob[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
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
        setRefreshing(false);
      });
      api.notifications
        .unreadCount(token)
        .then((res) => setUnreadCount(res.count))
        .catch(() => {});
    },
    [token, toast],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
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
        status:
          (
            {
              PENDING: 'Gaida apstiprinājumu',
              CONFIRMED: 'Apstiprināts',
              DELIVERED: 'Piegādāts',
            } as Record<string, string>
          )[skip.status] ?? skip.status,
        dotColor: '#f59e0b',
        kind: 'skip',
      };
    const tj = transportOrders.find((o) => TJ_ACTIVE_STATUSES.has(o.status));
    if (tj)
      return {
        id: tj.id,
        num: `#${tj.jobNumber}`,
        sub: tj.pickupCity ?? '—',
        status:
          (
            {
              ACCEPTED: 'Pieņemts',
              EN_ROUTE_PICKUP: 'Brauc uz iekraušanu',
              AT_PICKUP: 'Iekraujas',
              LOADED: 'Iekrauts',
              EN_ROUTE_DELIVERY: 'Brauc uz piegādi',
              AT_DELIVERY: 'Piegādā',
            } as Record<string, string>
          )[tj.status] ?? tj.status,
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
    <ScreenContainer topInset={insets.top} bg="#ffffff">
      <TopBar
        title=""
        transparent={true}
        unreadCount={unreadCount}
        leftElement={
          <TouchableOpacity
            style={s.avatarBtn}
            activeOpacity={0.85}
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/profile');
            }}
          >
            <Text style={s.avatarBtnText}>
              {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#111827"
          />
        }
      >
        {/* Profile completion nudge */}
        {user && (!user.phone || (user.isCompany && !user.company?.id)) && (
          <TouchableOpacity
            style={s.profileNudge}
            activeOpacity={0.8}
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/profile' as any);
            }}
          >
            <AlertCircle size={16} color="#b45309" />
            <Text style={s.profileNudgeText}>
              {!user.phone
                ? 'Pievienojiet tālruni, lai veiktu pasūtījumus'
                : 'Pievienojiet uzņēmuma profilu, lai pilnvērtīgi lietotu platformu'}
            </Text>
            <ChevronRight size={14} color="#b45309" />
          </TouchableOpacity>
        )}

        {/* ─── Active Order Hero ──────────────────────────── */}
        {activeItem && (
          <TouchableOpacity style={s.activeHero} onPress={navToActive} activeOpacity={0.92}>
            {/* top row: live dot + tag + order number */}
            <View style={s.activeHeroTop}>
              <View style={s.activeHeroLiveRow}>
                <View style={s.activeHeroDotWrap}>
                  <Animated.View
                    style={[
                      s.pulseRing,
                      { transform: [{ scale: pulseAnim }], backgroundColor: activeItem.dotColor },
                    ]}
                  />
                  <View style={[s.activeDot, { backgroundColor: activeItem.dotColor }]} />
                </View>
                <Text style={s.activeHeroTag}>
                  {activeCount > 1 ? `${activeCount} aktīvi pasūtījumi` : 'Aktīvs pasūtījums'}
                </Text>
              </View>
              <Text style={s.activeHeroNum}>{activeItem.num}</Text>
            </View>

            {/* big status headline */}
            <Text style={s.activeHeroStatus}>
              {activeCount > 1 ? `${activeCount} pasūtījumi ceļā` : activeItem.status}
            </Text>

            {/* address / destination */}
            <Text style={s.activeHeroSub} numberOfLines={1}>
              {activeItem.sub}
            </Text>

            {/* CTA row */}
            <View style={s.activeHeroCTA}>
              <Text style={s.activeHeroCTAText}>Skatīt detaļas</Text>
              <ChevronRight size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        )}

        {/* New-user hero — shown only when user has no history yet */}
        {isNewUser && !loading && (
          <TouchableOpacity
            style={s.newUserHero}
            activeOpacity={0.88}
            onPress={() => {
              haptics.medium();
              router.push('/(buyer)/catalog' as any);
            }}
          >
            <View>
              <Text style={s.newUserHeroGreeting}>
                Sveiki{user?.firstName ? `, ${user.firstName}` : ''} 👋
              </Text>
              <Text style={s.newUserHeroTitle}>Ko pasūtīt šodien?</Text>
              <Text style={s.newUserHeroSub}>
                Materi\u0101li, transports un konteineri — dažos klikšķos.
              </Text>
            </View>
            <View style={s.newUserHeroCTA}>
              <Text style={s.newUserHeroCTAText}>Sākt pasūtīt</Text>
              <ChevronRight size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        )}

        {/* Services Row */}
        <Text style={[s.sectionTitle, activeItem && s.sectionTitleSecondary]}>
          {activeItem ? 'Pasūtīt vēl' : 'Pakalpojumi'}
        </Text>
        <View style={{ position: 'relative', marginBottom: 24 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.servicesRow}
            style={s.servicesScroll}
          >
            {SERVICES.map((svc, i) => {
              const Icon = svc.icon;
              return (
                <TouchableOpacity
                  key={`${svc.id}-${i}`}
                  style={s.serviceChip}
                  onPress={() => {
                    haptics.light();
                    router.push(svc.route as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={s.serviceChipIcon}>
                    <Icon size={24} color="#111827" strokeWidth={2} />
                  </View>
                  <Text style={s.serviceLabel} numberOfLines={2}>
                    {svc.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <LinearGradient
            colors={['rgba(242,242,247,0)', 'rgba(242,242,247,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            pointerEvents="none"
            style={s.servicesGradient}
          />
        </View>

        {/* Recent Activity */}
        <View style={s.recentHeader}>
          <Text style={s.sectionTitle}>Pēdējie pasūtījumi</Text>
          <TouchableOpacity onPress={() => router.push('/(buyer)/orders' as any)}>
            <Text style={s.seeAllLink}>Visi</Text>
          </TouchableOpacity>
        </View>

        <View style={s.recentList}>
          {recentOrders.length > 0 ? (
            recentOrders.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={s.recentRow}
                onPress={() => {
                  haptics.light();
                  const route =
                    item.kind === 'skip'
                      ? `/(buyer)/skip-order/${item.id}`
                      : item.kind === 'transport'
                        ? `/(buyer)/transport-job/${item.id}`
                        : `/(buyer)/order/${item.id}`;
                  router.push(route as any);
                }}
              >
                <View style={s.recentIconSmall}>
                  {item.kind === 'transport' ? (
                    <Truck size={16} color="#6b7280" />
                  ) : (
                    <Package size={16} color="#6b7280" />
                  )}
                </View>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={s.recentRowTitle}>
                        {item.kind === 'mat'
                          ? 'Materiāli'
                          : item.kind === 'skip'
                            ? 'Konteiners'
                            : 'Transports'}
                      </Text>
                      <Text
                        style={[
                          s.recentStatusText,
                          item.status.includes('CANCEL') || item.status.includes('Atcelts')
                            ? { color: '#ef4444' }
                            : item.status.includes('Piegādāts')
                              ? { color: '#10b981' }
                              : {},
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                    <Text style={s.recentRowSub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                    <Text style={s.recentRowDate}>
                      {item.num}
                      {item.date
                        ? ' • ' +
                          new Date(item.date).toLocaleDateString('lv', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#d1d5db" />
              </TouchableOpacity>
            ))
          ) : loading ? (
            <View style={{ gap: 10, paddingHorizontal: 20 }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 52,
                    backgroundColor: '#e5e7eb',
                    borderRadius: 12,
                    opacity: 1 - i * 0.15,
                  }}
                />
              ))}
            </View>
          ) : isNewUser ? (
            <View style={s.emptyHint}>
              <Text style={s.emptyHintText}>Nav jaunu pasūtījumu</Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  router.push('/(buyer)/catalog' as any);
                }}
              >
                <Text style={s.emptyHintLink}>Sākt pasūtīt →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={s.emptyRecent}>Pabeigti pasūtījumi parādīsies šeit</Text>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  activeFloatWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    gap: 12,
  },
  activeIconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    borderRadius: 22,
  },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  pulseRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.3,
  },
  activeStatus: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  activeSub: { color: '#9ca3af', fontSize: 13, marginTop: 2 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
    marginLeft: 20,
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  sectionTitleSecondary: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af',
    marginTop: -8,
  },

  newUserHero: {
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    gap: 20,
  },
  newUserHeroGreeting: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#9ca3af',
    marginBottom: 4,
  },
  newUserHeroTitle: {
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  newUserHeroSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    lineHeight: 20,
  },
  newUserHeroCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
  },
  newUserHeroCTAText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#ffffff',
  },
  servicesScroll: {
    marginBottom: 4,
  },
  servicesGradient: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
  },
  servicesRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 12,
  },
  serviceChip: {
    width: 104,
    height: 104,
    backgroundColor: '#F4F4F5',
    borderRadius: 20,
    padding: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  serviceChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'left',
    letterSpacing: -0.2,
  },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
    marginBottom: 8,
    marginTop: 12,
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  recentList: {
    backgroundColor: '#ffffff',
    marginHorizontal: 0,
    paddingVertical: 0,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  recentIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recentRowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  recentStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'capitalize',
  },
  recentRowSub: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },
  recentRowDate: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  emptyRecent: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 32,
    fontSize: 14,
    fontWeight: '500',
  },

  emptyHint: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
    marginHorizontal: 20,
    borderRadius: 20,
  },
  emptyHintText: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptyHintLink: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  // ── Active hero card (replaces the compact pill) ──────────────────────
  activeHero: {
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  activeHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeHeroLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeHeroDotWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeHeroTag: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  activeHeroNum: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  activeHeroStatus: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  activeHeroSub: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  activeHeroCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
  },
  activeHeroCTAText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  profileNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
  },
  profileNudgeText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '600',
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
});
