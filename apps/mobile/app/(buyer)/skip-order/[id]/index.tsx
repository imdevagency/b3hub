import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, Package, Trash2, ChevronRight, Phone } from 'lucide-react-native';

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

  const heroPrimary = (() => {
    if (order.status === 'COLLECTED' || order.status === 'COMPLETED') return 'Pabeigts';
    if (order.status === 'CANCELLED') return 'Atcelts';
    if (order.status === 'DELIVERED') return 'Piegādāts';
    if (order.status === 'CONFIRMED') return formatDate(order.deliveryDate);
    return 'Gaida apstiprinājumu';
  })();

  const heroSubtitle = STATUS_LABEL[order.status] ?? '';

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
            <Text style={styles.heroPrimary}>{heroPrimary}</Text>
            {heroSubtitle
              ? heroSubtitle.toLowerCase() !== heroPrimary.toLowerCase() && (
                  <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
                )
              : null}

            <View style={styles.timelineRow}>
              <View style={styles.timelineIcons}>
                <View style={styles.timelineIconWrap}>
                  <Package size={14} color="#111827" />
                </View>
                <View style={styles.timelineLine} />
                <View style={styles.timelineIconWrap}>
                  <MapPin size={14} color="#6B7280" />
                </View>
              </View>
              <View style={styles.timelineDetails}>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineText} numberOfLines={1}>
                    {order.location || 'Iznomātājs'}
                  </Text>
                </View>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {order.location}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.cardActions}>
              {carrier?.phone && (
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
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
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
    marginBottom: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineIcons: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  timelineIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineLine: {
    position: 'absolute',
    top: 24,
    bottom: 24,
    width: 2,
    backgroundColor: '#E5E7EB',
    zIndex: -1,
  },
  timelineDetails: {
    flex: 1,
    gap: 16,
  },
  timelineItem: {
    minHeight: 24,
    justifyContent: 'center',
  },
  timelineItemSpacer: {
    flex: 1,
  },
  timelineText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#4B5563',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
  },
  detailsButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
});
