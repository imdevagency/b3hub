import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BaseMap, PinLayer, RouteLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';
import type { ApiTransportJob } from '@/lib/api';

export type ActiveJobStatus =
  | 'ACCEPTED'
  | 'EN_ROUTE_PICKUP'
  | 'AT_PICKUP'
  | 'LOADED'
  | 'EN_ROUTE_DELIVERY'
  | 'AT_DELIVERY'
  | 'DELIVERED';

export interface ActiveJobMapProps {
  job: ApiTransportJob;
  currentStatus: ActiveJobStatus;
  currentLat: number | null;
  currentLng: number | null;
}

export function ActiveJobMap({ job, currentStatus, currentLat, currentLng }: ActiveJobMapProps) {
  const cameraRef = React.useRef<CameraRefHandle | null>(null);
  const hasCoords =
    job.pickupLat != null &&
    job.pickupLng != null &&
    job.deliveryLat != null &&
    job.deliveryLng != null;

  const pickup = hasCoords ? { lat: job.pickupLat!, lng: job.pickupLng! } : null;
  const delivery = hasCoords ? { lat: job.deliveryLat!, lng: job.deliveryLng! } : null;

  const { route } = useRoute(pickup, delivery);

  const validCurrent =
    currentLat != null &&
    currentLng != null &&
    currentLat >= 34 &&
    currentLat <= 72 &&
    currentLng >= -25 &&
    currentLng <= 50
      ? { lat: currentLat, lng: currentLng }
      : null;

  const showToPickup = currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';
  const { route: toPickupRoute } = useRoute(
    showToPickup && validCurrent && pickup ? validCurrent : null,
    showToPickup && pickup ? pickup : null,
  );

  // Fit camera to show job once coords are known
  const fitted = React.useRef(false);
  React.useEffect(() => {
    if (!hasCoords || fitted.current || !cameraRef.current) return;
    const timer = setTimeout(() => {
      if (!cameraRef.current || !pickup || !delivery) return;
      cameraRef.current.fitBounds(
        [Math.max(pickup.lng, delivery.lng), Math.max(pickup.lat, delivery.lat)],
        [Math.min(pickup.lng, delivery.lng), Math.min(pickup.lat, delivery.lat)],
        [56, 56, 220, 56],
        400,
      );
      fitted.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, [hasCoords]);

  // Follow driver position
  React.useEffect(() => {
    if (!validCurrent || !cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: [validCurrent.lng, validCurrent.lat],
      zoomLevel: 13,
      animationDuration: 700,
    });
  }, [validCurrent?.lat, validCurrent?.lng]);

  const center: [number, number] = validCurrent
    ? [validCurrent.lng, validCurrent.lat]
    : pickup && delivery
      ? [(pickup.lng + delivery.lng) / 2, (pickup.lat + delivery.lat) / 2]
      : [24.1052, 56.9496];

  const mainCoords =
    route?.coords ??
    (pickup && delivery
      ? [
          { latitude: pickup.lat, longitude: pickup.lng },
          { latitude: delivery.lat, longitude: delivery.lng },
        ]
      : []);

  const toPickupCoords =
    toPickupRoute?.coords ??
    (validCurrent && pickup
      ? [
          { latitude: validCurrent.lat, longitude: validCurrent.lng },
          { latitude: pickup.lat, longitude: pickup.lng },
        ]
      : []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <BaseMap cameraRef={cameraRef} center={center} zoom={12} style={StyleSheet.absoluteFill}>
        {validCurrent && <PinLayer id="current" coordinate={validCurrent} type="current" />}
        {pickup && (
          <PinLayer id="pickup" coordinate={pickup} type="pickup" label={job.pickupCity} />
        )}
        {delivery && (
          <PinLayer id="delivery" coordinate={delivery} type="delivery" label={job.deliveryCity} />
        )}
        {mainCoords.length > 1 && (
          <RouteLayer id="main-route" coordinates={mainCoords} color="#111827" width={4} />
        )}
        {toPickupCoords.length > 1 && (
          <RouteLayer
            id="to-pickup"
            coordinates={toPickupCoords}
            color="#9ca3af"
            width={3}
            dashed
          />
        )}
      </BaseMap>
    </View>
  );
}
