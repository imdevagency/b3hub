import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Package, Trash2, Phone, Star, Truck } from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BaseMap } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

import { haptics } from '@/lib/haptics';
import { useSkipOrder } from '@/lib/use-skip-order';
import { formatDate } from '@/lib/format';
import { colors } from '@/lib/theme';

let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

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

  useEffect(() => {
    if (!order || !ACTIVE_STATUSES.has(order.status)) return;
    const interval = setInterval(() => reload(true), 15_000);
    return () => clearInterval(interval);
  }, [order?.status, reload]);

  useEffect(() => {
    if (!cameraRef.current || order?.lat == null || order?.lng == null) return;
    cameraRef.current.setCamera({
      centerCoordinate: [order.lng, order.lat],
      zoomLevel: 14,
      animationDuration: 600,
    });
  }, [order?.lat, order?.lng]);

  if (loading) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Skip noma" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Skip noma" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const hasCoords = order.lat != null && order.lng != null;
  const carrier = order.carrier;
  const currentStepIdx = STATUS_TO_STEP[order.status] ?? -1;
  const isTerminal =
    order.status === 'COLLECTED' || order.status === 'COMPLETED' || order.status === 'CANCELLED';

  const heroPrimary = (() => {
    if (order.status === 'COLLECTED' || order.status === 'COMPLETED') return 'Pabeigts';
    if (order.status === 'CANCELLED') return 'Atcelts';
    if (order.status === 'DELIVERED') return 'Piegādāts';
    if (order.status === 'CONFIRMED') return formatDate(order.deliveryDate);
    return 'Gaida apstiprinājumu';
  })();

  const heroSubtitle = STATUS_LABEL[order.status] ?? '';
  const showSubtitle = heroSubtitle && heroSubtitle.toLowerCase() !== heroPrimary.toLowerCase();

  return (
    <ScreenContainer bg="#FFFFFF" standalone>
      <ScreenHeader title="Skip noma" />
      <View style={styles.mapWrapper}>
        <BaseMap
          cameraRef={cameraRef}
          center={hasCoords ? [order.lng!, order.lat!] : [24.1052, 56.9496]}
          zoom={14}
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {hasCoords && Marker && (
            <Marker
              coordinate={{ latitude: order.lat!, longitude: order.lng! }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinDelivery}>
                <Trash2 size={14} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>

        <View style={styles.overlayContainer}>
          <View style={styles.overlayCard}>
            {/* Status hero */}
            <Text style={styles.heroPrimary}>{heroPrimary}</Text>
            {showSubtitle && <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>}

            {/* Progress stepper */}
            {order.status !== 'CANCELLED' && (
              <View style={styles.stepsRow}>
                {SKIP_STEPS.map((step, index) => {
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

            {/* Carrier card */}
            {carrier ? (
              <View style={styles.carrierRow}>
                <View style={styles.carrierAvatar}>
                  <Truck size={18} color="#FFFFFF" />
                </View>
                <View style={styles.carrierMeta}>
                  <Text style={styles.carrierName} numberOfLines={1}>
                    {carrier.name}
                  </Text>
                  {carrier.rating != null && (
                    <View style={styles.ratingPill}>
                      <Star size={11} color="#B45309" fill="#B45309" />
                      <Text style={styles.ratingPillText}>{carrier.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                {carrier.phone && (
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => {
                      haptics.medium();
                      Linking.openURL(`tel:${carrier.phone}`).catch(() => null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Phone size={16} color="#111827" />
                  </TouchableOpacity>
                )}
              </View>
            ) : !isTerminal ? (
              <Text style={styles.waitingText}>Gaida pārvadātāja apstiprinājumu…</Text>
            ) : null}

            {/* Bottom actions */}
            <View style={styles.cardActions}>
              {isTerminal && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onPress={() => {
                    haptics.medium();
                    router.push('/skip-hire' as any);
                  }}
                >
                  Pasūtīt vēlreiz
                </Button>
              )}
              <Button
                variant="secondary"
                size="lg"
                className={isTerminal ? 'flex-1' : 'w-full'}
                onPress={() => {
                  haptics.light();
                  router.push(`/(buyer)/skip-order/${id}/details` as never);
                }}
              >
                Detaļas
              </Button>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  pinDelivery: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  overlayContainer: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 24,
  },
  overlayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  heroPrimary: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    marginBottom: 14,
  },
  stepItem: {
    flex: 1,
  },
  stepDot: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 6,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#111827',
  },
  carrierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    gap: 10,
  },
  carrierAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierMeta: {
    flex: 1,
  },
  carrierName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingPillText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#B45309',
  },
  waitingText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
});
