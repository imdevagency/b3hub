import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Package,
  Trash2,
  Phone,
  Star,
  Truck,
  CheckCircle2,
  ChevronLeft, MessageCircle,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BaseMap, PinLayer } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

import { haptics } from '@/lib/haptics';
import { useSkipOrder } from '@/lib/use-skip-order';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';

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

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'DELIVERED']);

export default function SkipOrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { order, loading, reload } = useSkipOrder(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!order || !ACTIVE_STATUSES.has(order.status)) return;
    const interval = setInterval(() => reload(true), 15_000);
    return () => clearInterval(interval);
  }, [order?.status, reload]);

  useEffect(() => {
    if (!cameraRef.current || order?.lat == null || order?.lng == null) return;
    // zoom out a bit to show more context and top card gracefully
    cameraRef.current.setCamera({
      centerCoordinate: [order.lng, order.lat],
      zoomLevel: 13.5,
      animationDuration: 800,
    });
  }, [order?.lat, order?.lng]);

  if (loading) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Live Tracking" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Live Tracking" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const hasCoords = order.lat != null && order.lng != null;
  const carrier = order.carrier;
  const currentStepIdx = STATUS_TO_STEP[order.status] ?? -1;
  const isTerminal =
    order.status === 'COLLECTED' || order.status === 'COMPLETED' || order.status === 'CANCELLED';

  const orderSubDesc = order.wasteCategory.replace(/_/g, ' ').toLowerCase();

  return (
    <ScreenContainer bg="#FFFFFF" standalone topInset={0}>
      <View style={styles.mapWrapper}>
        <BaseMap
          cameraRef={cameraRef}
          center={hasCoords ? [order.lng!, order.lat!] : [24.1052, 56.9496]}
          zoom={13.5}
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
          mapPadding={{ top: 120, right: 16, bottom: 360, left: 16 }}
        >
          {hasCoords && (
            <PinLayer
              id="delivery"
              type="elegant-delivery"
              coordinate={{ lat: order.lat!, lng: order.lng! }}
            />
          )}
        </BaseMap>

        {/* Minimal Bolt-style Top Pill */}
        <View
          style={[
            styles.topPill,
            { top: Math.max(insets.top, 24) + 12 },
          ]}
        >
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(buyer)/orders'))}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.skipSize} konteiners
          </Text>
          
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => {
              haptics.light();
              router.push('/(shared)/help' as never);
            }}
          >
             <MessageCircle size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Uber/Bolt-style Bottom Sheet (Docked to bottom edge) */}
        <View style={[styles.bottomSheetWrapper, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.bottomSheetContent}>
            {/* Courier Header Row */}
            <View style={styles.courierHeader}>
              <View style={styles.courierAvatarFallback}>
                <Truck size={24} color="#6B7280" strokeWidth={1.5} />
              </View>
              <View style={styles.courierInfo}>
                <Text style={styles.courierName} numberOfLines={1}>
                  {carrier
                    ? carrier.name
                    : isTerminal
                      ? order.status === 'CANCELLED'
                        ? 'Pasūtījums atcelts'
                        : 'Pasūtījums pabeigts'
                      : 'Meklējam pārvadātāju...'}
                </Text>
                <Text style={styles.courierRole}>
                  {carrier ? 'Konteineru Serviss' : isTerminal ? '' : 'Pieprasījums nosūtīts'}
                </Text>
              </View>
              {carrier?.phone && (
                <View style={styles.driverActions}>
                  <TouchableOpacity
                    style={styles.courierActionBtn}
                    onPress={() => {
                      haptics.medium();
                      Linking.openURL(`tel:${carrier.phone}`).catch(() => null);
                    }}
                  >
                    <Phone size={20} color="#FFFFFF" fill="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Terminal state card or active timeline */}
            {isTerminal ? (
              <View style={styles.terminalSection}>
                <View
                  style={[
                    styles.terminalIconWrap,
                    { backgroundColor: order.status === 'CANCELLED' ? '#FEF2F2' : '#ECFDF5' },
                  ]}
                >
                  {order.status === 'CANCELLED' ? (
                    <X size={26} color="#DC2626" strokeWidth={2.5} />
                  ) : (
                    <CheckCircle2 size={26} color="#059669" strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.terminalTitle}>
                    {order.status === 'CANCELLED'
                      ? 'Pasūtījums atcelts'
                      : order.status === 'COLLECTED'
                        ? 'Konteiners savākts'
                        : 'Pasūtījums pabeigts'}
                  </Text>
                  {order.status !== 'CANCELLED' && order.location && (
                    <Text style={styles.terminalAddress} numberOfLines={1}>
                      {order.location.split(',')[0]}
                    </Text>
                  )}
                  {order.status !== 'CANCELLED' && order.createdAt && (
                    <Text style={styles.timelineDateText}>
                      {new Date(order.createdAt).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.statusSection}>
                <View style={styles.timelineContainer}>
                  {SKIP_STEPS.map((step, index) => {
                    const isDone = !isTerminal && index <= currentStepIdx;
                    const isCurrent = index === currentStepIdx;
                    const isLast = index === SKIP_STEPS.length - 1;

                    let dateStr = null;
                    if (order.statusTimestamps && order.statusTimestamps[step.key]) {
                      dateStr = new Date(order.statusTimestamps[step.key]).toLocaleDateString(
                        'lv-LV',
                        { day: 'numeric', month: 'short' },
                      );
                    } else if (index === 0) {
                      dateStr = new Date(order.createdAt).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'short',
                      });
                    } else if (
                      order.deliveryDate &&
                      (step.key === 'DELIVERED' || step.key === 'CONFIRMED')
                    ) {
                      dateStr = new Date(order.deliveryDate).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'short',
                      });
                    }

                    return (
                      <View key={step.key} style={styles.timelineRow}>
                        <View style={styles.timelineMarkerCol}>
                          {!isLast && (
                            <View
                              style={[
                                styles.timelineLine,
                                isDone && !isCurrent
                                  ? styles.timelineLineActive
                                  : styles.timelineLineInactive,
                              ]}
                            />
                          )}

                          {isCurrent ? (
                            <View style={styles.markerCurrent}>
                              <View style={styles.markerCurrentInner} />
                            </View>
                          ) : isDone ? (
                            <View style={styles.markerCompleted}>
                              <CheckCircle2 size={10} color="#FFFFFF" strokeWidth={4} />
                            </View>
                          ) : (
                            <View style={styles.markerFuture} />
                          )}
                        </View>

                        <View style={styles.timelineContent}>
                          <View style={styles.timelineTextWrap}>
                            <Text
                              style={[
                                styles.timelineTitle,
                                isCurrent && styles.timelineTitleCurrent,
                                !isDone && !isCurrent && styles.timelineTitleFuture,
                              ]}
                            >
                              {step.label}
                            </Text>
                            {isCurrent && order.location && (
                              <Text style={styles.timelineSubtitle} numberOfLines={1}>
                                {order.location.split(',')[0]}
                              </Text>
                            )}
                            {step.key === 'PENDING' && isCurrent && (
                              <Text style={styles.timelineSubtitle} numberOfLines={1}>
                                {orderSubDesc}
                              </Text>
                            )}
                          </View>
                          {dateStr && (
                            <View style={styles.timePillHover}>
                              <Text style={styles.timelineDateText}>{dateStr}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Bottom actions */}
            <View style={styles.cardActions}>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 mr-2"
                onPress={() => {
                  haptics.light();
                  router.push(`/(buyer)/skip-order/${id}/details` as never);
                }}
              >
                Detaļas
              </Button>
              {isTerminal && (
                <Button
                  variant="default"
                  size="lg"
                  className="flex-1 ml-2 bg-slate-900"
                  onPress={() => {
                    haptics.medium();
                    router.replace('/(wizards)/skip-hire' as never);
                  }}
                >
                  Pasūtīt vēlreiz
                </Button>
              )}
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const ORANGE = '#f97316'; // Orange for skip hire

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topPill: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  bottomSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 20,
  },
  bottomSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  courierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  courierAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  courierInfo: {
    flex: 1,
  },
  courierName: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  courierRole: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  courierActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSection: {
    marginBottom: 8,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineMarkerCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 16,
  },
  markerFuture: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    zIndex: 2,
  },
  markerCompleted: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    zIndex: 2,
  },
  markerCurrent: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    zIndex: 2,
  },
  markerCurrentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 20,
    bottom: -4,
    width: 2,
    zIndex: 1,
  },
  timelineLineActive: {
    backgroundColor: ORANGE,
  },
  timelineLineInactive: {
    backgroundColor: '#F3F4F6',
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 22,
  },
  timelineTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  timelineTitleCurrent: {
    color: '#111827',
  },
  timelineTitleFuture: {
    color: '#9CA3AF',
    fontFamily: 'Inter_500Medium',
  },
  timelineSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  timePillHover: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  timelineDateText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
  terminalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  terminalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 3,
  },
  terminalAddress: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
});