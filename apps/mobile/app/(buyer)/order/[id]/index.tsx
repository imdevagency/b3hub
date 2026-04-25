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
    if (movedEnough) {
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        animationDuration: 600,
      });
    }
  }, [liveLocation]);

  const routeOrigin = useMemo(() => {
    if (driverLocationOnMap) return { lat: driverLocationOnMap.lat, lng: driverLocationOnMap.lng };
    return null;
  }, [driverLocationOnMap]);

  const routeDestination = useMemo(() => {
    if (order?.deliveryLat != null && order?.deliveryLng != null) {
      return { lat: order.deliveryLat as number, lng: order.deliveryLng as number };
    }
    return null;
  }, [order?.deliveryLat, order?.deliveryLng]);

  const { route } = useRoute(routeOrigin, routeDestination);

  useEffect(() => {
    if (!cameraRef.current || !routeOrigin || !routeDestination) return;
    const ne: [number, number] = [
      Math.max(routeOrigin.lng, routeDestination.lng),
      Math.max(routeOrigin.lat, routeDestination.lat),
    ];
    const sw: [number, number] = [
      Math.min(routeOrigin.lng, routeDestination.lng),
      Math.min(routeOrigin.lat, routeDestination.lat),
    ];
    cameraRef.current.fitBounds(ne, sw, [48, 48, 48, 48], 600);
  }, [routeOrigin?.lat, routeOrigin?.lng, routeDestination?.lat, routeDestination?.lng]);

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
    <ScreenContainer bg="#F4F5F7" standalone topInset={0}>
      <View style={styles.mapWrapper}>
        <BaseMap
          cameraRef={cameraRef}
          center={
            driverLocationOnMap
              ? [driverLocationOnMap.lng, driverLocationOnMap.lat]
              : order.deliveryLng && order.deliveryLat
                ? [order.deliveryLng, order.deliveryLat]
                : [24.1052, 56.9496]
          }
          zoom={12.5}
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {route?.coords && route.coords.length > 1 && (
            <RouteLayer id="order-route" coordinates={route.coords} color="#4f46e5" width={4} />
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

        {/* Floating Header */}
        <View style={[styles.floatingHeader, { paddingTop: insets.top || 44 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(buyer)/orders'))}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pasūtījums</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Uber-like Top Floating Card */}
        <View style={[styles.topCardContainer, { top: (insets.top || 44) + 64 }]}>
          <View style={styles.topCard}>
            <View style={styles.topCardIcon}>
              <Package size={24} color="#374151" strokeWidth={1.5} />
            </View>
            <View style={styles.topCardMeta}>
              <Text style={styles.topCardTitle} numberOfLines={1}>
                {order.materials?.[0]?.material?.name || 'Materiāli'}
              </Text>
              <Text style={styles.topCardSubtitle}>ID: {order.id.slice(-8).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Uber-like Bottom Sheet / Overlay */}
        <View style={[styles.overlayContainer, { bottom: insets.bottom || 24 }]}>
          <View style={styles.overlayCard}>
            {/* Courier Header Row */}
            <View style={styles.courierHeader}>
              {driver?.avatar ? (
                <Image source={{ uri: driver.avatar }} style={styles.courierAvatar} />
              ) : (
                <View style={styles.courierAvatarFallback}>
                  <Truck size={20} color="#6B7280" strokeWidth={2} />
                </View>
              )}
              <View style={styles.courierInfo}>
                <Text style={styles.courierName} numberOfLines={1}>
                  {driver
                    ? `${driver.firstName} ${driver.lastName}`
                    : isTerminal
                      ? order.status === 'CANCELLED'
                        ? 'Pasūtījums atcelts'
                        : 'Piegāde pabeigta'
                      : 'Meklējam šoferi...'}
                </Text>
                <Text style={styles.courierRole}>
                  {driver ? 'Šoferis' : isTerminal ? '' : 'Pieprasījums nosūtīts'}
                </Text>
              </View>

              <View style={styles.driverActions}>
                {activeJob && (
                  <TouchableOpacity
                    style={styles.courierActionBtn}
                    onPress={() => {
                      haptics.medium();
                      router.push({
                        pathname: '/chat/[jobId]',
                        params: {
                          jobId: activeJob.id,
                          title: `${driver?.firstName} ${driver?.lastName}`,
                        },
                      });
                    }}
                  >
                    <MessageCircle size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                {driver?.phone && (
                  <TouchableOpacity
                    style={[styles.courierActionBtn, { marginLeft: 8 }]}
                    onPress={() => {
                      haptics.medium();
                      Linking.openURL(`tel:${driver.phone}`).catch(() => null);
                    }}
                  >
                    <Phone size={18} color="#FFFFFF" fill="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Status: success/cancelled card for terminal states, timeline for active */}
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
                  {order.status !== 'CANCELLED' && order.deliveryDate && (
                    <Text style={styles.terminalDate}>
                      {new Date(order.deliveryDate).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.statusSection}>
                <Text style={styles.statusSectionTitle}>Pasūtījuma statuss</Text>

                <View style={styles.timelineContainer}>
                  {JOB_STEPS.map((step, index) => {
                    const isSearching = order.status === 'PENDING' || order.status === 'SEARCHING';
                    const isDone = !isSearching && index <= currentStepIdx;
                    const isCurrent = !isSearching && index === currentStepIdx;
                    const isLast = index === JOB_STEPS.length - 1;

                    let dateStr: string | null = null;
                    if (etaMin != null && step.key === 'enroute' && isCurrent) {
                      dateStr = `~${etaMin} min`;
                    } else if (step.key === 'pickup') {
                      dateStr = order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString('lv-LV', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : null;
                    } else if (step.key === 'delivered') {
                      dateStr = order.deliveryDate
                        ? new Date(order.deliveryDate).toLocaleDateString('lv-LV', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : null;
                    }

                    let addressStr =
                      step.key === 'pickup' || step.key === 'loading'
                        ? order.siteContactName || order.supplierBranch?.name || 'Iekraušana'
                        : order.deliveryAddress || order.deliveryCity;

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
                              <CheckCircle2 size={12} color="#FFFFFF" strokeWidth={3} />
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
                            <Text style={styles.timelineSubtitle} numberOfLines={2}>
                              {addressStr}
                            </Text>
                          </View>
                          {dateStr && (
                            <Text
                              style={[
                                styles.timelineDateText,
                                isCurrent &&
                                  step.key === 'enroute' && { color: ORANGE, fontWeight: '700' },
                              ]}
                            >
                              {dateStr}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Bottom actions */}
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
              {isTerminal && (
                <Button
                  variant="default"
                  size="lg"
                  className="flex-1 ml-2"
                  onPress={() => {
                    haptics.medium();
                    router.replace('/(buyer)/catalog' as never);
                  }}
                >
                  Atkārtot
                </Button>
              )}
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const ORANGE = '#4f46e5';

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSpacer: {
    width: 44,
  },
  topCardContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  topCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  topCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  topCardMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  topCardTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  topCardSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  overlayContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  overlayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  courierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  courierAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  courierAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: '#E5E7EB',
  },
  courierInfo: {
    flex: 1,
  },
  courierName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSection: {
    marginBottom: 8,
  },
  statusSectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 2,
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
    borderColor: '#D1D5DB',
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
    bottom: -6,
    width: 2,
    zIndex: 1,
  },
  timelineLineActive: {
    backgroundColor: ORANGE,
  },
  timelineLineInactive: {
    backgroundColor: '#E5E7EB',
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  timelineTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
    marginBottom: 4,
  },
  timelineTitleCurrent: {
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
  timelineTitleFuture: {
    color: '#9CA3AF',
  },
  timelineSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  timelineDateText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
    paddingTop: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  terminalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 14,
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
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  terminalAddress: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 2,
  },
  terminalDate: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#9CA3AF',
  },
});
