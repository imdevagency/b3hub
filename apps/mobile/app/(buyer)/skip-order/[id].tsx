import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Image } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Phone,
  Package,
  Trash2,
  ArrowLeft,
  Star,
  XCircle,
  RotateCcw,
  Truck,
} from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { RatingModal } from '@/components/ui/RatingModal';
import { useToast } from '@/components/ui/Toast';
import { BaseMap } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useSkipOrder } from '@/lib/use-skip-order';
import { SIZE_LABEL } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';

let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

// ── Constants ──────────────────────────────────────────────────

const SKIP_STEPS = [
  { key: 'PENDING', label: 'Saņemts' },
  { key: 'CONFIRMED', label: 'Apstiprināts' },
  { key: 'DELIVERED', label: 'Piegādāts' },
  { key: 'COLLECTED', label: 'Savākts' },
] as const;

const STATUS_TO_STEP: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  DELIVERED: 2,
  COLLECTED: 3,
  COMPLETED: 3,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida apstiprinājumu',
  CONFIRMED: 'Pārvadātājs piešķirts',
  DELIVERED: 'Konteiners piegādāts',
  COLLECTED: 'Konteiners savākts',
  COMPLETED: 'Pasūtījums pabeigts',
  CANCELLED: 'Pasūtījums atcelts',
};

const WASTE_LABEL: Record<string, string> = {
  MIXED: 'Jaukti atkritumi',
  GREEN_GARDEN: 'Zaļie atkritumi',
  CONCRETE_RUBBLE: 'Gruži',
  WOOD: 'Koks',
  METAL_SCRAP: 'Metāls',
  ELECTRONICS_WEEE: 'Elektronika',
};

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'DELIVERED']);

// ── Main Screen ────────────────────────────────────────────────

