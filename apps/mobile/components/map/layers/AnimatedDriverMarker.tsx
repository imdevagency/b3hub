/**
 * AnimatedDriverMarker — smoothly animated truck marker for live driver tracking.
 *
 * Uses react-native-maps AnimatedRegion to interpolate between GPS positions
 * instead of jumping. Computes bearing from consecutive positions and rotates
 * the truck icon to face the direction of travel.
 *
 * Must be placed inside a <BaseMap> (i.e. inside a MapView).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';


let MarkerAnimated: any = null;
let AnimatedRegion: any = null;
try {
  const Maps = require('react-native-maps');
  MarkerAnimated = Maps.MarkerAnimated;
  AnimatedRegion = Maps.AnimatedRegion;
} catch {
  /* Expo Go / web — no-op */
}

interface Props {
  id: string;
  coordinate: { lat: number; lng: number };
  /** Animation duration in ms for position + rotation tweens */
  animationDuration?: number;
}

// ── Haversine bearing (degrees, 0 = north, clockwise) ───────────────────────
function computeBearing(
  prev: { lat: number; lng: number },
  next: { lat: number; lng: number },
): number {
  const lat1 = (prev.lat * Math.PI) / 180;
  const lat2 = (next.lat * Math.PI) / 180;
  const dLon = ((next.lng - prev.lng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// Haversine distance in metres between two points
function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function AnimatedDriverMarker({ id, coordinate, animationDuration = 900 }: Props) {
  if (!MarkerAnimated || !AnimatedRegion) return null;

  // ── Position ─────────────────────────────────────────────────────────────
  const animRegion = useRef<any>(
    new AnimatedRegion({
      latitude: coordinate.lat,
      longitude: coordinate.lng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  // ── Pulse ring ─────────────────────────────────────────────────────────────
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 2.6,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // ── Rotation ─────────────────────────────────────────────────────────────
  // We track cumulative rotation (can exceed 360) so the shortest-path
  // interpolation never spins the wrong way.
  const rotAnim = useRef(new Animated.Value(0)).current;
  const currentRotRef = useRef(0); // accumulated (possibly > 360) rotation
  const prevCoordRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const prev = prevCoordRef.current;
    prevCoordRef.current = coordinate;

    // Smooth position tween
    animRegion
      .timing({
        latitude: coordinate.lat,
        longitude: coordinate.lng,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration: animationDuration,
        useNativeDriver: false,
      })
      .start();

    // Only update bearing if we moved more than 15 m (avoids noise at rest)
    if (prev && distanceMetres(prev, coordinate) > 15) {
      const newBearing = computeBearing(prev, coordinate);
      // Shortest angular path to avoid spinning the wrong way
      const diff = ((newBearing - (currentRotRef.current % 360) + 540) % 360) - 180;
      const target = currentRotRef.current + diff;
      currentRotRef.current = target;

      Animated.timing(rotAnim, {
        toValue: target,
        duration: animationDuration,
        useNativeDriver: true,
      }).start();
    }
  }, [coordinate.lat, coordinate.lng]);

  // Interpolate across full range to handle accumulated values beyond 360
  const rotate = rotAnim.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ['-3600deg', '3600deg'],
  });

  return (
    <MarkerAnimated
      key={id}
      identifier={id}
      coordinate={animRegion}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      flat
    >
      <Animated.View style={[styles.wrapper, { transform: [{ rotate }] }]}>
        {/* Pulsing ring */}
        <Animated.View
          style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
        />
        {/* Top-down vehicle (Uber style) */}
        <View style={styles.vehicleBody}>
          {/* Front headlights */}
          <View style={[styles.light, styles.headlightLeft]} />
          <View style={[styles.light, styles.headlightRight]} />
          {/* Windshield */}
          <View style={styles.windshield} />
          {/* Roof */}
          <View style={styles.roof} />
          {/* Rear window */}
          <View style={styles.rearWindow} />
          {/* Tail lights */}
          <View style={[styles.light, styles.taillightLeft]} />
          <View style={[styles.light, styles.taillightRight]} />
        </View>
      </Animated.View>
    </MarkerAnimated>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    overflow: 'visible',
  },
  pulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  vehicleBody: {
    width: 22,
    height: 46,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  windshield: {
    width: 16,
    height: 6,
    backgroundColor: '#111827',
    marginTop: 10,
    borderRadius: 2,
    opacity: 0.85,
  },
  roof: {
    width: 14,
    height: 12,
    backgroundColor: '#f3f4f6',
    marginTop: 1,
  },
  rearWindow: {
    width: 14,
    height: 5,
    backgroundColor: '#374151',
    marginTop: 1,
    borderRadius: 1,
    opacity: 0.85,
  },
  light: {
    position: 'absolute',
    width: 5,
    height: 2,
    borderRadius: 1,
  },
  headlightLeft: {
    top: 2,
    left: 3,
    backgroundColor: '#fef08a', // warm yellow
  },
  headlightRight: {
    top: 2,
    right: 3,
    backgroundColor: '#fef08a',
  },
  taillightLeft: {
    bottom: 2,
    left: 3,
    backgroundColor: '#ef4444',
  },
  taillightRight: {
    bottom: 2,
    right: 3,
    backgroundColor: '#ef4444',
  },
});
