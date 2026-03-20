/**
 * AddressPickerModal — Full-screen address-picker overlay.
 *
 * Flow: type in search bar → tap suggestion → map zooms to pin → confirm.
 * Map is read-only (visual confirmation only). GPS button snaps to current location.
 *
 * Features:
 *   - Google Places autocomplete search bar
 *   - Read-only map that shows where the selected address is
 *   - GPS "Use my location" button
 *   - "Apstiprināt vietu" CTA returns { address, lat, lng, city }
 *
 * Usage:
 *   <AddressPickerModal
 *     visible={showPicker}
 *     title="Piegādes vieta"
 *     initial={picked}
 *     onClose={() => setShowPicker(false)}
 *     onConfirm={(r) => { setPicked(r); setShowPicker(false); }}
 *   />
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MapPin, Search, X, Navigation, ChevronLeft } from 'lucide-react-native';
import { useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';

// ── Types ────────────────────────────────────────────────────────────────────

export type PickedAddress = {
  address: string;
  lat: number;
  lng: number;
  city: string;
};

type Props = {
  visible: boolean;
  title?: string;
  /** Optional context label describing what we're selecting (e.g. "Iekraušanas vieta" or "Piegādes vieta") */
  contextLabel?: string;
  /** Optional icon type: 'from', 'to', or undefined */
  contextIcon?: 'from' | 'to';
  /** Optional address to show as context (e.g., previously selected location) */
  contextAddress?: PickedAddress | null;
  onClose: () => void;
  onConfirm: (result: PickedAddress) => void;
  /** Pre-populate with a previous selection. */
  initial?: PickedAddress | null;
};

// ── Constants ────────────────────────────────────────────────────────────────

