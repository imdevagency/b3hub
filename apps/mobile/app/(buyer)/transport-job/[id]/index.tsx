import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapPin,
  Package,
  MessageCircle,
  Truck,
  Phone,
  Star,
  Recycle,
  ChevronRight,
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
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useTransportJob } from '@/lib/use-transport-job';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { colors } from '@/lib/theme';

const JOB_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Pasūtījums publicēts platformā',
  ASSIGNED: 'Piedāvāts šoferim',
  ACCEPTED: 'Šoferis pieņēma pasūtījumu',
  EN_ROUTE_PICKUP: 'Šoferis dodas uz kraušanu',
  AT_PICKUP: 'Šoferis ir pie kraušanas vietas',
  LOADED: 'Krava ir iekrauta',
  EN_ROUTE_DELIVERY: 'Šoferis dodas uz jums',
  AT_DELIVERY: 'Šoferis ir uz vietas',
  DELIVERED: 'Piegāde pabeigta',
  CANCELLED: 'Pasūtījums atcelts',
};
const JOB_STEPS = [
  { key: 'pickup', label: 'Uz kraušanu' },
  { key: 'loading', label: 'Krauj' },
  { key: 'enroute', label: 'Ceļā' },
  { key: 'delivered', label: 'Piegādāts' },
] as const;

const JOB_STATUS_TO_STEP: Record<string, number> = {
  AVAILABLE: 0,
  ASSIGNED: 0,
  ACCEPTED: 0,
  EN_ROUTE_PICKUP: 0,
  AT_PICKUP: 1,
  LOADED: 1,
  EN_ROUTE_DELIVERY: 2,
  AT_DELIVERY: 3,
  DELIVERED: 3,
};

/** Minimal Google Maps style: hides POIs and transit to keep tracking uncluttered. */
const TRACKING_MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];

