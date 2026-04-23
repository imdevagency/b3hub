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

export type PinType =
  | 'pickup'
  | 'delivery'
  | 'return'
  | 'current'
  | 'custom'
  | 'home'
  | 'elegant-pickup'
  | 'elegant-delivery';

interface Props {
  id: string;
  coordinate: { lat: number; lng: number };
  type?: PinType;
  label?: string;
  subtitle?: string;
  color?: string;
  iconColor?: string;
}

export function PinLayer({
  id,
  coordinate,
  type = 'custom',
  label,
  subtitle,
  color,
  iconColor,
}: Props) {
  if (!Marker) return null;

  // Calculate vertical anchor offset based on what is rendering
  const anchor = type.startsWith('elegant') ? { x: 0.5, y: 0.9 } : { x: 0.5, y: 1 };

  return (
    <Marker
      key={id}
      identifier={id}
      coordinate={{ latitude: coordinate.lat, longitude: coordinate.lng }}
      tracksViewChanges={false}
      anchor={anchor}
    >
      <MarkerForType
        type={type}
        label={label}
        subtitle={subtitle}
        color={color}
        iconColor={iconColor}
      />
    </Marker>
  );
}

// ── Marker visuals ────────────────────────────────────────────────────────────

function MarkerForType({
  type,
  label,
  subtitle,
  color,
  iconColor,
}: {
  type: PinType;
  label?: string;
  subtitle?: string;
  color?: string;
  iconColor?: string;
}) {
  switch (type) {
    case 'elegant-pickup':
      return <ElegantPill type="pickup" label={label} subtitle={subtitle} />;
    case 'elegant-delivery':
      return <ElegantPill type="delivery" label={label} subtitle={subtitle} />;
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

function ElegantPill({
  type,
  label,
  subtitle,
}: {
  type: 'pickup' | 'delivery';
  label?: string;
  subtitle?: string;
}) {
  const isPickup = type === 'pickup';
  const mainColor = isPickup ? '#4f46e5' : '#14b8a6'; // Indigo for pickup, teal for delivery

  return (
    <View style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }}>
      {/* Floating Pill */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#fff',
          borderRadius: 24,
          padding: 6,
          paddingRight: 18,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 8,
          marginBottom: -16, // overlap the dot below
          zIndex: 2,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: mainColor,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontWeight: '800',
              fontSize: 13,
              transform: [{ translateY: -1 }],
            }}
          >
            {isPickup ? 'P' : 'D'}
          </Text>
        </View>
        <View style={{ justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
            {label || (isPickup ? 'Iekraušana' : 'Piegāde')}
          </Text>
          {subtitle ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: '#6b7280',
                maxWidth: 140,
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Target Dot on ground */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: `${mainColor}20`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mainColor }} />
        </View>
      </View>
    </View>
  );
}
