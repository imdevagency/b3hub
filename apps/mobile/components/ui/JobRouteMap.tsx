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
import { BaseMap, RouteLayer, PinLayer, useRoute } from '@/components/map';
import type { CameraRefHandle } from '@/components/map';

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
  /** Map height in px or string %. Default 220. Pass null to unconstrain height. */
  height?: number | string | null;
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
/** Returns true if coords look like a real on-device GPS fix in/near Europe.
 *  Filters out simulator defaults (Apple HQ ~37°N 122°W, SF ~37.8°N 122.4°W). */
function isEuropeanCoord(lat: number, lng: number): boolean {
  return lat >= 34 && lat <= 72 && lng >= -25 && lng <= 50;
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
  const cameraRef = useRef<CameraRefHandle | null>(null);

  // If height is explicitly "100%" or null, we shouldn't force a numeric height style if flex is desired.
  // But for API compat we'll trust the prop.
  // Note: If explicit height is passed, it overrides other layout styles in the array order if applied via { height }.

  // ...
  // Simulator defaults (Apple HQ / SF) are in California and would push the
  // initial camera centre into the Atlantic Ocean.
  const currentIsValid = current != null && isEuropeanCoord(current.lat, current.lng);
  const validCurrent = currentIsValid ? current : null;

  // Route hooks — always called, pass null to disable a leg
  const { route: mainRoute, loading: routeLoading } = useRoute(pickup, delivery);
  const toPickupOrigin = validCurrent && showToPickupLeg ? validCurrent : null;
  const { route: toPickupRoute } = useRoute(toPickupOrigin, toPickupOrigin ? pickup : null);

  // Initial camera centre — exclude current to avoid being dragged to SF
  const jobPoints = [pickup, delivery, ...extras];
  const allPoints = [...jobPoints, ...(validCurrent ? [validCurrent] : [])];
  const center = bboxCenter(jobPoints);

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
  const toPickupCoords = validCurrent
    ? (toPickupRoute?.coords ?? [
        { latitude: validCurrent.lat, longitude: validCurrent.lng },
        { latitude: pickup.lat, longitude: pickup.lng },
      ])
    : [];

  const containerStyle: any = [styles.container, { borderRadius }];
  // Only clip with overflow:hidden when there is an actual border radius to clip.
  // overflow:'hidden' with PROVIDER_GOOGLE on iOS prevents the native GMSMapView from rendering.
  if (borderRadius > 0) {
    containerStyle.push({ overflow: 'hidden' });
  }
  if (height !== null) {
    containerStyle.push({ height });
  } else {
    // If explicit null is passed, we probably want to fill available space
    containerStyle.push({ flex: 1, width: '100%' });
  }
  containerStyle.push(style);

  return (
    <View style={containerStyle}>
      {/* ── Distance + ETA pill ── */}
      {mainRoute && mainRoute.distanceKm > 0 && (
        <View style={styles.infoPill}>
          {routeLoading ? (
            <ActivityIndicator size="small" color="#111827" />
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

      <BaseMap cameraRef={cameraRef} center={center} zoom={10} style={StyleSheet.absoluteFill}>
        {validCurrent && <PinLayer id="current" coordinate={validCurrent} type="current" />}
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
        {validCurrent && showToPickupLeg && toPickupCoords.length >= 2 && (
          <RouteLayer id="toPickup" coordinates={toPickupCoords} color="#111827" dashed />
        )}
        <RouteLayer id="main" coordinates={mainCoords} color="#111827" />
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
