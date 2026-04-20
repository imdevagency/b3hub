import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Truck,
  Recycle,
  Phone,
  User,
  Package,
  Clock,
  XCircle,
  Navigation,
  RotateCcw,
  Leaf,
  FileText,
  Star,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { CATEGORY_LABELS } from '@/lib/materials';
import { useTransportJob, ACTIVE_STATUSES } from '@/lib/use-transport-job';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDate, formatDateTime } from '@/lib/format';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { TJB_STATUS } from '@/lib/materials';
import { BaseMap, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
import { colors } from '@/lib/theme';
let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

// ── Constants ──────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: 'AVAILABLE', label: 'Iesniegts', hint: 'Meklē pārvadātāju' },
  { key: 'ACCEPTED', label: 'Apstiprināts', hint: 'Pārvadātājs apstiprināts' },
  { key: 'EN_ROUTE_PICKUP', label: 'Ceļā', hint: 'Pārvadātājs dodas uz jums' },
  { key: 'DELIVERED', label: 'Piegādāts', hint: 'Piegāde pabeigta' },
];

const STATUS_ORDER = [
  'AVAILABLE',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
];

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

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_H = Math.round(SCREEN_H * 0.38);

/** Haversine great-circle distance in km between two lat/lng points. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Stepper ────────────────────────────────────────────────────

function StatusStepper({
  status,
  timestamps,
  createdAt,
}: {
  status: string;
  timestamps?: Record<string, string> | null;
  createdAt?: string | null;
}) {
  const activeIdx = STATUS_ORDER.indexOf(status);
  const visibleSteps = STATUS_STEPS;

  const fmtTs = (iso: string | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    const date = d.toLocaleDateString('lv-LV', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' });
    return `${date}  ${time}`;
  };

  // Map each visible step key to its timestamp
  const getTs = (key: string): string | null => {
    if (key === 'AVAILABLE') return fmtTs(createdAt ?? undefined);
    return fmtTs(timestamps?.[key]);
  };

  return (
    <View style={s.stepper}>
      {visibleSteps.map((step, i) => {
        const stepIdx = STATUS_ORDER.indexOf(step.key);
        const done = stepIdx < activeIdx;
        const active = stepIdx <= activeIdx;
        const ts = active ? getTs(step.key) : null;
        return (
          <View key={step.key} style={s.stepRow}>
            <View style={s.stepLeft}>
              <View style={[s.stepDot, active ? s.stepDotActive : s.stepDotInactive]}></View>
              {i < visibleSteps.length - 1 && (
                <View style={[s.stepLine, done ? s.stepLineActive : s.stepLineInactive]} />
              )}
            </View>
            <View style={s.stepContent}>
              <Text style={[s.stepLabel, active ? s.stepLabelActive : s.stepLabelInactive]}>
                {step.label}
              </Text>
              {ts ? (
                <Text style={s.stepTimestamp}>{ts}</Text>
              ) : active ? (
                <Text style={s.stepHint}>{step.hint}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Info Row ───────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
    style?: object;
  }>;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <View style={s.infoLabelRow}>
        <Icon size={16} color={colors.textDisabled} strokeWidth={2} />
        <Text style={s.infoLabel}>{label}</Text>
      </View>
      <Text style={[s.infoValue, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────

export default function TransportJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const cameraRef = useRef<CameraRefHandle | null>(null);

  const { job, loading, reload: loadJob } = useTransportJob(id);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJob();
    setRefreshing(false);
  }, [loadJob]);
  const [cancelling, setCancelling] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Check on load whether this job was already rated (survives re-entry)
  useEffect(() => {
    if (job && token && job.status === 'DELIVERED' && !ratingSubmitted) {
      api.reviews
        .status({ transportJobId: job.id }, token)
        .then(({ reviewed }) => {
          if (reviewed) setRatingSubmitted(true);
        })
        .catch((err) => console.warn('Failed to load review status:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, token]);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  // Live driver GPS + job status via WebSocket — replaces the 10 s polling loop
  const { jobLocation: liveLocation, jobStatus: liveJobStatus } = useLiveUpdates({
    jobId: typeof id === 'string' ? id : null,
    token,
  });

  // Apply live GPS updates reactively
  React.useEffect(() => {
    if (!liveLocation) return;
    const { lat, lng } = liveLocation;

    setDriverLocation({ lat, lng });
    if (liveLocation.estimatedArrivalMin != null) setEtaMin(liveLocation.estimatedArrivalMin);

    // Auto-pan camera to keep driver visible
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: 13,
      animationDuration: 800,
    });
  }, [liveLocation]);

  // When the server pushes a job status change, reload to get full updated job object
  React.useEffect(() => {
    if (liveJobStatus) loadJob();
  }, [liveJobStatus, loadJob]);

  // Route between pickup and delivery
  const pickup =
    job?.pickupLat && job?.pickupLng ? { lat: job.pickupLat, lng: job.pickupLng } : null;
  const delivery =
    job?.deliveryLat && job?.deliveryLng ? { lat: job.deliveryLat, lng: job.deliveryLng } : null;
  const { route } = useRoute(pickup, delivery);

  // Fit map to show both pins once map + data are ready
  useEffect(() => {
    if (!mapReady || !pickup || !delivery) return;
    setTimeout(() => {
      cameraRef.current?.fitBounds(
        [Math.max(pickup.lng, delivery.lng), Math.max(pickup.lat, delivery.lat)],
        [Math.min(pickup.lng, delivery.lng), Math.min(pickup.lat, delivery.lat)],
        [80, 40, MAP_H * 0.15, 40],
        600,
      );
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, pickup?.lat, delivery?.lat]);

  const isDisposal = job?.jobType === 'WASTE_COLLECTION';
  const Icon = isDisposal ? Recycle : Truck;
  const typeLabel = isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana';
  const st = job ? (TJB_STATUS[job.status] ?? TJB_STATUS.AVAILABLE) : null;
  const canCancel = job?.status === 'AVAILABLE';

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

  const handleCancel = () => {
    if (!job || !token) return;
    haptics.medium();
    Alert.alert('Atcelt pasūtījumu?', 'Šo darbību nevar atsaukt. Pasūtījums tiks atcelts.', [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.transportJobs.updateStatus(job.id, 'CANCELLED', token);
            loadJob();
          } catch (err) {
            haptics.error();
            Alert.alert(
              'Kļūda',
              err instanceof Error ? err.message : 'Neizdevās atcelt pasūtījumu',
            );
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const isActive = job ? ACTIVE_STATUSES.has(job.status) : false;
  // Show map whenever we have coords — live for active jobs, static for completed
  const showMap = !!(pickup && delivery);

  return (
    <ScreenContainer bg={colors.white}>
      {showMap ? (
        <View>
          {/* ── MAP SECTION ── */}
          <View style={{ height: MAP_H, backgroundColor: colors.border }}>
            <BaseMap
              cameraRef={cameraRef}
              center={pickup ? [pickup.lng, pickup.lat] : [24.1052, 56.9496]}
              zoom={12}
              style={{ flex: 1 }}
              rotateEnabled={false}
              pitchEnabled={false}
              onMapReady={() => setMapReady(true)}
            >
              {route && (
                <RouteLayer
                  id="job-route"
                  coordinates={route.coords}
                  color={colors.primary}
                  width={4}
                />
              )}
              {pickup && (
                <Marker
                  coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={s.pinPickup}>
                    <MapPin size={16} color={colors.white} strokeWidth={2.5} />
                  </View>
                </Marker>
              )}
              {delivery && (
                <Marker
                  coordinate={{ latitude: delivery.lat, longitude: delivery.lng }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={s.pinDelivery}>
                    <Navigation size={14} color={colors.white} strokeWidth={2.5} />
                  </View>
                </Marker>
              )}
              {/* Live driver marker */}
              {driverLocation && Marker && (
                <Marker
                  coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={s.pinDriver}>
                    <Truck size={13} color={colors.white} strokeWidth={2.5} />
                  </View>
                </Marker>
              )}
            </BaseMap>

            {/* Floating back button */}
            <TouchableOpacity
              style={[s.mapBackBtn, { top: 12 }]}
              onPress={() => {
                haptics.light();
                router.back();
              }}
              activeOpacity={0.8}
              hitSlop={12}
            >
              <ArrowLeft size={20} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>

            {/* Floating status + type pill */}
            {!loading && job && st && (
              <View style={s.mapStatusPill}>
                <Icon size={13} color={st.color} strokeWidth={2} />
                <Text style={[s.mapStatusText, { color: st.color }]}>{st.label}</Text>
                {ACTIVE_STATUSES.has(job.status) && <View style={s.liveDot} />}
              </View>
            )}

            {/* Distance badge */}
            {route && (
              <View style={s.distBadge}>
                <Text style={s.distText}>
                  {route.distanceKm.toFixed(0)} km · {route.durationLabel}
                </Text>
              </View>
            )}
            {/* Live driver distance chip */}
            {driverLocation && delivery && (
              <View style={[s.driverBadge, { top: 12 }]}>
                <View style={s.driverLiveDot} />
                <Text style={s.driverBadgeText}>
                  {etaMin != null
                    ? `Pienāks ~${etaMin} min`
                    : `Šoferis ~${haversineKm(driverLocation.lat, driverLocation.lng, delivery.lat, delivery.lng).toFixed(0)} km`}
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <ScreenHeader title="" />
      )}

      {/* ── CONTENT SECTION ── */}
      {loading ? (
        <SkeletonDetail />
      ) : !job ? (
        <View style={s.center}>
          <Package size={48} color="#d1d5db" />
          <Text style={s.emptyTitle}>Pasūtījums nav atrasts</Text>
          <TouchableOpacity style={s.backLink} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={s.backLinkText}>Atpakaļ</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* ── ETA summary banner — shown when driver is live ── */}
          {driverLocation && job && (
            <View style={s.etaBanner}>
              <View style={s.etaBannerLeft}>
                <Text style={s.etaBannerOrderNo}>{job.jobNumber}</Text>
                <Text style={s.etaBannerSub}>
                  {job.pickupCity} → {job.deliveryCity}
                </Text>
              </View>
              <View style={s.etaBannerRight}>
                <Text style={s.etaBannerLabel}>Pienāks pēc</Text>
                <View style={s.etaBannerTimeRow}>
                  <Clock size={14} color={colors.primary} strokeWidth={2.5} />
                  <Text style={s.etaBannerTime}>
                    {etaMin != null
                      ? `~${etaMin} min`
                      : `~${haversineKm(driverLocation.lat, driverLocation.lng, delivery?.lat ?? 0, delivery?.lng ?? 0).toFixed(0)} km`}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Hero Header */}
          <View style={s.hero}>
            {st && (
              <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
                <StatusPill label={st.label} bg={st.bg} color={st.color} />
              </View>
            )}
            <Text style={s.heroTitle}>{job.jobNumber}</Text>
            <Text style={s.heroSub}>{typeLabel}</Text>
          </View>

          {/* Driver card */}
          {job.driver && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Pārvadātājs</Text>
              <View style={s.driverRow}>
                <View style={s.driverAvatar}>
                  <User size={20} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.driverName}>
                    {job.driver.firstName} {job.driver.lastName}
                  </Text>
                  {job.vehicle && (
                    <Text style={s.driverSub}>
                      {VEHICLE_LABEL[job.vehicle.vehicleType] ?? job.vehicle.vehicleType} ·{' '}
                      {job.vehicle.licensePlate}
                    </Text>
                  )}
                </View>
                {job.driver.phone && (
                  <TouchableOpacity
                    style={s.callBtn}
                    onPress={() => {
                      haptics.light();
                      Linking.openURL(`tel:${job.driver!.phone}`);
                    }}
                    activeOpacity={0.8}
                  >
                    <Phone size={14} color={colors.white} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Progress stepper */}
          {job.status !== 'CANCELLED' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Pasūtījuma statuss</Text>
              <StatusStepper
                status={job.status}
                timestamps={job.statusTimestamps}
                createdAt={job.createdAt}
              />
            </View>
          )}

          {/* Route card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Maršruts</Text>
            <View style={s.routeRow}>
              <View style={s.routeDot} />
              <View style={s.routeInfo}>
                <Text style={s.routePlace}>{job.pickupCity}</Text>
                <Text style={s.routeAddr} numberOfLines={2}>
                  {job.pickupAddress}
                </Text>
              </View>
            </View>
            {job.distanceKm != null && (
              <View style={s.routeDistRow}>
                <View style={s.routeLine} />
                <Text style={s.routeDist}>{job.distanceKm.toFixed(0)} km</Text>
              </View>
            )}
            <View style={s.routeRow}>
              <View style={[s.routeDot, s.routeDotDest]} />
              <View style={s.routeInfo}>
                <Text style={s.routePlace}>{job.deliveryCity}</Text>
                <Text style={s.routeAddr} numberOfLines={2}>
                  {job.deliveryAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Details card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Detaļas</Text>
            <InfoRow
              icon={Package}
              label="Krava"
              value={CARGO_LABEL[job.cargoType] ?? job.cargoType}
            />
            {job.cargoWeight != null && (
              <InfoRow
                icon={Package}
                label="Svars"
                value={`${(job.cargoWeight / 1000).toFixed(1)} t`}
              />
            )}
            {job.cargoWeight != null && job.distanceKm != null && (
              <InfoRow
                icon={Leaf}
                label="CO\u2082 emisija"
                value={`~${((job.cargoWeight / 1000) * job.distanceKm * 0.09).toFixed(1)} kg`}
              />
            )}
            <InfoRow
              icon={Truck}
              label="Transportlīdzeklis"
              value={
                job.requiredVehicleType
                  ? (VEHICLE_LABEL[job.requiredVehicleType] ?? job.requiredVehicleType)
                  : undefined
              }
            />
            <InfoRow
              icon={CalendarDays}
              label="Izbraukšanas datums"
              value={formatDate(job.pickupDate)}
            />
            {job.pickupWindow && job.pickupWindow !== 'ANY' && (
              <InfoRow
                icon={Clock}
                label="Laika logs (iekraušana)"
                value={job.pickupWindow === 'AM' ? 'Rīts (8–12)' : 'Diena (12–17)'}
              />
            )}
            <InfoRow icon={Clock} label="Piegādes datums" value={formatDate(job.deliveryDate)} />
            {job.deliveryWindow && job.deliveryWindow !== 'ANY' && (
              <InfoRow
                icon={Clock}
                label="Laika logs (piegāde)"
                value={job.deliveryWindow === 'AM' ? 'Rīts (8–12)' : 'Diena (12–17)'}
              />
            )}
          </View>

          {/* Site contact card */}
          {(job.order?.siteContactName || job.order?.siteContactPhone) && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Kontaktpersona</Text>
              <View style={s.driverRow}>
                <View style={s.driverAvatar}>
                  <User size={20} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  {job.order.siteContactName && (
                    <Text style={s.driverName}>{job.order.siteContactName}</Text>
                  )}
                  {job.order.siteContactPhone && (
                    <Text style={s.driverSub}>{job.order.siteContactPhone}</Text>
                  )}
                </View>
                {job.order?.siteContactPhone && (
                  <TouchableOpacity
                    style={s.callBtn}
                    onPress={() => {
                      haptics.light();
                      Linking.openURL(`tel:${job.order?.siteContactPhone}`);
                    }}
                    activeOpacity={0.8}
                  >
                    <Phone size={14} color={colors.white} strokeWidth={2} />
                    <Text style={s.callBtnText}>Zvanīt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Pricing card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Cena</Text>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Tarifs</Text>
              <Text style={s.priceValue}>
                €{job.rate.toFixed(2)}
                {job.pricePerTonne != null ? ` (€${job.pricePerTonne.toFixed(2)}/t)` : ''}
              </Text>
            </View>
            {job.actualWeightKg != null && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Faktiskais svars</Text>
                <Text style={s.priceValue}>{(job.actualWeightKg / 1000).toFixed(2)} t</Text>
              </View>
            )}
          </View>

          {/* Weighing slip card — shown once driver marks job as LOADED */}
          {job.pickupPhotoUrl && (
            <View style={s.card}>
              <View style={s.slipHeader}>
                <FileText size={16} color={colors.textMuted} />
                <Text style={s.cardTitle}>Svēršanas zīme</Text>
              </View>
              <Image source={{ uri: job.pickupPhotoUrl }} style={s.slipThumb} resizeMode="cover" />
              {job.actualWeightKg != null && (
                <View style={s.priceRow}>
                  <Text style={s.priceLabel}>Izmērītais svars</Text>
                  <Text style={[s.priceValue, { color: colors.success }]}>
                    {(job.actualWeightKg / 1000).toFixed(3)} t
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={s.slipOpenBtn}
                onPress={() => {
                  haptics.light();
                  Linking.openURL(job.pickupPhotoUrl!);
                }}
                activeOpacity={0.8}
              >
                <Text style={s.slipOpenText}>Atvērt pilnā izmērā</Text>
              </TouchableOpacity>
            </View>
          )}

          {canCancel && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.85}
            >
              <XCircle size={16} color={colors.dangerText} />
              <Text style={s.cancelBtnText}>{cancelling ? 'Atceļ...' : 'Atcelt pasūtījumu'}</Text>
            </TouchableOpacity>
          )}

          {/* Driver rating card — shown after delivery while driver is known */}
          {job.status === 'DELIVERED' && job.driver && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Novērtēt šoferi</Text>
              {ratingSubmitted ? (
                <View style={s.ratingThanks}>
                  <Star size={20} color="#f59e0b" fill="#f59e0b" />
                  <Text style={s.ratingThanksText}>Paldies par vērtējumu!</Text>
                </View>
              ) : (
                <>
                  <Text style={s.ratingDriverName}>
                    {job.driver.firstName} {job.driver.lastName}
                  </Text>
                  <View style={s.starsRow}>
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
                    style={s.ratingInput}
                    placeholder="Komentārs (nav obligāts)"
                    placeholderTextColor={colors.textDisabled}
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    multiline
                    maxLength={300}
                  />
                  <TouchableOpacity
                    style={[
                      s.ratingSubmitBtn,
                      (driverRating === 0 || ratingLoading) && s.ratingSubmitDisabled,
                    ]}
                    onPress={handleRateDriver}
                    disabled={driverRating === 0 || ratingLoading}
                    activeOpacity={0.85}
                  >
                    {ratingLoading ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={s.ratingSubmitText}>Iesniegt vērtējumu</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {(job.status === 'DELIVERED' || job.status === 'CANCELLED') && (
            <TouchableOpacity
              style={s.reorderBtn}
              onPress={() => {
                haptics.medium();
                router.push({
                  pathname: isDisposal ? '/disposal' : '/transport',
                });
              }}
              activeOpacity={0.85}
            >
              <RotateCcw size={16} color={colors.white} />
              <Text style={s.reorderBtnText}>Pasūtīt vēlreiz</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Map overlays
  mapBackBtn: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapStatusPill: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapStatusText: { fontSize: 13, fontWeight: '600' },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.black,
  },
  distBadge: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    backgroundColor: colors.black,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  distText: { fontSize: 12, fontWeight: '600', color: colors.white },

  // Live driver badge
  driverBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  driverLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.black,
  },
  driverBadgeText: { fontSize: 13, fontWeight: '600', color: colors.black },

  // Map markers
  pinPickup: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinDelivery: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  pinDriver: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  scroll: { backgroundColor: colors.white },

  // ETA banner
  etaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  etaBannerLeft: { flex: 1, gap: 2 },
  etaBannerOrderNo: { fontSize: 15, fontWeight: '700', color: colors.primary },
  etaBannerSub: { fontSize: 12, color: colors.textMuted },
  etaBannerRight: { alignItems: 'flex-end', gap: 2 },
  etaBannerLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etaBannerTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  etaBannerTime: { fontSize: 18, fontWeight: '800', color: colors.primary },

  hero: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 24 },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSub: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  backLink: {
    backgroundColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backLinkText: { color: colors.white, fontWeight: '600', fontSize: 14 },

  card: {
    backgroundColor: colors.white,
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },

  // ── Stepper
  stepper: { gap: 0 },
  stepRow: { flexDirection: 'row', gap: 16 },
  stepLeft: { alignItems: 'center', width: 14 },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.black },
  stepDotInactive: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  stepLine: { width: 1.5, flex: 1, minHeight: 20, marginVertical: 4 },
  stepLineActive: { backgroundColor: colors.black },
  stepLineInactive: { backgroundColor: colors.border },
  stepContent: { flex: 1, paddingBottom: 24 },
  stepLabel: { fontSize: 15, fontWeight: '600' },
  stepLabelActive: { color: colors.textPrimary },
  stepLabelInactive: { color: colors.textDisabled },
  stepHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stepTimestamp: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as any,
  },
  stepCheck: { color: colors.white, fontSize: 12, fontWeight: '700' },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepNumActive: { color: colors.white },
  stepNumInactive: { color: colors.textDisabled },

  // ── Route
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.black,
    marginTop: 4,
  },
  routeDotDest: { backgroundColor: colors.danger, borderRadius: 0, width: 9, height: 9 },
  routeInfo: { flex: 1 },
  routePlace: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  routeAddr: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  routeDistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  routeLine: { width: 2, height: 24, backgroundColor: colors.border, marginLeft: 3.5 },
  routeDist: { fontSize: 12, color: colors.textDisabled, fontWeight: '500' },

  // ── Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },

  // ── Driver
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  driverSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  // ── Pricing
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceLabel: { fontSize: 14, color: colors.textMuted },
  priceValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  // ── Weighing slip
  slipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slipThumb: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.bgMuted,
  },
  slipOpenBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slipOpenText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // ── Cancel
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.danger,
    marginHorizontal: 24,
    marginTop: 8,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.dangerText },
  reorderBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.black,
    borderRadius: 8,
    paddingVertical: 14,
    marginHorizontal: 24,
  },
  reorderBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  // Driver rating
  ratingDriverName: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ratingInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  ratingSubmitBtn: {
    backgroundColor: colors.black,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSubmitDisabled: { opacity: 0.4 },
  ratingSubmitText: { fontSize: 15, fontWeight: '700', color: colors.white },
  ratingThanks: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  ratingThanksText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
