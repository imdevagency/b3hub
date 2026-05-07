import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder, SkipHireOrder, ApiTransportJob, ApiProject } from '@/lib/api';
import {
  HardHat,
  Trash2,
  Truck,
  Package,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  MailCheck,
  Building2,
  FolderOpen,
  Wrench,
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
  { id: 'container', icon: Package, label: 'Konteineri', sub: 'Piegāde', route: '/skip-hire' },
  {
    id: 'disposal',
    icon: Trash2,
    label: 'Utilizācija',
    sub: 'Būvgruži, zeme',
    route: '/disposal',
  },
  {
    id: 'scrap-buyback',
    icon: Wrench,
    label: 'Metāllūžņi',
    sub: 'Nodo un saņem samaksu',
    route: '/scrap-buyback',
  },
  {
    id: 'toilet-cabin',
    icon: Building2,
    label: 'Tualetes kabīnes',
    sub: 'Noma būvlaukumam',
    route: '/toilet-cabin',
  },
];

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { setConfig } = useHeaderConfig();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [transportOrders, setTransportOrders] = useState<ApiTransportJob[]>([]);
  const [activeProjects, setActiveProjects] = useState<ApiProject[]>([]);
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
        api.projects.getAll(token).catch(() => [] as ApiProject[]),
      ])
        .then(([mats, skips, reqs, projs]) => {
          setOrders(mats as ApiOrder[]);
          setSkipOrders(skips as SkipHireOrder[]);
          setTransportOrders(reqs as ApiTransportJob[]);
          setActiveProjects(
            (projs as ApiProject[]).filter((p) => p.status === 'ACTIVE').slice(0, 5),
          );
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

        {/* Single-priority account nudge — profile completion wins over email nudge */}
        {user && (!user.phone || (user.isCompany && !user.company?.id)) ? (
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
              if (!user.phone) router.push('/(buyer)/profile');
              else router.push('/(auth)/apply-role?type=supplier' as never);
            }}
          >
            <AlertCircle size={18} color="#d97706" />
            <Text
              style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#92400e' }}
            >
              {!user.phone
                ? 'Pievienojiet tālruni, lai veiktu pasūtījumus'
                : 'Pievienojiet uzņēmuma datus'}
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
                activeItem.kind === 'skip'
                  ? `/(buyer)/skip-order/${activeItem.id}`
                  : activeItem.kind === 'transport'
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
                    color: '#9ca3af',
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
                  color: '#9ca3af',
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

        {/* ── Project Quick-Order ── */}
        {activeProjects.length > 0 && (!user?.companyRole || (user?.permManageOrders ?? false)) && (
          <View style={{ marginBottom: 32 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  fontSize: 22,
                  letterSpacing: -0.5,
                  color: '#111827',
                }}
              >
                Projekti
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(buyer)/orders' as any)}
                hitSlop={12}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    fontSize: 14,
                    color: '#166534',
                  }}
                >
                  Visi projekti
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {activeProjects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  activeOpacity={0.85}
                  onPress={() => {
                    haptics.light();
                    router.push(`/(buyer)/catalog?projectId=${project.id}` as any);
                  }}
                  style={{
                    width: 200,
                    backgroundColor: '#f0fdf4',
                    borderRadius: 24,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: '#bbf7d0',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#dcfce7',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <FolderOpen size={20} color="#166534" strokeWidth={2} />
                  </View>
                  <Text
                    style={{
                      fontFamily: 'Inter_700Bold',
                      fontWeight: '700',
                      fontSize: 15,
                      color: '#111827',
                      letterSpacing: -0.3,
                      marginBottom: 4,
                    }}
                    numberOfLines={2}
                  >
                    {project.name}
                  </Text>
                  {project.siteAddress ? (
                    <Text
                      style={{
                        fontFamily: 'Inter_400Regular',
                        fontSize: 12,
                        color: '#6b7280',
                        marginBottom: 14,
                      }}
                      numberOfLines={1}
                    >
                      {project.siteAddress}
                    </Text>
                  ) : (
                    <View style={{ marginBottom: 14 }} />
                  )}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#166534',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        fontWeight: '600',
                        fontSize: 13,
                        color: '#fff',
                        flex: 1,
                      }}
                    >
                      Pasūtīt
                    </Text>
                    <ArrowRight size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Empty State / Actions Grid ── */}
        {(!user?.companyRole || (user?.permManageOrders ?? false)) && (
          <View style={{ paddingHorizontal: 20 }}>
            {/* Empty state — just a heading prompt, the grid below is the CTA */}
            {!activeItem && !loading && (
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontWeight: '500',
                  fontSize: 15,
                  color: '#6b7280',
                  marginBottom: 16,
                }}
              >
                Nav aktīvu pasūtījumu. Sāciet no pakalpojumiem zemāk.
              </Text>
            )}

            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                fontSize: 26,
                letterSpacing: -0.5,
                color: '#111827',
                marginBottom: 20,
              }}
            >
              Katalogs
            </Text>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}
            >
              {SERVICES.map((svc) => {
                const Icon = svc.icon;
                return (
                  <TouchableOpacity
                    key={svc.id}
                    style={{
                      width: '48%',
                      backgroundColor: '#f9fafb',
                      borderRadius: 32,
                      padding: 20,
                      marginBottom: 16,
                    }}
                    onPress={() => {
                      haptics.light();
                      router.push(svc.route as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        marginBottom: 24,
                        backgroundColor: '#ffffff',
                        alignSelf: 'flex-start',
                        padding: 14,
                        borderRadius: 20,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                        elevation: 2,
                      }}
                    >
                      <Icon size={24} color="#111827" strokeWidth={2} />
                    </View>
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontWeight: '700',
                        fontSize: 17,
                        letterSpacing: -0.5,
                        color: '#111827',
                        marginBottom: 6,
                      }}
                    >
                      {svc.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Inter_500Medium',
                        fontWeight: '500',
                        fontSize: 14,
                        color: '#6b7280',
                        lineHeight: 18,
                      }}
                      numberOfLines={1}
                    >
                      {svc.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
