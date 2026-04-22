import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, Package, Truck, Phone, Star, Recycle, ChevronRight } from 'lucide-react-native';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { BaseMap, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { useTransportJob } from '@/lib/use-transport-job';
import { useLiveUpdates } from '@/lib/use-live-updates';
import { colors } from '@/lib/theme';

let Marker: any = null;
try {
  const maps = require('react-native-maps');
  Marker = maps.Marker;
} catch {
  /* Expo Go */
}

const JOB_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Meklē pārvadātāju',
  ACCEPTED: 'Šoferis pieņēma pasūtījumu',
  EN_ROUTE_PICKUP: 'Šoferis dodas uz kraušanu',
  AT_PICKUP: 'Šoferis ir pie kraušanas vietas',
  LOADED: 'Krava ir iekrauta',
  EN_ROUTE_DELIVERY: 'Šoferis dodas uz jums',
  AT_DELIVERY: 'Šoferis ir uz vietas',
  DELIVERED: 'Piegāde pabeigta',
  CANCELLED: 'Pasūtījums atcelts',
};
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
  DELIVERED: 3,
};
export default function TransportJobTrackingScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { job, loading } = useTransportJob(id);
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const [driverLocationOnMap, setDriverLocationOnMap] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);

  const { jobLocation: liveLocation, jobStatus: liveJobStatus } = useLiveUpdates({
    jobId: typeof id === 'string' ? id : null,
    token,
  });

  useEffect(() => {
    if (!liveLocation) return;
    const { lat, lng } = liveLocation;
    if (liveLocation.estimatedArrivalMin != null) {
      setEtaMin(liveLocation.estimatedArrivalMin);
    }
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
    if (job?.pickupLat != null && job?.pickupLng != null) {
      return { lat: job.pickupLat, lng: job.pickupLng };
    }
    return null;
  }, [driverLocationOnMap, job?.pickupLat, job?.pickupLng]);

  const routeDestination = useMemo(() => {
    if (job?.deliveryLat != null && job?.deliveryLng != null) {
      return { lat: job.deliveryLat, lng: job.deliveryLng };
    }
    return null;
  }, [job?.deliveryLat, job?.deliveryLng]);

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
        <ScreenHeader title="Pārvadājums" />
        <SkeletonDetail />
      </ScreenContainer>
    );
  }

  if (!job) {
    return (
      <ScreenContainer bg="#F4F5F7" standalone>
        <ScreenHeader title="Pārvadājums" />
        <EmptyState icon={<Package size={32} color="#9CA3AF" />} title="Pasūtījums nav atrasts" />
      </ScreenContainer>
    );
  }

  const isDisposal = job.jobType === 'WASTE_COLLECTION';
  const driver = job.driver;
  const currentStepIdx = JOB_STATUS_TO_STEP[job.status] ?? -1;
  const isTerminal = job.status === 'DELIVERED' || job.status === 'CANCELLED';

  const heroPrimary = (() => {
    if (job.status === 'DELIVERED') return 'Piegādāts';
    if (job.status === 'CANCELLED') return 'Atcelts';
    if (etaMin != null) return `${etaMin} min`;
    if (driver) return 'Ceļā';
    if (job.status === 'AVAILABLE') return 'Meklē pārvadātāju';
    return 'Pārvadājumā';
  })();

  const heroSubtitle = JOB_STATUS_LABEL[job.status] ?? 'Pārvadājumā';
  const initialCenter: [number, number] =
    job.deliveryLng != null && job.deliveryLat != null
      ? [job.deliveryLng, job.deliveryLat]
      : [24.1052, 56.9496];

  return (
    <ScreenContainer bg="#FFFFFF" standalone>
      <ScreenHeader title="Pārvadājums" />
      <View style={styles.mapWrapper}>
        <BaseMap
          cameraRef={cameraRef}
          center={initialCenter}
          zoom={13}
          style={styles.map}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {route?.coords && route.coords.length > 1 && (
            <RouteLayer id="job-route" coordinates={route.coords} color="#111827" width={4} />
          )}
          {job.pickupLat != null && job.pickupLng != null && Marker && (
            <Marker
              coordinate={{ latitude: job.pickupLat, longitude: job.pickupLng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pinPickup}>
                <Package size={14} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </Marker>
          )}
          {job.deliveryLat != null && job.deliveryLng != null && Marker && (
            <Marker
              coordinate={{ latitude: job.deliveryLat, longitude: job.deliveryLng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pinDelivery}>
                {isDisposal ? (
                  <Recycle size={14} color="#FFFFFF" strokeWidth={2.5} />
                ) : (
                  <MapPin size={14} color="#FFFFFF" strokeWidth={2.5} />
                )}
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
            {heroSubtitle
              ? heroSubtitle.toLowerCase() !== heroPrimary.toLowerCase() && (
                  <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
                )
              : null}

            {currentStepIdx >= 0 && (
              <View style={styles.stepsRow}>
                {JOB_STEPS.map((step, index) => {
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
                  {isDisposal ? (
                    <Recycle size={14} color="#6B7280" />
                  ) : (
                    <MapPin size={14} color="#6B7280" />
                  )}
                </View>
              </View>
              <View style={styles.timelineDetails}>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {job.pickupAddress || job.pickupCity}
                  </Text>
                </View>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {job.deliveryAddress || job.deliveryCity}
                  </Text>
                </View>
              </View>
            </View>

            {isTerminal && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onPress={() => {
                  haptics.medium();
                  router.replace('/transport' as never);
                }}
              >
                Pasūtīt vēlreiz
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onPress={() => {
                haptics.light();
                router.push(`/(buyer)/transport-job/${id}/details` as never);
              }}
            >
              Detaļas
            </Button>
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
  pinPickup: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
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
  stepsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  stepItem: {
    flex: 1,
  },
  stepDot: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#111827',
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
