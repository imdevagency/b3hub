import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, Image, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Phone,
  Package,
  Truck,
  FileText,
  CheckCircle,
  ArrowLeft,
  MessageCircle,
  CreditCard,
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
import { useOrderDetail } from '@/lib/use-order-detail';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { RatingModal } from '@/components/ui/RatingModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionResultSheet } from '@/components/ui/ActionResultSheet';
import { DisputeSheet } from './dispute-sheet';
import { AmendSheet } from './amend-sheet';
import { useToast } from '@/components/ui/Toast';
import { UNIT_SHORT, MAT_STATUS } from '@/lib/materials';
import { colors } from '@/lib/theme';

// Guard: Stripe React Native — requires native build (not available in Expo Go)
let useStripe: (() => { initPaymentSheet: Function; presentPaymentSheet: Function }) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  useStripe = require('@stripe/stripe-react-native').useStripe;
} catch {
  /* Expo Go fallback */
}

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
};

const JOB_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'Šoferis pieņēma pasūtījumu',
  EN_ROUTE_PICKUP: 'Šoferis dodas uz kraušanu',
  AT_PICKUP: 'Šoferis ir pie kraušanas vietas',
  LOADED: 'Kravu iekrauj',
  EN_ROUTE_DELIVERY: 'Šoferis dodas uz jums',
  AT_DELIVERY: 'Šoferis ir uz vietas',
};

