/**
 * InlineAddressStep — Two-phase address picker
 *
 * Phase 1 (SEARCH): search bar + autocomplete + GPS + saved addresses
 * Phase 2 (MAP_CONFIRM): full-screen map with draggable pin, reverse-geocoded
 *   address shown in bottom panel, explicit "Apstiprināt" button.
 *
 * Flow: search → select → MAP_CONFIRM → confirm → onConfirm()
 * The double-advance bug cannot occur because the confirm button only exists
 * on the MAP_CONFIRM screen, and each wizard step is a fresh component
 * mounted with a unique key.
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  ArrowLeft,
  Search,
  X,
  Navigation,
  ChevronRight,
  MapPin,
  Clock,
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

type Mode = 'SEARCH' | 'MAP_CONFIRM';

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
  /** 'transport' renders the Uber route-stack header (pickup + dropoff).
   *  All other flows omit this prop — they get the simple delivery header. */
  variant?: 'transport';
  /** When provided, a live price preview is shown in the map confirmation panel */
  pricePreviewCategory?: MaterialCategory;
  pricePreviewQuantity?: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function InlineAddressStep({
  picked,
  onPick,
  onConfirm,
  onCancel,
  initialText,
  contextLabel = 'Izvēlēties vietu',
  contextAddress,
  variant,
  pricePreviewCategory,
  pricePreviewQuantity,
}: Props) {
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchText = useRef<string>('');
  const isSelectingRef = useRef<boolean>(false);
  const mapRef = useRef<MapView>(null);
  const { forwardGeocode, resolvePlace, reverseGeocodeWithCity } = useGeocode();
  const { token } = useAuth();

  const [mode, setMode] = useState<Mode>('SEARCH');
  // Transport steps always start empty — no pre-filled dropoff address.
  const [query, setQuery] = useState(
    variant === 'transport' ? (initialText ?? '') : (initialText ?? picked?.address ?? ''),
  );
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSugs, setShowSugs] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // Map-confirm state
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    picked ? { lat: picked.lat, lng: picked.lng } : null,
  );
  const [resolvedAddress, setResolvedAddress] = useState<PickedAddress | null>(picked ?? null);
  const [reversing, setReversing] = useState(false);

  // Live price preview (material order only)
  const [previewOffers, setPreviewOffers] = useState<SupplierOffer[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!pricePreviewCategory || pricePreviewQuantity == null || !token || !resolvedAddress) {
      setPreviewOffers([]);
      return;
    }
    previewAbortRef.current?.abort();
    const ctrl = new AbortController();
    previewAbortRef.current = ctrl;
    setPreviewLoading(true);
    api.materials
      .getOffers(
        {
          category: pricePreviewCategory,
          quantity: pricePreviewQuantity,
          lat: resolvedAddress.lat,
          lng: resolvedAddress.lng,
        },
        token,
      )
      .then((offers) => {
        if (ctrl.signal.aborted) return;
        setPreviewOffers(offers.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      });
    return () => ctrl.abort();
  }, [
    resolvedAddress?.lat,
    resolvedAddress?.lng,
    pricePreviewCategory,
    pricePreviewQuantity,
    token,
  ]);

  useEffect(() => {
    if (!token) return;
    api.savedAddresses
      .list(token)
      .then(setSavedAddresses)
      .catch(() => {});
  }, [token]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Enter map-confirm mode at given coords with address string */
  const enterMapConfirm = useCallback(
    (addr: PickedAddress) => {
      setResolvedAddress(addr);
      setPin({ lat: addr.lat, lng: addr.lng });
      onPick(addr);
      setMode('MAP_CONFIRM');
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          { latitude: addr.lat, longitude: addr.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
          400,
        );
      }, 150);
    },
    [onPick],
  );

  // ── Search handlers ───────────────────────────────────────────────────────

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
        const city = sug.place_name.split(',').slice(-2, -1)[0]?.trim() ?? '';
        enterMapConfirm({ address: sug.place_name, lat, lng, city });
        setQuery(sug.place_name);
      } finally {
        setResolving(false);
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 100);
      }
    },
    [resolvePlace, enterMapConfirm],
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
        enterMapConfirm({
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
  }, [reverseGeocodeWithCity, enterMapConfirm]);

  const handleSavedAddressPick = useCallback(
    async (addr: SavedAddress) => {
      Keyboard.dismiss();
      if (addr.lat != null && addr.lng != null) {
        enterMapConfirm({
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
          enterMapConfirm({ address: addr.address, lat, lng, city: addr.city || '' });
          setQuery(addr.address);
        } finally {
          setResolving(false);
        }
      }
    },
    [enterMapConfirm, forwardGeocode, resolvePlace],
  );

  // ── Map-confirm handlers ──────────────────────────────────────────────────

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
        setResolvedAddress(updated);
        onPick(updated);
        setQuery(result.address);
      } finally {
        setReversing(false);
      }
    },
    [reverseGeocodeWithCity, onPick],
  );

  const handleConfirm = useCallback(() => {
    haptics.light();
    onConfirm?.();
  }, [onConfirm]);

  // ── Render: MAP_CONFIRM ───────────────────────────────────────────────────

  if (mode === 'MAP_CONFIRM' && pin) {
    return (
      <View style={s.root}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: pin.lat,
            longitude: pin.lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        </MapView>

        {/* Floating header */}
        <SafeAreaView style={s.mapHeader} pointerEvents="box-none">
          <View style={s.mapHeaderInner}>
            <TouchableOpacity style={s.mapBackBtn} onPress={() => setMode('SEARCH')} hitSlop={12}>
              <ArrowLeft size={22} color="#000" />
            </TouchableOpacity>
            <Text style={s.mapHeaderTitle}>{contextLabel}</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>

        {/* Bottom panel */}
        <View style={s.mapPanel}>
          <View style={s.mapPanelRow}>
            <View style={s.mapPinIconWrap}>
              <MapPin size={18} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              {reversing ? (
                <View style={s.reversingRow}>
                  <ActivityIndicator size="small" color="#9ca3af" />
                  <Text style={s.reversingText}>Nosaka adresi…</Text>
                </View>
              ) : (
                <>
                  <Text style={s.mapAddrMain} numberOfLines={2}>
                    {resolvedAddress?.address ?? '—'}
                  </Text>
                  {resolvedAddress?.city ? (
                    <Text style={s.mapAddrCity}>{resolvedAddress.city}</Text>
                  ) : null}
                </>
              )}
            </View>
          </View>

          <Text style={s.mapHint}>Velciet pin, lai precizētu vietu</Text>

          {/* Price preview (material order only) */}
          {pricePreviewCategory && pricePreviewQuantity != null && (
            <View style={s.previewWrap}>
              {previewLoading ? (
                <View style={s.previewLoading}>
                  <ActivityIndicator size="small" color="#6b7280" />
                  <Text style={s.previewLoadingText}>Rēķina cenas…</Text>
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
            style={[s.confirmBtn, reversing && s.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={reversing}
          >
            <Text style={s.confirmBtnText}>Apstiprināt vietu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: SEARCH ────────────────────────────────────────────────────────

  const isTransportStep = variant === 'transport';

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safeArea}>
        {isTransportStep && contextAddress ? (
          // ── Transport step 2: route-stack (locked pickup + active dropoff) ──
          <View style={s.uberStackWrap}>
            <View style={s.uberBackRow}>
              <TouchableOpacity style={s.backBtn} onPress={() => onCancel?.()} hitSlop={12}>
                <ArrowLeft size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={s.uberStackRow}>
              <View style={s.uberTimeline}>
                <View style={s.uberDot} />
                <View style={s.uberLine} />
                <View style={s.uberSquare} />
              </View>
              <View style={s.uberInputs}>
                <View style={s.uberInputStatic}>
                  <Text style={s.uberInputStaticText} numberOfLines={1}>
                    {contextAddress.address}
                  </Text>
                </View>
                <View style={s.uberInputActiveWrap}>
                  <TextInput
                    style={s.uberInputActive}
                    placeholder="Kurp dosimies?"
                    placeholderTextColor="#9ca3af"
                    value={query}
                    onChangeText={handleQueryChange}
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {query.length > 0 && (
                    <TouchableOpacity
                      style={s.uberClearBtn}
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
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={s.searchHeader}>
              <Text style={s.headerTitle}>{contextLabel}</Text>
              <TouchableOpacity style={s.headerCloseBtn} onPress={() => onCancel?.()} hitSlop={12}>
                <X size={22} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={s.searchInputWrap}>
              <View style={s.searchIconLeft} pointerEvents="none">
                <Search size={18} color="#9ca3af" />
              </View>
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
          </>
        )}

        {(resolving || locating) && (
          <View style={s.searchingRow}>
            <ActivityIndicator size="small" color="#9ca3af" />
          </View>
        )}

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <TouchableOpacity
            style={s.actionRow}
            onPress={handleGPS}
            activeOpacity={0.7}
            disabled={locating || resolving}
          >
            <View style={s.actionIconWrap}>
              {locating || resolving ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <Navigation size={20} color="#6B7280" />
              )}
            </View>
            <Text style={s.actionText}>
              {locating ? 'Nosaka atrašanās vietu…' : 'Lietot manu šī brīža vietu'}
            </Text>
          </TouchableOpacity>

          <View style={s.divider} />

          {showSugs ? (
            searching ? (
              <View style={s.searchingRow}>
                <ActivityIndicator size="small" color="#9ca3af" />
              </View>
            ) : suggestions.length > 0 ? (
              suggestions.map((sg) => (
                <TouchableOpacity
                  key={sg.id}
                  style={s.suggRow}
                  onPress={() => handleSuggestionSelect(sg)}
                  activeOpacity={0.7}
                >
                  <View style={s.suggIconWrap}>
                    <Search size={15} color="#9ca3af" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.suggTitle} numberOfLines={1}>
                      {sg.place_name.split(',')[0]}
                    </Text>
                    <Text style={s.suggSub} numberOfLines={1}>
                      {sg.place_name.split(',').slice(1).join(',').trim()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={s.emptyText}>Nav atrasts neviens rezultāts</Text>
            )
          ) : (
            <View>
              <Text style={s.sectionHeader}>Manas vietas</Text>
              {savedAddresses.length === 0 ? (
                <Text style={s.emptyText}>Jums nav saglabātu adrešu</Text>
              ) : (
                savedAddresses.map((addr) => (
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
                ))
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
  root: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1 },

  // ── Map confirm ──
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  mapHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeaderTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#000' },
  mapPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    gap: 12,
  },
  mapPanelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mapPinIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reversingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  reversingText: { fontSize: 14, color: '#9ca3af', fontFamily: 'Inter_400Regular' },
  mapAddrMain: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#000', lineHeight: 22 },
  mapAddrCity: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6b7280', marginTop: 2 },
  mapHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9ca3af', textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  confirmBtnDisabled: { backgroundColor: '#d1d5db' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  // Price preview
  previewWrap: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  previewLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewLoadingText: { fontSize: 12, color: '#6b7280', fontFamily: 'Inter_500Medium' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  previewHeaderText: { fontSize: 12, color: '#059669', fontFamily: 'Inter_600SemiBold' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
    gap: 8,
  },
  previewSupplier: { fontSize: 13, color: '#000', fontFamily: 'Inter_500Medium' },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  previewMetaText: { fontSize: 11, color: '#6b7280', fontFamily: 'Inter_400Regular' },
  previewMetaDot: { fontSize: 11, color: '#9ca3af' },
  previewPriceCol: { alignItems: 'flex-end' },
  previewPrice: { fontSize: 14, color: '#059669', fontFamily: 'Inter_700Bold' },
  previewUnit: { fontSize: 11, color: '#6b7280', fontFamily: 'Inter_400Regular' },

  // ── Uber Stack (transport steps SEARCH mode) ──
  uberStackWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  uberBackRow: { flexDirection: 'row', marginBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberStackRow: { flexDirection: 'row' },
  uberTimeline: {
    width: 24,
    alignItems: 'center',
    paddingVertical: 14,
    marginRight: 12,
  },
  uberDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  uberLine: { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
  uberSquare: { width: 10, height: 10, backgroundColor: '#000' },
  uberInputs: { flex: 1, gap: 10 },
  uberInputActiveWrap: { position: 'relative' },
  uberInputActive: {
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 42,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#000',
  },
  uberClearBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberInputStatic: {
    height: 48,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  uberInputStaticText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#6b7280' },
  uberInputPlaceholder: { backgroundColor: '#f3f4f6', borderWidth: 0 },
  uberInputPlaceholderText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#bbb' },

  // ── Generic search header ──
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#000' },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputWrap: { paddingHorizontal: 16, paddingVertical: 8, position: 'relative' },
  searchIconLeft: { position: 'absolute', left: 32, top: 22, zIndex: 1 },
  searchTextInput: {
    height: 52,
    borderRadius: 14,
    paddingLeft: 46,
    paddingRight: 44,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#000',
    backgroundColor: '#f3f4f6',
  },
  searchClearBtn: { position: 'absolute', right: 28, top: 25 },

  // ── List ──
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#000' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20, marginVertical: 4 },
  searchingRow: { alignItems: 'center', paddingVertical: 24 },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  suggIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#000', marginBottom: 2 },
  suggSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9ca3af' },
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  savedPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  savedPlaceTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    marginBottom: 3,
  },
  savedPlaceSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    paddingHorizontal: 20,
    fontFamily: 'Inter_400Regular',
    marginTop: 12,
  },
});