export default function SkipOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { order, setOrder, loading, error, reload } = useSkipOrder(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [, setMapReady] = useState(false);
  const insets = useSafeAreaInsets();

  // Bottom sheet
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [320 + insets.bottom, 520, '92%'], [insets.bottom]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const handleSheetChange = useCallback((index: number) => {
    setSheetIndex(index);
    haptics.selection();
  }, []);

  const [showRating, setShowRating] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Auto-refresh while active
  useEffect(() => {
    if (!order || !ACTIVE_STATUSES.has(order.status)) return;
    const interval = setInterval(reload, 15_000);
    return () => clearInterval(interval);
  }, [order?.status, reload]);

  // Fit map to delivery pin once ready
  useEffect(() => {
    if (!cameraRef.current || !order?.lat || !order?.lng) return;
    cameraRef.current.setCamera({
      centerCoordinate: [order.lng, order.lat],
      zoomLevel: 14,
      animationDuration: 600,
    });
  }, [order?.lat, order?.lng]);

  // Load review status
  useEffect(() => {
    if (order && token && (order.status === 'COLLECTED' || order.status === 'COMPLETED')) {
      api.reviews
        .status({ skipOrderId: order.id }, token)
        .then(({ reviewed }) => setAlreadyRated(reviewed))
        .catch((err) => console.warn('Failed to load review status:', err));
    }
  }, [order?.id, order?.status, token]);

  useEffect(() => {
    if (error) {
      toast.error('Neizdevās ielādēt pasūtījumu.');
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/orders');
    }
  }, [error, router, toast]);

  const handleCancel = () => {
    if (!order || !token) return;
    haptics.heavy();
    const cancelMsg =
      order.status === 'CONFIRMED'
        ? 'Konteiners jau ir piešķirts pārvadātājam. Atcelšana pēc apstiprināšanas var radīt papildu izmaksas.'
        : 'Pasūtījums vēl nav apstiprināts. Atcelšana ir bezmaksas.';
    Alert.alert('Atcelt pasūtījumu?', cancelMsg, [
      { text: 'Nē', style: 'cancel' },
      {
        text: 'Atcelt',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const updated = await api.skipHire.cancel(order.id, token);
            setOrder(updated);
            haptics.success();
          } catch (err: unknown) {
            haptics.error();
            toast.error(err instanceof Error ? err.message : 'Neizdevās atcelt pasūtījumu');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Skip noma" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Skip noma" />
        <EmptyState icon={<Package size={32} color="#9ca3af" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const hasCoords = order.lat != null && order.lng != null;
  const carrier = order.carrier;
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canRate = (order.status === 'COLLECTED' || order.status === 'COMPLETED') && !alreadyRated;

  const currentStepIdx = STATUS_TO_STEP[order.status] ?? -1;

  // Hero line
  const heroPrimary = (() => {
    if (order.status === 'COLLECTED' || order.status === 'COMPLETED') return 'Pabeigts';
    if (order.status === 'CANCELLED') return 'Atcelts';
    if (order.status === 'DELIVERED') return 'Piegādāts';
    if (order.status === 'CONFIRMED') return formatDate(order.deliveryDate);
    return 'Gaida apstiprinājumu';
  })();
  const heroSubtitle = STATUS_LABEL[order.status] ?? '';

  // Contextual CTA
  type Cta = {
    label: string;
    onPress: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
    variant: 'primary' | 'success' | 'danger';
  };
  const primaryCta: Cta | null = (() => {
    if (canRate) {
      return {
        label: 'Novērtēt pakalpojumu',
        onPress: () => setShowRating(true),
        icon: <Star size={18} color="#fff" fill="#fff" style={{ marginRight: 8 }} />,
        variant: 'success',
      };
    }
    if (
      order.status === 'COLLECTED' ||
      order.status === 'COMPLETED' ||
      order.status === 'CANCELLED'
    ) {
      return {
        label: 'Pasūtīt vēlreiz',
        onPress: () => router.push('/skip-hire' as any),
        icon: <RotateCcw size={18} color="#fff" style={{ marginRight: 8 }} />,
        variant: 'primary',
      };
    }
    if (carrier?.phone) {
      return {
        label: 'Zvanīt pārvadātājam',
        onPress: () => Linking.openURL(`tel:${carrier.phone}`).catch(() => null),
        icon: <Phone size={18} color="#fff" style={{ marginRight: 8 }} />,
        variant: 'primary',
      };
    }
    if (canCancel) {
      return {
        label: cancelling ? 'Atceļ…' : 'Atcelt pasūtījumu',
        onPress: handleCancel,
        icon: <XCircle size={18} color="#fff" style={{ marginRight: 8 }} />,
        disabled: cancelling,
        variant: 'danger',
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
          center={hasCoords ? [order.lng!, order.lat!] : [24.1052, 56.9496]}
          zoom={14}
          style={{ flex: 1 }}
          rotateEnabled={false}
          pitchEnabled={false}
          mapPadding={{ top: 80, right: 40, bottom: 260, left: 40 }}
          onMapReady={() => setMapReady(true)}
        >
          {hasCoords && Marker && (
            <Marker
              coordinate={{ latitude: order.lat!, longitude: order.lng! }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinDelivery}>
                <Trash2 size={14} color="#fff" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>
      </View>

      {/* ── Floating back button ──────────────────────────────── */}
      <View style={[styles.floatingHeader, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.floatingBackBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom Sheet (peek / half / full) ─────────────────── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        topInset={insets.top}
        enableDynamicSizing={false}
        onChange={handleSheetChange}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: 48 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}
          <Text style={styles.heroEta}>{heroPrimary}</Text>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>

          {/* Progress dots */}
          {order.status !== 'CANCELLED' && (
            <View style={styles.stepsRow}>
              {SKIP_STEPS.map((s, i) => {
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

          {/* Carrier row OR order summary */}
          {carrier ? (
            <View style={styles.driverRowCompact}>
              <View style={styles.driverAvatarFallbackCompact}>
                <Truck size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.driverNameCompact} numberOfLines={1}>
                  {carrier.name}
                </Text>
                {carrier.rating != null && (
                  <View style={styles.driverPlatePill}>
                    <Text style={styles.driverPlatePillText}>★ {carrier.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              {carrier.phone && (
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnPrimary]}
                  onPress={() => Linking.openURL(`tel:${carrier.phone}`).catch(() => null)}
                >
                  <Phone size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.waitingRow}>
              <View style={styles.waitingItem}>
                <Package size={14} color="#6b7280" />
                <Text style={styles.waitingItemText}>
                  {SIZE_LABEL[order.skipSize] ?? order.skipSize} ·{' '}
                  {WASTE_LABEL[order.wasteCategory] ?? order.wasteCategory}
                </Text>
              </View>
              <View style={styles.waitingItem}>
                <MapPin size={14} color="#6b7280" />
                <Text style={styles.waitingItemText} numberOfLines={1}>
                  {order.location}
                </Text>
              </View>
            </View>
          )}

          {/* Primary contextual CTA */}
          {primaryCta && (
            <TouchableOpacity
              style={[
                styles.primaryCta,
                primaryCta.variant === 'success' && styles.primaryCtaSuccess,
                primaryCta.variant === 'danger' && styles.primaryCtaDanger,
                primaryCta.disabled && { opacity: 0.6 },
              ]}
              onPress={() => {
                haptics.medium();
                primaryCta.onPress();
              }}
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
            <DetailRow label="Piegādes vieta" value={order.location} />
            <DetailRow label="Piegādes datums" value={formatDate(order.deliveryDate)} />
            {order.deliveryWindow && order.deliveryWindow !== 'ANY' && (
              <DetailRow
                label="Piegādes laiks"
                value={order.deliveryWindow === 'AM' ? 'Rīts (8–12)' : 'Diena (12–17)'}
              />
            )}
            <DetailRow
              label="Konteinera izmērs"
              value={SIZE_LABEL[order.skipSize] ?? order.skipSize}
            />
            <DetailRow
              label="Atkritumu veids"
              value={WASTE_LABEL[order.wasteCategory] ?? order.wasteCategory}
            />
            {order.notes && <DetailRow label="Piezīmes" value={order.notes} />}
            {(order.contactName || order.contactPhone || order.contactEmail) && (
              <>
                <DetailRow label="Kontaktpersona" value={order.contactName} />
                <DetailRow label="Telefons" value={order.contactPhone} />
                <DetailRow label="E-pasts" value={order.contactEmail} />
              </>
            )}
            <View style={styles.detailsTotalRow}>
              <Text style={styles.detailsTotalLabel}>Kopā</Text>
              <Text style={styles.detailsTotalValue}>€{order.price.toFixed(2)}</Text>
            </View>
          </View>

          {/* Order number card */}
          <View style={styles.trackingBlackCard}>
            <View>
              <Text style={styles.trackingBlackLabel}>Pasūtījuma numurs</Text>
              <Text style={styles.trackingBlackNumber}>#{order.orderNumber}</Text>
            </View>
          </View>

          {/* Unloading-point photo */}
          {order.unloadingPointPhotoUrl && (
            <View style={styles.slipCard}>
              <Text style={styles.slipTitle}>Izkraušanas vietas foto</Text>
              <Image
                source={{ uri: order.unloadingPointPhotoUrl }}
                style={styles.slipThumb}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Secondary cancel action (if not already the primary) */}
          {canCancel && primaryCta?.variant !== 'danger' && (
            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                styles.secondaryActionBtnDanger,
                { marginTop: 12 },
              ]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={styles.secondaryActionBtnDangerText}>
                {cancelling ? 'Atceļ…' : 'Atcelt pasūtījumu'}
              </Text>
            </TouchableOpacity>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Rating modal */}
      {showRating && token && (
        <RatingModal
          visible={showRating}
          onClose={() => setShowRating(false)}
          onSuccess={() => {
            setShowRating(false);
            setAlreadyRated(true);
            if (id) {
              api.skipHire
                .getById(id, token)
                .then(setOrder)
                .catch((err) => console.warn('Failed to refresh skip order:', err));
            }
          }}
          token={token}
          skipOrderId={order.id}
        />
      )}
    </View>
  );
}

// ── Local detail row ──
function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
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

  // ── Progress dots ──
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

  // ── Carrier row (compact) ──
  driverRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  driverAvatarFallbackCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    letterSpacing: 0.3,
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

  // ── Waiting (no carrier yet) ──
  waitingRow: { marginTop: 16, gap: 8 },
  waitingItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waitingItemText: { fontSize: 15, color: '#374151', fontWeight: '500' },

  // ── Primary CTA ──
  primaryCta: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 4,
  },
  primaryCtaSuccess: { backgroundColor: '#16a34a' },
  primaryCtaDanger: { backgroundColor: '#ef4444' },
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

  // ── Photo slip ──
  slipCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  slipTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 10 },
  slipThumb: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
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
  secondaryActionBtnDangerText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
});
