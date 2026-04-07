import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
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
import { UNIT_SHORT, MAT_STATUS } from '@/lib/materials';
import { formatDate } from '@/lib/format';

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
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās saglabāt izmaiņas');
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
        defaultBillingDetails: {},
      });
      if (initError) {
        Alert.alert('Kļūda', initError.message);
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
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās apstrādāt maksājumu');
    } finally {
      setPayLoading(false);
    }
  };

  const DISPUTE_REASONS: { key: string; label: string }[] = [
    { key: 'SHORT_DELIVERY', label: 'Krašana nepareiza / trūkst daudzums' },
    { key: 'WRONG_MATERIAL', label: 'Sagadītā prece neatbilst pasūtītājai' },
    { key: 'DAMAGE', label: 'Prece bojāta piegādes laikā' },
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
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās nosūtīt sūdzību');
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
            Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās atcelt');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer bg="#f4f5f7">
        <ScreenHeader title="Pasūtījums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#f4f5f7">
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
    <ScreenContainer bg="#f4f5f7">
      {/* Header */}
      <ScreenHeader
        title={order.orderNumber}
        rightAction={<StatusPill label={st.label} bg={st.bg} color={st.color} />}
      />

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
            <View key={ex.id} style={s.exceptionBanner}>
              <AlertTriangle size={16} color="#92400e" style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.exceptionBannerTitle}>{EXCEPTION_LABELS[ex.type] ?? ex.type}</Text>
                {isPartial && actualQty != null && (
                  <Text style={s.exceptionBannerMeta}>
                    Piegādāts: {actualQty} t — pasūtījuma summa atjaunota uz faktisko daudzumu
                  </Text>
                )}
                {cleanNotes ? <Text style={s.exceptionBannerNote}>{cleanNotes}</Text> : null}
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
            <Navigation2 size={20} color="#3b82f6" />
          </TouchableOpacity>
        )}

        {/* Driver card — if order is in transit */}
        {driver && (
          <View style={s.driverCard}>
            <View style={s.driverCardRow}>
              <Truck size={16} color="#6b7280" />
              <Text style={s.driverTitle}>Šoferis</Text>
            </View>
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
                {driver.phone ? <Text style={s.driverPhone}>{driver.phone}</Text> : null}
                {vehicle ? (
                  <Text style={s.driverPlate}>
                    {vehicle.licensePlate}
                    {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ''}
                  </Text>
                ) : null}
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
                  <Phone size={14} color="#fff" />
                  <Text style={s.callBtnText}>Zvanīt</Text>
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
            <View
              style={[
                s.exceptionBanner,
                {
                  backgroundColor: isUnder ? '#fffbeb' : '#eff6ff',
                  borderColor: isUnder ? '#fcd34d' : '#bfdbfe',
                },
              ]}
            >
              <AlertTriangle
                size={16}
                color={isUnder ? '#92400e' : '#1e40af'}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.exceptionBannerTitle, { color: isUnder ? '#92400e' : '#1e40af' }]}>
                  {isUnder ? 'Piegādāts mazāk nekā pasūtīts' : 'Piegādāts vairāk nekā pasūtīts'}
                </Text>
                <Text style={s.exceptionBannerMeta}>
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
              PENDING: { bg: '#f3f4f6', color: '#6b7280' },
              ACCEPTED: { bg: '#eff6ff', color: '#1d4ed8' },
              EN_ROUTE_PICKUP: { bg: '#fffbeb', color: '#92400e' },
              AT_PICKUP: { bg: '#fffbeb', color: '#92400e' },
              LOADED: { bg: '#f0fdf4', color: '#166534' },
              EN_ROUTE_DELIVERY: { bg: '#dcfce7', color: '#15803d' },
              AT_DELIVERY: { bg: '#dcfce7', color: '#15803d' },
              DELIVERED: { bg: '#f0fdf4', color: '#166534' },
              CANCELLED: { bg: '#fef2f2', color: '#b91c1c' },
              FAILED: { bg: '#fef2f2', color: '#b91c1c' },
            };
            return (
              <InfoSection
                icon={<Truck size={14} color="#6b7280" />}
                title={
                  order.transportJobs.length > 1
                    ? `Kravas auto (${order.transportJobs.length})`
                    : 'Kravas auto'
                }
              >
                {order.transportJobs.map((job, i) => {
                  const sc = JOB_STATUS_COLORS[job.status] ?? { bg: '#f3f4f6', color: '#6b7280' };
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
        <InfoSection icon={<Package size={14} color="#6b7280" />} title="Preces">
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
              <View style={[s.totalRow, { paddingVertical: 6 }]}>
                <Text style={[s.totalLabel, { fontWeight: '500', color: '#6b7280', fontSize: 13 }]}>
                  Materiāli
                </Text>
                <Text style={[s.totalValue, { fontSize: 14, color: '#374151' }]}>
                  €{order.subtotal.toFixed(2)}
                </Text>
              </View>
              <View style={[s.totalRow, { paddingVertical: 6 }]}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.totalLabel, { fontWeight: '500', color: '#6b7280', fontSize: 13 }]}
                  >
                    Piegāde
                  </Text>
                  {(() => {
                    const job = order.transportJobs?.[0];
                    const parts: string[] = [];
                    if (job?.distanceKm) parts.push(`${job.distanceKm.toFixed(1)} km`);
                    if (job?.pricePerTonne) parts.push(`€${job.pricePerTonne.toFixed(2)}/t`);
                    else if (job?.rate && job?.distanceKm)
                      parts.push(`€${job.rate.toFixed(2)}/brauciens`);
                    return parts.length > 0 ? (
                      <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        {parts.join(' · ')}
                      </Text>
                    ) : null;
                  })()}
                </View>
                <Text style={[s.totalValue, { fontSize: 14, color: '#374151' }]}>
                  €{order.deliveryFee.toFixed(2)}
                </Text>
              </View>
              {(order.surcharges ?? [])
                .filter((sc) => sc.billable)
                .map((sc) => (
                  <View key={sc.id} style={[s.totalRow, { paddingVertical: 6 }]}>
                    <Text
                      style={[s.totalLabel, { fontWeight: '500', color: '#6b7280', fontSize: 13 }]}
                    >
                      {sc.label}
                    </Text>
                    <Text style={[s.totalValue, { fontSize: 14, color: '#374151' }]}>
                      +€{sc.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              {order.tax > 0 && (
                <View style={[s.totalRow, { paddingVertical: 6 }]}>
                  <Text
                    style={[s.totalLabel, { fontWeight: '500', color: '#6b7280', fontSize: 13 }]}
                  >
                    PVN
                  </Text>
                  <Text style={[s.totalValue, { fontSize: 14, color: '#374151' }]}>
                    €{order.tax.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 6 }} />
            </>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Kopā</Text>
            <Text style={s.totalValue}>
              €{order.total.toFixed(2)} {order.currency}
            </Text>
          </View>
        </InfoSection>

        {/* Delivery details */}
        <InfoSection icon={<MapPin size={14} color="#6b7280" />} title="Piegādes dati">
          <DetailRow label="Adrese" value={order.deliveryAddress} />
          <DetailRow label="Pilsēta" value={order.deliveryCity} />
          <DetailRow
            label="Datums"
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
          <InfoSection icon={<FileDown size={14} color="#6b7280" />} title="Dokumenti">
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
                icon={<Camera size={14} color="#6b7280" />}
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
          <InfoSection icon={<User size={14} color="#6b7280" />} title="Pasūtītājs">
            <DetailRow label="Vārds" value={order.buyer?.name ?? ''} />
            <DetailRow label="Tālrunis" value={order.buyer?.phone} last />
          </InfoSection>
        )}

        {/* Actions */}
        <View style={s.actions}>
          {/* Pay Now — shown when order is PENDING and payment not yet authorised */}
          {canPay && (
            <TouchableOpacity
              style={[s.payNowBtn, payLoading && { opacity: 0.6 }]}
              onPress={handlePay}
              disabled={payLoading}
              activeOpacity={0.85}
            >
              {payLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <CreditCard size={16} color="#fff" />
                  <Text style={s.payNowBtnText}>Maksāt €{order.total.toFixed(2)}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {/* Fallback message shown in Expo Go where native Stripe SDK is unavailable */}
          {!stripe &&
            order.status === 'PENDING' &&
            (!order.paymentStatus || order.paymentStatus === 'PENDING') && (
              <View style={s.stripeUnavailableBanner}>
                <AlertTriangle size={14} color="#d97706" />
                <Text style={s.stripeUnavailableText}>
                  Apmaksa jāveic caur B3Hub mājas lapu vai jaunāko lietotnes versiju
                </Text>
              </View>
            )}
          {/* Invoice payment banner — shown for NET-terms orders */}
          {isInvoiceOrder && order.status === 'PENDING' && (
            <View style={s.invoiceBanner}>
              <FileText size={16} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={s.invoiceBannerTitle}>Rēķina apmaksa</Text>
                <Text style={s.invoiceBannerDesc}>
                  Šis pasūtījums tiks apmaksāts ar rēķinu saskaņā ar jūsu kredīta noteikumiem
                  {order.invoiceDueDate
                    ? `. Apmaksas termiņš: ${new Date(order.invoiceDueDate).toLocaleDateString('lv-LV')}`
                    : '.'}
                </Text>
              </View>
            </View>
          )}
          {/* Chat with driver — shown whenever there's an active transport job */}
          {activeJob && (
            <TouchableOpacity
              style={s.chatDriverBtn}
              onPress={() =>
                router.push({
                  pathname: '/chat/[jobId]',
                  params: {
                    jobId: activeJob.id,
                    title: driver ? `${driver.firstName} ${driver.lastName}` : 'Šoferis',
                  },
                })
              }
              activeOpacity={0.8}
            >
              <MessageCircle size={16} color="#111827" />
              <Text style={s.chatDriverBtnText}>
                {driver ? `Rakstīt ${driver.firstName}` : 'Rakstīt šoferim'}
              </Text>
            </TouchableOpacity>
          )}
          {order.status === 'PENDING' && (
            <View style={s.pendingNote}>
              <FileText size={14} color="#6b7280" />
              <Text style={s.pendingText}>Pasūtījums gaida apstiprinājumu</Text>
            </View>
          )}
          {order.status === 'PENDING' && (
            <TouchableOpacity
              style={s.amendBtn}
              onPress={() => {
                haptics.light();
                openAmend();
              }}
              activeOpacity={0.8}
            >
              <CalendarDays size={14} color="#374151" />
              <Text style={s.amendBtnText}>Labot pasūtījumu</Text>
            </TouchableOpacity>
          )}
          {order.status === 'DELIVERED' && (
            <View style={s.deliveredNote}>
              <CheckCircle size={14} color="#111827" />
              <Text style={s.deliveredText}>Pasūtījums piegādāts!</Text>
            </View>
          )}
          {/* Re-order button */}
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
            <TouchableOpacity
              style={s.reorderBtn}
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
              activeOpacity={0.85}
            >
              <RotateCcw size={16} color="#fff" />
              <Text style={s.reorderBtnText}>Pasūtīt vēlreiz</Text>
            </TouchableOpacity>
          )}

          {order.status === 'DELIVERED' && !hasRated && (
            <TouchableOpacity
              style={s.rateBtn}
              onPress={() => setShowRating(true)}
              activeOpacity={0.85}
            >
              <Star size={16} color="#fff" fill="#fff" />
              <Text style={s.rateBtnText}>{t.rating.rateBtn}</Text>
            </TouchableOpacity>
          )}
          {order.status === 'DELIVERED' && hasRated && (
            <View style={s.alreadyRated}>
              <Star size={14} color="#9ca3af" fill="#9ca3af" />
              <Text style={s.alreadyRatedText}>{t.rating.alreadyRated}</Text>
            </View>
          )}
          {order.status === 'CANCELLED' && (
            <>
              <View style={s.cancelledNote}>
                <XCircle size={14} color="#b91c1c" />
                <Text style={s.cancelledText}>Pasūtījums atcelts</Text>
              </View>
              <TouchableOpacity
                style={s.reorderBtn}
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
                activeOpacity={0.85}
              >
                <RotateCcw size={16} color="#fff" />
                <Text style={s.reorderBtnText}>Pasūtīt no jauna</Text>
              </TouchableOpacity>
            </>
          )}
          {canCancel && (
            <TouchableOpacity
              style={[s.cancelOrderBtn, actionLoading && { opacity: 0.5 }]}
              onPress={handleCancel}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text style={s.cancelOrderBtnText}>Atcelt pasūtījumu</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Report issue — shown on delivered orders that haven't been disputed yet */}
          {order.status === 'DELIVERED' && !disputeFiled && (
            <TouchableOpacity
              style={s.reportIssueBtn}
              onPress={() => {
                haptics.light();
                setShowDispute(true);
              }}
              activeOpacity={0.8}
            >
              <AlertTriangle size={14} color="#6b7280" />
              <Text style={s.reportIssueBtnText}>Ziņot par problēmu</Text>
            </TouchableOpacity>
          )}
          {disputeFiled && (
            <View style={s.disputeFiledNote}>
              <AlertTriangle size={13} color="#d97706" />
              <Text style={s.disputeFiledText}>Sūdzība iesniegta — mēs sazināsimies ar jums</Text>
            </View>
          )}
        </View>
      </ScrollView>

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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1, marginHorizontal: 10 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },

  // ── Horizontal status stepper ──────────────────────────────────
  stepperCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stepperWrap: { position: 'relative', paddingBottom: 4 },
  stepperTrack: {
    position: 'absolute',
    top: 11,
    left: '10%',
    right: '10%',
    height: 2,
    backgroundColor: '#e5e7eb',
  },
  stepperFill: {
    position: 'absolute',
    top: 11,
    left: '10%',
    height: 2,
    backgroundColor: '#00A878',
  },
  stepperDotsRow: { flexDirection: 'row' },
  stepCol: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: '#00A878' },
  stepDotActive: {
    backgroundColor: '#00A878',
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: '#00A878',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  stepDotPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  stepLabel: {
    fontSize: 10,
    color: '#d1d5db',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  stepLabelDone: { color: '#9ca3af' },
  stepLabelActive: {
    color: '#00A878',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  stepHint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
  },

  liveTrackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 2,
  },
  liveTrackLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  liveTrackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
    fontFamily: 'Inter_700Bold',
  },
  liveTrackSub: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 1,
    fontFamily: 'Inter_400Regular',
  },
  driverCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
  },
  driverCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb' },
  driverAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarInitials: { fontSize: 15, fontWeight: '700', color: '#fff' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  driverPhone: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  driverPlate: { fontSize: 11, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: '#374151' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  callSiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    margin: 12,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  callSiteBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actions: { gap: 10 },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4b5563',
  },
  pendingText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  deliveredNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
  },
  deliveredText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  cancelledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
  },
  cancelledText: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  cancelOrderBtn: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  cancelOrderBtnText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
  },
  payNowBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  stripeUnavailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 12,
  },
  stripeUnavailableText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
  invoiceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
  },
  invoiceBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 2 },
  invoiceBannerDesc: { fontSize: 13, color: '#1e40af', lineHeight: 18 },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 100,
    padding: 14,
    justifyContent: 'center',
  },
  rateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // ETA card
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  etaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  etaEmoji: { fontSize: 28 },
  etaLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  etaValue: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 2 },

  // Re-order button
  reorderBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  reorderBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  alreadyRated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
  },
  alreadyRatedText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },

  // Documents section
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  docStatus: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  docDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  docDownloadText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  docPendingBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  docPendingText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },

  trackingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff7f7',
    borderBottomWidth: 1,
    borderBottomColor: '#fee2e2',
  },
  trackingTitle: { fontSize: 12, fontWeight: '700', color: '#374151', flex: 1 },

  // Order timeline
  tlRow: { flexDirection: 'row', minHeight: 44 },
  tlLeft: { alignItems: 'center', width: 28, marginRight: 12 },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  tlDotDone: { backgroundColor: '#111827', borderColor: '#111827' },
  tlDotActive: {
    backgroundColor: '#fff',
    borderColor: '#111827',
    borderWidth: 3,
  },
  tlDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  tlLine: { flex: 1, width: 2, backgroundColor: '#e5e7eb', marginVertical: 2 },
  tlLineDone: { backgroundColor: '#111827' },
  tlContent: { flex: 1, paddingTop: 2, paddingBottom: 10 },
  tlLabel: { fontSize: 14, fontWeight: '500', color: '#9ca3af' },
  tlLabelDone: { color: '#374151', fontWeight: '600' },
  tlLabelActive: { color: '#111827', fontWeight: '700' },
  tlHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  chatDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chatDriverBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  // Delivery proof section
  proofTime: { fontSize: 11, color: '#9ca3af', marginLeft: 'auto' },
  proofPhotoRow: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10, gap: 10 },
  proofPhoto: {
    width: 140,
    height: 140,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  proofNoPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  proofNoPhotoText: { fontSize: 13, color: '#6b7280' },

  // Weighing slip photo
  weighingSlipPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    marginTop: 10,
  },
  weighingWeight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginLeft: 'auto',
  },

  // Amendment button
  amendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
  },
  amendBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // Amendment sheet fields
  amendField: { gap: 6 },
  amendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amendInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  amendWindowRow: { flexDirection: 'row', gap: 8 },
  amendWindowBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  amendWindowBtnActive: { backgroundColor: '#111827' },
  amendWindowBtnText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  amendWindowBtnTextActive: { color: '#fff' },
  amendSubmitBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  amendSubmitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Report issue button
  reportIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  reportIssueBtnText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Dispute filed confirmation
  disputeFiledNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 4,
  },
  disputeFiledText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },

  // Dispute bottom sheet
  disputeReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  disputeReasonRowActive: {
    borderColor: '#111827',
    backgroundColor: '#f9fafb',
  },
  disputeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeRadioActive: {
    borderColor: '#111827',
  },
  disputeRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  disputeReasonText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  disputeReasonTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  disputeDetailsInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    height: 80,
    textAlignVertical: 'top',
  },
  disputeSubmitBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeSubmitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Exception banner ──────────────────────────────────────────
  exceptionBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 14,
  },
  exceptionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  exceptionBannerMeta: {
    fontSize: 13,
    color: '#b45309',
    fontWeight: '500',
  },
  exceptionBannerNote: {
    fontSize: 13,
    color: '#78350f',
    marginTop: 2,
  },
});
