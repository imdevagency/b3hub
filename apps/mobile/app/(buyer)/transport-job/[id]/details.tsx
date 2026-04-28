import { PriceRow } from '@/components/ui/PriceRow';
import React, { useCallback, useEffect, useState } from 'react';
import Animated from 'react-native-reanimated';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Package,
  Phone,
  Star,
  Clock3,
  FileText,
  Recycle,
  Hash,
  MessageCircle,
  ChevronLeft,
} from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { InfoSection } from '@/components/ui/InfoSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { JobStatusBadge } from '@/components/ui/OrderStatusBadge';
import { JobRouteMap } from '@/components/ui/JobRouteMap';
import { Divider } from '@/components/ui/Divider';
import { Button } from '@/components/ui/button';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useTransportJob } from '@/lib/use-transport-job';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { CATEGORY_LABELS } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';
import { entering } from '@/lib/transitions';

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

export default function TransportJobDetailsScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, loading, reload: loadJob } = useTransportJob(id);
  const [cancelling, setCancelling] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingChecked, setRatingChecked] = useState(false);
  const [submittedRating, setSubmittedRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Don't subscribe to live updates for terminal jobs — no new events expected
  const isTerminalJob = job?.status === 'DELIVERED' || job?.status === 'CANCELLED';

  const { jobStatus: liveJobStatus } = useLiveUpdates({
    jobId: !isTerminalJob && typeof id === 'string' ? id : null,
    token,
  });

  useEffect(() => {
    if (liveJobStatus) loadJob();
  }, [liveJobStatus, loadJob]);

  useEffect(() => {
    if (job && token && job.status === 'DELIVERED' && !ratingChecked) {
      api.reviews
        .status({ transportJobId: job.id }, token)
        .then(({ reviewed }) => {
          if (reviewed) setRatingSubmitted(true);
        })
        .catch(() => null)
        .finally(() => setRatingChecked(true));
    } else if (job && job.status !== 'DELIVERED') {
      setRatingChecked(true);
    }
  }, [job?.id, job?.status, token, ratingChecked]);

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
            await api.transportJobs.buyerCancel(job.id, token);
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
      setSubmittedRating(driverRating);
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
      <ScreenContainer bg="#FFFFFF" standalone>
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#FFFFFF" standalone>
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const isDisposal = job.jobType === 'WASTE_COLLECTION';
  const typeLabel = isDisposal ? 'Atkritumu izvešana' : 'Kravas pārvadāšana';
  const driver = job.driver;
  const vehicle = job.vehicle;
  const canCancel = job.status === 'AVAILABLE';

  const hasMapData =
    job.pickupLat != null &&
    job.pickupLng != null &&
    job.deliveryLat != null &&
    job.deliveryLng != null;
  const pickupPin = hasMapData ? { lat: job.pickupLat!, lng: job.pickupLng! } : null;
  const deliveryPin = hasMapData ? { lat: job.deliveryLat!, lng: job.deliveryLng! } : null;

  const isJobClosed = job.status === 'DELIVERED' || job.status === 'CANCELLED';

  const routeRows = [
    { label: 'Iekraušanas pilsēta', value: job.pickupCity },
    { label: 'Iekraušanas adrese', value: job.pickupAddress },
    { label: 'Piegādes pilsēta', value: job.deliveryCity },
    { label: 'Piegādes adrese', value: job.deliveryAddress },
  ].filter((row) => row.value);

  const cargoRows = [
    { label: 'Referents', value: job.jobNumber ?? null },
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
      phone: null,
    },
    { label: 'Šofera tālrunis', value: driver?.phone, phone: driver?.phone },
    { label: 'Numurzīme', value: vehicle?.licensePlate ?? null, phone: null },
    { label: 'Objekta kontakts', value: job.order?.siteContactName ?? null, phone: null },
    {
      label: 'Objekta tālrunis',
      value: job.order?.siteContactPhone ?? null,
      phone: job.order?.siteContactPhone ?? null,
    },
    { label: 'Piegādātājs', value: job.order?.supplierName ?? null, phone: null },
    {
      label: 'Piegādātāja tālrunis',
      value: job.order?.supplierPhone ?? null,
      phone: job.order?.supplierPhone ?? null,
    },
  ].filter((row) => row.value);

  const notes = job.order?.notes?.trim() ?? '';

  return (
    <ScreenContainer bg="#FFFFFF" standalone topInset={0}>
      <View style={styles.headerSpacer} />
      <View style={styles.headerSection}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            haptics.light();
            router.back();
          }}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.titleText}>
              {driver ? `${driver.firstName} ${driver.lastName}` : 'Nav piešķirts šoferis'}
            </Text>
            <Text style={styles.dateText}>{formatDate(job.pickupDate || job.createdAt || '')}</Text>
          </View>
          <View style={styles.avatarCircle}>
            {driver ? (
              <Text style={styles.avatarText}>
                {driver.firstName[0]}
                {driver.lastName[0]}
              </Text>
            ) : (
              <Package size={20} color="#9CA3AF" />
            )}
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {hasMapData ? (
          <View style={styles.mapWrap}>
            <JobRouteMap
              pickup={pickupPin!}
              delivery={deliveryPin!}
              height={200}
              borderRadius={16}
            />
            {job.distanceKm != null && (
              <View style={styles.mapPill}>
                <Clock3 size={14} color="#111827" />
                <Text style={styles.mapPillText}>{`${job.distanceKm.toFixed(1)} km`}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noMapSpacer} />
        )}

        <View style={styles.cardSection}>
          <Text style={styles.sectionHeading}>Maršruts</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineTrack} />

            <View style={styles.timelineStop}>
              <View style={styles.dotBgGreen}>
                <View style={styles.dotCoreGreen} />
              </View>
              <View style={styles.stopContent}>
                <View style={styles.stopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopAddress}>{job.pickupAddress}</Text>
                    {job.pickupCity && <Text style={styles.stopCity}>{job.pickupCity}</Text>}
                  </View>
                  <Text style={styles.stopTime}>
                    {job.pickupWindow || formatDate(job.pickupDate)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.timelineStop, { marginTop: 24 }]}>
              <View style={styles.dropoffPin}>
                <MapPin size={16} color="#FFFFFF" fill="#3B82F6" strokeWidth={0} />
                <View style={styles.dropoffPinDot} />
              </View>
              <View style={styles.stopContent}>
                <View style={styles.stopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stopAddress}>{job.deliveryAddress}</Text>
                    {job.deliveryCity && <Text style={styles.stopCity}>{job.deliveryCity}</Text>}
                  </View>
                  <Text style={styles.stopTime}>
                    {job.deliveryWindow || formatDate(job.deliveryDate)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            {canCancel && (
              <TouchableOpacity
                style={styles.pillButton}
                onPress={handleCancel}
                disabled={cancelling}
              >
                <Text style={styles.pillText}>Atcelt darbu</Text>
              </TouchableOpacity>
            )}
            {driver?.phone && (
              <TouchableOpacity
                style={styles.pillButton}
                onPress={() => {
                  haptics.light();
                  Linking.openURL(`tel:${driver.phone}`).catch(console.error);
                }}
              >
                <Text style={styles.pillText}>Zvanīt šoferim</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.pillButton}
              onPress={() => {
                haptics.light();
                router.push('/(shared)/support-chat');
              }}
            >
              <Text style={styles.pillText}>Atbalsts</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 8, backgroundColor: '#F3F4F6' }} />

        <View style={styles.cardSection}>
          <Text style={styles.sectionHeading}>Papildu informācija</Text>
          <DetailRow label="Darba tips" value={typeLabel} />
          <DetailRow label="Krava" value={CARGO_LABEL[job.cargoType] ?? job.cargoType} />
          <DetailRow
            label="Svars"
            value={job.cargoWeight != null ? `${(job.cargoWeight / 1000).toFixed(1)} t` : null}
          />
          <DetailRow
            label="Transportlīdzeklis"
            value={
              job.requiredVehicleType
                ? (VEHICLE_LABEL[job.requiredVehicleType] ?? job.requiredVehicleType)
                : null
            }
            last
          />
        </View>

        <View style={{ height: 8, backgroundColor: '#F3F4F6' }} />

        <View style={styles.cardSection}>
          <Text style={styles.sectionHeading}>Maksājums</Text>
          <View style={styles.payRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payLabel}>Pārvadājuma maksa</Text>
              {job.distanceKm != null && (
                <Text style={styles.paySub}>{job.distanceKm.toFixed(1)} km</Text>
              )}
            </View>
            <Text style={styles.payAmount}>€{job.rate.toFixed(2)}</Text>
          </View>
          <View style={styles.payHairline} />
          <View style={styles.payRow}>
            <Text style={styles.payTotalLabel}>Kopā</Text>
            <Text style={styles.payTotalAmount}>€{job.rate.toFixed(2)}</Text>
          </View>
        </View>

        {isJobClosed && (
          <View style={[styles.cardSection, { paddingTop: 8 }]}>
            <TouchableOpacity
              style={styles.pillButton}
              onPress={() => {
                haptics.light();
                router.push('/(shared)/support-chat');
              }}
            >
              <Text style={styles.pillText}>Saņemt čeku</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerSpacer: {
    height: 48,
    backgroundColor: '#FFFFFF',
  },
  headerSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLeft: {
    flex: 1,
    paddingRight: 16,
  },
  titleText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#111827',
    marginBottom: 4,
  },
  dateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#6B7280',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#374151',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mapWrap: {
    marginHorizontal: 20,
    height: 200,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#111827',
  },
  noMapSpacer: {
    height: 16,
  },
  cardSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionHeading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#111827',
    marginBottom: 20,
  },
  timeline: {
    position: 'relative',
    marginLeft: 8,
    marginBottom: 24,
  },
  timelineTrack: {
    position: 'absolute',
    left: 7,
    top: 24,
    bottom: 24,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  timelineStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dotBgGreen: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dotCoreGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  dotBgBlue: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dotCoreBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  stopContent: {
    marginLeft: 16,
    flex: 1,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stopAddress: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
    marginBottom: 2,
  },
  stopCity: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#6B7280',
  },
  stopTime: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#6B7280',
  },
  dropoffPin: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dropoffPinDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  payLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  paySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  payAmount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  payHairline: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  payTotalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#111827',
  },
  payTotalAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#111827',
  },
  actionRow: {
    flexDirection: 'column',
    gap: 12,
  },
  pillButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#F3F4F6',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#111827',
  },
});
