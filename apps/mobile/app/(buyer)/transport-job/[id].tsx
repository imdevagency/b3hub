import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Phone,
  Package,
  Truck,
  MessageCircle,
  Recycle,
  Star,
  Clock3,
  Hash,
} from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { InfoSection } from '@/components/ui/InfoSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/button';
import { BaseMap, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { useTransportJob } from '@/lib/use-transport-job';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { CATEGORY_LABELS } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';

let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

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
  AVAILABLE: 'Meklē pārvadātāju',
  ACCEPTED: 'Šoferis pieņēma pasūtījumu',
  EN_ROUTE_PICKUP: 'Šoferis dodas uz kraušanu',
  AT_PICKUP: 'Šoferis ir pie kraušanas vietas',
  LOADED: 'Krava ir iekrauta',
  EN_ROUTE_DELIVERY: 'Šoferis dodas uz jums',
  AT_DELIVERY: 'Šoferis ir uz vietas',
  DELIVERED: 'Piegāde pabeigta',
  CANCELLED: 'Pasūtījums atcelts',
};

const JOB_STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  AVAILABLE: { label: 'Gaida', bg: '#EFF6FF', color: '#1D4ED8' },
  ACCEPTED: { label: 'Pieņemts', bg: '#ECFDF5', color: '#047857' },
  EN_ROUTE_PICKUP: { label: 'Uz kraušanu', bg: '#ECFDF5', color: '#047857' },
  AT_PICKUP: { label: 'Kraušana', bg: '#FEF3C7', color: '#B45309' },
  LOADED: { label: 'Iekrauts', bg: '#FEF3C7', color: '#B45309' },
  EN_ROUTE_DELIVERY: { label: 'Ceļā', bg: '#ECFDF5', color: '#047857' },
  AT_DELIVERY: { label: 'Uz vietas', bg: '#FEF3C7', color: '#B45309' },
  DELIVERED: { label: 'Piegādāts', bg: '#DCFCE7', color: '#15803D' },
  CANCELLED: { label: 'Atcelts', bg: '#FEF2F2', color: '#DC2626' },
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

function formatOptionalDate(date: string, window?: string | null) {
  const base = formatDate(date);
  return window ? `${base} · ${window}` : base;
}

