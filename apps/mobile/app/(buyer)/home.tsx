import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder, SkipHireOrder, ApiTransportJob } from '@/lib/api';
import {
  HardHat,
  Trash2,
  Truck,
  Package,
  ChevronRight,
  AlertCircle,
  ArrowRight,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useHeaderConfig } from '@/lib/header-context';
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
    sub: 'Smiltis, šķembas',
    route: '/(buyer)/catalog',
  },
  {
    id: 'transport',
    icon: Truck,
    label: 'Pasūtīt auto',
    sub: 'Tehnika, transports',
    route: '/transport',
  },
  { id: 'container', icon: Package, label: 'Konteineri', sub: 'Piegāde', route: '/order' },
  { id: 'disposal', icon: Trash2, label: 'Utilizācija', sub: 'Būvgruži, zeme', route: '/disposal' },
];

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { setConfig } = useHeaderConfig();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [transportOrders, setTransportOrders] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Active status animations
  useEffect(() => {
    const hasActive =
      orders.some((o) => ACTIVE_STATUSES.has(o.status)) ||
      skipOrders.some((o) => SKIP_ACTIVE_STATUSES.has(o.status)) ||
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
      ])
        .then(([mats, skips, reqs]) => {
          setOrders(mats as ApiOrder[]);
          setSkipOrders(skips as SkipHireOrder[]);
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
    const skip = skipOrders.find((o) => SKIP_ACTIVE_STATUSES.has(o.status));
    if (skip) {
      return {
        id: skip.id,
        num: `#${skip.orderNumber}`,
        sub: skip.location ?? '—',
        status:
          (
            { PENDING: 'Gaida', CONFIRMED: 'Apstiprināts', DELIVERED: 'Piegādāts' } as Record<
              string,
              string
            >
          )[skip.status] ?? skip.status,
        dotColor: '#f59e0b',
        kind: 'skip',
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
  }, [orders, skipOrders, transportOrders]);

  const activeCount = useMemo(
    () =>
      orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length +
      skipOrders.filter((o) => SKIP_ACTIVE_STATUSES.has(o.status)).length +
      transportOrders.filter((o) => TJ_ACTIVE_STATUSES.has(o.status)).length,
    [orders, skipOrders, transportOrders],
  );

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff" topInset={0} noAnimation>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
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
        <View className="px-5 pt-8 pb-6 flex-row justify-between items-end">
          <View>
            <Text
              className=" font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-0.5"
              style={{ fontSize: 13 }}
            >
              Laipni lūdzam
            </Text>
            <Text className=" font-bold tracking-tight text-gray-900" style={{ fontSize: 32 }}>
              Sveiki{user?.firstName ? `, ${user.firstName}` : ''}
            </Text>
          </View>
          <View className="bg-gray-100 px-3 py-1.5 rounded-full mb-1">
            <Text className=" font-bold text-gray-900" style={{ fontSize: 13 }}>
              Rīga
            </Text>
          </View>
        </View>

        {/* Profile Nudge */}
        {user && (!user.phone || (user.isCompany && !user.company?.id)) && (
          <TouchableOpacity
            className="mx-5 mb-8 bg-gray-100 p-4 rounded-[20px] flex-row items-center"
            activeOpacity={0.8}
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/profile');
            }}
          >
            <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center mr-3">
              <AlertCircle size={20} color="#b45309" />
            </View>
            <View className="flex-1 mr-2">
              <Text
                className=" text-gray-900 font-bold mb-0.5 tracking-tight"
                style={{ fontSize: 15 }}
              >
                Pabeidziet konta reģistrāciju
              </Text>
              <Text className=" text-gray-500 font-medium leading-tight" style={{ fontSize: 13 }}>
                {!user.phone
                  ? 'Pievienojiet tālruni, lai veiktu pasūtījumus'
                  : 'Pievienojiet uzņēmuma datus'}
              </Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}

        {/* Tracking (Uber-style dark card) */}
        {activeItem && (
          <TouchableOpacity
            className="mx-5 mb-8 bg-gray-900 overflow-hidden"
            style={{ borderRadius: 28 }}
            activeOpacity={0.9}
            onPress={() => {
              haptics.light();
              if (activeCount > 1) return router.push('/(buyer)/orders');
              const route =
                activeItem.kind === 'skip'
                  ? `/(buyer)/skip-order/${activeItem.id}`
                  : activeItem.kind === 'transport'
                    ? `/(buyer)/transport-job/${activeItem.id}`
                    : `/(buyer)/order/${activeItem.id}`;
              router.push(route);
            }}
          >
            <View className="p-6">
              <View className="flex-row justify-between items-center mb-6">
                <View className="flex-row items-center bg-gray-800 rounded-full px-3 py-1.5">
                  <View className="relative w-2.5 h-2.5 items-center justify-center mr-2">
                    <Animated.View
                      style={{
                        transform: [{ scale: pulseAnim }],
                        backgroundColor: activeItem.dotColor,
                      }}
                      className="absolute w-2.5 h-2.5 rounded-full opacity-50"
                    />
                    <View
                      style={{ backgroundColor: activeItem.dotColor }}
                      className="w-1.5 h-1.5 rounded-full"
                    />
                  </View>
                  <Text
                    className="text-gray-200 font-bold uppercase tracking-widest"
                    style={{ fontSize: 11 }}
                  >
                    {activeCount > 1 ? `${activeCount} Aktīvi` : 'Aktīvs'}
                  </Text>
                </View>
                <Text className="text-gray-400 font-semibold" style={{ fontSize: 13 }}>
                  {activeItem.num}
                </Text>
              </View>

              <Text
                className="text-white font-bold tracking-tight leading-tight mb-2"
                style={{ fontSize: 28 }}
              >
                {activeCount > 1 ? `${activeCount} pasūtījumi ceļā` : activeItem.status}
              </Text>
              <Text
                className="text-gray-400 font-medium mb-6 line-clamp-1"
                style={{ fontSize: 15 }}
              >
                {activeItem.sub}
              </Text>

              <View className="bg-white/10 p-4 rounded-2xl flex-row items-center justify-between">
                <Text className="text-white font-bold " style={{ fontSize: 15 }}>
                  Sekot līdzi
                </Text>
                <ArrowRight size={20} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Actions Grid */}
        {(!user?.companyRole || (user?.permManageOrders ?? false)) && (
          <View className="px-5">
            <Text className=" font-bold tracking-tight text-gray-900 mb-4" style={{ fontSize: 22 }}>
              Ko vēlaties pasūtīt?
            </Text>
            <View className="flex-row flex-wrap justify-between">
              {SERVICES.map((svc) => {
                const Icon = svc.icon;
                return (
                  <TouchableOpacity
                    key={svc.id}
                    className="bg-gray-100 p-4 rounded-[24px] mb-3"
                    style={{ width: '48%' }}
                    onPress={() => {
                      haptics.light();
                      router.push(svc.route);
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="mb-6 bg-white self-start p-3.5 rounded-full shadow-sm">
                      <Icon size={22} color="#111827" strokeWidth={2.5} />
                    </View>
                    <Text className="text-gray-900 font-bold text-base tracking-tight mb-1">
                      {svc.label}
                    </Text>
                    <Text
                      className="text-gray-500 font-medium line-clamp-1 leading-tight"
                      style={{ fontSize: 13 }}
                    >
                      {svc.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
