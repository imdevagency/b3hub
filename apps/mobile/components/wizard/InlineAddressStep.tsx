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
  ScrollView,
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
  /** Pre-seed the search input text without marking an address as confirmed (e.g. reorder prefill). */
  initialText?: string;
  /** Optional compact banner shown above the map (e.g. pickup reference in transport step 2). */
  banner?: React.ReactNode;
  /** Optional label describing what address we're selecting (e.g. "Piegādes vieta"). */
  contextLabel?: string;
  /** Optional icon type: 'from' or 'to' to indicate source vs destination. */
  contextIcon?: 'from' | 'to';
  /** Optional previously selected address to show as context (e.g., pickup when selecting delivery). */
  contextAddress?: PickedAddress | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const RIGA_REGION = {
  latitude: 56.9496,
  longitude: 24.1052,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function InlineAddressStep({
  picked,
  onPick,
  initialText,
  banner,
  contextLabel,
  contextIcon,
  contextAddress,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchText = useRef<string>('');
  const isSelectingRef = useRef<boolean>(false);
  const { forwardGeocode, resolvePlace, reverseGeocodeWithCity } = useGeocode();

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    picked ? { latitude: picked.lat, longitude: picked.lng } : null,
  );
  const [query, setQuery] = useState(initialText ?? picked?.address ?? '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSugs, setShowSugs] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applyCoords = useCallback(
    async (lat: number, lng: number) => {
      isSelectingRef.current = true;
      setResolving(true);
      try {
        const result = await reverseGeocodeWithCity(lat, lng);
        onPick({ address: result.address, lat, lng, city: result.city });
        setQuery(result.address);
      } finally {
        setResolving(false);
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 100);
      }
    },
    [reverseGeocodeWithCity, onPick],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleQueryChange = useCallback(
    (text: string) => {
      if (isSelectingRef.current) return;
      setQuery(text);
      activeSearchText.current = text;

      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (!text.trim()) {
        setSuggestions([]);
        setShowSugs(false);
        setSearching(false);
        return;
      }
      setShowSugs(true);
      searchTimer.current = setTimeout(async () => {
        setSearching(true);
        const results = await forwardGeocode(text);
        if (activeSearchText.current !== text) return;
        setSuggestions(results);
        setShowSugs(true);
        setSearching(false);
      }, 350);
    },
    [forwardGeocode],
  );

  const handleSuggestionSelect = useCallback(
    async (sug: GeocodeSuggestion) => {
      isSelectingRef.current = true;
      Keyboard.dismiss();
      if (searchTimer.current) clearTimeout(searchTimer.current);
      activeSearchText.current = '';
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
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 100);
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

  const handleMapPress = useCallback(
    async (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      const nextPin = { latitude, longitude };
      setPin(nextPin);
      await applyCoords(latitude, longitude);
    },
    [applyCoords],
  );

  const handleMarkerDragEnd = useCallback(
    async (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      const nextPin = { latitude, longitude };
      setPin(nextPin);
      await applyCoords(latitude, longitude);
    },
    [applyCoords],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Map fills all available space */}
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={pin ? { ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 } : RIGA_REGION}
          onPress={handleMapPress}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {pin && <Marker coordinate={pin} draggable onDragEnd={handleMarkerDragEnd} />}
        </MapView>

        <View style={s.mapHintWrap} pointerEvents="none">
          <Text style={s.mapHintText}>
            Pieskaries kartei vai velc marķieri precīzai izkraušanas vietai
          </Text>
        </View>

        {/* GPS button */}
        <TouchableOpacity
          style={s.gpsBtn}
          onPress={handleGPS}
          disabled={locating}
          activeOpacity={0.85}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <Navigation size={20} color="#111827" />
          )}
        </TouchableOpacity>
      </View>

      {/* Search panel */}
      <View style={s.searchPanel}>
        {/* Optional reference address timeline */}
        {contextAddress && (
          <View style={s.timelineWrap}>
            <View style={s.timelineRow}>
              <View style={s.timelineDot} />
              <Text style={s.timelineText} numberOfLines={1}>
                {contextAddress.address}
              </Text>
            </View>
            <View style={s.timelineLine} />
          </View>
        )}

        {/* Input */}
        <View style={[s.searchBox, showSugs && s.searchBoxFocused]}>
          <Search size={20} color="#111827" />
          <TextInput
            style={s.searchInput}
            placeholder="Meklēt adresi..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCorrect={false}
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
              <X size={20} color="#111827" />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete suggestions — floats above CTA */}
        {showSugs && query.trim().length > 0 && (
          <View style={s.sugBox}>
            {searching ? (
              <View style={s.sugStatusRow}>
                <ActivityIndicator size="small" color="#6b7280" />
                <Text style={s.sugStatusText}>Meklēju adreses...</Text>
              </View>
            ) : suggestions.length === 0 ? (
              <View style={s.sugStatusRow}>
                <Text style={s.sugStatusText}>
                  Adreses netika atrastas. Pamēģini precīzāku ievadi.
                </Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="always" style={s.sugScroll}>
                {suggestions.map((sg, i) => (
                  <TouchableOpacity
                    key={sg.id}
                    style={[s.sugRow, i < suggestions.length - 1 && s.sugBorder]}
                    onPress={() => handleSuggestionSelect(sg)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#f3f4f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MapPin size={16} color="#4b5563" />
                    </View>
                    <Text style={s.sugText} numberOfLines={2}>
                      {sg.place_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
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
  mapHintWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.88)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mapHintText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  gpsBtn: {
    position: 'absolute',
    bottom: 34,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  searchPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20, // Overlap map
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  timelineWrap: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9ca3af',
    marginLeft: 6,
  },
  timelineText: {
    flex: 1,
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  timelineLine: {
    width: 2,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginLeft: 9,
    marginTop: 4,
    marginBottom: -4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchBoxFocused: {
    borderColor: '#111827',
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500', color: '#111827', padding: 0 },
  sugBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: 280,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    marginTop: 8,
  },
  sugScroll: {
    maxHeight: 280,
  },
  sugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sugStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sugStatusText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  sugBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  sugText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#111827', lineHeight: 22 },

  confirmedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  confirmedText: { flex: 1, fontSize: 15, color: '#111827', lineHeight: 22, fontWeight: '600' },
});
