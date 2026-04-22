/**
 * FlatAddressPicker — search bar + inline map card in one flat block.
 *
 * Designed to live inside WizardLayout's content ScrollView (no fullscreen
 * takeover, no overlay, no modal). The parent ScrollView handles scrolling;
 * the embedded map card is static (non-pannable) with a draggable pin.
 *
 * Flow:
 *   1. User types → suggestions list appears inline
 *   2. User taps suggestion / GPS → map card fades in below search bar
 *   3. User can drag the pin to refine → address updates via reverse-geocode
 *   4. Saved addresses shown when idle (no query, no picked address)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import * as Location from 'expo-location';
import { Search, X, Navigation, MapPin, ChevronRight } from 'lucide-react-native';
import { useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { SavedAddress } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import type { PickedAddress } from './InlineAddressStep';

// Guard: react-native-maps requires a native build (not available in Expo Go)
let RNMapView: any = null;
let RNMarker: any = null;
try {
  const maps = require('react-native-maps');
  RNMapView = maps.default;
  RNMarker = maps.Marker;
} catch {
  /* Expo Go */
}

export function FlatAddressPicker({
  picked,
  onPick,
}: {
  picked: PickedAddress | null;
  onPick: (p: PickedAddress) => void;
}) {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchText = useRef('');
  const isSelectingRef = useRef(false);
  const mapRef = useRef<any>(null);
  const { forwardGeocode, resolvePlace, reverseGeocodeWithCity } = useGeocode();
  const { token } = useAuth();

  const [query, setQuery] = useState(picked?.address ?? '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSugs, setShowSugs] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    picked ? { lat: picked.lat, lng: picked.lng } : null,
  );

  useEffect(() => {
    if (!token) return;
    api.savedAddresses
      .list(token)
      .then(setSavedAddresses)
      .catch(() => {});
  }, [token]);

  // ── Internal helper: commit a resolved address ──────────────────────────

  const commitAddress = useCallback(
    (addr: PickedAddress) => {
      haptics.selection();
      setPin({ lat: addr.lat, lng: addr.lng });
      onPick(addr);
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: addr.lat,
            longitude: addr.lng,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006,
          },
          400,
        );
      }, 100);
    },
    [onPick],
  );

  // ── Search ───────────────────────────────────────────────────────────────

  const handleQueryChange = useCallback(
    (text: string) => {
      if (isSelectingRef.current) return;
      setQuery(text);
      activeSearchText.current = text;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (!text.trim()) {
        setSuggestions([]);
        setShowSugs(false);
        return;
      }
      setShowSugs(true);
      searchTimer.current = setTimeout(async () => {
        setSearching(true);
        const results = await forwardGeocode(text);
        if (activeSearchText.current !== text) return;
        setSuggestions(results);
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
        const city = sug.place_name.split(',').slice(-2, -1)[0]?.trim() ?? '';
        commitAddress({ address: sug.place_name, lat, lng, city });
        setQuery(sug.place_name);
      } finally {
        setResolving(false);
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 100);
      }
    },
    [resolvePlace, commitAddress],
  );

  const handleGPS = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      isSelectingRef.current = true;
      setResolving(true);
      try {
        const result = await reverseGeocodeWithCity(latitude, longitude);
        commitAddress({
          address: result.address,
          lat: latitude,
          lng: longitude,
          city: result.city,
        });
        setQuery(result.address);
      } finally {
        setResolving(false);
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 100);
      }
    } finally {
      setLocating(false);
    }
  }, [reverseGeocodeWithCity, commitAddress]);

  const handleSavedAddressPick = useCallback(
    async (addr: SavedAddress) => {
      Keyboard.dismiss();
      if (addr.lat != null && addr.lng != null) {
        commitAddress({
          address: addr.address,
          lat: addr.lat,
          lng: addr.lng,
          city: addr.city || '',
        });
        setQuery(addr.address);
      } else {
        setResolving(true);
        try {
          const results = await forwardGeocode(addr.address);
          if (!results.length) return;
          const coords = await resolvePlace(results[0].id);
          if (!coords) return;
          const [lng, lat] = coords;
          commitAddress({ address: addr.address, lat, lng, city: addr.city || '' });
          setQuery(addr.address);
        } finally {
          setResolving(false);
        }
      }
    },
    [commitAddress, forwardGeocode, resolvePlace],
  );

  // ── Drag-to-refine ───────────────────────────────────────────────────────

  const handleMarkerDragEnd = useCallback(
    async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPin({ lat: latitude, lng: longitude });
      setReversing(true);
      try {
        const result = await reverseGeocodeWithCity(latitude, longitude);
        const updated: PickedAddress = {
          address: result.address,
          lat: latitude,
          lng: longitude,
          city: result.city,
        };
        setQuery(result.address);
        onPick(updated);
      } finally {
        setReversing(false);
      }
    },
    [reverseGeocodeWithCity, onPick],
  );

  // ── Derived flags ────────────────────────────────────────────────────────

  const busy = resolving || locating;
  const showMap = !!pin && !showSugs && !!RNMapView;
  const showSaved = !showSugs && !pin && savedAddresses.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View>
      {/* ── Search row ── */}
      <View style={fp.searchRow}>
        <View style={fp.searchWrap}>
          <View style={fp.searchIconWrap} pointerEvents="none">
            {busy ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : (
              <Search size={18} color="#9ca3af" />
            )}
          </View>
          <TextInput
            style={fp.searchInput}
            placeholder="Meklēt pēc adreses…"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={handleQueryChange}
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => {
              if (query.trim()) setShowSugs(true);
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={fp.clearBtn}
              onPress={() => {
                setQuery('');
                setSuggestions([]);
                setShowSugs(false);
              }}
            >
              <X size={15} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={fp.gpsBtn}
          onPress={handleGPS}
          activeOpacity={0.75}
          disabled={busy}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <Navigation size={18} color="#6B7280" />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Suggestions (replaces map area while typing) ── */}
      {showSugs && (
        <View style={fp.sugList}>
          {searching ? (
            <View style={fp.sugLoading}>
              <ActivityIndicator size="small" color="#9ca3af" />
            </View>
          ) : suggestions.length > 0 ? (
            suggestions.map((sg) => (
              <TouchableOpacity
                key={sg.id}
                style={fp.sugRow}
                onPress={() => handleSuggestionSelect(sg)}
                activeOpacity={0.7}
              >
                <View style={fp.sugIconWrap}>
                  <MapPin size={14} color="#9ca3af" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={fp.sugTitle} numberOfLines={1}>
                    {sg.place_name.split(',')[0]}
                  </Text>
                  <Text style={fp.sugSub} numberOfLines={1}>
                    {sg.place_name.split(',').slice(1).join(',').trim()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={fp.emptyText}>Nav atrasts neviens rezultāts</Text>
          )}
        </View>
      )}

      {/* ── Inline map card ── */}
      {showMap && (
        <View style={fp.mapCard}>
          <RNMapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider="google"
            initialRegion={{
              latitude: pin!.lat,
              longitude: pin!.lng,
              latitudeDelta: 0.006,
              longitudeDelta: 0.006,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {RNMarker && (
              <RNMarker
                coordinate={{ latitude: pin!.lat, longitude: pin!.lng }}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
            )}
          </RNMapView>
          {reversing && (
            <View style={fp.mapOverlay}>
              <ActivityIndicator size="small" color="#000" />
            </View>
          )}
        </View>
      )}

      {/* ── Confirmed address label + drag hint ── */}
      {pin && !showSugs && (
        <View style={fp.addrRow}>
          <MapPin size={14} color="#374151" />
          <Text style={fp.addrText} numberOfLines={2}>
            {query || picked?.address}
          </Text>
          {reversing && <ActivityIndicator size="small" color="#9ca3af" />}
        </View>
      )}
      {showMap && <Text style={fp.dragHint}>Velciet atzīmi, lai precizētu vietu</Text>}

      {/* ── Saved addresses (shown when idle: no query, no address) ── */}
      {showSaved && (
        <View style={fp.savedSection}>
          <Text style={fp.savedHeader}>Manas vietas</Text>
          {savedAddresses.map((addr) => (
            <TouchableOpacity
              key={addr.id}
              style={fp.savedRow}
              onPress={() => handleSavedAddressPick(addr)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={fp.savedTitle} numberOfLines={1}>
                  {addr.label}
                </Text>
                <Text style={fp.savedSub} numberOfLines={1}>
                  {addr.address}
                </Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fp = StyleSheet.create({
  // Search row
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  searchWrap: {
    flex: 1,
    height: 50,
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconWrap: { paddingLeft: 14, paddingRight: 8 },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
    paddingRight: 40,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Suggestions
  sugList: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sugLoading: { padding: 16, alignItems: 'center' },
  sugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  sugIconWrap: { width: 24, alignItems: 'center' },
  sugTitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.textPrimary },
  sugSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginTop: 1,
  },
  emptyText: {
    padding: 16,
    fontSize: 14,
    color: colors.textDisabled,
    fontFamily: 'Inter_400Regular',
  },

  // Map card
  mapCard: {
    marginHorizontal: 20,
    marginTop: 16,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  // Address label below map
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  addrText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  dragHint: {
    marginHorizontal: 20,
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textDisabled,
  },

  // Saved addresses
  savedSection: { marginTop: 20, paddingHorizontal: 20 },
  savedHeader: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: colors.textDisabled,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  savedTitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  savedSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginTop: 1,
  },
});
