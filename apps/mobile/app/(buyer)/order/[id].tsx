import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  TextInput,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  CalendarDays,
  Phone,
  Package,
  Truck,
  FileText,
  CheckCircle,
  XCircle,
  Star,
  FileDown,
  MessageCircle,
  User,
  Camera,
  CreditCard,
  AlertTriangle,
  Navigation2,
  RotateCcw,
  Scale,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { useOrderDetail } from '@/lib/use-order-detail';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { t } from '@/lib/translations';
import { RatingModal } from '@/components/ui/RatingModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoSection } from '@/components/ui/InfoSection';
import { StatusPill } from '@/components/ui/StatusPill';
import { DetailRow } from '@/components/ui/DetailRow';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ActionResultSheet } from '@/components/ui/ActionResultSheet';
import { useToast } from '@/components/ui/Toast';
import { UNIT_SHORT, MAT_STATUS } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';
import { s } from './order-detail-styles';

// Guard: Stripe React Native — requires native build (not available in Expo Go)
let useStripe: (() => { initPaymentSheet: Function; presentPaymentSheet: Function }) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  useStripe = require('@stripe/stripe-react-native').useStripe;
} catch {
  /* Expo Go fallback */
}

// ── Constants ──────────────────────────────────────────────────

const ORDER_STEPS = [
  { key: 'PENDING', label: 'Pasūtīts', short: 'Gaida', hint: 'Gaida apstiprināšanu' },
  { key: 'CONFIRMED', label: 'Apstiprināts', short: 'Apstip.', hint: 'Pasūtījums apstiprināts' },
  { key: 'IN_PROGRESS', label: 'Piegādē', short: 'Ceļā', hint: 'Šoferis dodas uz jums' },
  { key: 'DELIVERED', label: 'Piegādāts', short: 'Piegāde', hint: 'Piegāde pabeigta' },
  { key: 'COMPLETED', label: 'Pabeigts', short: 'Pabeigts', hint: 'Pasūtījums pabeigts' },
];

