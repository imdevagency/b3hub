import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Phone,
  Package,
  Truck,
  ArrowLeft,
  MessageCircle,
  Recycle,
  RotateCcw,
  XCircle,
  Star,
} from 'lucide-react-native';
import { BaseMap, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useTransportJob } from '@/lib/use-transport-job';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { CATEGORY_LABELS } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';

// ── Job step model (4 simplified stages driving the progress dots) ──
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

const JOB_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'Šoferis pieņēma pasūtījumu',
  EN_ROUTE_PICKUP: 'Šoferis dodas uz kraušanu',
  AT_PICKUP: 'Šoferis ir pie kraušanas vietas',
  LOADED: 'Kravu iekrauj',
  EN_ROUTE_DELIVERY: 'Šoferis dodas uz jums',
  AT_DELIVERY: 'Šoferis ir uz vietas',
};

const VEHICLE_LABEL: Record<string, string> = {
  TIPPER_SMALL: 'Pašizgāzējs (10 t)',
  TIPPER_LARGE: 'Pašizgāzējs lielais (18 t)',
  ARTICULATED_TIPPER: 'Sattelkipper (26 t)',
};

const CARGO_LABEL: Record<string, string> = {
  WASTE_COLLECTION: 'Atkritumu izvešana',
  MATERIAL_DELIVERY: 'Materiālu piegāde',
  GENERAL_FREIGHT: 'Vispārīgā krava',
  SAND: CATEGORY_LABELS.SAND,
  GRAVEL: CATEGORY_LABELS.GRAVEL,
  CONCRETE: CATEGORY_LABELS.CONCRETE,
  SOIL: CATEGORY_LABELS.SOIL,
  WOOD: 'Koks',
  METAL: 'Metāls',
  MIXED: 'Jaukts',
};

// ── Main Screen ────────────────────────────────────────────────

