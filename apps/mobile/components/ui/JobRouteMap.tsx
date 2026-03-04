/**
 * JobRouteMap — reusable map component for B3Hub.
 *
 * Uses Google Maps on both iOS and Android for a consistent look.
 * API keys:
 *   iOS     → app.json  ios.config.googleMapsApiKey
 *   Android → app.json  android.googleMapsApiKey
 *
 * Use cases:
 *  - Active job: current position  →  pickup (green)  →  delivery (red)
 *  - Return trips: delivery anchor + nearby pickup pins
 *  - Buyer delivery tracking: driver dot moving toward delivery pin
 *  - Container overview: container location pins on a cluster map
 */
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { fetchRoute, RouteInfo } from '@/lib/maps';

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

// ── Helper: compute an initial region from coords ────────────────────────────
function computeRegion(coords: { lat: number; lng: number }[]): Region {
  if (coords.length === 0) {
    return { latitude: 56.946, longitude: 24.106, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 0.3;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 0.01) * (1 + pad),
    longitudeDelta: Math.max(maxLng - minLng, 0.01) * (1 + pad),
  };
}

// ── Marker shapes ─────────────────────────────────────────────────────────────
function PickupMarker({ label }: { label?: string }) {
  return (
    <View style={markerStyles.wrapper}>
      <View style={[markerStyles.pin, { backgroundColor: '#16a34a' }]}>
        <Text style={markerStyles.pinText}>P</Text>
      </View>
      <View style={[markerStyles.tail, { borderTopColor: '#16a34a' }]} />
      {label ? <Text style={[markerStyles.label, { color: '#16a34a' }]}>{label}</Text> : null}
    </View>
  );
}

function DeliveryMarker({ label }: { label?: string }) {
  return (
    <View style={markerStyles.wrapper}>
      <View style={[markerStyles.pin, { backgroundColor: '#dc2626' }]}>
        <Text style={markerStyles.pinText}>D</Text>
      </View>
      <View style={[markerStyles.tail, { borderTopColor: '#dc2626' }]} />
      {label ? <Text style={[markerStyles.label, { color: '#dc2626' }]}>{label}</Text> : null}
    </View>
  );
}

function ReturnPickupMarker({ label }: { label?: string }) {
  return (
    <View style={markerStyles.wrapper}>
      <View style={[markerStyles.pinSmall, { backgroundColor: '#059669' }]}>
        <Text style={[markerStyles.pinText, { fontSize: 9 }]}>R</Text>
      </View>
      <View style={[markerStyles.tailSmall, { borderTopColor: '#059669' }]} />
      {label ? (
        <Text style={[markerStyles.label, { color: '#059669', fontSize: 9 }]}>{label}</Text>
      ) : null}
    </View>
  );
}

function CurrentLocationMarker() {
  return (
    <View style={markerStyles.currentWrapper}>
      <View style={markerStyles.currentOuter}>
        <View style={markerStyles.currentInner} />
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
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
  const mapRef = useRef<MapView>(null);

  // Real road routes (fetched from Google Routes API)
  const [mainRoute, setMainRoute] = useState<RouteInfo | null>(null);
  const [toPickupRoute, setToPickupRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Fetch road polylines whenever the key coords change
  useEffect(() => {
    let cancelled = false;
    async function fetchRoutes() {
      setRouteLoading(true);
      const main = await fetchRoute(pickup, delivery);
      if (!cancelled) {
        setMainRoute(main);
      }
      if (current && showToPickupLeg) {
        const toPickup = await fetchRoute(current, pickup);
        if (!cancelled) setToPickupRoute(toPickup);
      } else {
        if (!cancelled) setToPickupRoute(null);
      }
      if (!cancelled) setRouteLoading(false);
    }
    fetchRoutes();
    return () => {
      cancelled = true;
    };
  }, [
    pickup.lat,
    pickup.lng,
    delivery.lat,
    delivery.lng,
    current?.lat,
    current?.lng,
    showToPickupLeg,
  ]);

  const allPoints = [
    pickup,
    delivery,
    ...(current ? [current] : []),
    ...extras.map((e) => ({ lat: e.lat, lng: e.lng })),
  ];

  const initialRegion = computeRegion(allPoints);

  // Once rendered, fit all markers into view
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapRef.current || allPoints.length === 0) return;
      mapRef.current.fitToCoordinates(
        allPoints.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false },
      );
    }, 400);
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

  return (
    <View style={[styles.container, { height, borderRadius, overflow: 'hidden' }, style]}>
      {/* Distance + ETA pill overlaid on top of the map */}
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
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* ── Driver's current position (blue dot) ── */}
        {current && (
          <Marker
            coordinate={{ latitude: current.lat, longitude: current.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <CurrentLocationMarker />
          </Marker>
        )}

        {/* ── Pickup pin (green) ── */}
        <Marker
          coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <PickupMarker label={pickup.label} />
        </Marker>

        {/* ── Delivery pin (red) ── */}
        <Marker
          coordinate={{ latitude: delivery.lat, longitude: delivery.lng }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <DeliveryMarker label={delivery.label} />
        </Marker>

        {/* ── Extra pins (return trips, containers, etc.) ── */}
        {extras.map((pin, i) => (
          <Marker
            key={`extra-${i}`}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <ReturnPickupMarker label={pin.label} />
          </Marker>
        ))}

        {/* ── Leg 1: current → pickup (red dashed, real road) ── */}
        {current && showToPickupLeg && (
          <Polyline
            coordinates={
              toPickupRoute?.coords ?? [
                { latitude: current.lat, longitude: current.lng },
                { latitude: pickup.lat, longitude: pickup.lng },
              ]
            }
            strokeColor="#dc2626"
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}

        {/* ── Leg 2: pickup → delivery (green solid, real road) ── */}
        <Polyline
          coordinates={
            mainRoute?.coords ?? [
              { latitude: pickup.lat, longitude: pickup.lng },
              { latitude: delivery.lat, longitude: delivery.lng },
            ]
          }
          strokeColor="#16a34a"
          strokeWidth={4}
        />
      </MapView>
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

const markerStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pinSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  pinText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tailSmall: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Current location dot
  currentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(29, 78, 216, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(29, 78, 216, 0.4)',
  },
  currentInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1d4ed8',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
