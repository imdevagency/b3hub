/**
 * UnloadingSpotStep
 *
 * Shows a satellite map centred on the delivery address.
 * The buyer drags the pin to mark the exact unloading spot within the site.
 * The step is always skippable — the pin defaults to the delivery address coords.
 */
import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors } from '@/lib/theme';

// react-native-maps is not bundled in Expo Go — guard the import so the app
// loads in Expo Go and shows a fallback instead of crashing.
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = undefined;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch {
  /* Expo Go — react-native-maps not available */
}

interface Props {
  /** Geocoded address coordinates — used to centre the map and as pin default. */
  deliveryLat: number;
  deliveryLng: number;
  /** Currently-set precise unload coords (null until buyer moves the pin). */
  unloadLat: number | null;
  unloadLng: number | null;
  /** Called whenever the buyer releases the drag handle. */
  onChange: (lat: number, lng: number) => void;
}

export function UnloadingSpotStep({
  deliveryLat,
  deliveryLng,
  unloadLat,
  unloadLng,
  onChange,
}: Props) {
  const mapRef = useRef<any>(null);

  const pinLat = unloadLat ?? deliveryLat;
  const pinLng = unloadLng ?? deliveryLng;
  const isPinMoved = unloadLat !== null && unloadLng !== null;

  const handleDragEnd = (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onChange(latitude, longitude);
  };

  if (!MapView) {
    return (
      <View style={s.fallback}>
        <MapPin size={32} color={colors.textMuted} />
        <Text style={s.fallbackTitle}>Karte nav pieejama</Text>
        <Text style={s.fallbackSub}>Izkraušanas vietas precizēšana nav pieejama Expo Go.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        mapType="satellite"
        initialRegion={{
          latitude: pinLat,
          longitude: pinLng,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={{ latitude: pinLat, longitude: pinLng }}
          draggable
          onDragEnd={handleDragEnd}
        />
      </MapView>

      {/* Top instruction banner */}
      <View style={s.topBanner} pointerEvents="none">
        <Text style={s.topBannerText}>Velciet pin uz precīzo izkraušanas vietu</Text>
      </View>

      {/* Bottom status panel */}
      <View style={s.bottomPanel} pointerEvents="none">
        <View style={s.statusRow}>
          <View style={[s.statusDot, isPinMoved && s.statusDotActive]} />
          <Text style={s.statusText}>
            {isPinMoved ? 'Izkraušanas vieta atzīmēta' : 'Pin pēc noklusējuma uz adresi'}
          </Text>
        </View>
        <Text style={s.skipHint}>Varat turpināt bez precizēšanas</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Expo Go fallback ──
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  fallbackTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  fallbackSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Top banner ──
  topBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  topBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },

  // ── Bottom panel ──
  bottomPanel: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9ca3af',
  },
  statusDotActive: {
    backgroundColor: '#16a34a',
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
  skipHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    marginTop: 4,
  },
});
