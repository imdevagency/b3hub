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
import { colors } from '@/lib/theme';

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
  /**
   * When true the camera smoothly pans to the driver's current position on
   * every GPS update instead of re-fitting all bounds. Use on the driver's
   * own active-job screen so the map follows them like a navigation app.
   */
  followCurrentPosition?: boolean;
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

/**
 * splitRouteAtProgress — splits a polyline at the point nearest to `pos`.
 * Returns `{ passed, remaining }` where:
 *   `passed`    = coords from start → snap point (rendered dim/grey)
 *   `remaining` = coords from snap point → end (rendered full colour)
 */
function splitRouteAtProgress(
  coords: Array<{ latitude: number; longitude: number }>,
  pos: { lat: number; lng: number },
): {
  passed: Array<{ latitude: number; longitude: number }>;
  remaining: Array<{ latitude: number; longitude: number }>;
} {
  if (coords.length < 2) return { passed: [], remaining: coords };

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dlat = coords[i].latitude - pos.lat;
    const dlng = coords[i].longitude - pos.lng;
    const d = dlat * dlat + dlng * dlng; // squared distance — no need for sqrt
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const snap = coords[bestIdx];
  const passed = [...coords.slice(0, bestIdx + 1)];
  const remaining = [snap, ...coords.slice(bestIdx + 1)];
  return { passed, remaining };
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
  followCurrentPosition = false,
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

  // Initial camera centre — exclude current to avoid being dragged to SF
  const jobPoints = [pickup, delivery, ...extras];
  const allPoints = [...jobPoints, ...(validCurrent ? [validCurrent] : [])];
  const center = bboxCenter(jobPoints);

  // Track whether initial bounds have been fitted (only do it once)
  const initialFitDone = useRef(false);

  // Fit camera to show all pins — runs once after the map is ready and we have job coords
  useEffect(() => {
    if (initialFitDone.current) return;
    const timer = setTimeout(() => {
      if (!cameraRef.current) return;
      const points = followCurrentPosition ? jobPoints : allPoints;
      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      cameraRef.current.fitBounds(
        [Math.max(...lngs), Math.max(...lats)],
        [Math.min(...lngs), Math.min(...lats)],
        [56, 56, 56, 56],
        400,
      );
      initialFitDone.current = true;
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng]);

  // When followCurrentPosition is on, smoothly pan camera to driver after every GPS fix
  useEffect(() => {
    if (!followCurrentPosition || !validCurrent || !cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: [validCurrent.lng, validCurrent.lat],
      zoomLevel: 13,
      animationDuration: 700,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validCurrent?.lat, validCurrent?.lng]);

  // Fallback: straight line while the real route loads
  const mainCoords = mainRoute?.coords ?? [
    { latitude: pickup.lat, longitude: pickup.lng },
    { latitude: delivery.lat, longitude: delivery.lng },
  ];
  // The dashed "to pickup" leg is a visual approximation — always use a
  // straight line to avoid a Directions API call on every GPS fix.
  const toPickupCoords =
    showToPickupLeg && validCurrent
      ? [
          { latitude: validCurrent.lat, longitude: validCurrent.lng },
          { latitude: pickup.lat, longitude: pickup.lng },
        ]
      : [];

  // Split main route into passed (grey) + remaining (dark) segments
  const { passed: passedCoords, remaining: remainingCoords } =
    validCurrent && mainCoords.length >= 2
      ? splitRouteAtProgress(mainCoords, validCurrent)
      : { passed: [] as typeof mainCoords, remaining: mainCoords };

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
        {/* Passed segment — light grey to show progress */}
        {passedCoords.length >= 2 && (
          <RouteLayer id="main-passed" coordinates={passedCoords} color="#d1d5db" width={4} />
        )}
        {/* Remaining segment — full dark colour */}
        <RouteLayer id="main-remaining" coordinates={remainingCoords} color="#111827" width={4} />
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
    color: colors.textPrimary,
  },
  infoDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    marginLeft: 4,
  },
});
