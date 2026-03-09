/**
 * PinLayer — renders a single PointAnnotation on a Mapbox map.
 *
 * Provides pre-styled marker types that match the B3Hub design language:
 *   pickup   — green "P" bubble
 *   delivery — red "D" bubble
 *   return   — small green "R" bubble
 *   current  — blue pulsing GPS dot
 *   custom   — pass any `color` and optional `label`
 *
 * Must be placed inside a <BaseMap> (or <MapboxGL.MapView>).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// Lazy-load: native module not available in Expo Go
let MapboxGL: typeof import('@rnmapbox/maps').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MapboxGL = require('@rnmapbox/maps').default;
} catch {
  /* Expo Go */
}

export type PinType = 'pickup' | 'delivery' | 'return' | 'current' | 'custom';

interface Props {
  /** Unique annotation id — must be unique per map instance. */
  id: string;
  /** Pin position as { lat, lng }. */
  coordinate: { lat: number; lng: number };
  /** Visual style preset. Default 'custom'. */
  type?: PinType;
  /** Short text shown below the bubble. */
  label?: string;
  /** Bubble fill colour — used when type === 'custom'. */
  color?: string;
}

export function PinLayer({ id, coordinate, type = 'custom', label, color = '#6b7280' }: Props) {
  if (!MapboxGL) return null;
  const coord: [number, number] = [coordinate.lng, coordinate.lat];

  return (
    <MapboxGL.PointAnnotation id={id} coordinate={coord}>
      <View collapsable={false}>
        <MarkerForType type={type} label={label} color={color} />
      </View>
    </MapboxGL.PointAnnotation>
  );
}

// ── Marker visuals ────────────────────────────────────────────────────────────

function MarkerForType({ type, label, color }: { type: PinType; label?: string; color: string }) {
  switch (type) {
    case 'pickup':
      return <BubbleMarker letter="P" color="#16a34a" label={label} />;
    case 'delivery':
      return <BubbleMarker letter="D" color="#dc2626" label={label} />;
    case 'return':
      return <BubbleMarker letter="R" color="#059669" label={label} small />;
    case 'current':
      return <CurrentDotMarker />;
    default:
      return <BubbleMarker letter="·" color={color} label={label} />;
  }
}

function BubbleMarker({
  letter,
  color,
  label,
  small = false,
}: {
  letter: string;
  color: string;
  label?: string;
  small?: boolean;
}) {
  const size = small ? 22 : 28;
  const radius = size / 2;
  const fontSize = small ? 9 : 11;
  const tailH = small ? 6 : 7;
  const tailW = small ? 4 : 5;

  return (
    <View style={pin.wrapper}>
      <View
        style={[
          pin.bubble,
          { width: size, height: size, borderRadius: radius, backgroundColor: color },
        ]}
      >
        <Text style={[pin.letter, { fontSize }]}>{letter}</Text>
      </View>
      <View
        style={[
          pin.tail,
          {
            borderTopColor: color,
            borderTopWidth: tailH,
            borderLeftWidth: tailW,
            borderRightWidth: tailW,
          },
        ]}
      />
      {label ? <Text style={[pin.label, { color, fontSize: small ? 9 : 10 }]}>{label}</Text> : null}
    </View>
  );
}

function CurrentDotMarker() {
  return (
    <View style={pin.currentWrapper}>
      <View style={pin.currentOuter}>
        <View style={pin.currentInner} />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pin = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  bubble: {
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
  letter: { color: '#ffffff', fontWeight: '900' },
  tail: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  label: {
    fontWeight: '700',
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  // current-location dot
  currentWrapper: { alignItems: 'center', justifyContent: 'center' },
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
