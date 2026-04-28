import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapPin,
  Package,
  Truck,
  Star,
  Phone,
  ChevronRight,
  MessageCircle,
  ChevronLeft,
  CheckCircle2,
  X,
} from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BaseMap, RouteLayer, useRoute, PinLayer, AnimatedDriverMarker } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useOrderDetail } from '@/lib/use-order-detail';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { MAT_STATUS } from '@/lib/materials';
import { colors } from '@/lib/theme';

/** Suppress POI / transit clutter on the tracking map. */
const TRACKING_MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];

/** O(n) nearest-coordinate index — used for local route trimming. */
function findNearestIdx(
  coords: Array<{ latitude: number; longitude: number }>,
  driver: { lat: number; lng: number },
): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = (coords[i].latitude - driver.lat) ** 2 + (coords[i].longitude - driver.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

const JOB_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'Šoferis pieņēma pasūtījumu',
  EN_ROUTE_PICKUP: 'Šoferis dodas uz kraušanu',
  AT_PICKUP: 'Šoferis ir pie kraušanas vietas',
  LOADED: 'Krava ir iekrauta',
  EN_ROUTE_DELIVERY: 'Šoferis dodas uz jums',
  AT_DELIVERY: 'Šoferis ir uz vietas',
  DELIVERED: 'Piegādāts',
};

const ORDER_STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  ...MAT_STATUS,
  COMPLETED: { label: 'Pabeigts', bg: '#DCFCE7', color: '#15803D' },
};

const JOB_STEPS = [
  { key: 'pickup', label: 'Uz kraušanu' },
  { key: 'loading', label: 'Krauj' },
  { key: 'enroute', label: 'Ceļā' },
  { key: 'delivered', label: 'Piegādāts' },
] as const;

const JOB_STATUS_TO_STEP: Record<string, number> = {
  ACCEPTED: 0,
  EN_ROUTE_PICKUP: 0,
  AT_PICKUP: 1,
  LOADED: 1,
  EN_ROUTE_DELIVERY: 2,
  AT_DELIVERY: 3,
  DELIVERED: 3,
};

