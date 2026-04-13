/**
 * InlineAddressStep (Now Fullscreen GlobalAddressPicker)
 *
 * Fullscreen address-picking step matching 2-screen design:
 *   - Screen 1: Search / Select from Saved / GPS
 *   - Screen 2: Map confirmation
 *
 * Usage:
 *   <InlineAddressStep
 *     picked={pickedAddress}
 *     onPick={(p) => setPickedAddress(p)}
 *     onConfirm={() => goNext()}
 *     onCancel={() => goBack()}
 *     contextLabel="Izkraušanas vieta"
 *   />
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
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import {
  MapPin,
  Search,
  X,
  Navigation,
  CheckCircle,
  Star,
  Map,
  ChevronRight,
  Clock,
  Tag,
  TrendingDown,
} from 'lucide-react-native';
import { useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { SavedAddress, SupplierOffer, MaterialCategory } from '@/lib/api';
import { haptics } from '@/lib/haptics';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PickedAddress = {
  address: string;
  lat: number;
  lng: number;
  city: string;
};

type Props = {
  picked: PickedAddress | null;
  onPick: (p: PickedAddress) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  initialText?: string;
  banner?: React.ReactNode;
  contextLabel?: string;
  contextIcon?: 'from' | 'to';
  contextAddress?: PickedAddress | null;
  /** When provided, a live price preview is fetched after picking an address */
  pricePreviewCategory?: MaterialCategory;
  pricePreviewQuantity?: number;
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
  onConfirm,
  onCancel,
  initialText,
  banner,
  contextLabel = 'Izvēlēties vietu',
  contextIcon,
  contextAddress,
  pricePreviewCategory,
  pricePreviewQuantity,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchText = useRef<string>('');
  const isSelectingRef = useRef<boolean>(false);
  const { forwardGeocode, resolvePlace, reverseGeocodeWithCity } = useGeocode();
  const { token } = useAuth();

  const [mode, setMode] = useState<'SEARCH' | 'MAP'>('SEARCH');
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    picked ? { latitude: picked.lat, longitude: picked.lng } : null,
  );
  const [query, setQuery] = useState(initialText ?? picked?.address ?? '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSugs, setShowSugs] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // ── Live price preview ─────────────────────────────────────────────────────
  const [previewOffers, setPreviewOffers] = useState<SupplierOffer[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!pricePreviewCategory || pricePreviewQuantity == null || !token || !picked) {
      setPreviewOffers([]);
      return;
    }
    // Cancel any in-flight preview fetch
    previewAbortRef.current?.abort();
    const ctrl = new AbortController();
    previewAbortRef.current = ctrl;
    setPreviewLoading(true);
    api.materials
      .getOffers(
        {
          category: pricePreviewCategory,
          quantity: pricePreviewQuantity,
          lat: picked.lat,
          lng: picked.lng,
        },
        token,
      )
      .then((offers) => {
        if (ctrl.signal.aborted) return;
        // Show top 3 cheapest
        setPreviewOffers(offers.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      });
    return () => ctrl.abort();
  }, [picked?.lat, picked?.lng, pricePreviewCategory, pricePreviewQuantity, token]);

  useEffect(() => {
    if (!token) return;
    api.savedAddresses
      .list(token)
      .then(setSavedAddresses)
      .catch(() => {});
  }, [token]);

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
        setMode('MAP');
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
      await applyCoords(latitude, longitude);
      setMode('MAP');
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          { ...newPin, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          600,
        );
      }, 100);
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

  const handleSavedAddressPick = useCallback(
    async (addr: SavedAddress) => {
      Keyboard.dismiss();
      if (addr.lat != null && addr.lng != null) {
        const newPin = { latitude: addr.lat, longitude: addr.lng };
        setPin(newPin);
        setQuery(addr.address);
        onPick({ address: addr.address, lat: addr.lat, lng: addr.lng, city: addr.city || '' });
        setMode('MAP');
        setTimeout(() => {
          mapRef.current?.animateToRegion(
            { ...newPin, latitudeDelta: 0.01, longitudeDelta: 0.01 },
            600,
          );
        }, 100);
      } else {
        setResolving(true);
        try {
          const results = await forwardGeocode(addr.address);
          if (!results.length) return;
          const coords = await resolvePlace(results[0].id);
          if (!coords) return;
          const [lng, lat] = coords;
          const newPin = { latitude: lat, longitude: lng };
          setPin(newPin);
          setQuery(addr.address);
          onPick({ address: addr.address, lat, lng, city: addr.city || '' });
          setMode('MAP');
          setTimeout(() => {
            mapRef.current?.animateToRegion(
              { ...newPin, latitudeDelta: 0.01, longitudeDelta: 0.01 },
              600,
            );
          }, 100);
        } finally {
          setResolving(false);
        }
      }
    },
    [onPick, forwardGeocode, resolvePlace],
  );

  const handleConfirmDone = useCallback(() => {
    haptics.light();
    if (onConfirm) onConfirm();
  }, [onConfirm]);

  const handleCancelDone = useCallback(() => {
    if (onCancel) onCancel();
  }, [onCancel]);

  // ── Render MAP Mode ────────────────────────────────────────────────────────

  if (mode === 'MAP') {
    return (
      <View style={s.root}>
        <MapView
          ref={mapRef}
          style={s.mapFullscreen}
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

        {/* Floating cross circular button top-right */}
        <SafeAreaView style={s.floatingHeader}>
          <View style={s.floatingHeaderContent}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={s.mapXBtn}
              onPress={() => setMode('SEARCH')}
              activeOpacity={0.8}
            >
              <X size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Bottom Confirmation Card Overlay */}
        <View style={s.bottomPanel}>
          <Text style={s.panelTitle}>Apstipriniet vietu</Text>
          <View style={s.panelInfoRow}>
            <View style={s.panelPinOuter}>
              <MapPin size={24} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.panelAddress} numberOfLines={2}>
                {picked?.address || query || 'Izvēlēties vietu kartē'}
              </Text>
            </View>
          </View>
          {/* Live price preview strip */}
          {pricePreviewCategory && pricePreviewQuantity != null && (
            <View style={s.previewWrap}>
              {previewLoading ? (
                <View style={s.previewLoading}>
                  <ActivityIndicator size="small" color="#6b7280" />
                  <Text style={s.previewLoadingText}>Rēķina cenas jūsu adresei…</Text>
                </View>
              ) : previewOffers.length > 0 ? (
                <>
                  <View style={s.previewHeader}>
                    <TrendingDown size={13} color="#059669" />
                    <Text style={s.previewHeaderText}>
                      {previewOffers.length} piegādātājs{previewOffers.length > 1 ? 'i' : ''}{' '}
                      pieejams
                    </Text>
                  </View>
                  {previewOffers.map((offer) => (
                    <View key={offer.id} style={s.previewRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.previewSupplier} numberOfLines={1}>
                          {offer.supplier.name}
                        </Text>
                        <View style={s.previewMeta}>
                          {offer.distanceKm != null && (
                            <>
                              <Text style={s.previewMetaText}>{offer.distanceKm} km</Text>
                              <Text style={s.previewMetaDot}>·</Text>
                            </>
                          )}
                          <Clock size={10} color="#6b7280" />
                          <Text style={s.previewMetaText}>
                            {offer.etaLabel ?? `${offer.etaDays}d`}
                          </Text>
                        </View>
                      </View>
                      <View style={s.previewPriceCol}>
                        <Text style={s.previewPrice}>€{offer.totalPrice.toFixed(2)}</Text>
                        <Text style={s.previewUnit}>
                          €{offer.effectiveUnitPrice.toFixed(2)}/{offer.unit.toLowerCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={[s.ctaBtn, resolving || locating ? s.ctaBtnDisabled : {}]}
            onPress={handleConfirmDone}
            disabled={resolving || locating || !picked}
            activeOpacity={0.88}
          >
            {resolving || locating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.ctaBtnText}>APSTIPRINĀT</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render SEARCH Mode ─────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <SafeAreaView style={s.searchSafeArea}>
        {/* Header */}
        <View style={s.searchHeader}>
          <View style={s.headerSpacer} />
          <Text style={s.headerTitle}>{contextLabel}</Text>
          <TouchableOpacity style={s.headerSpacerRight} onPress={handleCancelDone} hitSlop={12}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Input */}
        <View style={s.searchInputWrap}>
          <TextInput
            style={s.searchTextInput}
            placeholder="Meklēt pēc adreses/nosaukuma"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={s.searchClearBtn}
              onPress={() => {
                setQuery('');
                setSuggestions([]);
                setShowSugs(false);
              }}
            >
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* Action Buttons */}
          <TouchableOpacity style={s.actionRow} onPress={handleGPS} activeOpacity={0.7}>
            <View style={s.actionIconWrap}>
              <Navigation size={20} color="#6B7280" />
            </View>
            <Text style={s.actionText}>Lietot manu šī brīža vietu</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionRow} onPress={() => setMode('MAP')} activeOpacity={0.7}>
            <View style={s.actionIconWrap}>
              <Map size={20} color="#6B7280" />
            </View>
            <Text style={s.actionText}>Norādīt vietu kartē</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider} />

          {/* Autocomplete Suggestions OR Saved Places */}
          {showSugs && suggestions.length > 0 ? (
            <View>
              {suggestions.map((sg, i) => (
                <TouchableOpacity
                  key={sg.id}
                  style={s.savedPlaceRow}
                  onPress={() => handleSuggestionSelect(sg)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.savedPlaceTitle} numberOfLines={1}>
                      {sg.place_name}
                    </Text>
                    <Text style={s.savedPlaceSub} numberOfLines={1}>
                      {sg.place_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text style={s.sectionHeader}>Manas vietas</Text>
              {savedAddresses.map((addr) => (
                <TouchableOpacity
                  key={addr.id}
                  style={s.savedPlaceRow}
                  onPress={() => handleSavedAddressPick(addr)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.savedPlaceTitle} numberOfLines={1}>
                      {addr.label}
                    </Text>
                    <Text style={s.savedPlaceSub} numberOfLines={1}>
                      {addr.address}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
              {savedAddresses.length === 0 && (
                <Text style={s.emptyText}>Jums nav saglabātu adrešu</Text>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ── MAP MODE ──
  mapFullscreen: {
    flex: 1,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  floatingHeaderContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  mapXBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    maxHeight: '65%',
  },
  panelTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
    marginBottom: 16,
  },
  panelInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  panelPinOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelAddress: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
  },
  ctaBtn: {
    backgroundColor: '#10b981', // APSTIPRINĀT green
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },

  // ── Live price preview ──
  previewWrap: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  previewLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewLoadingText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Inter_500Medium',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  previewHeaderText: {
    fontSize: 12,
    color: '#059669',
    fontFamily: 'Inter_600SemiBold',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
    gap: 8,
  },
  previewSupplier: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'Inter_500Medium',
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  previewMetaText: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  previewMetaDot: {
    fontSize: 11,
    color: '#9ca3af',
  },
  previewPriceCol: {
    alignItems: 'flex-end',
  },
  previewPrice: {
    fontSize: 14,
    color: '#059669',
    fontFamily: 'Inter_700Bold',
  },
  previewUnit: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },

  // \u2500\u2500 SEARCH MODE \u2500\u2500
  searchSafeArea: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  headerSpacerRight: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  searchInputWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchTextInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#111827',
    backgroundColor: '#fff',
  },
  searchClearBtn: {
    position: 'absolute',
    right: 28,
    top: 28,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  actionIconWrap: {
    width: 24,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  savedPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  savedPlaceTitle: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
    marginBottom: 4,
  },
  savedPlaceSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
    marginTop: 10,
  },
});
