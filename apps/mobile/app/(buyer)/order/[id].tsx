import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  RefreshControl,
  StyleSheet,
  Dimensions,
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
  ArrowLeft,
  XCircle,
  Star,
  FileDown,
  MessageCircle,
  User,
  Camera,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  Scale,
} from 'lucide-react-native';
import { BaseMap, RouteLayer } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_H = Math.round(SCREEN_H * 0.28);
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
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { DetailRow } from '@/components/ui/DetailRow';
import { ActionResultSheet } from '@/components/ui/ActionResultSheet';
import { DisputeSheet } from './dispute-sheet';
import { AmendSheet } from './amend-sheet';
import { useToast } from '@/components/ui/Toast';
import { UNIT_SHORT, MAT_STATUS } from '@/lib/materials';
import { formatDate, formatDateTime } from '@/lib/format';
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
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, setOrder, loading, alreadyRated, documents, reload: load } = useOrderDetail(id);
  const [refreshing, setRefreshing] = useState(false);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

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
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  React.useEffect(() => {
    if (!token || !id || !UUID_RE.test(id) || !order) return;
    api
      .listDisputes(token, id)
      .then((disputes) => {
        if (disputes.length > 0) setDisputeFiled(true);
      })
      .catch((err) => console.warn('Failed to load disputes:', err));
  }, [token, id, order?.id]);

  // Amendment sheet state
  const [showAmend, setShowAmend] = useState(false);
  // Local flag so the UI updates immediately after rating without a reload
  const [ratedLocally, setRatedLocally] = useState(false);
  const hasRated = alreadyRated || ratedLocally;
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = React.useMemo(() => ['25%', '50%', '90%'], []);

  // Update ETA from live driver location broadcasts
  React.useEffect(() => {
    if (!liveLocation) return;
    if (liveLocation.estimatedArrivalMin != null) setEtaMin(liveLocation.estimatedArrivalMin);
    const { lat, lng } = liveLocation;
    setDriverLocationOnMap({ lat, lng });
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: 13,
      animationDuration: 800,
    });
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
  // Company members without permManageOrders cannot cancel or amend orders.
  // Solo users (no companyRole) always have full access.
  const canManageOrders = !user?.companyRole || (user?.permManageOrders ?? false);
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status) && canManageOrders;
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
    <View style={{ flex: 1, backgroundColor: '#f4f5f7' }}>
      {/* ── Background Map ────────────────────────────────────── */}
      <View style={[StyleSheet.absoluteFillObject]}>
        <BaseMap
          cameraRef={cameraRef}
          center={
            driverLocationOnMap
              ? [driverLocationOnMap.lng, driverLocationOnMap.lat]
              : order.deliveryLng && order.deliveryLat
                ? [order.deliveryLng, order.deliveryLat]
                : [24.1052, 56.9496]
          }
          zoom={13}
          style={{ flex: 1 }}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => setMapReady(true)}
        >
          {/* Delivery pin */}
          {order.deliveryLat != null && order.deliveryLng != null && Marker && (
            <Marker
              coordinate={{ latitude: order.deliveryLat, longitude: order.deliveryLng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={s.pinDelivery}>
                <MapPin size={14} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
          {/* Live driver marker */}
          {driverLocationOnMap && Marker && (
            <Marker
              coordinate={{ latitude: driverLocationOnMap.lat, longitude: driverLocationOnMap.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={s.pinDriver}>
                <Truck size={13} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>
      </View>

      {/* ── Floating Header ────────────────────────────────────── */}
      <View style={s.floatingHeader}>
        <TouchableOpacity style={s.floatingBackBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={s.floatingTitlePill}>
          <Text style={s.floatingOrderNumber}>#{order.orderNumber}</Text>
          <StatusPill label={st.label} bg="#f3f4f6" color="#111827" size="sm" />
        </View>
      </View>

      {/* ── ETA Floating Chip (if active job) ──────────────────── */}
      {activeJob && (
        <View style={s.floatingEta}>
          <View style={s.mapEtaDot} />
          <Text style={s.mapEtaText}>
            {etaMin != null ? `Pienāks ~${etaMin} min` : 'Šoferis ir ceļā'}
          </Text>
        </View>
      )}

      {/* ── Bottom Sheet ───────────────────────────────────────── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{ borderRadius: 24 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        >
          {/* Driver Card */}
          {driver && (
            <View style={s.minimalDriverCard}>
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
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.driverName}>
                  {driver.firstName} {driver.lastName}
                </Text>
                {vehicle ? (
                  <Text
                    style={[
                      s.driverPlate,
                      {
                        backgroundColor: '#E5E7EB',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        overflow: 'hidden',
                        alignSelf: 'flex-start',
                        marginTop: 4,
                        fontSize: 12,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                        color: '#111827',
                      },
                    ]}
                  >
                    {vehicle.licensePlate}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {driver.phone && (
                  <TouchableOpacity
                    style={s.callBtnMinimal}
                    onPress={() => Linking.openURL(`tel:${driver.phone}`).catch(() => null)}
                  >
                    <Phone size={18} color="#111827" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={s.callBtnMinimal}
                  onPress={() =>
                    router.push({
                      pathname: '/chat/[jobId]',
                      params: {
                        jobId: activeJob.id,
                        title: `${driver.firstName} ${driver.lastName}`,
                      },
                    })
                  }
                >
                  <MessageCircle size={18} color="#111827" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Surcharges & Actions (Swipe up to see more) */}
          <View style={{ marginTop: 24 }}>
            {canPay && (
              <TouchableOpacity
                style={[s.primaryActionBtn, payLoading && { opacity: 0.6 }, { marginBottom: 16 }]}
                onPress={handlePay}
                disabled={payLoading}
              >
                <CreditCard size={18} color="#fff" />
                <Text style={s.primaryActionBtnText}>Maksāt €{order.total.toFixed(2)}</Text>
              </TouchableOpacity>
            )}

            {order.status === 'DELIVERED' && (
              <TouchableOpacity
                style={[
                  s.primaryActionBtn,
                  { backgroundColor: disputeFiled ? '#9ca3af' : '#16a34a', marginBottom: 16 },
                ]}
                onPress={handleConfirmReceipt}
                disabled={actionLoading || disputeFiled}
              >
                <CheckCircle size={18} color="#fff" />
                <Text style={s.primaryActionBtnText}>Apstiprināt saņemšanu</Text>
              </TouchableOpacity>
            )}

            <InfoSection icon={<Package size={14} color="#111827" />} title="Preces">
              {order.items.map((item, idx) => (
                <DetailRow
                  key={idx}
                  label={item.material.name}
                  value={`${item.quantity} ${UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] ?? item.unit}`}
                />
              ))}
              <View
                style={[
                  s.totalRowFinal,
                  { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
                ]}
              >
                <Text style={s.totalLabelFinal}>Kopā</Text>
                <Text style={s.totalValueFinal}>€{order.total.toFixed(2)}</Text>
              </View>
            </InfoSection>

            <InfoSection icon={<MapPin size={14} color="#111827" />} title="Piegāde">
              <DetailRow
                label="Adrese"
                value={`${order.deliveryAddress}\n${order.deliveryCity}`}
                last
              />
            </InfoSection>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {canCancel && (
                <TouchableOpacity
                  style={[{ flex: 1 }, s.secondaryActionBtn, s.secondaryActionBtnDanger]}
                  onPress={handleCancel}
                  disabled={actionLoading}
                >
                  <Text style={s.secondaryActionBtnDangerText}>Atcelt</Text>
                </TouchableOpacity>
              )}
              {canManageOrders && canCancel && (
                <TouchableOpacity
                  style={[{ flex: 1 }, s.secondaryActionBtn]}
                  onPress={() => setShowAmend(true)}
                >
                  <Text style={s.secondaryActionBtnText}>Labot</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Sheets & Modals */}
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
      {order && token && (
        <DisputeSheet
          visible={showDispute}
          onClose={() => setShowDispute(false)}
          order={order}
          token={token}
          onFiled={() => {
            setDisputeFiled(true);
            setDisputeResultVisible(true);
          }}
        />
      )}
      {order && token && (
        <AmendSheet
          visible={showAmend}
          onClose={() => setShowAmend(false)}
          order={order}
          token={token}
          onSuccess={load}
        />
      )}
      <ActionResultSheet
        visible={cancelResultVisible}
        onClose={() => setCancelResultVisible(false)}
        variant="cancelled"
        title="Pasūtījums atcelts"
        subtitle="Jūsu pasūtījums ir atcelts."
        primaryLabel="Pasūtīt no jauna"
        onPrimary={() => {
          setCancelResultVisible(false);
          router.replace({ pathname: '/material-order' });
        }}
        secondaryLabel="Mani pasūtījumi"
        onSecondary={() => {
          setCancelResultVisible(false);
          router.replace('/(buyer)/orders');
        }}
      />
      <ActionResultSheet
        visible={disputeResultVisible}
        onClose={() => setDisputeResultVisible(false)}
        variant="info"
        title="Sūdzība iesniegta"
        subtitle="Mēs izskatīsim jūsu paziņojumu."
        primaryLabel="Labi"
        onPrimary={() => setDisputeResultVisible(false)}
      />
    </View>
  );
}
