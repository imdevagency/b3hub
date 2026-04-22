import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Package,
  Truck,
  Star,
  Phone,
  ChevronRight,
} from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BaseMap, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useOrderDetail } from '@/lib/use-order-detail';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { MAT_STATUS } from '@/lib/materials';
import { colors } from '@/lib/theme';

let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

const JOB_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'Šoferis pieņēma pasūtījumu',
  EN_ROUTE_PICKUP: 'Šoferis dodas uz kraušanu',
  AT_PICKUP: 'Šoferis ir pie kraušanas vietas',
  LOADED: 'Krava ir iekrauta',
  EN_ROUTE_DELIVERY: 'Šoferis dodas uz jums',
  AT_DELIVERY: 'Šoferis ir uz vietas',
  DELIVERED: 'Piegādāts',
};

const ORDER_STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  ...MAT_STATUS,
  COMPLETED: { label: 'Pabeigts', bg: '#DCFCE7', color: '#15803D' },
};

export default function OrderTrackingScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, setOrder, loading, reload: load } = useOrderDetail(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  const {
    orderStatus: liveStatus,
    jobStatus: liveJobStatus,
    jobLocation: liveLocation,
  } = useLiveUpdates({
    orderId: id ?? null,
    jobId: order?.transportJobs?.[0]?.id ?? null,
    token,
  });

  useEffect(() => {
    if (liveStatus && order && liveStatus !== order.status) {
      setOrder((prev) => (prev ? { ...prev, status: liveStatus } : prev));
    }
  }, [liveStatus, order?.status, setOrder]);

  useEffect(() => {
    if (liveJobStatus) load();
  }, [liveJobStatus, load]);

  useEffect(() => {
    if (!liveLocation) return;
    if (liveLocation.estimatedArrivalMin != null) {
      setEtaMin(liveLocation.estimatedArrivalMin);
    }
    const { lat, lng } = liveLocation;
    const prev = driverLocationOnMap;
    const movedEnough =
      !prev || Math.abs(prev.lat - lat) > 0.0003 || Math.abs(prev.lng - lng) > 0.0003;
    setDriverLocationOnMap({ lat, lng });
    if (movedEnough) {
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        animationDuration: 600,
      });
    }
  }, [liveLocation]);

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

  useEffect(() => {
    if (!cameraRef.current || !routeOrigin || !routeDestination) return;
    const ne: [number, number] = [
      Math.max(routeOrigin.lng, routeDestination.lng),
      Math.max(routeOrigin.lat, routeDestination.lat),
    ];
    const sw: [number, number] = [
      Math.min(routeOrigin.lng, routeDestination.lng),
      Math.min(routeOrigin.lat, routeDestination.lat),
    ];
    cameraRef.current.fitBounds(ne, sw, [48, 48, 48, 48], 600);
  }, [routeOrigin?.lat, routeOrigin?.lng, routeDestination?.lat, routeDestination?.lng]);

  if (loading) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pasūtījums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pasūtījums" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const statusMeta = ORDER_STATUS_PILL[order.status] ?? ORDER_STATUS_PILL.PENDING;
  const activeJob = order.transportJobs?.find(
    (job) =>
      job.status === 'ACCEPTED' ||
      job.status === 'EN_ROUTE_PICKUP' ||
      job.status === 'AT_PICKUP' ||
      job.status === 'LOADED' ||
      job.status === 'EN_ROUTE_DELIVERY' ||
      job.status === 'AT_DELIVERY',
  );
  const driver = activeJob?.driver;

  const heroPrimary = (() => {
    if (order.status === 'DELIVERED') return 'Piegādāts';
    if (order.status === 'COMPLETED') return 'Pabeigts';
    if (order.status === 'CANCELLED') return 'Atcelts';
    if (etaMin != null) return `${etaMin} min`;
    if (driver) return 'Ceļā';
    if (order.status === 'PENDING') return 'Gaida apstiprināšanu';
    return 'Meklē šoferi';
  })();

  const jobStatusLabel = activeJob ? (JOB_STATUS_LABEL[activeJob.status] ?? 'Piegādē') : null;
  const heroSubtitle =
    jobStatusLabel ??
    (order.status === 'DELIVERED' ? 'Apstipriniet saņemšanu' : statusMeta.label);

  return (
    <ScreenContainer bg="#FFFFFF" standalone>
      <ScreenHeader title="Pasūtījums" />
      <View style={styles.mapWrapper}>
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
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {route?.coords && route.coords.length > 1 && (
            <RouteLayer id="order-route" coordinates={route.coords} color="#111827" width={4} />
          )}
          {order.deliveryLat != null && order.deliveryLng != null && Marker && (
            <Marker
              coordinate={{ latitude: order.deliveryLat, longitude: order.deliveryLng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pinDelivery}>
                <MapPin size={14} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
          {driverLocationOnMap && Marker && (
            <Marker
              coordinate={{
                latitude: driverLocationOnMap.lat,
                longitude: driverLocationOnMap.lng,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.pinDriver}>
                <Truck size={13} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
        </BaseMap>

        <View style={styles.overlayContainer}>
          <View style={styles.overlayCard}>
            <Text style={styles.heroPrimary}>{heroPrimary}</Text>
            {heroSubtitle ? (heroSubtitle.toLowerCase() !== heroPrimary.toLowerCase() && (
                <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
              )) : null}

            {driver && (
              <View style={styles.driverRow}>
                {driver.avatar ? (
                  <Image source={{ uri: driver.avatar }} style={styles.driverAvatar} />
                ) : (
                  <View style={styles.driverAvatarFallback}>
                    <Text style={styles.driverAvatarText}>
                      {driver.firstName?.[0] ?? '?'}
                      {driver.lastName?.[0] ?? ''}
                    </Text>
                  </View>
                )}
                <View style={styles.driverMeta}>
                  <Text style={styles.driverName} numberOfLines={1}>
                    {driver.firstName} {driver.lastName}
                  </Text>
                  <View style={styles.driverRating}>
                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.driverRatingText}>4.8</Text>
                  </View>
                </View>
                {driver.phone && (
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => Linking.openURL(`tel:${driver.phone}`).catch(() => null)}
                  >
                    <Phone size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

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
                    {order.siteContactName || 'Iekraušana'}
                  </Text>
                </View>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {order.deliveryAddress}, {order.deliveryCity}
                  </Text>
                </View>
              </View>
            </View>

            <Button variant="secondary" size="lg" className="w-full" onPress={() => {
                haptics.light();
                router.push(`/(buyer)/order/${id}/details` as never);
              }}>Detaļas</Button>
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
  pinDriver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
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
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  driverAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#4B5563',
  },
  driverMeta: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#111827',
    marginBottom: 2,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverRatingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#6B7280',
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
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
  detailsButton: {
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