// ── Main Screen ────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, setOrder, loading, alreadyRated, reload: load } = useOrderDetail(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [, setMapReady] = useState(false);
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ── Bottom sheet ──
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['22%', '55%', '92%'], []);
  const [sheetIndex, setSheetIndex] = useState(0);
  const handleSheetChange = useCallback((index: number) => {
    setSheetIndex(index);
    haptics.selection();
  }, []);

  const onRefresh = () => {
    load();
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

  // ── Route hooks — must be before early returns (Rules of Hooks) ──────────
  const routeOrigin = useMemo(() => {
    if (driverLocationOnMap) return { lat: driverLocationOnMap.lat, lng: driverLocationOnMap.lng };
    return null;
  }, [driverLocationOnMap]);
  const routeDestination = useMemo(() => {
    if (order?.deliveryLat != null && order?.deliveryLng != null) {
      return { lat: order.deliveryLat as number, lng: order.deliveryLng as number };
    }
    return null;
  }, [order?.deliveryLat, order?.deliveryLng]);
  const { route } = useRoute(routeOrigin, routeDestination);

  // Fit the map camera to include driver + delivery whenever either updates
  React.useEffect(() => {
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
  const canManageOrders = !user?.companyRole || (user?.permManageOrders ?? false);
  const canCancel = ['PENDING', 'CONFIRMED'].includes(order.status) && canManageOrders;
  const canPay =
    !paymentProcessing &&
    order.status === 'PENDING' &&
    (!order.paymentStatus || order.paymentStatus === 'PENDING') &&
    order.paymentMethod !== 'INVOICE' &&
    !!stripe;

  const currentStepIdx = activeJob ? (JOB_STATUS_TO_STEP[activeJob.status] ?? 0) : -1;
  const jobStatusLabel = activeJob ? (JOB_STATUS_LABEL[activeJob.status] ?? 'Piegādē') : null;

  // Hero line shown at the top of the sheet
  const heroPrimary = (() => {
    if (order.status === 'DELIVERED') return 'Piegādāts';
    if (order.status === 'COMPLETED') return 'Pabeigts';
    if (order.status === 'CANCELLED') return 'Atcelts';
    if (etaMin != null) return `${etaMin} min`;
    if (driver) return 'Ceļā';
    if (order.status === 'PENDING') return 'Gaida apstiprināšanu';
    return 'Meklē šoferi…';
  })();
  const heroSubtitle =
    jobStatusLabel ?? (order.status === 'DELIVERED' ? 'Apstipriniet saņemšanu' : 'Gaidām šoferi');

  // Single contextual CTA surfaced in the peek view
  type Cta = {
    label: string;
    onPress: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
    variant: 'primary' | 'success';
  };
  const primaryCta: Cta | null = (() => {
    if (order.status === 'DELIVERED') {
      return {
        label: 'Apstiprināt saņemšanu',
        onPress: handleConfirmReceipt,
        icon: <CheckCircle size={18} color="#fff" style={{ marginRight: 8 }} />,
        disabled: actionLoading || disputeFiled,
        variant: 'success',
      };
    }
    if (canPay) {
      return {
        label: `Maksāt €${order.total.toFixed(2)}`,
        onPress: handlePay,
        icon: <CreditCard size={18} color="#fff" style={{ marginRight: 8 }} />,
        disabled: payLoading,
        variant: 'primary',
      };
    }
    if (driver && driver.phone) {
      return {
        label: 'Zvanīt šoferim',
        onPress: () => Linking.openURL(`tel:${driver.phone}`).catch(() => null),
        icon: <Phone size={18} color="#fff" style={{ marginRight: 8 }} />,
        variant: 'primary',
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
              : order.deliveryLng && order.deliveryLat
                ? [order.deliveryLng, order.deliveryLat]
                : [24.1052, 56.9496]
          }
          zoom={13}
          style={{ flex: 1 }}
          rotateEnabled={false}
          pitchEnabled={false}
          mapPadding={{ top: 80, right: 40, bottom: 260, left: 40 }}
          onMapReady={() => setMapReady(true)}
        >
          {/* Route polyline */}
          {route?.coords && route.coords.length > 1 && (
            <RouteLayer id="order-route" coordinates={route.coords} color="#111827" width={4} />
          )}
          {/* Delivery pin */}
          {order.deliveryLat != null && order.deliveryLng != null && Marker && (
            <Marker
              coordinate={{ latitude: order.deliveryLat, longitude: order.deliveryLng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinDelivery}>
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
              <View style={styles.pinDriver}>
                <Truck size={13} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>
      </View>

      {/* ── Floating back button ──────────────────────────────── */}
      <View style={styles.floatingHeader} pointerEvents="box-none">
        <TouchableOpacity style={styles.floatingBackBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom Sheet (peek / half / full) ─────────────────── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChange}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO — big ETA, supporting status line */}
          <Text style={styles.heroEta}>{heroPrimary}</Text>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>

          {/* Progress dots (only when a driver is active) */}
          {driver && (
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
                      jobId: activeJob!.id,
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
              {order.items.map((item, idx) => (
                <View key={idx} style={styles.waitingItem}>
                  <Package size={14} color="#6b7280" />
                  <Text style={styles.waitingItemText}>
                    {item.quantity} {UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] ?? item.unit}{' '}
                    · {item.material.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Primary contextual CTA */}
          {primaryCta && (
            <TouchableOpacity
              style={[
                styles.primaryCta,
                primaryCta.variant === 'success' && styles.primaryCtaSuccess,
                primaryCta.disabled && { opacity: 0.6 },
              ]}
              onPress={primaryCta.onPress}
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
            <DetailRow
              label="Piegādes adrese"
              value={`${order.deliveryAddress}\n${order.deliveryCity}`}
            />
            <DetailRow label="Saņēmējs" value={order.siteContactName || user?.firstName || '—'} />
            <DetailRow label="Sazināties" value={order.siteContactPhone || user?.phone || '—'} />
            <DetailRow
              label="Piegādes laiks"
              value={`${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('lv-LV') : '—'}${order.deliveryWindow ? ` (${order.deliveryWindow})` : ''}`}
            />
            <DetailRow label="Piezīmes šoferim" value={order.notes || '—'} />
            <DetailRow
              label="Maksājuma veids"
              value={order.paymentMethod === 'INVOICE' ? 'Rēķins' : 'Karte'}
            />
            <View style={styles.detailsTotalRow}>
              <Text style={styles.detailsTotalLabel}>Pasūtījuma summa</Text>
              <Text style={styles.detailsTotalValue}>€{order.total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Order number card */}
          <View style={styles.trackingBlackCard}>
            <View>
              <Text style={styles.trackingBlackLabel}>Pasūtījuma numurs</Text>
              <Text style={styles.trackingBlackNumber}>#{order.orderNumber}</Text>
            </View>
            <TouchableOpacity style={styles.trackingBlackDocBtn}>
              <FileText size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Secondary actions */}
          {canCancel && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={[{ flex: 1 }, styles.secondaryActionBtn, styles.secondaryActionBtnDanger]}
                onPress={handleCancel}
                disabled={actionLoading}
              >
                <Text style={styles.secondaryActionBtnDangerText}>Atcelt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1 }, styles.secondaryActionBtn]}
                onPress={() => setShowAmend(true)}
              >
                <Text style={styles.secondaryActionBtnText}>Labot</Text>
              </TouchableOpacity>
            </View>
          )}

          {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
            <TouchableOpacity
              style={[styles.secondaryActionBtn, { marginTop: 12 }]}
              onPress={() => setShowDispute(true)}
            >
              <Text style={styles.secondaryActionBtnText}>Ziņot par problēmu</Text>
            </TouchableOpacity>
          )}
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

// ── Local detail row (kept inline to avoid pulling the heavy InfoSection UI) ──
function DetailRow({ label, value }: { label: string; value: string }) {
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
  pinDelivery: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
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
    top: 60,
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
    paddingBottom: 48,
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

  // ── Progress dots (4 steps) ──
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
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryCtaSuccess: { backgroundColor: '#16a34a' },
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

  // ── Black tracking card (order number) ──
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
  trackingBlackDocBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
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