/** Find the index of the route coordinate closest to the driver's current position. */
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
export default function TransportJobTrackingScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, loading, reload: reloadJob, accessDenied } = useTransportJob(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const insets = useSafeAreaInsets();
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  // null = not yet checked, true/false = result of API check
  const [ratingAlreadyDone, setRatingAlreadyDone] = useState<boolean | null>(null);

  // Don't open a live subscription for truly terminal jobs (no new events expected)
  const jobIsTerminalForLive =
    job != null && (job.status === 'DELIVERED' || job.status === 'CANCELLED');

  const {
    jobLocation: liveLocation,
    jobStatus: liveJobStatus,
    connected,
  } = useLiveUpdates({
    jobId: jobIsTerminalForLive ? null : typeof id === 'string' ? id : null,
    token,
  });

  useEffect(() => {
    if (!liveLocation) return;
    const { lat, lng } = liveLocation;
    if (liveLocation.estimatedArrivalMin != null) {
      setEtaMin(liveLocation.estimatedArrivalMin);
    }
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

  // Reload job data when a live status push arrives (e.g. driver marks DELIVERED)
  useEffect(() => {
    if (liveJobStatus) reloadJob();
  }, [liveJobStatus, reloadJob]);

  // Clear stale driver marker and ETA when job becomes terminal
  useEffect(() => {
    if (job?.status === 'DELIVERED' || job?.status === 'CANCELLED') {
      setDriverLocationOnMap(null);
      setEtaMin(null);
    }
  }, [job?.status]);

  // Check if buyer has already rated — determines tracking screen CTA label
  useEffect(() => {
    if (!job || !token || job.status !== 'DELIVERED' || ratingAlreadyDone !== null) return;
    api.reviews
      .status({ transportJobId: job.id }, token)
      .then(({ reviewed }) => setRatingAlreadyDone(reviewed))
      .catch(() => setRatingAlreadyDone(false));
  }, [job?.id, job?.status, token, ratingAlreadyDone]);

  const handleCancel = useCallback(() => {
    if (!job || !token) return;
    haptics.heavy();
    Alert.alert('Atcelt pasūtījumu?', 'Šo darbību nevar atsaukt. Pasūtījums tiks atcelts.', [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.transportJobs.buyerCancel(job.id, token);
            haptics.success();
            reloadJob();
          } catch {
            haptics.error();
          }
        },
      },
    ]);
  }, [job, reloadJob, token]);

  const routeOrigin = useMemo(() => {
    // Fixed to pickup coords — never re-fetches on driver GPS updates.
    // Route trimming from driver’s current position is done locally in displayCoords.
    if (job?.pickupLat != null && job?.pickupLng != null) {
      return { lat: job.pickupLat, lng: job.pickupLng };
    }
    return null;
  }, [job?.pickupLat, job?.pickupLng]);

  const routeDestination = useMemo(() => {
    if (job?.deliveryLat != null && job?.deliveryLng != null) {
      return { lat: job.deliveryLat, lng: job.deliveryLng };
    }
    return null;
  }, [job?.deliveryLat, job?.deliveryLng]);

  const { route } = useRoute(routeOrigin, routeDestination);

  /**
   * Route trimming — once the driver is en-route to delivery, slice the
   * polyline from the nearest point to the driver’s current position forward.
   * This avoids the expensive repeated Directions API calls that the old
   * approach (driverLocationOnMap in routeOrigin) triggered every GPS update.
   */
  const displayCoords = useMemo(() => {
    const coords = route?.coords;
    if (!coords || coords.length < 2) return coords ?? [];
    if (
      driverLocationOnMap &&
      (job?.status === 'EN_ROUTE_DELIVERY' || job?.status === 'AT_DELIVERY')
    ) {
      const idx = findNearestIdx(coords, driverLocationOnMap);
      return idx > 1 ? coords.slice(idx - 1) : coords;
    }
    return coords;
  }, [route?.coords, driverLocationOnMap, job?.status]);

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
        <ScreenHeader title="Pārvadājums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (accessDenied) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pārvadājums" />
        <EmptyState
          icon={<X size={32} color="#9CA3AF" />}
          title="Piekļuve liegta"
          subtitle="Šis pārvadājums jums nav pieejams."
        />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pārvadājums" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const isDisposal = job.jobType === 'WASTE_COLLECTION';
  const driver = job.driver;
  const currentStepIdx = JOB_STATUS_TO_STEP[job.status] ?? -1;
  const isTerminal = job.status === 'DELIVERED' || job.status === 'CANCELLED';
  const isSearching = job.status === 'AVAILABLE' || job.status === 'ASSIGNED';

  const heroPrimary = (() => {
    if (job.status === 'DELIVERED') return 'Piegādāts';
    if (job.status === 'CANCELLED') return 'Atcelts';
    if (job.status === 'AT_DELIVERY') return 'Uz vietas';
    if (job.status === 'AT_PICKUP' || job.status === 'LOADED') return 'Krauj kravu';
    // Only show live ETA while the driver is actively en route
    if (etaMin != null && job.status === 'EN_ROUTE_DELIVERY') return `${etaMin} min`;
    if (driver) return 'Ceļā';
    if (job.status === 'ASSIGNED') return 'Piešķirts šoferim';
    if (job.status === 'AVAILABLE') return 'Meklē pārvadātāju';
    return 'Pārvadājumā';
  })();

  const heroSubtitle = JOB_STATUS_LABEL[job.status] ?? 'Pārvadājumā';
  const initialCenter: [number, number] =
    job.deliveryLng != null && job.deliveryLat != null
      ? [job.deliveryLng, job.deliveryLat]
      : [24.1052, 56.9496];

  return (
    <ScreenContainer bg="#FFFFFF" standalone topInset={0}>
      <View style={styles.mapWrapper}>
        <BaseMap
          cameraRef={cameraRef}
          center={initialCenter}
          zoom={12.5}
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
          customMapStyle={TRACKING_MAP_STYLE}
          mapPadding={{ top: 120, right: 16, bottom: 360, left: 16 }}
        >
          {displayCoords.length > 1 && (
            <RouteLayer id="job-route" coordinates={displayCoords} color="#4f46e5" width={4} />
          )}
          {job.pickupLat != null && job.pickupLng != null && (
            <PinLayer
              id="pickup"
              type="elegant-pickup"
              coordinate={{ lat: job.pickupLat, lng: job.pickupLng }}
            />
          )}
          {job.deliveryLat != null && job.deliveryLng != null && (
            <PinLayer
              id="delivery"
              type="elegant-delivery"
              coordinate={{ lat: job.deliveryLat, lng: job.deliveryLng }}
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
            Pārvadājums {job.jobNumber ?? job.id.slice(-8).toUpperCase()}
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
                      ? job.status === 'CANCELLED'
                        ? 'Atcelts'
                        : 'Pabeigts'
                      : job.status === 'ASSIGNED'
                        ? 'Gaida šoferi...'
                        : 'Meklējam šoferi...'}
                </Text>
                <Text style={styles.courierRole}>
                  {driver
                    ? 'Šoferis'
                    : isTerminal
                      ? ''
                      : job.status === 'ASSIGNED'
                        ? 'Piedāvājums nosūtīts'
                        : 'Pieprasījums nosūtīts'}
                </Text>
              </View>
              {driver?.phone && (
                <TouchableOpacity
                  style={styles.courierPhoneBtn}
                  onPress={() => {
                    haptics.medium();
                    Linking.openURL(`tel:${driver.phone}`).catch(() => null);
                  }}
                >
                  <Phone size={20} color="#FFFFFF" fill="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Terminal state card or active timeline */}
            {isTerminal ? (
              <View style={styles.terminalSection}>
                <View
                  style={[
                    styles.terminalIconWrap,
                    { backgroundColor: job.status === 'CANCELLED' ? '#FEF2F2' : '#ECFDF5' },
                  ]}
                >
                  {job.status === 'CANCELLED' ? (
                    <X size={26} color="#DC2626" strokeWidth={2.5} />
                  ) : (
                    <CheckCircle2 size={26} color="#059669" strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.terminalTitle}>
                    {job.status === 'CANCELLED' ? 'Pasūtījums atcelts' : 'Piegāde pabeigta'}
                  </Text>
                  {job.status !== 'CANCELLED' && job.deliveryAddress && (
                    <Text style={styles.terminalAddress} numberOfLines={1}>
                      {job.deliveryAddress.split(',')[0]}
                    </Text>
                  )}
                  {job.status === 'DELIVERED' && job.pickupPhotoUrl && (
                    <TouchableOpacity
                      onPress={() => {
                        haptics.light();
                        router.push(`/(buyer)/transport-job/${id}/details` as never);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.terminalDocsLink}>Skatīt dokumentus →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.statusSection}>
                {job.sla?.isOverdue && (
                  <View style={styles.overdueBanner}>
                    <Text style={styles.overdueText}>⚠ Kavējas {job.sla.overdueMinutes} min</Text>
                  </View>
                )}
                {isSearching && (
                  <Text style={styles.searchingHint}>
                    {job.status === 'ASSIGNED'
                      ? 'Gaida šofera apstiprinājumu. Parasti tas aizņem dažas minūtes.'
                      : 'Meklējam brīvu šoferi jūsu maršrutam. Parasti tas aizņem 5–15 minūtes.'}
                  </Text>
                )}

                <View style={styles.timelineContainer}>
                  {JOB_STEPS.map((step, index) => {
                    const isDone = !isSearching && index <= currentStepIdx;
                    const isCurrent = !isSearching && index === currentStepIdx;
                    const isLast = index === JOB_STEPS.length - 1;

                    let dateStr = null;
                    const ts = job.statusTimestamps ?? {};
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
                    } else if (step.key === 'pickup') {
                      dateStr = new Date(job.pickupDate).toLocaleTimeString('lv-LV', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } else if (step.key === 'delivered') {
                      dateStr = new Date(job.deliveryDate).toLocaleTimeString('lv-LV', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    }

                    let addressStr =
                      step.key === 'pickup' || step.key === 'loading'
                        ? job.pickupAddress || job.pickupCity
                        : job.deliveryAddress || job.deliveryCity;

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
                className="flex-1 mr-2"
                onPress={() => {
                  haptics.light();
                  router.push(`/(buyer)/transport-job/${id}/details` as never);
                }}
              >
                Detaļas
              </Button>
              {isSearching && (
                <Button
                  variant="destructive"
                  size="lg"
                  className="flex-1 ml-2"
                  onPress={handleCancel}
                >
                  Atcelt
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
  courierPhoneBtn: {
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
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
  terminalDocsLink: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: ORANGE,
    marginTop: 6,
  },
  searchingHint: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  overdueBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  overdueText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#DC2626',
  },
});
