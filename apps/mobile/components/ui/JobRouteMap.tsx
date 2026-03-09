/**
 * JobRouteMap — business-level map for B3Hub transport jobs.
 *
 * Composes BaseMap + RouteLayer + PinLayer from components/map so this file
 * only contains domain logic: which pins to show, how to fit the camera to
 * all markers, and the distance / ETA info pill.
 *
 * Use cases:
 *  - Active job:          driver dot → pickup (green) → delivery (red)
 *  - Return trips:        delivery anchor + nearby return-pickup pins
 *  - Buyer order tracking: driver dot moving toward delivery pin
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
// Lazy-load: native module not available in Expo Go
let MapboxGL: typeof import('@rnmapbox/maps').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MapboxGL = require('@rnmapbox/maps').default;
} catch {
  /* Expo Go */
}
import { BaseMap, RouteLayer, PinLayer, useRoute } from '@/components/map';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MapPin {
  lat: number;
  lng: number;
  /** Short label shown in the callout */
  label?: string;
}

export interface ExtraPin {
  lat: number;
  lng: number;
  label?: string;
  /** 'return' = green return-trip pickup pin */
  type: 'return' | 'waypoint';
}

export interface JobRouteMapProps {
  /** Green pickup / loading location */
  pickup: MapPin;
  /** Red delivery / unloading location */
  delivery: MapPin;
  /** Blue pulsing dot — driver's live GPS position */
  current?: MapPin | null;
  /** Additional pins (e.g. return-trip pickups, containers) */
  extras?: ExtraPin[];
  /** Map height in px. Default 220 */
  height?: number;
  /** Border radius. Default 16 */
  borderRadius?: number;
  /** Extra style applied to the outer wrapper */
  style?: ViewStyle;
  /** Show the dashed "to pickup" leg from current → pickup. Default true */
  showToPickupLeg?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bboxCenter(points: { lat: number; lng: number }[]): [number, number] {
  if (!points.length) return [24.1052, 56.9496]; // Rīga
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function JobRouteMap({
  pickup,
  delivery,
  current,
  extras = [],
  height = 220,
  borderRadius = 16,
  style,
  showToPickupLeg = true,
}: JobRouteMapProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);

  // Route hooks — always called, pass null to disable a leg
  const { route: mainRoute, loading: routeLoading } = useRoute(pickup, delivery);
  const toPickupOrigin = current && showToPickupLeg ? current : null;
  const { route: toPickupRoute } = useRoute(toPickupOrigin, toPickupOrigin ? pickup : null);

  const allPoints = [pickup, delivery, ...(current ? [current] : []), ...extras];
  const center = bboxCenter(allPoints);

  // Fit camera to show all pins once the map is ready
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!cameraRef.current) return;
      const lats = allPoints.map((p) => p.lat);
      const lngs = allPoints.map((p) => p.lng);
      cameraRef.current.fitBounds(
        [Math.max(...lngs), Math.max(...lats)],
        [Math.min(...lngs), Math.min(...lats)],
        [56, 56, 56, 56],
        400,
      );
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pickup.lat,
    pickup.lng,
    delivery.lat,
    delivery.lng,
    current?.lat,
    current?.lng,
    extras.length,
  ]);

  // Fallback: straight line while the real route loads
  const mainCoords = mainRoute?.coords ?? [
    { latitude: pickup.lat, longitude: pickup.lng },
    { latitude: delivery.lat, longitude: delivery.lng },
  ];
  const toPickupCoords = current
    ? (toPickupRoute?.coords ?? [
        { latitude: current.lat, longitude: current.lng },
        { latitude: pickup.lat, longitude: pickup.lng },
      ])
    : [];

  return (
    <View style={[styles.container, { height, borderRadius, overflow: 'hidden' }, style]}>
      {/* ── Distance + ETA pill ── */}
      {mainRoute && mainRoute.distanceKm > 0 && (
        <View style={styles.infoPill}>
          {routeLoading ? (
            <ActivityIndicator size="small" color="#16a34a" />
          ) : (
            <>
              <Text style={styles.infoDistance}>{mainRoute.distanceKm} km</Text>
              {mainRoute.durationLabel ? (
                <Text style={styles.infoDuration}>· {mainRoute.durationLabel}</Text>
              ) : null}
            </>
          )}
        </View>
      )}

      <BaseMap cameraRef={cameraRef} center={center} zoom={10}>
        {current && <PinLayer id="current" coordinate={current} type="current" />}
        <PinLayer id="pickup" coordinate={pickup} type="pickup" label={pickup.label} />
        <PinLayer id="delivery" coordinate={delivery} type="delivery" label={delivery.label} />
        {extras.map((pin, i) => (
          <PinLayer
            key={`extra-${i}`}
            id={`extra-${i}`}
            coordinate={pin}
            type={pin.type === 'return' ? 'return' : 'custom'}
            label={pin.label}
          />
        ))}
        {current && showToPickupLeg && toPickupCoords.length >= 2 && (
          <RouteLayer id="toPickup" coordinates={toPickupCoords} color="#dc2626" dashed />
        )}
        <RouteLayer id="main" coordinates={mainCoords} color="#16a34a" />
      </BaseMap>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e5e7eb',
  },
  infoPill: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  infoDistance: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  infoDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 4,
  },
});
