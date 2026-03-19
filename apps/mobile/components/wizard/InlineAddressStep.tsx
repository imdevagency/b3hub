/**
 * InlineAddressStep
 *
 * Drop-in address-picking step for all booking wizards.
 * Map fills the available space; search bar + autocomplete sit below.
 * No modal overlay — the map lives natively in the step.
 *
 * Usage:
 *   <InlineAddressStep
 *     picked={pickedAddress}
 *     onPick={(p) => { setPickedAddress(p); }}
 *   />
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MapPin, Search, X, Navigation, CheckCircle } from 'lucide-react-native';
import { useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PickedAddress = {
  address: string;
  lat: number;
  lng: number;
  city: string;
};

type Props = {
  /** Currently confirmed address (null = none yet). */
  picked: PickedAddress | null;
  /** Called whenever the user confirms a new address. */
  onPick: (p: PickedAddress) => void;
  /** Optional compact banner shown above the map (e.g. pickup reference in transport step 2). */
  banner?: React.ReactNode;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const RIGA_REGION = {
  latitude: 56.9496,
  longitude: 24.1052,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function InlineAddressStep({ picked, onPick, banner }: Props) {
  const mapRef = useRef<MapView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { forwardGeocode, resolvePlace, reverseGeocodeWithCity } = useGeocode();

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    picked ? { latitude: picked.lat, longitude: picked.lng } : null,
  );
  const [query, setQuery] = useState(picked?.address ?? '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSugs, setShowSugs] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applyCoords = useCallback(
    async (lat: number, lng: number) => {
      setResolving(true);
      try {
        const result = await reverseGeocodeWithCity(lat, lng);
        onPick({ address: result.address, lat, lng, city: result.city });
        setQuery(result.address);
      } finally {
        setResolving(false);
      }
    },
    [reverseGeocodeWithCity, onPick],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (!text.trim()) {
        setSuggestions([]);
        setShowSugs(false);
        return;
      }
      searchTimer.current = setTimeout(async () => {
        const results = await forwardGeocode(text);
        setSuggestions(results);
        setShowSugs(results.length > 0);
      }, 350);
    },
    [forwardGeocode],
  );

  const handleSuggestionSelect = useCallback(
    async (sug: GeocodeSuggestion) => {
      Keyboard.dismiss();
      setShowSugs(false);
      setResolving(true);
      try {
        const coords = await resolvePlace(sug.id);
        if (!coords) return;
        const [lng, lat] = coords;
        const newPin = { latitude: lat, longitude: lng };
        setPin(newPin);
        mapRef.current?.animateToRegion(
          { ...newPin, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          600,
        );
        const city = sug.place_name.split(',').slice(-2, -1)[0]?.trim() ?? '';
        onPick({ address: sug.place_name, lat, lng, city });
        setQuery(sug.place_name);
      } finally {
        setResolving(false);
      }
    },
    [resolvePlace, onPick],
  );

  const handleGPS = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      const newPin = { latitude, longitude };
      setPin(newPin);
      mapRef.current?.animateToRegion(
        { ...newPin, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600,
      );
      await applyCoords(latitude, longitude);
    } finally {
      setLocating(false);
    }
  }, [applyCoords]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Optional banner above map (e.g. pickup reference for transport step 2) */}
      {banner}

      {/* Map fills all available space */}
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={pin ? { ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 } : RIGA_REGION}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {pin && <Marker coordinate={pin} />}
        </MapView>

        {/* GPS button */}
        <TouchableOpacity
          style={s.gpsBtn}
          onPress={handleGPS}
          disabled={locating}
          activeOpacity={0.85}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Navigation size={18} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Resolving overlay */}
        {resolving && (
          <View style={s.resolveOverlay} pointerEvents="none">
            <ActivityIndicator color="#111827" />
          </View>
        )}
      </View>

      {/* Search panel */}
      <View style={s.searchPanel}>
        {/* Input */}
        <View style={s.searchBox}>
          <Search size={15} color="#9ca3af" />
          <TextInput
            style={s.searchInput}
            placeholder="Meklēt adresi..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCorrect={false}
            onFocus={() => suggestions.length > 0 && setShowSugs(true)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              hitSlop={8}
              onPress={() => {
                setQuery('');
                setSuggestions([]);
                setShowSugs(false);
              }}
            >
              <X size={15} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete suggestions — floats above CTA */}
        {showSugs && (
          <View style={s.sugBox}>
            {suggestions.map((sg, i) => (
              <TouchableOpacity
                key={sg.id}
                style={[s.sugRow, i < suggestions.length - 1 && s.sugBorder]}
                onPress={() => handleSuggestionSelect(sg)}
                activeOpacity={0.7}
              >
                <MapPin size={12} color="#6b7280" style={{ marginTop: 2, flexShrink: 0 }} />
                <Text style={s.sugText} numberOfLines={2}>
                  {sg.place_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Confirmed address chip */}
        {!!picked && !showSugs && (
          <View style={s.confirmedChip}>
            <CheckCircle size={14} color="#059669" />
            <Text style={s.confirmedText} numberOfLines={2}>
              {picked.address}
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  gpsBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  resolveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  sugBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  sugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sugBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  sugText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  confirmedChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  confirmedText: { flex: 1, fontSize: 13, color: '#166534', lineHeight: 18 },
});
