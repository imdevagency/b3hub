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
    <ScreenContainer bg="#FFFFFF" standalone>
      <ScreenHeader title="Detaļas" noBorder />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        {pickupPin && deliveryPin && job.status !== 'CANCELLED' && (
          <JobRouteMap pickup={pickupPin} delivery={deliveryPin} height={260} borderRadius={0} />
        )}

        {/* ── Hero ── */}
        <Animated.View entering={entering.card(0)} style={styles.heroSection}>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {typeLabel}
          </Text>
          <View style={styles.heroMetaRow}>
            <JobStatusBadge status={job.status} size="md" />
            <Text style={styles.heroSubtitle}>
              {formatDate(job.pickupDate)}
              {job.order?.orderNumber ? ` · #${job.order.orderNumber}` : ''}
            </Text>
          </View>
        </Animated.View>

        <Divider color="#EBEBEB" marginV={0} />

        {/* ── Driver ── */}
        {driver && (
          <Animated.View entering={entering.card(1)}>
            {isJobClosed ? (
              <View style={styles.driverHighlightRow}>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>Šoferis {driver.firstName}</Text>
                  <Text style={styles.driverVehicle}>
                    {job.requiredVehicleType
                      ? (VEHICLE_LABEL[job.requiredVehicleType] ?? job.requiredVehicleType)
                      : 'Nav norādīts'}
                    {vehicle?.licensePlate ? ` · ${vehicle.licensePlate}` : ''}
                  </Text>
                </View>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverInitials}>
                    {(driver.firstName[0] || '').toUpperCase()}
                    {(driver.lastName[0] || '').toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.driverHighlightRow}
                onPress={() => {
                  haptics.light();
                  router.push({
                    pathname: '/chat/[jobId]',
                    params: { jobId: job.id, title: `${driver.firstName} ${driver.lastName}` },
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>Šoferis {driver.firstName}</Text>
                  <Text style={styles.driverVehicle}>
                    {job.requiredVehicleType
                      ? (VEHICLE_LABEL[job.requiredVehicleType] ?? job.requiredVehicleType)
                      : 'Nav norādīts'}
                    {vehicle?.licensePlate ? ` · ${vehicle.licensePlate}` : ''}
                  </Text>
                </View>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverInitials}>
                    {(driver.firstName[0] || '').toUpperCase()}
                    {(driver.lastName[0] || '').toUpperCase()}
                  </Text>
                  <View style={styles.chatBadge}>
                    <MessageCircle size={10} color="#fff" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
            <Divider color="#EBEBEB" marginV={0} />
          </Animated.View>
        )}

        <Animated.View entering={entering.card(driver ? 2 : 1)}>
          <InfoSection icon={<MapPin size={18} color="#111827" />} title="Maršruts">
            {routeRows.map((row, index) => (
              <DetailRow
                key={row.label}
                label={row.label}
                value={row.value}
                last={index === routeRows.length - 1}
              />
            ))}
          </InfoSection>
        </Animated.View>
        <Divider color="#EBEBEB" marginV={0} />

        <Animated.View entering={entering.card(driver ? 3 : 2)}>
          <InfoSection icon={<Package size={18} color="#111827" />} title="Krava">
            {cargoRows.map((row, index) => (
              <DetailRow
                key={row.label}
                label={row.label}
                value={row.value}
                last={index === cargoRows.length - 1}
              />
            ))}
          </InfoSection>
        </Animated.View>
        <Divider color="#EBEBEB" marginV={0} />

        <Animated.View entering={entering.card(driver ? 4 : 3)}>
          <InfoSection icon={<Clock3 size={18} color="#111827" />} title="Laiks">
            {timingRows.map((row, index) => (
              <DetailRow
                key={row.label}
                label={row.label}
                value={row.value}
                last={index === timingRows.length - 1}
              />
            ))}
          </InfoSection>
        </Animated.View>
        <Divider color="#EBEBEB" marginV={0} />

        <Animated.View entering={entering.card(driver ? 5 : 4)}>
          <InfoSection icon={<Phone size={18} color="#111827" />} title="Kontakti">
            {contactRows.length > 0 ? (
              contactRows.map((row, index) =>
                row.phone ? (
                  <DetailRow
                    key={row.label}
                    label={row.label}
                    last={index === contactRows.length - 1}
                    value={
                      <TouchableOpacity
                        onPress={() => {
                          haptics.medium();
                          Linking.openURL(`tel:${row.phone}`).catch(() => null);
                        }}
                        activeOpacity={0.7}
                        style={styles.phoneTapTarget}
                      >
                        <Text style={styles.phoneValueText}>{row.value as string}</Text>
                        <Phone size={13} color="#4f46e5" />
                      </TouchableOpacity>
                    }
                  />
                ) : (
                  <DetailRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    last={index === contactRows.length - 1}
                  />
                ),
              )
            ) : (
              <Text style={styles.emptySectionText}>Kontaktu informācija vēl nav pieejama.</Text>
            )}
          </InfoSection>
        </Animated.View>

        {notes.length > 0 && (
          <InfoSection icon={<FileText size={18} color="#111827" />} title="Piezīmes">
            <Text style={styles.notesText}>{notes}</Text>
          </InfoSection>
        )}

        {job.order?.sitePhotoUrl && (
          <InfoSection icon={<MapPin size={18} color="#111827" />} title="Objekta foto">
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
                <Recycle size={18} color="#111827" />
              ) : (
                <Package size={18} color="#111827" />
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

        {job.status === 'DELIVERED' && ratingChecked && !ratingSubmitted && (
          <InfoSection icon={<Star size={18} color="#111827" />} title="Novērtēt šoferi">
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
          <InfoSection icon={<Star size={18} color="#111827" />} title="Jūsu vērtējums">
            {submittedRating > 0 && (
              <View style={styles.ratingSubmittedRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={24}
                    color={star <= submittedRating ? '#F59E0B' : '#E5E7EB'}
                    fill={star <= submittedRating ? '#F59E0B' : 'transparent'}
                  />
                ))}
              </View>
            )}
            <Text style={styles.ratingSubmittedText}>Paldies par vērtējumu!</Text>
          </InfoSection>
        )}

        {/* ── Secondary actions ── */}
        <View style={styles.secondaryActionsBlock}>
          {driver && !isJobClosed && (
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
        </View>
      </ScrollView>

      {/* ── Sticky footer: cancel ── */}
      {canCancel && (
        <View style={styles.stickyFooter}>
          <Button variant="destructive" size="lg" onPress={handleCancel} isLoading={cancelling}>
            Atcelt pasūtījumu
          </Button>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 100,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
  driverHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  driverInfo: {
    flex: 1,
    paddingRight: 16,
  },
  driverName: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  driverVehicle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#00A878',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  chatBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#F9423A',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  secondaryActionsBlock: {
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
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
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
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
  phoneTapTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneValueText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#4f46e5',
  },
});