export default function TransportJobDetailScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, loading, reload: loadJob } = useTransportJob(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [, setMapReady] = useState(false);
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const insets = useSafeAreaInsets();

  // ── Bottom sheet ──
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [320 + insets.bottom, 520, '92%'], [insets.bottom]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const handleSheetChange = useCallback((index: number) => {
    setSheetIndex(index);
    haptics.selection();
  }, []);

  const [cancelling, setCancelling] = useState(false);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  // Driver rating state
  const [driverRating, setDriverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Live updates via WebSocket
  const { jobLocation: liveLocation, jobStatus: liveJobStatus } = useLiveUpdates({
    jobId: typeof id === 'string' ? id : null,
    token,
  });

  useEffect(() => {
    if (!liveLocation) return;
    const { lat, lng } = liveLocation;
    setDriverLocationOnMap({ lat, lng });
    if (liveLocation.estimatedArrivalMin != null) setEtaMin(liveLocation.estimatedArrivalMin);
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: 13,
      animationDuration: 800,
    });
  }, [liveLocation]);

  useEffect(() => {
    if (liveJobStatus) loadJob();
  }, [liveJobStatus, loadJob]);

  // Check whether this job was already rated
  useEffect(() => {
    if (job && token && job.status === 'DELIVERED' && !ratingSubmitted) {
      api.reviews
        .status({ transportJobId: job.id }, token)
        .then(({ reviewed }) => {
          if (reviewed) setRatingSubmitted(true);
        })
        .catch((err) => console.warn('Failed to load review status:', err));
    }
  }, [job?.id, job?.status, token, ratingSubmitted]);

  // ── Route hooks — must be before early returns (Rules of Hooks) ──────────
  const routeOrigin = useMemo(() => {
    if (driverLocationOnMap) return { lat: driverLocationOnMap.lat, lng: driverLocationOnMap.lng };
    if (job?.pickupLat != null && job?.pickupLng != null) {
      return { lat: job.pickupLat, lng: job.pickupLng };
    }
    return null;
  }, [driverLocationOnMap, job?.pickupLat, job?.pickupLng]);

  const routeDestination = useMemo(() => {
    if (job?.deliveryLat != null && job?.deliveryLng != null) {
      return { lat: job.deliveryLat, lng: job.deliveryLng };
    }
    return null;
  }, [job?.deliveryLat, job?.deliveryLng]);

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
    cameraRef.current.fitBounds(ne, sw, [80, 60, 260, 60], 600);
  }, [routeOrigin?.lat, routeOrigin?.lng, routeDestination?.lat, routeDestination?.lng]);

  const handleCancel = () => {
    if (!job || !token) return;
    haptics.heavy();
    Alert.alert('Atcelt pasūtījumu?', 'Šo darbību nevar atsaukt. Pasūtījums tiks atcelts.', [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.transportJobs.updateStatus(job.id, 'CANCELLED', token);
            haptics.success();
            loadJob();
          } catch (err) {
            haptics.error();
            toast.error(err instanceof Error ? err.message : 'Neizdevās atcelt pasūtījumu');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleRateDriver = async () => {
    if (!job || !token || driverRating === 0) return;
    haptics.medium();
    setRatingLoading(true);
    try {
      await api.transportJobs.rateDriver(
        job.id,
        { rating: driverRating, comment: ratingComment.trim() || undefined },
        token,
      );
      setRatingSubmitted(true);
      haptics.success();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt vērtējumu');
    } finally {
      setRatingLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Pasūtījums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Pasūtījums" />
        <EmptyState icon={<Package size={32} color="#9ca3af" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const isDisposal = job.jobType === 'WASTE_COLLECTION';
  const typeLabel = isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana';
  const driver = job.driver;
  const vehicle = job.vehicle;
  const canCancel = job.status === 'AVAILABLE';

  const currentStepIdx = JOB_STATUS_TO_STEP[job.status] ?? -1;
  const jobStatusLabel = JOB_STATUS_LABEL[job.status] ?? null;

  // Hero line shown at the top of the sheet
  const heroPrimary = (() => {
    if (job.status === 'DELIVERED') return 'Piegādāts';
    if (job.status === 'CANCELLED') return 'Atcelts';
    if (etaMin != null) return `${etaMin} min`;
    if (driver) return 'Ceļā';
    if (job.status === 'AVAILABLE') return 'Meklē pārvadātāju…';
    return typeLabel;
  })();

  const heroSubtitle =
    jobStatusLabel ??
    (job.status === 'DELIVERED'
      ? ratingSubmitted
        ? 'Paldies par vērtējumu!'
        : 'Lūdzu novērtējiet šoferi'
      : job.status === 'CANCELLED'
        ? 'Pasūtījums atcelts'
        : typeLabel);

  // Single contextual CTA surfaced in the peek view
  type Cta = {
    label: string;
    onPress: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
    variant: 'primary' | 'success' | 'danger';
  };

  const primaryCta: Cta | null = (() => {
    if (job.status === 'DELIVERED' || job.status === 'CANCELLED') {
      return {
        label: 'Pasūtīt vēlreiz',
        onPress: () => router.push({ pathname: isDisposal ? '/disposal' : '/transport' }),
        icon: <RotateCcw size={18} color="#fff" style={{ marginRight: 8 }} />,
        variant: 'primary',
      };
    }
    if (driver?.phone) {
      return {
        label: 'Zvanīt šoferim',
        onPress: () => Linking.openURL(`tel:${driver.phone}`).catch(() => null),
        icon: <Phone size={18} color="#fff" style={{ marginRight: 8 }} />,
        variant: 'primary',
      };
    }
    if (canCancel) {
      return {
        label: cancelling ? 'Atceļ…' : 'Atcelt pasūtījumu',
        onPress: handleCancel,
        icon: <XCircle size={18} color="#fff" style={{ marginRight: 8 }} />,
        disabled: cancelling,
        variant: 'danger',
      };
    }
    return null;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f5f7' }}>
      {/* ── Background Map ────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFillObject}>
        <BaseMap
          cameraRef={cameraRef}
          center={
            driverLocationOnMap
              ? [driverLocationOnMap.lng, driverLocationOnMap.lat]
              : job.deliveryLng != null && job.deliveryLat != null
                ? [job.deliveryLng, job.deliveryLat]
                : [24.1052, 56.9496]
          }
          zoom={13}
          style={{ flex: 1 }}
          rotateEnabled={false}
          pitchEnabled={false}
          mapPadding={{ top: 80, right: 40, bottom: 260, left: 40 }}
          onMapReady={() => setMapReady(true)}
        >
          {route?.coords && route.coords.length > 1 && (
            <RouteLayer id="job-route" coordinates={route.coords} color="#111827" width={4} />
          )}
          {job.pickupLat != null && job.pickupLng != null && Marker && (
            <Marker
              coordinate={{ latitude: job.pickupLat, longitude: job.pickupLng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinPickup}>
                <MapPin size={14} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
          {job.deliveryLat != null && job.deliveryLng != null && Marker && (
            <Marker
              coordinate={{ latitude: job.deliveryLat, longitude: job.deliveryLng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinDelivery}>
                {isDisposal ? (
                  <Recycle size={14} color="#fff" strokeWidth={2.5} />
                ) : (
                  <MapPin size={14} color="#fff" strokeWidth={2.5} />
                )}
              </View>
            </Marker>
          )}
          {driverLocationOnMap && Marker && (
            <Marker
              coordinate={{ latitude: driverLocationOnMap.lat, longitude: driverLocationOnMap.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.pinDriver}>
                <Truck size={13} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>
      </View>

      {/* ── Floating back button ──────────────────────────────── */}
      <View style={[styles.floatingHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.floatingBackBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom Sheet (peek / half / full) ─────────────────── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={insets.top}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: 48 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}
          <Text style={styles.heroEta}>{heroPrimary}</Text>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>

          {/* Progress dots */}
          {driver && job.status !== 'CANCELLED' && (
            <View style={styles.stepsRow}>
              {JOB_STEPS.map((s, i) => {
                const done = i <= currentStepIdx;
                return (
                  <View key={s.key} style={styles.stepItem}>
                    <View style={[styles.stepDot, done && styles.stepDotActive]} />
                    <Text
                      style={[styles.stepLabel, done && styles.stepLabelActive]}
                      numberOfLines={1}
                    >
                      {s.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Driver row OR waiting list */}
          {driver ? (
            <View style={styles.driverRowCompact}>
              {driver.avatar ? (
                <Image source={{ uri: driver.avatar }} style={styles.driverAvatarCompact} />
              ) : (
                <View style={styles.driverAvatarFallbackCompact}>
                  <Text style={styles.driverInitialCompact}>
                    {driver.firstName?.[0] ?? '?'}
                    {driver.lastName?.[0] ?? ''}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.driverNameCompact} numberOfLines={1}>
                  {driver.firstName} {driver.lastName}
                </Text>
                {vehicle && (
                  <View style={styles.driverPlatePill}>
                    <Text style={styles.driverPlatePillText}>{vehicle.licensePlate}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[jobId]',
                    params: {
                      jobId: job.id,
                      title: `${driver.firstName} ${driver.lastName}`,
                    },
                  })
                }
              >
                <MessageCircle size={18} color="#111827" />
              </TouchableOpacity>
              {driver.phone && (
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnPrimary]}
                  onPress={() => Linking.openURL(`tel:${driver.phone}`).catch(() => null)}
                >
                  <Phone size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.waitingRow}>
              <View style={styles.waitingItem}>
                <Package size={14} color="#6b7280" />
                <Text style={styles.waitingItemText}>
                  {CARGO_LABEL[job.cargoType] ?? job.cargoType}
                  {job.cargoWeight != null ? ` · ${(job.cargoWeight / 1000).toFixed(1)} t` : ''}
                </Text>
              </View>
              <View style={styles.waitingItem}>
                <MapPin size={14} color="#6b7280" />
                <Text style={styles.waitingItemText} numberOfLines={1}>
                  {job.pickupCity} → {job.deliveryCity}
                </Text>
              </View>
            </View>
          )}

          {/* Primary contextual CTA */}
          {primaryCta && (
            <TouchableOpacity
              style={[
                styles.primaryCta,
                primaryCta.variant === 'success' && styles.primaryCtaSuccess,
                primaryCta.variant === 'danger' && styles.primaryCtaDanger,
                primaryCta.disabled && { opacity: 0.6 },
              ]}
              onPress={() => {
                haptics.medium();
                primaryCta.onPress();
              }}
              disabled={primaryCta.disabled}
            >
              {primaryCta.icon}
              <Text style={styles.primaryCtaText}>{primaryCta.label}</Text>
            </TouchableOpacity>
          )}

          {/* Drag hint while collapsed */}
          {sheetIndex === 0 && (
            <Text style={styles.dragHint}>Velciet augšup, lai redzētu detaļas</Text>
          )}

          {/* ─── Expanded-only content ────────────────────────── */}
          <View style={styles.expandedDivider} />

          {/* Details list */}
          <View style={styles.detailsCard}>
            <DetailRow label="Iekraušanas pilsēta" value={job.pickupCity} />
            <DetailRow label="Iekraušanas adrese" value={job.pickupAddress} />
            <DetailRow label="Piegādes pilsēta" value={job.deliveryCity} />
            <DetailRow label="Piegādes adrese" value={job.deliveryAddress} />
            <DetailRow label="Krava" value={CARGO_LABEL[job.cargoType] ?? job.cargoType} />
            {job.cargoWeight != null && (
              <DetailRow label="Svars" value={`${(job.cargoWeight / 1000).toFixed(1)} t`} />
            )}
            {job.requiredVehicleType && (
              <DetailRow
                label="Transportlīdzeklis"
                value={VEHICLE_LABEL[job.requiredVehicleType] ?? job.requiredVehicleType}
              />
            )}
            <DetailRow label="Izbraukšana" value={formatDate(job.pickupDate)} />
            <DetailRow label="Piegāde" value={formatDate(job.deliveryDate)} />
            {job.distanceKm != null && (
              <DetailRow label="Attālums" value={`${job.distanceKm.toFixed(0)} km`} />
            )}
            <View style={styles.detailsTotalRow}>
              <Text style={styles.detailsTotalLabel}>Tarifs</Text>
              <Text style={styles.detailsTotalValue}>€{job.rate.toFixed(2)}</Text>
            </View>
          </View>

          {/* Job number card */}
          <View style={styles.trackingBlackCard}>
            <View>
              <Text style={styles.trackingBlackLabel}>Pasūtījuma numurs</Text>
              <Text style={styles.trackingBlackNumber}>{job.jobNumber}</Text>
            </View>
          </View>

          {/* Driver rating (after delivery) */}
          {job.status === 'DELIVERED' && driver && !ratingSubmitted && (
            <View style={styles.ratingCard}>
              <Text style={styles.ratingTitle}>Novērtēt šoferi</Text>
              <Text style={styles.ratingDriverName}>
                {driver.firstName} {driver.lastName}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => {
                      haptics.light();
                      setDriverRating(n);
                    }}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <Star
                      size={32}
                      color="#f59e0b"
                      fill={n <= driverRating ? '#f59e0b' : 'transparent'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.ratingInput}
                placeholder="Komentārs (nav obligāts)"
                placeholderTextColor="#9ca3af"
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
                maxLength={300}
              />
              <TouchableOpacity
                style={[
                  styles.ratingSubmitBtn,
                  (driverRating === 0 || ratingLoading) && { opacity: 0.4 },
                ]}
                onPress={handleRateDriver}
                disabled={driverRating === 0 || ratingLoading}
                activeOpacity={0.85}
              >
                {ratingLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.ratingSubmitText}>Iesniegt vērtējumu</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Weighing slip */}
          {job.pickupPhotoUrl && (
            <View style={styles.slipCard}>
              <Text style={styles.slipTitle}>Svēršanas zīme</Text>
              <Image
                source={{ uri: job.pickupPhotoUrl }}
                style={styles.slipThumb}
                resizeMode="cover"
              />
              {job.actualWeightKg != null && (
                <View style={styles.detailsTotalRow}>
                  <Text style={styles.detailsTotalLabel}>Izmērītais svars</Text>
                  <Text style={[styles.detailsTotalValue, { color: colors.success }]}>
                    {(job.actualWeightKg / 1000).toFixed(3)} t
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Secondary actions — cancel still accessible when available */}
          {canCancel && primaryCta?.variant !== 'danger' && (
            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                styles.secondaryActionBtnDanger,
                { marginTop: 12 },
              ]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={styles.secondaryActionBtnDangerText}>
                {cancelling ? 'Atceļ…' : 'Atcelt pasūtījumu'}
              </Text>
            </TouchableOpacity>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// ── Local detail row ──
function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Map pins ──
  pinPickup: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  pinDelivery: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  pinDriver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  // ── Floating back button ──
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  floatingBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  // ── Bottom sheet chrome ──
  sheetBackground: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    backgroundColor: '#d1d5db',
    width: 44,
    height: 5,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // ── Hero ──
  heroEta: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },

  // ── Progress dots ──
  stepsRow: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 8,
    gap: 6,
  },
  stepItem: { flex: 1, alignItems: 'flex-start' },
  stepDot: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  stepLabelActive: { color: '#111827', fontWeight: '600' },

  // ── Driver row (compact) ──
  driverRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  driverAvatarCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
  },
  driverAvatarFallbackCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitialCompact: { fontSize: 15, fontWeight: '700', color: '#fff' },
  driverNameCompact: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  driverPlatePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  driverPlatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  iconBtnPrimary: { backgroundColor: '#111827' },

  // ── Waiting (no driver yet) ──
  waitingRow: { marginTop: 16, gap: 8 },
  waitingItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waitingItemText: { fontSize: 15, color: '#374151', fontWeight: '500' },

  // ── Primary CTA ──
  primaryCta: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 4,
  },
  primaryCtaSuccess: { backgroundColor: '#16a34a' },
  primaryCtaDanger: { backgroundColor: '#ef4444' },
  primaryCtaText: { fontSize: 16, color: '#fff', fontWeight: '600' },

  // ── Drag hint ──
  dragHint: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // ── Expanded content ──
  expandedDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginTop: 20,
    marginBottom: 4,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailRowLabel: { fontSize: 14, color: '#6b7280' },
  detailRowValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 16,
  },
  detailsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  detailsTotalLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  detailsTotalValue: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
  },

  // ── Black tracking card (job number) ──
  trackingBlackCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingBlackLabel: { color: '#9ca3af', fontSize: 11, marginBottom: 2, fontWeight: '500' },
  trackingBlackNumber: { color: '#fff', fontSize: 20, fontWeight: '800' },

  // ── Rating card ──
  ratingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  ratingTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  ratingDriverName: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  ratingSubmitBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Weighing slip ──
  slipCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  slipTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 10 },
  slipThumb: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },

  // ── Secondary actions ──
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryActionBtnDanger: { backgroundColor: '#fef2f2' },
  secondaryActionBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  secondaryActionBtnDangerText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
});
