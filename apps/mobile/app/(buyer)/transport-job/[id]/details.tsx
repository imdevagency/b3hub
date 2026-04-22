import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Linking,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Package,
  Truck,
  Phone,
  Star,
  Clock3,
  FileText,
  Recycle,
  Hash,
  MessageCircle,
} from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { InfoSection } from '@/components/ui/InfoSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { StatusPill } from '@/components/ui/StatusPill';
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

export default function TransportJobDetailsScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, loading, reload: loadJob } = useTransportJob(id);
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
    if (liveJobStatus) loadJob();
  }, [liveJobStatus, loadJob]);

  useEffect(() => {
    if (liveLocation?.estimatedArrivalMin != null) {
      setEtaMin(liveLocation.estimatedArrivalMin);
    }
  }, [liveLocation]);

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
        <ScreenHeader title="Detaļas" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Detaļas" />
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
  const statusPill = JOB_STATUS_PILL[job.status] ?? JOB_STATUS_PILL.AVAILABLE;

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
    { label: 'Pasūtījuma ID', value: job.order?.id ?? null },
    { label: 'Sistēmas ID', value: job.id },
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
      <ScreenHeader title="Detaļas" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <InfoSection
          icon={<Truck size={16} color={colors.textMuted} />}
          title="Statuss"
          right={
            <StatusPill label={statusPill.label} bg={statusPill.bg} color={statusPill.color} />
          }
        >
          {driver && (
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
                {vehicle?.licensePlate && (
                  <Text style={styles.driverSubline}>{vehicle.licensePlate}</Text>
                )}
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
              <Text style={styles.waitingTitle}>Meklē šoferi</Text>
              <Text style={styles.waitingText}>
                Pasūtījums ir publicēts. Kad šoferis pieņems braucienu, šeit parādīsies informācija.
              </Text>
            </View>
          )}
        </InfoSection>

        <View style={styles.actionsBlock}>
          {driver?.phone && (
            <Button
              size="lg"
              variant="outline"
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
              size="lg"
              variant="outline"
              onPress={() => {
                haptics.medium();
                router.push({
                  pathname: '/chat/[jobId]',
                  params: { jobId: job.id, title: `${driver.firstName} ${driver.lastName}` },
                });
              }}
            >
              Rakstīt šoferim
            </Button>
          )}

          {(job.status === 'DELIVERED' || job.status === 'CANCELLED') && (
            <Button
              variant="outline"
              size="lg"
              onPress={() => {
                haptics.medium();
                router.push('/transport' as any);
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

        <InfoSection icon={<Package size={16} color={colors.textMuted} />} title="Krava">
          {cargoRows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              last={index === cargoRows.length - 1}
            />
          ))}
        </InfoSection>

        <InfoSection icon={<Clock3 size={16} color={colors.textMuted} />} title="Laiks">
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

        {notes.length > 0 && (
          <InfoSection icon={<FileText size={16} color={colors.textMuted} />} title="Piezīmes">
            <Text style={styles.notesText}>{notes}</Text>
          </InfoSection>
        )}

        {job.order?.sitePhotoUrl && (
          <InfoSection icon={<MapPin size={16} color={colors.textMuted} />} title="Objekta foto">
            <Image
              source={{ uri: job.order.sitePhotoUrl }}
              style={styles.siteImage}
              resizeMode="cover"
            />
          </InfoSection>
        )}

        {job.pickupPhotoUrl && (
          <InfoSection
            icon={
              isDisposal ? (
                <Recycle size={16} color={colors.textMuted} />
              ) : (
                <Package size={16} color={colors.textMuted} />
              )
            }
            title={isDisposal ? 'Kraušanas foto' : 'Svēršanas slip'}
          >
            <Image
              source={{ uri: job.pickupPhotoUrl }}
              style={styles.siteImage}
              resizeMode="cover"
            />
            {job.actualWeightKg != null && (
              <View style={styles.weightBadge}>
                <Hash size={14} color="#374151" />
                <Text style={styles.weightText}>{(job.actualWeightKg / 1000).toFixed(2)} t</Text>
              </View>
            )}
          </InfoSection>
        )}

        {job.status === 'DELIVERED' && !ratingSubmitted && (
          <InfoSection icon={<Star size={16} color={colors.textMuted} />} title="Novērtēt šoferi">
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    haptics.light();
                    setDriverRating(star);
                  }}
                  activeOpacity={0.7}
                >
                  <Star
                    size={28}
                    color={star <= driverRating ? '#F59E0B' : '#E5E7EB'}
                    fill={star <= driverRating ? '#F59E0B' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.ratingInput}
              placeholder="Komentārs (nav obligāts)..."
              placeholderTextColor="#9CA3AF"
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              numberOfLines={3}
              maxLength={500}
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

        {ratingSubmitted && job.status === 'DELIVERED' && (
          <InfoSection icon={<Star size={16} color={colors.textMuted} />} title="Jūsu vērtējums">
            <View style={styles.ratingSubmittedRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={24}
                  color={star <= driverRating ? '#F59E0B' : '#E5E7EB'}
                  fill={star <= driverRating ? '#F59E0B' : 'transparent'}
                />
              ))}
            </View>
            <Text style={styles.ratingSubmittedText}>Paldies par vērtējumu!</Text>
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
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 6,
  },
  waitingText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
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
  siteImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  weightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  weightText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#374151',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  ratingInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#111827',
    height: 88,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  ratingSubmittedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ratingSubmittedText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#6B7280',
  },
});