export default function OrderTrackingScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, setOrder, loading, reload: load } = useOrderDetail(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const insets = useSafeAreaInsets();
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  // Lock the route origin to the first driver GPS fix so useRoute is called
  // only once — subsequent GPS updates trim the polyline locally instead of
  // re-fetching the Directions API on every WebSocket location push.
  const [lockedRouteOrigin, setLockedRouteOrigin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Don't open a live subscription for closed orders — saves battery and socket slots
  const orderIsTerminalForLive =
    order != null && ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status);

  const {
    orderStatus: liveStatus,
    jobStatus: liveJobStatus,
    jobLocation: liveLocation,
  } = useLiveUpdates({
    orderId: orderIsTerminalForLive ? null : (id ?? null),
    jobId: orderIsTerminalForLive ? null : (order?.transportJobs?.[0]?.id ?? null),
    token,
  });

  useEffect(() => {
    if (liveStatus && order && liveStatus !== order.status) {
      setOrder((prev) => (prev ? { ...prev, status: liveStatus } : prev));
    }
  }, [liveStatus, order?.status, setOrder]);

  useEffect(() => {
    if (liveJobStatus) load();
  }, [liveJobStatus, load]);

  useEffect(() => {
    if (!liveLocation) return;
    if (liveLocation.estimatedArrivalMin != null) {
      setEtaMin(liveLocation.estimatedArrivalMin);
    }
    const { lat, lng } = liveLocation;
    const prev = driverLocationOnMap;
    const movedEnough =
      !prev || Math.abs(prev.lat - lat) > 0.0003 || Math.abs(prev.lng - lng) > 0.0003;
    setDriverLocationOnMap({ lat, lng });
    // Lock origin once — never update it again so useRoute isn't re-called on GPS
    setLockedRouteOrigin((cur) => cur ?? { lat, lng });
    if (movedEnough) {
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        animationDuration: 600,
      });
    }
  }, [liveLocation]);

  // routeOrigin is locked to the first GPS fix — never changes after that.
  const routeDestination = useMemo(() => {
    if (order?.deliveryLat != null && order?.deliveryLng != null) {
      return { lat: order.deliveryLat as number, lng: order.deliveryLng as number };
    }
    return null;
  }, [order?.deliveryLat, order?.deliveryLng]);

  const { route } = useRoute(lockedRouteOrigin, routeDestination);

  // Trim the polyline locally from the driver's current position rather than
  // re-fetching the Directions API on every GPS update.
  const displayCoords = useMemo(() => {
    const coords = route?.coords;
    if (!coords || coords.length < 2) return coords ?? [];
    const jobStatus = order?.transportJobs?.[0]?.status;
    if (driverLocationOnMap && (jobStatus === 'EN_ROUTE_DELIVERY' || jobStatus === 'AT_DELIVERY')) {
      const idx = findNearestIdx(coords, driverLocationOnMap);
      return idx > 1 ? coords.slice(idx - 1) : coords;
    }
    return coords;
  }, [route?.coords, driverLocationOnMap, order?.transportJobs]);

  // Fit bounds once — only when the locked origin first becomes available.
  useEffect(() => {
    if (!cameraRef.current || !lockedRouteOrigin || !routeDestination) return;
    const ne: [number, number] = [
      Math.max(lockedRouteOrigin.lng, routeDestination.lng),
      Math.max(lockedRouteOrigin.lat, routeDestination.lat),
    ];
    const sw: [number, number] = [
      Math.min(lockedRouteOrigin.lng, routeDestination.lng),
      Math.min(lockedRouteOrigin.lat, routeDestination.lat),
    ];
    cameraRef.current.fitBounds(ne, sw, [48, 48, 280, 48], 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedRouteOrigin != null, routeDestination?.lat, routeDestination?.lng]);

  if (loading) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pasūtījums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pasūtījums" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const statusMeta = ORDER_STATUS_PILL[order.status] ?? ORDER_STATUS_PILL.PENDING;
  const activeJob = order.transportJobs?.find(
    (job) =>
      job.status === 'ACCEPTED' ||
      job.status === 'EN_ROUTE_PICKUP' ||
      job.status === 'AT_PICKUP' ||
      job.status === 'LOADED' ||
      job.status === 'EN_ROUTE_DELIVERY' ||
      job.status === 'AT_DELIVERY',
  );
  const driver = activeJob?.driver;
  const currentStepIdx = activeJob ? (JOB_STATUS_TO_STEP[activeJob.status] ?? 0) : -1;
  const isTerminal = ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status);

  const heroPrimary = (() => {
    if (order.status === 'DELIVERED') return 'Piegādāts';
    if (order.status === 'COMPLETED') return 'Pabeigts';
    if (order.status === 'CANCELLED') return 'Atcelts';
    if (etaMin != null) {
      const etaDate = new Date(Date.now() + etaMin * 60 * 1000);
      const hh = String(etaDate.getHours()).padStart(2, '0');
      const mm = String(etaDate.getMinutes()).padStart(2, '0');
      return `${etaMin} min  ·  ${hh}:${mm}`;
    }
    if (driver) return 'Ceļā';
    if (order.status === 'PENDING') return 'Gaida apstiprināšanu';
    return 'Meklē šoferi';
  })();

  const jobStatusLabel = activeJob ? (JOB_STATUS_LABEL[activeJob.status] ?? 'Piegādē') : null;
  const heroSubtitle =
    jobStatusLabel ?? (order.status === 'DELIVERED' ? 'Apstipriniet saņemšanu' : statusMeta.label);

  return (
    <ScreenContainer bg="#FFFFFF" standalone topInset={0}>
      <View style={styles.mapWrapper}>
        <BaseMap
          cameraRef={cameraRef}
          center={
            order?.deliveryLat && order?.deliveryLng
              ? [order.deliveryLng, order.deliveryLat]
              : [24.1052, 56.9496]
          }
          zoom={12.5}
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
          customMapStyle={TRACKING_MAP_STYLE}
          mapPadding={{ top: 120, right: 16, bottom: 360, left: 16 }}
        >
          {displayCoords.length > 1 && (
            <RouteLayer id="job-route" coordinates={displayCoords} color="#10b981" width={4} />
          )}

          {order.deliveryLat != null && order.deliveryLng != null && (
            <PinLayer
              id="delivery"
              type="elegant-delivery"
              coordinate={{ lat: order.deliveryLat, lng: order.deliveryLng }}
            />
          )}
          {driverLocationOnMap && (
            <AnimatedDriverMarker
              id="driver"
              coordinate={{ lat: driverLocationOnMap.lat, lng: driverLocationOnMap.lng }}
            />
          )}
        </BaseMap>

        {/* Minimal Bolt-style Top Pill */}
        <View style={[styles.topPill, { top: Math.max(insets.top, 24) + 12 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(buyer)/orders'))}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Pasūtījums {order.orderNumber ?? order.id.slice(-8).toUpperCase()}
          </Text>

          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => {
              haptics.light();
              router.push('/(shared)/help' as never);
            }}
          >
            <MessageCircle size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Uber/Bolt-style Bottom Sheet (Docked to bottom edge) */}
        <View style={[styles.bottomSheetWrapper, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {false && (
            <View
              className="absolute z-20 self-center flex-row items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 border-[1.5px] border-white"
              style={{
                top: -24,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View className="h-2 w-2 rounded-full bg-red-500" />
              <Text className="font-medium text-white text-xs">Tiešsaiste pārtraukta</Text>
            </View>
          )}

          <View style={styles.bottomSheetContent}>
            {/* Courier Header Row */}
            <View style={styles.courierHeader}>
              {driver?.avatar ? (
                <Image source={{ uri: driver.avatar }} style={styles.courierAvatar} />
              ) : (
                <View style={styles.courierAvatarFallback}>
                  <Truck size={24} color="#6B7280" strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.courierInfo}>
                <Text style={styles.courierName} numberOfLines={1}>
                  {driver
                    ? `${driver.firstName} ${driver.lastName}`
                    : isTerminal
                      ? order.status === 'CANCELLED'
                        ? 'Atcelts'
                        : 'Pabeigts'
                      : 'Gaidām pārvadātāju...'}
                </Text>
                <Text style={styles.courierRole}>
                  {driver ? 'Šoferis' : isTerminal ? '' : 'Piemeklēsim drīzumā'}
                </Text>
              </View>
              {driver?.phone && (
                <View style={styles.driverActions}>
                  <TouchableOpacity
                    style={[styles.courierActionBtn, { backgroundColor: '#4f46e5' }]}
                    onPress={() => {
                      haptics.medium();
                      const tJobId = order?.transportJobs?.[0]?.id;
                      if (!tJobId) return;
                      router.push(`/(shared)/chat/${tJobId}` as never);
                    }}
                  >
                    <MessageCircle size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.courierActionBtn}
                    onPress={() => {
                      haptics.medium();
                      Linking.openURL(`tel:${driver.phone}`).catch(() => null);
                    }}
                  >
                    <Phone size={20} color="#FFFFFF" fill="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Terminal state card or active timeline */}
            {isTerminal ? (
              <View style={styles.terminalSection}>
                <View
                  style={[
                    styles.terminalIconWrap,
                    { backgroundColor: order.status === 'CANCELLED' ? '#FEF2F2' : '#ECFDF5' },
                  ]}
                >
                  {order.status === 'CANCELLED' ? (
                    <X size={26} color="#DC2626" strokeWidth={2.5} />
                  ) : (
                    <CheckCircle2 size={26} color="#059669" strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.terminalTitle}>
                    {order.status === 'CANCELLED' ? 'Pasūtījums atcelts' : 'Piegāde pabeigta'}
                  </Text>
                  {order.status !== 'CANCELLED' && order.deliveryAddress && (
                    <Text style={styles.terminalAddress} numberOfLines={1}>
                      {order.deliveryAddress.split(',')[0]}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.statusSection}>
                <View style={styles.timelineContainer}>
                  {JOB_STEPS.map((step, index) => {
                    const isDone = index <= currentStepIdx;
                    const isCurrent = index === currentStepIdx;
                    const isLast = index === JOB_STEPS.length - 1;

                    let dateStr = null;
                    const job = order.transportJobs?.[0];
                    const ts = (job as any)?.statusTimestamps ?? {};
                    const fmtTs = (iso: string) =>
                      new Date(iso).toLocaleTimeString('lv-LV', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    const actualTsKey = {
                      pickup: 'AT_PICKUP',
                      loading: 'LOADED',
                      enroute: 'EN_ROUTE_DELIVERY',
                      delivered: 'DELIVERED',
                    };
                    if (etaMin != null && step.key === 'enroute' && isCurrent) {
                      dateStr = `~${etaMin} min`;
                    } else if (isDone && !isCurrent && ts[actualTsKey[step.key]]) {
                      dateStr = fmtTs(ts[actualTsKey[step.key]]);
                    } else if (step.key === 'pickup' && null) {
                      dateStr = new Date().toLocaleTimeString('lv-LV', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } else if (step.key === 'delivered' && order.deliveryDate) {
                      dateStr = new Date(order.deliveryDate).toLocaleTimeString('lv-LV', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    }

                    let addressStr =
                      step.key === 'pickup' || step.key === 'loading'
                        ? order.deliveryAddress
                        : order.deliveryAddress;

                    return (
                      <View key={step.key} style={styles.timelineRow}>
                        <View style={styles.timelineMarkerCol}>
                          {!isLast && (
                            <View
                              style={[
                                styles.timelineLine,
                                isDone && !isCurrent
                                  ? styles.timelineLineActive
                                  : styles.timelineLineInactive,
                              ]}
                            />
                          )}

                          {isCurrent ? (
                            <View style={styles.markerCurrent}>
                              <View style={styles.markerCurrentInner} />
                            </View>
                          ) : isDone ? (
                            <View style={styles.markerCompleted}>
                              <CheckCircle2 size={10} color="#FFFFFF" strokeWidth={4} />
                            </View>
                          ) : (
                            <View style={styles.markerFuture} />
                          )}
                        </View>

                        <View style={styles.timelineContent}>
                          <View style={styles.timelineTextWrap}>
                            <Text
                              style={[
                                styles.timelineTitle,
                                isCurrent && styles.timelineTitleCurrent,
                                !isDone && !isCurrent && styles.timelineTitleFuture,
                              ]}
                            >
                              {step.label}
                            </Text>
                            <Text style={styles.timelineSubtitle} numberOfLines={1}>
                              {addressStr}
                            </Text>
                          </View>
                          {dateStr && (
                            <View
                              style={[
                                styles.timePillHover,
                                isCurrent &&
                                  step.key === 'enroute' && { backgroundColor: '#D1FAE5' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timelineDateText,
                                  isCurrent &&
                                    step.key === 'enroute' && {
                                      color: '#059669',
                                      fontWeight: '700',
                                    },
                                ]}
                              >
                                {dateStr}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
            <View style={styles.cardActions}>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onPress={() => {
                  haptics.light();
                  router.push(`/(buyer)/order/${id}/details` as never);
                }}
              >
                Detaļas
              </Button>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const ORANGE = '#10b981'; // Green for orders, indigo for transport

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topPill: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  bottomSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 20,
  },
  bottomSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  courierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  courierAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  courierAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: '#E5E7EB',
  },
  courierInfo: {
    flex: 1,
  },
  courierName: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  courierRole: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  courierActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSection: {
    marginBottom: 8,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineMarkerCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 16,
  },
  markerFuture: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    zIndex: 2,
  },
  markerCompleted: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    zIndex: 2,
  },
  markerCurrent: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    zIndex: 2,
  },
  markerCurrentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 20,
    bottom: -4,
    width: 2,
    zIndex: 1,
  },
  timelineLineActive: {
    backgroundColor: ORANGE,
  },
  timelineLineInactive: {
    backgroundColor: '#F3F4F6',
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 22,
  },
  timelineTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  timelineTitleCurrent: {
    color: '#111827',
  },
  timelineTitleFuture: {
    color: '#9CA3AF',
    fontFamily: 'Inter_500Medium',
  },
  timelineSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  timePillHover: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  timelineDateText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
  terminalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 8,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  terminalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 3,
  },
  terminalAddress: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
});
