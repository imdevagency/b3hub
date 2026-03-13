/**
 * PinLayer — renders a single Marker on a Google Maps (react-native-maps) map.
 *
 * Provides pre-styled marker types matching the B3Hub design language:
 *   pickup   — dark "P" bubble
 *   delivery — dark "D" bubble
 *   return   — green "R" bubble
 *   current  — blue GPS dot
 *   custom   — any colour + optional label
 *
 * Must be placed inside a <BaseMap>.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

export type PinType = 'pickup' | 'delivery' | 'return' | 'current' | 'custom';

interface Props {
  id: string;
  coordinate: { lat: number; lng: number };
  type?: PinType;
  label?: string;
  color?: string;
}

export function PinLayer({ id, coordinate, type = 'custom', label, color = '#6b7280' }: Props) {
  return (
    <Marker
      key={id}
      identifier={id}
      coordinate={{ latitude: coordinate.lat, longitude: coordinate.lng }}
      tracksViewChanges={false}
    >
      <MarkerForType type={type} label={label} color={color} />
    </Marker>
  );
}

// ── Marker visuals ────────────────────────────────────────────────────────────

function MarkerForType({ type, label, color }: { type: PinType; label?: string; color: string }) {
  switch (type) {
    case 'pickup':
      return <BubbleMarker letter="P" color="#111827" label={label} />;
    case 'delivery':
      return <BubbleMarker letter="D" color="#111827" label={label} />;
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
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
