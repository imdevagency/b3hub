/**
 * PinLayer — renders a single Marker on a Google Maps (react-native-maps) map.
 *
 * Provides pre-styled marker types matching the B3Hub design language:
 *   pickup   — dark bubble with ArrowUp icon
 *   delivery — dark bubble with ArrowDown icon
 *   return   — green bubble with Refresh icon
 *   current  — blue GPS dot
 *   custom   — dark default bubble with Dot icon
 *
 * Must be placed inside a <BaseMap>.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';
import { ArrowUp, ArrowDown, RefreshCcw, Circle, MapPin, Home } from 'lucide-react-native';

let Marker: any = null;
try {
  Marker = require('react-native-maps').Marker;
} catch {
  /* Expo Go */
}

export type PinType = 'pickup' | 'delivery' | 'return' | 'current' | 'custom' | 'home';

interface Props {
  id: string;
  coordinate: { lat: number; lng: number };
  type?: PinType;
  label?: string;
  color?: string;
  iconColor?: string;
}

export function PinLayer({ id, coordinate, type = 'custom', label, color, iconColor }: Props) {
  if (!Marker) return null;
  return (
    <Marker
      key={id}
      identifier={id}
      coordinate={{ latitude: coordinate.lat, longitude: coordinate.lng }}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
    >
      <MarkerForType type={type} label={label} color={color} iconColor={iconColor} />
    </Marker>
  );
}

// ── Marker visuals ────────────────────────────────────────────────────────────

function MarkerForType({
  type,
  label,
  color,
  iconColor,
}: {
  type: PinType;
  label?: string;
  color?: string;
  iconColor?: string;
}) {
  switch (type) {
    case 'pickup':
      return (
        <PinBubble icon={ArrowUp} color={color || '#111827'} label={label} iconColor={iconColor} />
      );
    case 'delivery':
      return (
        <PinBubble
          icon={ArrowDown}
          color={color || '#111827'}
          label={label}
          iconColor={iconColor}
        />
      );
    case 'return':
      return (
        <PinBubble
          icon={RefreshCcw}
          color={color || '#059669'}
          label={label}
          iconColor={iconColor}
          small
        />
      );
    case 'home':
      return (
        <PinBubble icon={Home} color={color || '#111827'} label={label} iconColor={iconColor} />
      );
    case 'current':
      return <CurrentDotMarker />;
    case 'custom':
    default:
      return (
        <PinBubble
          icon={Circle}
          fillIcon
          color={color || '#111827'}
          label={label}
          iconColor={iconColor}
        />
      );
  }
}

function PinBubble({
  icon: IconComponent,
  color,
  iconColor = colors.white,
  label,
  small = false,
  fillIcon = false,
}: {
  icon: any;
  color: string;
  iconColor?: string;
  label?: string;
  small?: boolean;
  fillIcon?: boolean;
}) {
  const size = small ? 24 : 34;
  const radius = size / 2;
  const iconSize = small ? 14 : 18;

  return (
    <View style={pin.wrapper}>
      <View
        style={[
          pin.bubble,
          { width: size, height: size, borderRadius: radius, backgroundColor: color },
        ]}
      >
        <IconComponent
          size={iconSize}
          color={iconColor}
          fill={fillIcon ? iconColor : 'none'}
          strokeWidth={fillIcon ? 0 : 2}
        />
      </View>
      <View
        style={[
          pin.tail,
          {
            borderTopColor: color,
          },
        ]}
      />
      {label ? (
        <Text style={[pin.label, { fontSize: small ? 11 : 13 }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
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
  wrapper: { alignItems: 'center', minWidth: 120 },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  label: {
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  currentWrapper: { alignItems: 'center', justifyContent: 'center' },
  currentOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    backgroundColor: colors.primaryMid,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
