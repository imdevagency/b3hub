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
import { Truck } from 'lucide-react-native';

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
        <View style={styles.bubble}>
          <Truck size={16} color="#fff" strokeWidth={2.5} />
        </View>
        {/* Directional notch at top of bubble indicating forward */}
        <View style={styles.notch} />
      </Animated.View>
    </MarkerAnimated>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  bubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 10,
  },
  // Small triangle pointing forward (north before rotation applied)
  notch: {
    position: 'absolute',
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#111827',
  },
});