export default function TransportJobDetailScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, loading, reload: loadJob } = useTransportJob(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [driverRating, setDriverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  const { jobLocation: liveLocation, jobStatus: liveJobStatus } = useLiveUpdates({
    jobId: typeof id === 'string' ? id : null,
    token,
  });

  useEffect(() => {
    if (!liveLocation) return;
    const { lat, lng } = liveLocation;
    if (liveLocation.estimatedArrivalMin != null) {
      setEtaMin(liveLocation.estimatedArrivalMin);
    }
    // Only re-centre the map if the driver moved more than ~30 m to avoid
    // constant jitter and to preserve the user's manual zoom/pan.
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

  useEffect(() => {
    if (liveJobStatus) loadJob();
  }, [liveJobStatus, loadJob]);

  useEffect(() => {
    if (job && token && job.status === 'DELIVERED' && !ratingSubmitted) {
      api.reviews
        .status({ transportJobId: job.id }, token)
        .then(({ reviewed }) => {
          if (reviewed) setRatingSubmitted(true);
        })
        .catch(() => null);
    }
  }, [job?.id, job?.status, token, ratingSubmitted]);

  const initialCenter = useMemo<[number, number]>(() => {
    if (job?.deliveryLng != null && job?.deliveryLat != null) {
      return [job.deliveryLng, job.deliveryLat];
    }
    return [24.1052, 56.9496];
  }, [job?.deliveryLat, job?.deliveryLng]);

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
    cameraRef.current.fitBounds(ne, sw, [48, 48, 48, 48], 600);
  }, [routeOrigin?.lat, routeOrigin?.lng, routeDestination?.lat, routeDestination?.lng]);

  const handleCancel = useCallback(() => {
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
  }, [job, loadJob, toast, token]);

  const handleRateDriver = useCallback(async () => {
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
  }, [driverRating, job, ratingComment, toast, token]);

  if (loading) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pasūtījums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pasūtījums" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const isDisposal = job.jobType === 'WASTE_COLLECTION';
  const typeLabel = isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana';
  const driver = job.driver;
  const vehicle = job.vehicle;
  const canCancel = job.status === 'AVAILABLE';
  const currentStepIdx = JOB_STATUS_TO_STEP[job.status] ?? -1;
  const jobStatusLabel = JOB_STATUS_LABEL[job.status] ?? typeLabel;
  const statusPill = JOB_STATUS_PILL[job.status] ?? JOB_STATUS_PILL.AVAILABLE;

  const heroPrimary = (() => {
    if (job.status === 'DELIVERED') return 'Piegādāts';
    if (job.status === 'CANCELLED') return 'Atcelts';
    if (etaMin != null) return `${etaMin} min`;
    if (driver) return 'Ceļā';
    if (job.status === 'AVAILABLE') return 'Meklē pārvadātāju';
    return typeLabel;
  })();

  const heroSubtitle =
    job.status === 'DELIVERED'
      ? ratingSubmitted
        ? 'Paldies par vērtējumu'
        : 'Lūdzu novērtējiet šoferi'
      : job.status === 'CANCELLED'
        ? 'Pasūtījums atcelts'
        : jobStatusLabel;

  const routeRows = [
    { label: 'Iekraušanas pilsēta', value: job.pickupCity },
    { label: 'Iekraušanas adrese', value: job.pickupAddress },
    { label: 'Piegādes pilsēta', value: job.deliveryCity },
    { label: 'Piegādes adrese', value: job.deliveryAddress },
  ].filter((row) => row.value);

  const cargoRows = [
    { label: 'Darba tips', value: typeLabel },
    { label: 'Krava', value: CARGO_LABEL[job.cargoType] ?? job.cargoType },
    {
      label: 'Svars',
      value: job.cargoWeight != null ? `${(job.cargoWeight / 1000).toFixed(1)} t` : null,
    },
    {
      label: 'Transportlīdzeklis',
      value: job.requiredVehicleType
        ? (VEHICLE_LABEL[job.requiredVehicleType] ?? job.requiredVehicleType)
        : null,
    },
    { label: 'Attālums', value: job.distanceKm != null ? `${job.distanceKm.toFixed(0)} km` : null },
    { label: 'Tarifs', value: `€${job.rate.toFixed(2)}` },
  ].filter((row) => row.value);

  const timingRows = [
    { label: 'Izbraukšana', value: formatOptionalDate(job.pickupDate, job.pickupWindow) },
    { label: 'Piegāde', value: formatOptionalDate(job.deliveryDate, job.deliveryWindow) },
    { label: 'Pieņemts', value: job.acceptedAt ? formatDate(job.acceptedAt) : null },
    { label: 'Atjaunināts', value: job.statusUpdatedAt ? formatDate(job.statusUpdatedAt) : null },
  ].filter((row) => row.value);

  const contactRows = [
    {
      label: 'Šoferis',
      value: driver ? `${driver.firstName} ${driver.lastName}`.trim() : null,
    },
    { label: 'Šofera tālrunis', value: driver?.phone },
    { label: 'Numurzīme', value: vehicle?.licensePlate ?? null },
    { label: 'Objekta kontakts', value: job.order?.siteContactName ?? null },
    { label: 'Objekta tālrunis', value: job.order?.siteContactPhone ?? null },
    { label: 'Piegādātājs', value: job.order?.supplierName ?? null },
    { label: 'Piegādātāja tālrunis', value: job.order?.supplierPhone ?? null },
  ].filter((row) => row.value);

  const notes = job.order?.notes?.trim() ?? '';

  return (
    <ScreenContainer bg="#F4F5F7" standalone>
      <ScreenHeader title="Pasūtījums" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.mapCard}>
          <BaseMap
            cameraRef={cameraRef}
            center={initialCenter}
            zoom={13}
            style={styles.map}
            rotateEnabled={false}
            pitchEnabled={false}
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
                  <MapPin size={14} color="#FFFFFF" strokeWidth={2.5} />
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
                    <Recycle size={14} color="#FFFFFF" strokeWidth={2.5} />
                  ) : (
                    <MapPin size={14} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                </View>
              </Marker>
            )}
            {driverLocationOnMap && Marker && (
              <Marker
                coordinate={{
                  latitude: driverLocationOnMap.lat,
                  longitude: driverLocationOnMap.lng,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.pinDriver}>
                  <Truck size={13} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </Marker>
            )}
          </BaseMap>

          <View style={styles.mapOverlay}>
            <Text style={styles.heroEta}>{heroPrimary}</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
            <View style={styles.mapMetaRow}>
              <View style={styles.mapMetaItem}>
                <MapPin size={13} color="#E5E7EB" />
                <Text style={styles.mapMetaText} numberOfLines={1}>
                  {job.pickupCity} → {job.deliveryCity}
                </Text>
              </View>
              <View style={styles.mapMetaItem}>
                <Hash size={13} color="#E5E7EB" />
                <Text style={styles.mapMetaText} numberOfLines={1}>
                  {job.jobNumber}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <InfoSection
          icon={<Truck size={16} color={colors.textMuted} />}
          title="Statuss"
          right={
            <StatusPill label={statusPill.label} bg={statusPill.bg} color={statusPill.color} />
          }
        >
          {driver && job.status !== 'CANCELLED' && (
            <View style={styles.stepsRow}>
              {JOB_STEPS.map((step, index) => {
                const done = index <= currentStepIdx;
                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View style={[styles.stepDot, done && styles.stepDotActive]} />
                    <Text
                      style={[styles.stepLabel, done && styles.stepLabelActive]}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {driver ? (
            <View style={styles.driverCard}>
              {driver.avatar ? (
                <Image source={{ uri: driver.avatar }} style={styles.driverAvatar} />
              ) : (
                <View style={styles.driverAvatarFallback}>
                  <Text style={styles.driverAvatarText}>
                    {driver.firstName?.[0] ?? '?'}
                    {driver.lastName?.[0] ?? ''}
                  </Text>
                </View>
              )}
              <View style={styles.driverMeta}>
                <Text style={styles.driverName} numberOfLines={1}>
                  {driver.firstName} {driver.lastName}
                </Text>
                <Text style={styles.driverSubline} numberOfLines={1}>
                  {vehicle?.licensePlate ?? 'Transportlīdzeklis nav norādīts'}
                </Text>
                {etaMin != null && (
                  <View style={styles.etaPill}>
                    <Clock3 size={13} color={colors.primary} />
                    <Text style={styles.etaPillText}>{etaMin} min</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.waitingCard}>
              <Text style={styles.waitingTitle}>Notiek pārvadātāja meklēšana</Text>
              <Text style={styles.waitingText}>
                Kad šoferis pieņems darbu, šeit redzēsiet ETA, kontaktus un transportlīdzekli.
              </Text>
            </View>
          )}
        </InfoSection>

        <View style={styles.actionsBlock}>
          {driver?.phone && (
            <Button
              size="lg"
              onPress={() => {
                haptics.medium();
                Linking.openURL(`tel:${driver.phone}`).catch(() => null);
              }}
            >
              Zvanīt šoferim
            </Button>
          )}

          {driver && (
            <Button
              variant="outline"
              size="lg"
              onPress={() => {
                haptics.medium();
                router.push({
                  pathname: '/chat/[jobId]',
                  params: {
                    jobId: job.id,
                    title: `${driver.firstName} ${driver.lastName}`,
                  },
                });
              }}
            >
              Rakstīt šoferim
            </Button>
          )}

          {(job.status === 'DELIVERED' || job.status === 'CANCELLED') && (
            <Button
              size="lg"
              onPress={() => {
                haptics.medium();
                router.push({ pathname: isDisposal ? '/disposal' : '/transport' });
              }}
            >
              Pasūtīt vēlreiz
            </Button>
          )}

          {canCancel && (
            <Button variant="destructive" size="lg" onPress={handleCancel} isLoading={cancelling}>
              Atcelt pasūtījumu
            </Button>
          )}
        </View>

        <InfoSection icon={<MapPin size={16} color={colors.textMuted} />} title="Maršruts">
          {routeRows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              last={index === routeRows.length - 1}
            />
          ))}
        </InfoSection>

        <InfoSection icon={<Package size={16} color={colors.textMuted} />} title="Krava un tarifs">
          {cargoRows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              last={index === cargoRows.length - 1}
            />
          ))}
        </InfoSection>

        <InfoSection icon={<Clock3 size={16} color={colors.textMuted} />} title="Laiki">
          {timingRows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              last={index === timingRows.length - 1}
            />
          ))}
        </InfoSection>

        <InfoSection icon={<Phone size={16} color={colors.textMuted} />} title="Kontakti">
          {contactRows.length > 0 ? (
            contactRows.map((row, index) => (
              <DetailRow
                key={row.label}
                label={row.label}
                value={row.value}
                last={index === contactRows.length - 1}
              />
            ))
          ) : (
            <Text style={styles.emptySectionText}>Kontaktu informācija vēl nav pieejama.</Text>
          )}
        </InfoSection>

        {(notes.length > 0 || job.order?.sitePhotoUrl) && (
          <InfoSection icon={<MessageCircle size={16} color={colors.textMuted} />} title="Piezīmes">
            {notes.length > 0 && <Text style={styles.notesText}>{notes}</Text>}
            {job.order?.sitePhotoUrl && (
              <Image
                source={{ uri: job.order.sitePhotoUrl }}
                style={styles.sitePhoto}
                resizeMode="cover"
              />
            )}
          </InfoSection>
        )}

        {job.status === 'DELIVERED' && driver && !ratingSubmitted && (
          <InfoSection icon={<Star size={16} color={colors.textMuted} />} title="Novērtējums">
            <Text style={styles.ratingTitle}>Novērtējiet šoferi</Text>
            <Text style={styles.ratingDriverName}>
              {driver.firstName} {driver.lastName}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    haptics.light();
                    setDriverRating(value);
                  }}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Star
                    size={32}
                    color="#F59E0B"
                    fill={value <= driverRating ? '#F59E0B' : 'transparent'}
                    strokeWidth={1.5}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.ratingInput}
              placeholder="Komentārs (nav obligāts)"
              placeholderTextColor="#9CA3AF"
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              maxLength={300}
            />
            <Button
              size="lg"
              onPress={() => {
                void handleRateDriver();
              }}
              disabled={driverRating === 0 || ratingLoading}
              isLoading={ratingLoading}
            >
              Iesniegt vērtējumu
            </Button>
          </InfoSection>
        )}

        {job.pickupPhotoUrl && (
          <InfoSection
            icon={<Recycle size={16} color={colors.textMuted} />}
            title="Svēršanas zīme"
            right={
              job.actualWeightKg != null ? (
                <Text style={styles.weightText}>{(job.actualWeightKg / 1000).toFixed(3)} t</Text>
              ) : undefined
            }
          >
            <Image
              source={{ uri: job.pickupPhotoUrl }}
              style={styles.slipThumb}
              resizeMode="cover"
            />
          </InfoSection>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  mapCard: {
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#DDE3EA',
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.88)',
  },
  heroEta: {
    fontSize: 30,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#E5E7EB',
    marginTop: 4,
  },
  mapMetaRow: {
    marginTop: 12,
    gap: 8,
  },
  mapMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapMetaText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#F9FAFB',
  },
  pinPickup: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  pinDelivery: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  pinDriver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  stepItem: {
    flex: 1,
  },
  stepDot: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#111827',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  driverAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  driverAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  driverMeta: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  driverSubline: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  etaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  etaPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.primary,
  },
  waitingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 14,
  },
  waitingTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  waitingText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 6,
  },
  actionsBlock: {
    gap: 10,
    marginBottom: 12,
  },
  emptySectionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#374151',
  },
  sitePhoto: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: '#E5E7EB',
  },
  ratingTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  ratingDriverName: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#111827',
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  weightText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.success,
  },
  slipThumb: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
});