// ── Main Screen ────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, setOrder, loading, alreadyRated, documents, reload: load } = useOrderDetail(id);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 1200);
  };

  // Live status updates via WebSocket — no pull-to-refresh needed for status changes
  const { orderStatus: liveStatus, jobLocation: liveLocation } = useLiveUpdates({
    orderId: id ?? null,
    jobId: order?.transportJobs?.[0]?.id ?? null,
    token,
  });

  // When the server pushes a new status, update the local order copy immediately
  React.useEffect(() => {
    if (liveStatus && order && liveStatus !== order.status) {
      setOrder((prev) => (prev ? { ...prev, status: liveStatus } : prev));
    }
  }, [liveStatus, order?.status]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [cancelResultVisible, setCancelResultVisible] = useState(false);
  const [disputeResultVisible, setDisputeResultVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeFiled, setDisputeFiled] = useState(false);

  // Surcharge approval state
  const [surchargeActionLoading, setSurchargeActionLoading] = useState<string | null>(null);

  const handleApproveSurcharge = async (surchargeId: string) => {
    const jobId = order?.transportJobs?.[0]?.id;
    if (!token || !jobId) return;
    setSurchargeActionLoading(surchargeId);
    haptics.light();
    try {
      await api.transportJobs.approveSurcharge(jobId, surchargeId, token);
      haptics.success();
      load();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās apstiprināt piemaksu');
    } finally {
      setSurchargeActionLoading(null);
    }
  };

  const handleRejectSurcharge = async (surchargeId: string) => {
    const jobId = order?.transportJobs?.[0]?.id;
    if (!token || !jobId) return;
    setSurchargeActionLoading(surchargeId);
    haptics.light();
    try {
      await api.transportJobs.rejectSurcharge(jobId, surchargeId, token);
      haptics.success();
      load();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās noraidīt piemaksu');
    } finally {
      setSurchargeActionLoading(null);
    }
  };

  // Load existing dispute from server so confirm-receipt is always properly blocked
  React.useEffect(() => {
    if (!token || !id || !order) return;
    api
      .listDisputes(token, id)
      .then((disputes) => {
        if (disputes.length > 0) setDisputeFiled(true);
      })
      .catch(() => {});
  }, [token, id, order?.id]);

  // Amendment sheet state
  const [showAmend, setShowAmend] = useState(false);
  const [amendLoading, setAmendLoading] = useState(false);
  const [amendDate, setAmendDate] = useState('');
  const [amendWindow, setAmendWindow] = useState<'AM' | 'PM' | 'ANY'>('ANY');
  const [amendNotes, setAmendNotes] = useState('');
  const [amendContact, setAmendContact] = useState('');
  const [amendPhone, setAmendPhone] = useState('');
  const openAmend = () => {
    setAmendDate(order?.deliveryDate ? order.deliveryDate.split('T')[0] : '');
    setAmendWindow((order?.deliveryWindow as 'AM' | 'PM' | 'ANY') ?? 'ANY');
    setAmendNotes(order?.notes ?? '');
    setAmendContact(order?.siteContactName ?? '');
    setAmendPhone(order?.siteContactPhone ?? '');
    setShowAmend(true);
  };
  const handleAmendSubmit = async () => {
    if (!token || !order) return;
    setAmendLoading(true);
    haptics.light();
    try {
      const body: Record<string, string> = {};
      if (amendDate) body.deliveryDate = amendDate;
      if (amendWindow) body.deliveryWindow = amendWindow;
      if (amendNotes !== (order.notes ?? '')) body.notes = amendNotes;
      if (amendContact !== (order.siteContactName ?? '')) body.siteContactName = amendContact;
      if (amendPhone !== (order.siteContactPhone ?? '')) body.siteContactPhone = amendPhone;
      await api.orders.update(order.id, body, token);
      haptics.success();
      setShowAmend(false);
      load();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās saglabāt izmaiņas');
    } finally {
      setAmendLoading(false);
    }
  };
  // Local flag so the UI updates immediately after rating without a reload
  const [ratedLocally, setRatedLocally] = useState(false);
  const hasRated = alreadyRated || ratedLocally;
  const [etaMin, setEtaMin] = useState<number | null>(null);

  // Update ETA from live driver location broadcasts
  React.useEffect(() => {
    if (liveLocation?.estimatedArrivalMin != null) setEtaMin(liveLocation.estimatedArrivalMin);
  }, [liveLocation]);

  // Stripe payment sheet — guarded for Expo Go
  const stripe = useStripe ? useStripe() : null;
  const [payLoading, setPayLoading] = useState(false);
  // Optimistic flag: hide Pay button immediately after success while webhook fires
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const handlePay = async () => {
    if (!token || !order || !stripe) return;
    setPayLoading(true);
    haptics.light();
    try {
      const { clientSecret } = await api.createIntent(order.id, token);
      const { error: initError } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'B3Hub',
        returnURL: 'b3hub://order/return',
        defaultBillingDetails: {},
      });
      if (initError) {
        toast.error(initError.message);
        return;
      }
      const { error: presentError } = await stripe.presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          haptics.error();
          Alert.alert('Maksājums neizdevās', presentError.message);
        }
        return;
      }
      haptics.success();
      Alert.alert('Maksājums veiksmīgs', 'Jūsu pasūtījums tiek apstrādāts.');
      setPaymentProcessing(true);
      load();
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās apstrādāt maksājumu');
    } finally {
      setPayLoading(false);
    }
  };

  const DISPUTE_REASONS: { key: string; label: string }[] = [
    { key: 'SHORT_DELIVERY', label: 'Nepietiekams daudzums' },
    { key: 'WRONG_MATERIAL', label: 'Nepareizs materiāls' },
    { key: 'DAMAGE', label: 'Bojājumi piegādes laikā' },
    { key: 'QUALITY_ISSUE', label: 'Kvālitātes problēma' },
    { key: 'NO_DELIVERY', label: 'Nav saņemta piegāde' },
    { key: 'LATE_DELIVERY', label: 'Piegāde ievērojami kavējas' },
    { key: 'OTHER', label: 'Cits jautājums' },
  ];

  const handleDisputeSubmit = async () => {
    if (!disputeReason) {
      haptics.warning();
      Alert.alert('Izvēlieties iemeslu', 'Lūdzu izvēlieties problēmas iemeslu.');
      return;
    }
    if (!token || !order) return;
    setDisputeLoading(true);
    haptics.light();
    try {
      const selectedReason = DISPUTE_REASONS.find((r) => r.key === disputeReason);
      await api.reportDispute(
        order.id,
        disputeReason,
        disputeDetails || selectedReason?.label,
        token,
      );
      haptics.success();
      setDisputeFiled(true);
      setShowDispute(false);
      setDisputeResultVisible(true);
    } catch (err: unknown) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt sūdzību');
    } finally {
      setDisputeLoading(false);
    }
  };

  const handleCancel = () => {
    haptics.heavy();
    Alert.alert('Atcelt pasūtījumu?', 'Šo darbību nevar atsaukt.', [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt pasūtījumu',
        style: 'destructive',
        onPress: async () => {
          if (!token || !order) return;
          setActionLoading(true);
          try {
            const updated = await api.orders.cancel(order.id, token);
            setOrder(updated);
            haptics.success();
            setCancelResultVisible(true);
          } catch (err: unknown) {
            haptics.error();
            toast.error(err instanceof Error ? err.message : 'Neizdevās atcelt');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleConfirmReceipt = () => {
    haptics.medium();
    Alert.alert(
      'Apstiprināt saņemšanu?',
      'Apstiprinot saņemšanu, pasūtījums tiks slēgts un maksājums tiks izmaksāts piegādātājam.',
      [
        { text: 'Nē', style: 'cancel' },
        {
          text: 'Apstiprināt',
          onPress: async () => {
            if (!token || !order) return;
            setActionLoading(true);
            try {
              const updated = await api.orders.confirmReceipt(order.id, token);
              setOrder(updated);
              haptics.success();
              Alert.alert('✅ Apstiprināts', 'Pasūtījums veiksmīgi pabeigts. Paldies!');
            } catch (err: unknown) {
              haptics.error();
              toast.error(err instanceof Error ? err.message : 'Neizdevās apstiprināt');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Pasūtījums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Pasūtījums" />
        <EmptyState icon={<Package size={32} color="#9ca3af" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const st = MAT_STATUS[order.status] ?? MAT_STATUS.PENDING;
  const activeJob = order.transportJobs?.find(
    (j) =>
      j.status === 'ACCEPTED' ||
      j.status === 'EN_ROUTE_PICKUP' ||
      j.status === 'AT_PICKUP' ||
      j.status === 'LOADED' ||
      j.status === 'EN_ROUTE_DELIVERY' ||
      j.status === 'AT_DELIVERY',
  );
  const driver = activeJob?.driver;
  const vehicle = activeJob?.vehicle;
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status);
  const canPay =
    !paymentProcessing &&
    order.status === 'PENDING' &&
    (!order.paymentStatus || order.paymentStatus === 'PENDING') &&
    order.paymentMethod !== 'INVOICE' &&
    !!stripe;
  const isInvoiceOrder = order.paymentMethod === 'INVOICE';
  const stepperIdx = ORDER_STEPS.findIndex((x) => x.key === order.status);

  // ── Exception banners ──────────────────────────────────────────
  const allExceptions = order.transportJobs?.flatMap((j) => j.exceptions ?? []) ?? [];
  const openExceptions = allExceptions.filter((e) => e.status === 'OPEN');

  const EXCEPTION_LABELS: Record<string, string> = {
    PARTIAL_DELIVERY: 'Daļēja piegāde',
    WRONG_MATERIAL: 'Nepareizs materiāls',
    DAMAGE: 'Prece bojāta',
    REJECTED_DELIVERY: 'Piegāde noraidīta',
    DRIVER_NO_SHOW: 'Šoferis neierādījās',
    SUPPLIER_NOT_READY: 'Piegādātājs nav gatavs',
    SITE_CLOSED: 'Objekts slēgts',
    OVERWEIGHT: 'Pārsniegts svars',
    OTHER: 'Cits',
  };

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader title="Pasūtījums" />
      {/* Uber-style hero header */}
      <View style={s.heroHeader}>
        <View style={s.heroLeft}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Text style={s.heroOrderNumber} numberOfLines={1}>
              {order.orderNumber}
            </Text>
            <StatusPill label={st.label} bg="#f3f4f6" color="#111827" size="md" />
          </View>
          {order.items[0]?.material?.name ? (
            <Text style={s.heroMaterial} numberOfLines={1}>
              {order.items[0].material.name}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Horizontal status stepper ─────────────────────────── */}
        {order.status !== 'CANCELLED' && (
          <View style={s.stepperCard}>
            <View style={s.stepperWrap}>
              {/* Grey background track */}
              <View style={s.stepperTrack} />
              {/* Green filled progress */}
              {stepperIdx > 0 && (
                <View
                  style={[
                    s.stepperFill,
                    { width: `${(stepperIdx / (ORDER_STEPS.length - 1)) * 100}%` },
                  ]}
                />
              )}
              {/* Step columns */}
              <View style={s.stepperDotsRow}>
                {ORDER_STEPS.map((step, i) => {
                  const done = i < stepperIdx;
                  const active = i === stepperIdx;
                  return (
                    <View key={step.key} style={s.stepCol}>
                      <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                        {done && <CheckCircle size={9} color="#fff" />}
                        {active && <View style={s.stepDotPulse} />}
                      </View>
                      <Text
                        style={[s.stepLabel, done && s.stepLabelDone, active && s.stepLabelActive]}
                        numberOfLines={1}
                      >
                        {step.short}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <Text style={s.stepHint}>{ORDER_STEPS[stepperIdx]?.hint ?? ''}</Text>
          </View>
        )}

        {/* ── Open exception banners ────────────────────────────── */}
        {openExceptions.map((ex) => {
          const isPartial = ex.type === 'PARTIAL_DELIVERY';
          const actualQtyMatch = ex.notes?.match(/\[actualQuantity=([0-9.]+)\]/);
          const actualQty = actualQtyMatch ? parseFloat(actualQtyMatch[1]) : null;
          const cleanNotes = ex.notes?.replace(/\s*\[actualQuantity=[0-9.]+\]/, '').trim();
          return (
            <View key={ex.id} style={s.exceptionBannerFlat}>
              <AlertTriangle size={14} color="#6b7280" />
              <View style={{ flex: 1 }}>
                <Text style={s.exceptionBannerFlatTitle}>
                  {EXCEPTION_LABELS[ex.type] ?? ex.type}
                </Text>
                {isPartial && actualQty != null && (
                  <Text style={s.exceptionBannerFlatSub}>Piegādāts: {actualQty} t</Text>
                )}
                {cleanNotes ? <Text style={s.exceptionBannerFlatSub}>{cleanNotes}</Text> : null}
              </View>
            </View>
          );
        })}

        {/* Live tracking card — shown whenever a transport job is active */}
        {activeJob && (
          <TouchableOpacity
            style={s.liveTrackCard}
            activeOpacity={0.82}
            onPress={() => {
              haptics.light();
              router.push(`/(buyer)/transport-job/${activeJob.id}` as any);
            }}
          >
            <View style={s.liveTrackLeft}>
              <View style={s.liveIndicator}>
                <View style={s.liveDot} />
              </View>
              <View>
                <Text style={s.liveTrackTitle}>
                  {etaMin != null ? `Pienāks pēc ~${etaMin} min` : 'Šoferis ir ceļā'}
                </Text>
                <Text style={s.liveTrackSub}>Izseko piegādi kartē</Text>
              </View>
            </View>
            <Navigation2 size={24} color="#111827" />
          </TouchableOpacity>
        )}

        {/* Driver card — if order is in transit */}
        {driver && (
          <View style={s.driverCard}>
            <View style={s.driverInfo}>
              {driver.avatar ? (
                <Image source={{ uri: driver.avatar }} style={s.driverAvatar} />
              ) : (
                <View style={s.driverAvatarFallback}>
                  <Text style={s.driverAvatarInitials}>
                    {driver.firstName?.[0] ?? '?'}
                    {driver.lastName?.[0] ?? ''}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>
                  {driver.firstName} {driver.lastName}
                </Text>
                {/* Driver rating & completed jobs */}
                {(driver as any).driverProfile?.rating != null ? (
                  <View style={s.driverRatingRow}>
                    <Star size={12} color="#111827" fill="#111827" />
                    <Text style={s.driverRatingText}>
                      {((driver as any).driverProfile.rating as number).toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                {vehicle ? <Text style={s.driverPlate}>{vehicle.licensePlate}</Text> : null}
              </View>
              {driver.phone ? (
                <TouchableOpacity
                  style={s.callBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${driver.phone}`).catch(() =>
                      Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'),
                    )
                  }
                >
                  <Phone size={20} color="#111827" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* Weighing slip photo — shown as soon as driver marks job LOADED */}
        {(() => {
          const jobWithPhoto = order.transportJobs?.find((j) => j.pickupPhotoUrl);
          if (!jobWithPhoto?.pickupPhotoUrl) return null;
          return (
            <InfoSection
              icon={<Camera size={14} color="#6b7280" />}
              title="Svēršanas biļete"
              right={
                jobWithPhoto.actualWeightKg != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Scale size={11} color="#374151" />
                    <Text style={s.weighingWeight}>
                      {jobWithPhoto.actualWeightKg.toFixed(0)} kg
                    </Text>
                  </View>
                ) : undefined
              }
            >
              <Image
                source={{ uri: jobWithPhoto.pickupPhotoUrl }}
                style={s.weighingSlipPhoto}
                resizeMode="contain"
              />
            </InfoSection>
          );
        })()}

        {/* Weight discrepancy alert — when actual ≠ ordered by > 5% */}
        {(() => {
          const jobWithWeight = order.transportJobs?.find((j) => (j as any).actualWeightKg != null);
          if (!jobWithWeight) return null;
          const actualKg = (jobWithWeight as any).actualWeightKg as number;
          const orderedKg = order.items.reduce(
            (sum: number, item: any) => (item.unit === 'TONNE' ? sum + item.quantity * 1000 : sum),
            0,
          );
          if (!orderedKg) return null;
          const diffPct = Math.abs(actualKg - orderedKg) / orderedKg;
          if (diffPct < 0.05) return null;
          const isUnder = actualKg < orderedKg;
          return (
            <View style={s.exceptionBannerFlat}>
              <AlertTriangle size={14} color={isUnder ? '#92400e' : '#1e40af'} />
              <View style={{ flex: 1 }}>
                <Text style={s.exceptionBannerFlatTitle}>
                  {isUnder ? 'Piegādāts mazāk nekā pasūtīts' : 'Piegādāts vairāk nekā pasūtīts'}
                </Text>
                <Text style={s.exceptionBannerFlatSub}>
                  Pasūtīts: {(orderedKg / 1000).toFixed(2)} t · Faktiski:{' '}
                  {(actualKg / 1000).toFixed(2)} t ({isUnder ? '' : '+'}
                  {((actualKg - orderedKg) / (orderedKg / 100)).toFixed(0)}%)
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Per-truck dispatch status — shown when there are transport jobs */}
        {order.transportJobs &&
          order.transportJobs.length > 0 &&
          (() => {
            const JOB_STATUS_LABELS: Record<string, string> = {
              PENDING: 'Gaida',
              ACCEPTED: 'Pieņemts',
              EN_ROUTE_PICKUP: 'Dodas uz iekraušanu',
              AT_PICKUP: 'Pie iekraušanas',
              LOADED: 'Iekrauts',
              EN_ROUTE_DELIVERY: 'Dodas pie jums',
              AT_DELIVERY: 'Pie jums',
              DELIVERED: 'Piegādāts',
              CANCELLED: 'Atcelts',
              FAILED: 'Neizdevās',
            };
            const JOB_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
              PENDING: { bg: '#f3f4f6', color: colors.textMuted },
              ACCEPTED: { bg: '#eff6ff', color: '#1d4ed8' },
              EN_ROUTE_PICKUP: { bg: '#fffbeb', color: '#92400e' },
              AT_PICKUP: { bg: '#fffbeb', color: '#92400e' },
              LOADED: { bg: '#f0fdf4', color: '#166534' },
              EN_ROUTE_DELIVERY: { bg: '#dcfce7', color: colors.successText },
              AT_DELIVERY: { bg: '#dcfce7', color: colors.successText },
              DELIVERED: { bg: '#f0fdf4', color: '#166534' },
              CANCELLED: { bg: '#fef2f2', color: colors.dangerText },
              FAILED: { bg: '#fef2f2', color: colors.dangerText },
            };
            return (
              <InfoSection
                icon={<Truck size={14} color="#111827" />}
                title={
                  order.transportJobs.length > 1
                    ? `Kravas auto (${order.transportJobs.length})`
                    : 'Kravas auto'
                }
              >
                {order.transportJobs.map((job, i) => {
                  const sc = JOB_STATUS_COLORS[job.status] ?? {
                    bg: '#f3f4f6',
                    color: colors.textMuted,
                  };
                  const label = JOB_STATUS_LABELS[job.status] ?? job.status;
                  const driverName = job.driver
                    ? `${job.driver.firstName} ${job.driver.lastName}`
                    : null;
                  const plate = job.vehicle?.licensePlate ?? null;
                  return (
                    <TouchableOpacity
                      key={job.id}
                      onPress={() => {
                        haptics.light();
                        router.push(`/(buyer)/transport-job/${job.id}` as any);
                      }}
                      activeOpacity={0.75}
                    >
                      <DetailRow
                        label={`Auto ${i + 1}${driverName ? ` · ${driverName}` : ''}${plate ? ` · ${plate}` : ''}`}
                        value={<StatusPill label={label} bg={sc.bg} color={sc.color} />}
                        last={i === (order.transportJobs?.length ?? 0) - 1}
                      />
                    </TouchableOpacity>
                  );
                })}
              </InfoSection>
            );
          })()}

        {/* Order items */}
        <InfoSection icon={<Package size={14} color="#111827" />} title="Preces">
          {order.items.map((item, idx) => (
            <View key={idx} style={[s.itemRow, idx < order.items.length - 1 && s.itemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{item.material.name}</Text>
                <Text style={s.itemMeta}>
                  {item.quantity} {UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] ?? item.unit} ×
                  €{item.unitPrice.toFixed(2)}
                </Text>
              </View>
              <Text style={s.itemTotal}>€{item.total.toFixed(2)}</Text>
            </View>
          ))}
          {order.deliveryFee > 0 && (
            <>
              <View style={s.priceRowSimple}>
                <Text style={s.priceLabel}>Materiāli</Text>
                <Text style={s.priceValue}>€{order.subtotal.toFixed(2)}</Text>
              </View>
              <View style={s.priceRowSimple}>
                <Text style={s.priceLabel}>Piegāde</Text>
                <Text style={s.priceValue}>€{order.deliveryFee.toFixed(2)}</Text>
              </View>
              {(order.surcharges ?? [])
                .filter(
                  (sc) =>
                    sc.billable &&
                    sc.approvalStatus !== 'PENDING' &&
                    sc.approvalStatus !== 'REJECTED',
                )
                .map((sc) => (
                  <View key={sc.id} style={s.priceRowSimple}>
                    <Text style={s.priceLabel}>{sc.label}</Text>
                    <Text style={s.priceValue}>+€{sc.amount.toFixed(2)}</Text>
                  </View>
                ))}
              {(order.surcharges ?? [])
                .filter((sc) => sc.billable && sc.approvalStatus === 'PENDING')
                .map((sc) => (
                  <View key={sc.id} style={s.pendingSurchargeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pendingSurchargeLabel}>{sc.label}</Text>
                      <Text style={s.pendingSurchargeMeta}>Gaida jūsu apstiprinājumu</Text>
                    </View>
                    <Text style={s.pendingSurchargeAmount}>+€{sc.amount.toFixed(2)}</Text>
                    <View style={s.pendingSurchargeActions}>
                      <TouchableOpacity
                        style={s.rejectBtn}
                        onPress={() => handleRejectSurcharge(sc.id)}
                        disabled={surchargeActionLoading === sc.id}
                        activeOpacity={0.7}
                      >
                        {surchargeActionLoading === sc.id ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <Text style={s.rejectBtnText}>Noraidīt</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.approveBtn}
                        onPress={() => handleApproveSurcharge(sc.id)}
                        disabled={surchargeActionLoading === sc.id}
                        activeOpacity={0.7}
                      >
                        {surchargeActionLoading === sc.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.approveBtnText}>Apstiprināt</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              {order.tax > 0 && (
                <View style={s.priceRowSimple}>
                  <Text style={s.priceLabel}>PVN</Text>
                  <Text style={s.priceValue}>€{order.tax.toFixed(2)}</Text>
                </View>
              )}
              <View style={s.priceDivider} />
            </>
          )}
          <View style={s.totalRowFinal}>
            <Text style={s.totalLabelFinal}>Kopā</Text>
            <Text style={s.totalValueFinal}>
              €{order.total.toFixed(2)} {order.currency}
            </Text>
          </View>
        </InfoSection>

        {/* Delivery details */}
        <InfoSection icon={<MapPin size={14} color="#111827" />} title="Piegādes informācija">
          <DetailRow label="Adrese" value={`${order.deliveryAddress}\n${order.deliveryCity}`} />
          <DetailRow
            label="Piegādes datums"
            value={order.deliveryDate ? formatDate(order.deliveryDate) : null}
          />
          {order.deliveryWindow && order.deliveryWindow !== 'ANY' && (
            <DetailRow
              label="Piegādes laiks"
              value={order.deliveryWindow === 'AM' ? 'Rīts (8–12)' : 'Diena (12–17)'}
            />
          )}
          <DetailRow label="Kontaktpersona" value={order.siteContactName} />
          <DetailRow label="Tālrunis" value={order.siteContactPhone} />
          {order.siteContactPhone && (
            <TouchableOpacity
              style={s.callSiteBtn}
              onPress={() => Linking.openURL(`tel:${order.siteContactPhone}`).catch(() => null)}
              activeOpacity={0.8}
            >
              <Phone size={13} color="#374151" />
              <Text style={s.callSiteBtnText}>Zvanīt kontaktpersonai</Text>
            </TouchableOpacity>
          )}
        </InfoSection>

        {/* Documents — CMR, weighing slip (shown after delivery) */}
        {order.status === 'DELIVERED' && documents.length > 0 && (
          <InfoSection icon={<FileDown size={14} color="#111827" />} title="Dokumenti">
            {documents.map((doc) => {
              const docLabel =
                doc.type === 'WEIGHING_SLIP'
                  ? 'Svēršanas kvīts'
                  : doc.type === 'DELIVERY_NOTE'
                    ? 'Pavadzīme (CMR)'
                    : doc.type === 'INVOICE'
                      ? 'Rēķins'
                      : doc.title;
              return (
                <View key={doc.id} style={s.docRow}>
                  <View style={s.docInfo}>
                    <Text style={s.docTitle}>{docLabel}</Text>
                    <Text style={s.docStatus}>
                      {doc.fileUrl ? 'Pieejams' : 'Tiek sagatavots...'}
                    </Text>
                  </View>
                  {doc.fileUrl ? (
                    <TouchableOpacity
                      style={s.docDownloadBtn}
                      onPress={() => Linking.openURL(doc.fileUrl!).catch(() => null)}
                      activeOpacity={0.8}
                    >
                      <FileDown size={14} color="#fff" />
                      <Text style={s.docDownloadText}>Lejupielādēt</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.docPendingBadge}>
                      <Text style={s.docPendingText}>Gaida</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </InfoSection>
        )}

        {/* Delivery proof — photos + notes submitted by driver */}
        {order.status === 'DELIVERED' &&
          (() => {
            const proof = order.transportJobs?.find((j) => j.deliveryProof)?.deliveryProof;
            if (!proof) return null;
            return (
              <InfoSection
                icon={<Camera size={14} color="#111827" />}
                title="Piegādes pierādījums"
                right={
                  <Text style={s.proofTime}>
                    {new Date(proof.createdAt).toLocaleDateString('lv-LV', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                }
              >
                {proof.recipientName ? (
                  <DetailRow label="Pieņēma" value={proof.recipientName} />
                ) : null}
                {proof.notes ? <DetailRow label="Piezīmes" value={proof.notes} /> : null}
                {proof.photos.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.proofPhotoRow}
                  >
                    {proof.photos.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={s.proofPhoto} resizeMode="cover" />
                    ))}
                  </ScrollView>
                )}
                {proof.photos.length === 0 && (
                  <View style={s.proofNoPhoto}>
                    <CheckCircle size={14} color="#111827" />
                    <Text style={s.proofNoPhotoText}>Piegāde apstiprināta bez fotogrāfijas</Text>
                  </View>
                )}
              </InfoSection>
            );
          })()}

        {/* Buyer info */}
        {order.buyer && (
          <InfoSection icon={<User size={14} color="#111827" />} title="Pasūtītājs">
            <DetailRow label="Vārds" value={order.buyer?.name ?? ''} />
            <DetailRow label="Tālrunis" value={order.buyer?.phone} last />
          </InfoSection>
        )}

        {/* bottom spacer so sticky footer doesn't cover last section */}
        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Sticky action footer */}
      <View style={s.actions}>
        {/* Primary action only */}
        {canPay && (
          <TouchableOpacity
            style={[s.primaryActionBtn, payLoading && { opacity: 0.6 }]}
            onPress={handlePay}
            disabled={payLoading}
            activeOpacity={0.85}
          >
            {payLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <CreditCard size={18} color="#fff" />
                <Text style={s.primaryActionBtnText}>Maksāt €{order.total.toFixed(2)}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Fallback message shown in Expo Go where native Stripe SDK is unavailable */}
        {!stripe &&
          order.status === 'PENDING' &&
          (!order.paymentStatus || order.paymentStatus === 'PENDING') && (
            <View style={s.statusMessage}>
              <AlertTriangle size={14} color="#d97706" />
              <Text style={[s.statusMessageText, { color: '#92400e' }]}>
                Apmaksa jāveic caur lapu vai jaunāko versiju
              </Text>
            </View>
          )}

        {order.status === 'PENDING' && (
          <>
            {!canPay && !isInvoiceOrder && (
              <View style={s.statusMessage}>
                <FileText size={14} color="#6b7280" />
                <Text style={s.statusMessageText}>Pasūtījums gaida apstiprinājumu</Text>
              </View>
            )}
            {isInvoiceOrder && (
              <View style={[s.statusMessage, { backgroundColor: '#eff6ff' }]}>
                <FileText size={14} color="#2563eb" />
                <Text style={[s.statusMessageText, { color: '#1e40af' }]}>Apmaksa ar rēķinu</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[{ flex: 1 }, s.secondaryActionBtn]}
                onPress={() => openAmend()}
                activeOpacity={0.8}
              >
                <Text style={s.secondaryActionBtnText}>Labot</Text>
              </TouchableOpacity>
              {canCancel && (
                <TouchableOpacity
                  style={[{ flex: 1 }, s.secondaryActionBtn, s.secondaryActionBtnDanger]}
                  onPress={handleCancel}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#991b1b" />
                  ) : (
                    <Text style={s.secondaryActionBtnDangerText}>Atcelt</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {order.status === 'DELIVERED' && (
          <>
            <TouchableOpacity
              style={[
                s.primaryActionBtn,
                { backgroundColor: disputeFiled ? '#9ca3af' : '#16a34a' },
              ]}
              onPress={handleConfirmReceipt}
              disabled={actionLoading || disputeFiled}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <CheckCircle size={18} color="#fff" />
                  <Text style={s.primaryActionBtnText}>Apstiprināt saņemšanu</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!hasRated && (
                <TouchableOpacity
                  style={[{ flex: 1 }, s.secondaryActionBtn]}
                  onPress={() => setShowRating(true)}
                >
                  <Star size={16} color="#111827" />
                  <Text style={s.secondaryActionBtnText}>Novērtēt</Text>
                </TouchableOpacity>
              )}
              {!disputeFiled && (
                <TouchableOpacity
                  style={[{ flex: 1 }, s.secondaryActionBtn]}
                  onPress={() => setShowDispute(true)}
                >
                  <AlertTriangle size={16} color="#111827" />
                  <Text style={s.secondaryActionBtnText}>Problēma</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
          <TouchableOpacity
            style={s.primaryActionBtn}
            onPress={() =>
              router.push({
                pathname: '/order-request-new',
                params: {
                  prefillMaterial: order.items[0]?.material?.name ?? '',
                  prefillAddress: order.deliveryAddress ?? '',
                  prefillCity: order.deliveryCity ?? '',
                },
              })
            }
          >
            <RotateCcw size={18} color="#fff" />
            <Text style={s.primaryActionBtnText}>Pasūtīt vēlreiz</Text>
          </TouchableOpacity>
        )}

        {/* Chat with driver — shown whenever there's an active transport job */}
        {activeJob && (
          <TouchableOpacity
            style={s.chatBtn}
            onPress={() =>
              router.push({
                pathname: '/chat/[jobId]',
                params: {
                  jobId: activeJob.id,
                  title: driver ? `${driver.firstName} ${driver.lastName}` : 'Šoferis',
                },
              })
            }
          >
            <MessageCircle size={16} color="#111827" />
            <Text style={s.chatBtnText}>
              {driver ? `Rakstīt ${driver.firstName}` : 'Rakstīt šoferim'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Rating modal */}
      {id && token && (
        <RatingModal
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSuccess={() => {
            setShowRating(false);
            setRatedLocally(true);
          }}
          token={token}
          orderId={id}
        />
      )}

      {/* Dispute / report issue bottom sheet */}
      <BottomSheet
        visible={showDispute}
        onClose={() => setShowDispute(false)}
        title="Ziņot par problēmu"
        subtitle="Aprakstiet problēmu ar pasūtījumu"
        scrollable
      >
        <View style={{ gap: 12, paddingBottom: 8 }}>
          {DISPUTE_REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[s.disputeReasonRow, disputeReason === r.key && s.disputeReasonRowActive]}
              onPress={() => {
                haptics.light();
                setDisputeReason(r.key);
              }}
              activeOpacity={0.8}
            >
              <View style={[s.disputeRadio, disputeReason === r.key && s.disputeRadioActive]}>
                {disputeReason === r.key && <View style={s.disputeRadioDot} />}
              </View>
              <Text
                style={[s.disputeReasonText, disputeReason === r.key && s.disputeReasonTextActive]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={s.disputeDetailsInput}
            placeholder="Papildu informācija (neobligāts)..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            value={disputeDetails}
            onChangeText={setDisputeDetails}
          />

          <TouchableOpacity
            style={[s.disputeSubmitBtn, (!disputeReason || disputeLoading) && { opacity: 0.5 }]}
            onPress={handleDisputeSubmit}
            disabled={!disputeReason || disputeLoading}
            activeOpacity={0.85}
          >
            {disputeLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.disputeSubmitBtnText}>Nosūtīt sūdzību</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Amendment bottom sheet — edit PENDING order */}
      <BottomSheet
        visible={showAmend}
        onClose={() => setShowAmend(false)}
        title="Labot pasūtījumu"
        subtitle="Izmaiņas iespējamas, kamēr pasūtījums nav apstiprināts"
        scrollable
      >
        <View style={{ gap: 14, paddingBottom: 8 }}>
          {/* Delivery date */}
          <View style={s.amendField}>
            <Text style={s.amendLabel}>Piegādes datums (GGGG-MM-DD)</Text>
            <TextInput
              style={s.amendInput}
              placeholder="2025-06-15"
              placeholderTextColor="#9ca3af"
              value={amendDate}
              onChangeText={setAmendDate}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
          </View>

          {/* Delivery window */}
          <View style={s.amendField}>
            <Text style={s.amendLabel}>Piegādes laiks</Text>
            <View style={s.amendWindowRow}>
              {(['AM', 'PM', 'ANY'] as const).map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[s.amendWindowBtn, amendWindow === w && s.amendWindowBtnActive]}
                  onPress={() => {
                    haptics.light();
                    setAmendWindow(w);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[s.amendWindowBtnText, amendWindow === w && s.amendWindowBtnTextActive]}
                  >
                    {w === 'AM' ? 'Rīts (8–12)' : w === 'PM' ? 'Diena (12–17)' : 'Jebkurā laikā'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Site contact */}
          <View style={s.amendField}>
            <Text style={s.amendLabel}>Kontaktpersona</Text>
            <TextInput
              style={s.amendInput}
              placeholder="Vārds Uzvārds"
              placeholderTextColor="#9ca3af"
              value={amendContact}
              onChangeText={setAmendContact}
            />
          </View>
          <View style={s.amendField}>
            <Text style={s.amendLabel}>Kontaktpersonas tālrunis</Text>
            <TextInput
              style={s.amendInput}
              placeholder="+371 XXXXXXXX"
              placeholderTextColor="#9ca3af"
              value={amendPhone}
              onChangeText={setAmendPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Notes */}
          <View style={s.amendField}>
            <Text style={s.amendLabel}>Piezīmes šoferim</Text>
            <TextInput
              style={[s.amendInput, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Piegādes instrukcijas, ieeja objektā..."
              placeholderTextColor="#9ca3af"
              multiline
              value={amendNotes}
              onChangeText={setAmendNotes}
            />
          </View>

          <TouchableOpacity
            style={[s.amendSubmitBtn, amendLoading && { opacity: 0.5 }]}
            onPress={handleAmendSubmit}
            disabled={amendLoading}
            activeOpacity={0.85}
          >
            {amendLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.amendSubmitBtnText}>Saglabāt izmaiņas</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Cancel confirmation result */}
      <ActionResultSheet
        visible={cancelResultVisible}
        onClose={() => setCancelResultVisible(false)}
        variant="cancelled"
        title="Pasūtījums atcelts"
        subtitle="Jūsu pasūtījums ir atcelts. Ja vēlaties, varat pasūtīt no jauna."
        primaryLabel="Pasūtīt no jauna"
        onPrimary={() => {
          setCancelResultVisible(false);
          router.replace({ pathname: '/order-request-new' });
        }}
        secondaryLabel="Mani pasūtījumi"
        onSecondary={() => {
          setCancelResultVisible(false);
          router.replace('/(buyer)/orders');
        }}
      />

      {/* Dispute submitted result */}
      <ActionResultSheet
        visible={disputeResultVisible}
        onClose={() => setDisputeResultVisible(false)}
        variant="info"
        title="Sūdzība iesniegta"
        subtitle="Mēs izskatīsim jūsu paziņojumu un sazināsimies 1–2 darba dienu laikā."
        primaryLabel="Labi, sapratu"
        onPrimary={() => setDisputeResultVisible(false)}
      />
    </ScreenContainer>
  );
}
