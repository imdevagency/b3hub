import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder, ApiTransportJob } from '@/lib/api';
import {
  HardHat,
  Trash2,
  Truck,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  MailCheck,
  RefreshCcw,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

import { useHeaderConfig } from '@/lib/header-context';
import { useToast } from '@/components/ui/Toast';
import { useMode } from '@/lib/mode-context';

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
  { id: 'materials', icon: HardHat, label: 'Materiāli', route: '/(wizards)/material-order' },
  { id: 'disposal', icon: Trash2, label: 'Utilizācija', route: '/disposal' },
  { id: 'transport', icon: Truck, label: 'Transports', route: '/(buyer)/new-order' },
];

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { setConfig } = useHeaderConfig();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [transportOrders, setTransportOrders] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Active status animations
  useEffect(() => {
    const hasActive =
      orders.some((o) => ACTIVE_STATUSES.has(o.status)) ||
      transportOrders.some((o) => TJ_ACTIVE_STATUSES.has(o.status));
    if (!hasActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [orders, transportOrders]);

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      Promise.all([
        api.orders.myOrders(token).catch(() => {
          toast.error('Neizdevās ielādēt pasūtījumus');
          return [] as ApiOrder[];
        }),
        api.transportJobs.myRequests(token).catch(() => [] as ApiTransportJob[]),
      ])
        .then(([mats, reqs]) => {
          setOrders(mats as ApiOrder[]);
          setTransportOrders(reqs as ApiTransportJob[]);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [token, toast],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
  );

  useFocusEffect(
    useCallback(() => {
      setConfig({});
      return () => setConfig(null);
    }, [setConfig]),
  );

  const activeItem = useMemo(() => {
    const mat = orders.find((o) => ACTIVE_STATUSES.has(o.status));
    if (mat) {
      const trackingJob = mat.transportJobs?.find((j: any) => TJ_ACTIVE_STATUSES.has(j.status));
      return {
        id: trackingJob ? trackingJob.id : mat.id,
        num: `#${mat.orderNumber}`,
        sub: mat.deliveryCity ?? '—',
        status: STATUS_LABEL[mat.status] ?? mat.status,
        dotColor: STATUS_DOT[mat.status] ?? '#22c55e',
        kind: trackingJob ? 'transport' : 'mat',
      };
    }
    const tj = transportOrders.find((o) => TJ_ACTIVE_STATUSES.has(o.status));
    if (tj) {
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
    }
    return null;
  }, [orders, transportOrders]);

  const activeCount = useMemo(
    () =>
      orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length +
      transportOrders.filter((o) => TJ_ACTIVE_STATUSES.has(o.status)).length,
    [orders, transportOrders],
  );

  // Unified "order again" items — material and transport
  type ReorderItem = {
    key: string;
    label: string;
    sub: string;
    kind: 'material' | 'transport';
    onPress: () => void;
  };
  const recentReorders = useMemo<ReorderItem[]>(() => {
    const items: ReorderItem[] = [];
    for (const o of orders) {
      if ((o.status === 'COMPLETED' || o.status === 'DELIVERED') && o.items?.length > 0) {
        const firstItem = o.items[0];
        items.push({
          key: o.id,
          label: firstItem?.material?.name ?? '—',
          sub: o.deliveryCity ?? o.deliveryAddress ?? '—',
          kind: 'material',
          onPress: () => {
            haptics.light();
            router.push({
              pathname: '/(wizards)/material-order' as never,
              params: {
                initialCategory: firstItem?.material?.category ?? undefined,
                prefillAddress: o.deliveryAddress ?? undefined,
                prefillCity: o.deliveryCity ?? undefined,
              },
            } as never);
          },
        });
      }
    }
    for (const o of transportOrders) {
      if (o.status === 'DELIVERED') {
        items.push({
          key: o.id,
          label: 'Transports',
          sub: (o as any).pickupCity ?? '—',
          kind: 'transport',
          onPress: () => {
            haptics.light();
            router.push('/(wizards)/transport' as never);
          },
        });
      }
    }
    return items.slice(0, 4);
  }, [orders, transportOrders, router]);

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff" topInset={0} noAnimation>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#111827"
          />
        }
      >
        {/* Flat Minimal Header */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 32,
            paddingBottom: 24,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                fontSize: 36,
                letterSpacing: -1,
                color: '#111827',
              }}
            >
              Sveiki{user?.firstName ? `, ${user.firstName}` : ''}
            </Text>
          </View>
          {user?.company?.name && (
            <View
              style={{
                backgroundColor: '#f3f4f6',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontWeight: '600',
                  fontSize: 13,
                  color: '#111827',
                }}
                numberOfLines={1}
              >
                {user.company.name}
              </Text>
            </View>
          )}
        </View>

        {/* Single-priority account nudge — company profile completion */}
        {user && user.isCompany && !user.company?.id ? (
          <TouchableOpacity
            style={{
              marginHorizontal: 20,
              marginBottom: 20,
              backgroundColor: '#fffbeb',
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              gap: 12,
              borderWidth: 1,
              borderColor: '#fde68a',
            }}
            activeOpacity={0.8}
            onPress={() => {
              haptics.light();
              router.push('/(auth)/apply-role?type=supplier' as never);
            }}
          >
            <AlertCircle size={18} color="#d97706" />
            <Text
              style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#92400e' }}
            >
              Pievienojiet uzņēmuma datus
            </Text>
            <ChevronRight size={16} color="#d97706" />
          </TouchableOpacity>
        ) : user && !user.emailVerified ? (
          <TouchableOpacity
            style={{
              marginHorizontal: 20,
              marginBottom: 20,
              backgroundColor: '#eff6ff',
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              gap: 12,
              borderWidth: 1,
              borderColor: '#bfdbfe',
            }}
            activeOpacity={0.8}
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/profile');
            }}
          >
            <MailCheck size={18} color="#2563eb" strokeWidth={2} />
            <Text
              style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#1e3a5f' }}
            >
              Apstipriniet e-pastu, lai saņemtu rēķinus
            </Text>
            <ChevronRight size={16} color="#2563eb" />
          </TouchableOpacity>
        ) : null}

        {/* Tracking (Uber-style dark card) */}
        {activeItem && (
          <TouchableOpacity
            style={{
              marginHorizontal: 20,
              marginBottom: 32,
              backgroundColor: '#166534',
              borderRadius: 32,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.15,
              shadowRadius: 32,
              elevation: 12,
            }}
            activeOpacity={0.9}
            onPress={() => {
              haptics.light();
              if (activeCount > 1) return router.push('/(buyer)/orders');
              const route =
                activeItem.kind === 'transport'
                  ? `/(buyer)/transport-job/${activeItem.id}`
                  : `/(buyer)/order/${activeItem.id}`;
              router.push(route);
            }}
          >
            <View style={{ padding: 28 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 28,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <View
                    style={{
                      position: 'relative',
                      width: 10,
                      height: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                    }}
                  >
                    <Animated.View
                      style={{
                        transform: [{ scale: pulseAnim }],
                        backgroundColor: activeItem.dotColor,
                        position: 'absolute',
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        opacity: 0.5,
                      }}
                    />
                    <View
                      style={{
                        backgroundColor: activeItem.dotColor,
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      color: '#e5e7eb',
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {activeCount > 1 ? `${activeCount} Aktīvi` : 'Aktīvs'}
                  </Text>
                </View>
                <Text
                  style={{
                    color: '#d1d5db',
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  {activeItem.num}
                </Text>
              </View>

              <Text
                style={{
                  color: '#fff',
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  fontSize: 32,
                  letterSpacing: -1,
                  lineHeight: 36,
                  marginBottom: 8,
                }}
              >
                {activeCount > 1 ? `${activeCount} pasūtījumi ceļā` : activeItem.status}
              </Text>
              <Text
                style={{
                  color: '#d1d5db',
                  fontFamily: 'Inter_500Medium',
                  fontWeight: '500',
                  fontSize: 16,
                  marginBottom: 32,
                }}
                numberOfLines={1}
              >
                {activeItem.sub}
              </Text>

              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    fontSize: 16,
                  }}
                >
                  Sekot līdzi
                </Text>
                <ArrowRight size={20} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Search + Services + Popular Materials — always visible for permitted users ── */}
        {(!user?.companyRole || (user?.permManageOrders ?? false)) && (
          <>
            {/* Services — Uber style 2-column grid */}
            <View style={{ marginBottom: 32, paddingHorizontal: 20 }}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                {SERVICES.map((svc, i) => {
                  const Icon = svc.icon;
                  // First two cards are larger visually if needed, but let's make them all uniform 2-col squares
                  const isTopRow = i < 2;
                  return (
                    <TouchableOpacity
                      key={svc.id}
                      activeOpacity={0.85}
                      onPress={() => {
                        haptics.light();
                        router.push(svc.route as any);
                      }}
                      style={{
                        width: '48%',
                        aspectRatio: isTopRow ? 1.2 : 1.1,
                        backgroundColor: '#f3f4f6',
                        borderRadius: 16,
                        padding: 16,
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#111827' }}
                        numberOfLines={2}
                      >
                        {svc.label}
                      </Text>
                      <View style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                        <Icon size={isTopRow ? 36 : 28} color="#4b5563" strokeWidth={1.5} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ── Recent Orders ── */}
        {recentReorders.length > 0 && (!user?.companyRole || (user?.permManageOrders ?? false)) && (
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 20,
                letterSpacing: -0.4,
                color: '#111827',
                paddingHorizontal: 20,
                marginBottom: 8,
              }}
            >
              Pasūtīt vēlreiz
            </Text>
            <View style={{ paddingHorizontal: 20 }}>
              {recentReorders.map((item, index) => (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.7}
                  onPress={item.onPress}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    borderBottomWidth: index === recentReorders.length - 1 ? 0 : 1,
                    borderBottomColor: '#f3f4f6',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#f3f4f6',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 16,
                    }}
                  >
                    <RefreshCcw size={18} color="#4b5563" />
                  </View>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 16,
                        color: '#111827',
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6b7280' }}
                      numberOfLines={1}
                    >
                      {item.sub}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#9ca3af" strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Restricted member — no order permission */}
        {user?.companyRole &&
          user.companyRole !== 'OWNER' &&
          !(user?.permManageOrders ?? false) && (
            <View
              style={{
                marginHorizontal: 20,
                marginTop: 8,
                backgroundColor: '#f9fafb',
                borderRadius: 24,
                padding: 24,
                alignItems: 'center',
              }}
            >
              <AlertCircle size={36} color="#9ca3af" style={{ marginBottom: 16 }} />
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  fontSize: 18,
                  color: '#111827',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                Pasūtīšana nav atļauta
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 15,
                  color: '#6b7280',
                  textAlign: 'center',
                  marginBottom: 20,
                  lineHeight: 22,
                }}
              >
                Jūsu kontam nav tiesību veikt pasūtījumus. Sazinieties ar uzņēmuma vadītāju, lai
                saņemtu piekļuvi.
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  haptics.light();
                  router.push('/(buyer)/orders');
                }}
                style={{
                  backgroundColor: '#f3f4f6',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    fontSize: 15,
                    color: '#374151',
                  }}
                >
                  Skatīt pasūtījumus
                </Text>
              </TouchableOpacity>
            </View>
          )}
      </ScrollView>
    </ScreenContainer>
  );
}
