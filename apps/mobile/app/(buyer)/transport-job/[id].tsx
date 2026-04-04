import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  RefreshControl,
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
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { CATEGORY_LABELS } from '@/lib/materials';
import { useTransportJob, ACTIVE_STATUSES } from '@/lib/use-transport-job';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDate, formatDateTime } from '@/lib/format';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { TJB_STATUS } from '@/lib/materials';
import { BaseMap, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
let Marker: any = null;
try {
  Marker = require('react-native-maps').Marker;
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

function StatusStepper({ status }: { status: string }) {
  const activeIdx = STATUS_ORDER.indexOf(status);
  const visibleSteps = STATUS_STEPS;

  return (
    <View style={s.stepper}>
      {visibleSteps.map((step, i) => {
        const stepIdx = STATUS_ORDER.indexOf(step.key);
        const done = stepIdx < activeIdx;
        const active = stepIdx <= activeIdx;
        return (
          <View key={step.key} style={s.stepRow}>
            <View style={s.stepLeft}>
              <View style={[s.stepDot, active ? s.stepDotActive : s.stepDotInactive]}>
                {done ? (
                  <Text style={s.stepCheck}>✓</Text>
                ) : (
                  <Text style={[s.stepNum, active ? s.stepNumActive : s.stepNumInactive]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < visibleSteps.length - 1 && (
                <View style={[s.stepLine, done ? s.stepLineActive : s.stepLineInactive]} />
              )}
            </View>
            <View style={s.stepContent}>
              <Text style={[s.stepLabel, active ? s.stepLabelActive : s.stepLabelInactive]}>
                {step.label}
              </Text>
              {active && <Text style={s.stepHint}>{step.hint}</Text>}
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
      <View style={s.infoIcon}>
        <Icon size={14} color="#6b7280" strokeWidth={2} />
      </View>
      <View style={s.infoText}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────

export default function TransportJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  // Live driver GPS + job status via WebSocket — replaces the 10 s polling loop
  const { jobLocation: liveLocation, jobStatus: liveJobStatus } = useLiveUpdates({
    jobId: typeof id === 'string' ? id : null,
    token,
  });

  // Apply live GPS updates reactively
  React.useEffect(() => {
    if (liveLocation) {
      setDriverLocation({ lat: liveLocation.lat, lng: liveLocation.lng });
      if (liveLocation.estimatedArrivalMin != null) setEtaMin(liveLocation.estimatedArrivalMin);
    }
  }, [liveLocation]);

  // When the server pushes a job status change, reload to get full updated job object
  React.useEffect(() => {
    if (liveJobStatus) loadJob();
  }, [liveJobStatus]);

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

  return (
    <ScreenContainer topInset={0} bg="#f9fafb">
      {/* ── MAP SECTION ── */}
      <View style={{ height: MAP_H, backgroundColor: '#e5e7eb' }}>
        <BaseMap
          cameraRef={cameraRef}
          center={pickup ? [pickup.lng, pickup.lat] : [24.1052, 56.9496]}
          zoom={12}
          style={{ flex: 1 }}
          rotateEnabled={false}
          pitchEnabled={false}
          // @ts-ignore onMapReady not in props type but works
          onMapReady={() => setMapReady(true)}
        >
          {route && (
            <RouteLayer id="job-route" coordinates={route.coords} color="#111827" width={4} />
          )}
          {pickup && (
            <Marker
              coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={s.pinPickup}>
                <MapPin size={16} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
          {delivery && (
            <Marker
              coordinate={{ latitude: delivery.lat, longitude: delivery.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={s.pinDelivery}>
                <Navigation size={14} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
          {/* Live driver marker */}
          {driverLocation && (
            <Marker
              coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={s.pinDriver}>
                <Truck size={13} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>

        {/* Floating back button */}
        <TouchableOpacity
          style={[s.mapBackBtn, { top: insets.top + 12 }]}
          onPress={() => {
            haptics.light();
            router.back();
          }}
          activeOpacity={0.8}
          hitSlop={12}
        >
          <ArrowLeft size={20} color="#111827" strokeWidth={2} />
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
          <View style={s.driverBadge}>
            <View style={s.driverLiveDot} />
            <Text style={s.driverBadgeText}>
              {etaMin != null
                ? `Pienāks ~${etaMin} min`
                : `Šoferis ~${haversineKm(driverLocation.lat, driverLocation.lng, delivery.lat, delivery.lng).toFixed(0)} km`}
            </Text>
          </View>
        )}
      </View>

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
          {/* Job number + type header */}
          <View style={s.jobHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.jobNumber}>{job.jobNumber}</Text>
              <Text style={s.jobType}>{typeLabel}</Text>
            </View>
            {st && <StatusPill label={st.label} bg={st.bg} color={st.color} />}
          </View>

          {/* Progress stepper */}
          {job.status !== 'CANCELLED' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Pasūtījuma statuss</Text>
              <StatusStepper status={job.status} />
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

          {/* Driver card */}
          {job.driver && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Pārvadātājs</Text>
              <View style={s.driverRow}>
                <View style={s.driverAvatar}>
                  <User size={20} color="#374151" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.driverName}>
                    {job.driver.firstName} {job.driver.lastName}
                  </Text>
                  {job.vehicle && (
                    <Text style={s.driverSub}>
                      {job.vehicle.vehicleType} · {job.vehicle.licensePlate}
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
                    <Phone size={14} color="#fff" strokeWidth={2} />
                    <Text style={s.callBtnText}>Zvanīt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Site contact card */}
          {(job.order?.siteContactName || job.order?.siteContactPhone) && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Kontaktpersona</Text>
              <View style={s.driverRow}>
                <View style={s.driverAvatar}>
                  <User size={20} color="#374151" />
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
                      Linking.openURL(`tel:${job.order!.siteContactPhone}`);
                    }}
                    activeOpacity={0.8}
                  >
                    <Phone size={14} color="#fff" strokeWidth={2} />
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

          {canCancel && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.85}
            >
              <XCircle size={16} color="#b91c1c" />
              <Text style={s.cancelBtnText}>{cancelling ? 'Atceļ...' : 'Atcelt pasūtījumu'}</Text>
            </TouchableOpacity>
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
              <RotateCcw size={16} color="#fff" />
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
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
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
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
    backgroundColor: '#111827',
  },
  distBadge: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  distText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // Live driver badge
  driverBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  driverLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#111827',
  },
  driverBadgeText: { fontSize: 13, fontWeight: '600', color: '#111827' },

  // Map markers
  pinPickup: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinDelivery: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinDriver: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#111827',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  // Content
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },

  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  jobNumber: { fontSize: 18, fontWeight: '700', color: '#111827' },
  jobType: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  backLink: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backLinkText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    gap: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Stepper
  stepper: { gap: 0 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepLeft: { alignItems: 'center', width: 28 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#111827' },
  stepDotInactive: { backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#e5e7eb' },
  stepLine: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  stepLineActive: { backgroundColor: '#111827' },
  stepLineInactive: { backgroundColor: '#e5e7eb' },
  stepContent: { flex: 1, paddingBottom: 16 },
  stepLabel: { fontSize: 14, fontWeight: '600' },
  stepLabelActive: { color: '#111827' },
  stepLabelInactive: { color: '#9ca3af' },
  stepHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  stepCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepNumActive: { color: '#fff' },
  stepNumInactive: { color: '#9ca3af' },

  // ── Route
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
    marginTop: 4,
  },
  routeDotDest: { backgroundColor: '#dc2626' },
  routeInfo: { flex: 1 },
  routePlace: { fontSize: 15, fontWeight: '700', color: '#111827' },
  routeAddr: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  routeDistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  routeLine: { width: 2, height: 20, backgroundColor: '#e5e7eb' },
  routeDist: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },

  // ── Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 1 },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },

  // ── Driver
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  driverSub: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // ── Pricing
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceValue: { fontSize: 15, fontWeight: '700', color: '#111827' },

  // ── Cancel
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff7f7',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#b91c1c' },
  reorderBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
  },
  reorderBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