const { height: SH } = Dimensions.get('window');
// Smaller height — map is a preview, not an input surface
const MAP_H = Math.round(SH * 0.38);
const RIGA_REGION = {
  latitude: 56.9496,
  longitude: 24.1052,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// ── Component ────────────────────────────────────────────────────────────────

export function AddressPickerModal({
  visible,
  title,
  contextLabel,
  contextIcon,
  contextAddress,
  onClose,
  onConfirm,
  initial,
}: Props) {
  const insets = useSafeAreaInsets();
  const {
    forwardGeocode,
    resolvePlace,
    reverseGeocodeWithCity,
    loading: geoLoading,
  } = useGeocode();
  const mapRef = useRef<MapView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchText = useRef<string>('');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSugs, setShowSugs] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  // ── Reset state whenever the modal opens ─────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      const newPin = { latitude: initial.lat, longitude: initial.lng };
      setPin(newPin);
      setAddress(initial.address);
      setCity(initial.city);
      setQuery(initial.address);
      // Pan map to initial after a small delay (modal animation)
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          { ...newPin, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          300,
        );
      }, 400);
    } else {
      setPin(null);
      setAddress('');
      setCity('');
      setQuery('');
    }
    setSuggestions([]);
    setShowSugs(false);
    setSearching(false);
  }, [visible, initial]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applyCoords = useCallback(
    async (lat: number, lng: number) => {
      setResolving(true);
      try {
        const result = await reverseGeocodeWithCity(lat, lng);
        setAddress(result.address);
        setCity(result.city);
        setQuery(result.address);
      } finally {
        setResolving(false);
      }
    },
    [reverseGeocodeWithCity],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleQueryChange = useCallback(
    (text: string) => {
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
        // Use the suggestion text directly — no need to reverse-geocode back
        const displayAddress = sug.place_name;
        const extractedCity = displayAddress.split(',').slice(-2, -1)[0]?.trim() ?? '';
        setAddress(displayAddress);
        setCity(extractedCity);
        setQuery(displayAddress);
      } finally {
        setResolving(false);
      }
    },
    [resolvePlace],
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

  const handleConfirm = useCallback(() => {
    if (!pin || !address) return;
    onConfirm({ address, lat: pin.latitude, lng: pin.longitude, city });
  }, [pin, address, city, onConfirm]);

  const canConfirm = !!pin && !!address && !resolving;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[apm.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={apm.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={apm.iconBtn}>
            <ChevronLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={apm.headerTitle}>{title ?? 'Izvēlēties vietu'}</Text>
          <View style={apm.iconBtn} />
        </View>

        {/* Context card — show what we're selecting FOR */}
        {(contextLabel || contextAddress) && (
          <View style={apm.contextCard}>
            {contextAddress && (
              <View style={apm.contextSection}>
                <View style={apm.contextIconWrap}>
                  {contextIcon === 'from' && <MapPin size={14} color="#059669" />}
                  {contextIcon === 'to' && <MapPin size={14} color="#dc2626" />}
                  {!contextIcon && <MapPin size={14} color="#6b7280" />}
                </View>
                <View style={apm.contextTextWrap}>
                  <Text style={apm.contextHint}>
                    {contextIcon === 'from'
                      ? 'No šejienes'
                      : contextIcon === 'to'
                        ? 'Uz šejieni'
                        : 'Jau izvēlēts'}
                  </Text>
                  <Text style={apm.contextAddressText} numberOfLines={2}>
                    {contextAddress.address}
                  </Text>
                </View>
              </View>
            )}

            {contextLabel && (
              <View style={apm.contextAction}>
                <Text style={apm.contextActionText}>{contextLabel}</Text>
              </View>
            )}
          </View>
        )}

        {/* Map */}
        <View style={{ height: MAP_H }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={
              pin ? { ...pin, latitudeDelta: 0.01, longitudeDelta: 0.01 } : RIGA_REGION
            }
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            showsUserLocation
            showsMyLocationButton={false}
            pointerEvents="none"
          >
            {pin && <Marker coordinate={pin} />}
          </MapView>

          {/* GPS overlay button */}
          <TouchableOpacity
            style={apm.gpsBtn}
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
        </View>

        {/* Search bar */}
        <View style={apm.searchWrap}>
          <View style={apm.searchBox}>
            <Search size={15} color="#9ca3af" />
            <TextInput
              style={apm.searchInput}
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
                <X size={15} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* Autocomplete suggestions */}
          {showSugs && query.trim().length > 0 && (
            <View style={apm.sugBox}>
              {searching ? (
                <View style={apm.sugStatusRow}>
                  <ActivityIndicator size="small" color="#6b7280" />
                  <Text style={apm.sugStatusText}>Meklēju adreses...</Text>
                </View>
              ) : suggestions.length === 0 ? (
                <View style={apm.sugStatusRow}>
                  <Text style={apm.sugStatusText}>
                    Adreses netika atrastas. Pamēģini precīzāku ievadi.
                  </Text>
                </View>
              ) : (
                <ScrollView keyboardShouldPersistTaps="always" style={apm.sugScroll}>
                  {suggestions.map((s, i) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[apm.sugRow, i < suggestions.length - 1 && apm.sugBorder]}
                      onPress={() => handleSuggestionSelect(s)}
                      activeOpacity={0.7}
                    >
                      <MapPin size={12} color="#6b7280" style={{ marginTop: 2, flexShrink: 0 }} />
                      <Text style={apm.sugText} numberOfLines={2}>
                        {s.place_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* Selected address card */}
        {!!address && !showSugs && (
          <View style={apm.addressCard}>
            <MapPin size={15} color="#111827" />
            <Text style={apm.addressText} numberOfLines={2}>
              {address}
            </Text>
          </View>
        )}

        {/* Footer CTA */}
        <View style={[apm.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <TouchableOpacity
            style={[apm.confirmBtn, !canConfirm && apm.confirmBtnDisabled]}
            disabled={!canConfirm}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            {resolving ? (
              <ActivityIndicator color="#9ca3af" />
            ) : (
              <Text style={[apm.confirmText, !canConfirm && apm.confirmTextDisabled]}>
                Apstiprināt vietu
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const apm = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: -0.3 },

  // context card — shows what address we're selecting for
  contextCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contextSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  contextIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  contextTextWrap: {
    flex: 1,
    gap: 2,
  },
  contextHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contextAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  contextAction: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  contextActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },

  // map overlay buttons
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

  // search
  searchWrap: { paddingHorizontal: 16, paddingTop: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  searchBoxFocused: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  sugBox: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    maxHeight: 240,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  sugScroll: {
    maxHeight: 240,
  },
  sugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
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
  sugBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },
  sugText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  // selected address display
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 14,
  },
  addressText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20, fontWeight: '500' },

  // footer
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  confirmBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  confirmBtnDisabled: { backgroundColor: '#f3f4f6', shadowOpacity: 0, elevation: 0 },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.1 },
  confirmTextDisabled: { color: '#9ca3af' },
});
