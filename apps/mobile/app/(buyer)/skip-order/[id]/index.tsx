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
  ChevronLeft,
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
    <ScreenContainer bg="#F4F5F7" standalone topInset={0}>
      <View style={styles.mapWrapper}>
        <BaseMap
          cameraRef={cameraRef}
          center={hasCoords ? [order.lng!, order.lat!] : [24.1052, 56.9496]}
          zoom={13.5}
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {hasCoords && (
            <PinLayer
              id="delivery"
              type="elegant-delivery"
              coordinate={{ lat: order.lat!, lng: order.lng! }}
            />
          )}
        </BaseMap>

        {/* Floating Header */}
        <View style={[styles.floatingHeader, { paddingTop: insets.top || 44 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(buyer)/orders'))}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Konteinera noma</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Uber-like Top Floating Card */}
        <View style={[styles.topCardContainer, { top: (insets.top || 44) + 64 }]}>
          <View style={styles.topCard}>
            <View style={styles.topCardIcon}>
              <Trash2 size={24} color="#374151" strokeWidth={1.5} />
            </View>
            <View style={styles.topCardMeta}>
              <Text style={styles.topCardTitle} numberOfLines={1}>
                {order.skipSize} konteiners
              </Text>
              <Text style={styles.topCardSubtitle}>ID:{order.orderNumber}</Text>
            </View>
          </View>
        </View>

        {/* Uber-like Bottom Sheet / Overlay */}
        <View style={[styles.overlayContainer, { bottom: insets.bottom || 24 }]}>
          <View style={styles.overlayCard}>
            {/* Courier Header Row */}
            <View style={styles.courierHeader}>
              <View style={styles.courierAvatarFallback}>
                <Truck size={20} color="#6B7280" strokeWidth={2} />
              </View>
              <View style={styles.courierInfo}>
                <Text style={styles.courierName} numberOfLines={1}>
                  {carrier ? carrier.name : 'Meklējam pārvadātāju...'}
                </Text>
                <Text style={styles.courierRole}>
                  {carrier ? 'Pārvadātājs' : 'Pieprasījums nosūtīts'}
                </Text>
              </View>
              {carrier?.phone && (
                <TouchableOpacity
                  style={styles.courierPhoneBtn}
                  onPress={() => {
                    haptics.medium();
                    Linking.openURL(`tel:${carrier.phone}`).catch(() => null);
                  }}
                >
                  <Phone size={18} color="#FFFFFF" fill="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Vertical Timeline replacing the horizontal stepper */}
            <View style={styles.statusSection}>
              <Text style={styles.statusSectionTitle}>Konteinera statuss</Text>

              <View style={styles.timelineContainer}>
                {SKIP_STEPS.map((step, index) => {
                  const isDone = !isTerminal && index <= currentStepIdx;
                  const isCurrent = index === currentStepIdx;
                  const isLast = index === SKIP_STEPS.length - 1;

                  let dateStr: string | null = null;
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
                            <CheckCircle2 size={12} color="#FFFFFF" strokeWidth={3} />
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
                        {dateStr && <Text style={styles.timelineDateText}>{dateStr}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const ORANGE = '#F97316';

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSpacer: {
    width: 44,
  },
  topCardContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  topCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  topCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  topCardMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  topCardTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  topCardSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  overlayContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  overlayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  courierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  courierAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  courierAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: '#E5E7EB',
  },
  courierInfo: {
    flex: 1,
  },
  courierName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  courierRole: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
  courierPhoneBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSection: {
    marginBottom: 8,
  },
  statusSectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 2,
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
    borderColor: '#D1D5DB',
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
    backgroundColor: '#FFF7ED',
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
    bottom: -6,
    width: 2,
    zIndex: 1,
  },
  timelineLineActive: {
    backgroundColor: ORANGE,
  },
  timelineLineInactive: {
    backgroundColor: '#E5E7EB',
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  timelineTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  timelineTitle: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
    marginBottom: 4,
  },
  timelineTitleCurrent: {
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
  timelineTitleFuture: {
    color: '#9CA3AF',
  },
  timelineSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  timelineDateText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
    paddingTop: 1,
  },
});
