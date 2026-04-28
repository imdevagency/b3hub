/**
 * AddressPicker — full-screen address picker with tap-to-place pin.
 *
 * Usage:
 *   <AddressPicker
 *     visible={open}
 *     title="Pickup location"
 *     initialAddress="Rīga, Latvia"
 *     initialLat={56.9496}
 *     initialLng={24.1052}
 *     onConfirm={({ address, lat, lng }) => { ... }}
 *     onClose={() => setOpen(false)}
 *   />
 *
 * The user can:
 *   1. Type an address → Google Maps Geocoding autocomplete
 *   2. Tap a suggestion → map flies to that location
 *   3. Tap the map to fine-tune the exact gate/bay/entrance
 *   4. Press Confirm → returns address + precise coords
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { Marker } from 'react-native-maps';
import { MapPin, X, Check, Search, Navigation } from 'lucide-react-native';
import { BaseMap, useGeocode, GeocodeSuggestion } from '@/components/map';
import type { CameraRefHandle, MapPressFeature } from '@/components/map';
import { colors } from '@/lib/theme';
import { t } from '@/lib/translations';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PickedLocation {
  address: string;
  lat: number;
  lng: number;
  city?: string;
}

export interface AddressPickerProps {
  visible: boolean;
  /** Heading shown at the top of the modal */
  title?: string;
  /** Pre-fill the search input */
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
  /** Pin colour. Default '#111827' (red for delivery) */
  pinColor?: string;
}

// ── Default centre: Rīga ─────────────────────────────────────────────────────
const DEFAULT_LAT = 56.9496;
const DEFAULT_LNG = 24.1052;

export function AddressPicker({
  visible,
  title,
  initialAddress,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
  pinColor = '#1f8f53', // green matching the mockup
}: AddressPickerProps) {
  const displayTitle = title ?? t.savedAddresses?.setDeliveryAddress ?? 'Set delivery address';
  const cameraRef = useRef<CameraRefHandle | null>(null);
  const {
    forwardGeocode,
    resolvePlace,
    reverseGeocodeWithCity,
    loading: geocodeLoading,
  } = useGeocode();

  const [lat, setLat] = useState(initialLat ?? DEFAULT_LAT);
  const [lng, setLng] = useState(initialLng ?? DEFAULT_LNG);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [city, setCity] = useState('');
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchText = useRef<string>('');

  // Animation state for pin drag
  const isDragging = useSharedValue(false);

  // Fly the map camera to given coords
  const flyTo = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    cameraRef.current?.setCamera({
      centerCoordinate: [newLng, newLat],
      zoomLevel: 15,
      animationDuration: 500,
    });
  };

  const handleRegionChange = useCallback(
    (region: { latitude: number; longitude: number }, details?: { isGesture?: boolean }) => {
      if (details?.isGesture) {
        isDragging.value = true;
      }
    },
    [isDragging],
  );

  // User dragged the map → update coords + reverse-geocode
  const handleRegionChangeComplete = useCallback(
    async (region: { latitude: number; longitude: number }, details?: { isGesture?: boolean }) => {
      isDragging.value = false;
      // Only reverse geocode if the change was initiated by a user gesture
      // to avoid infinite loops or overriding the address when flying to a search result
      if (details?.isGesture) {
        setLat(region.latitude);
        setLng(region.longitude);
        const result = await reverseGeocodeWithCity(region.latitude, region.longitude);
        if (result?.address) {
          setAddress(result.address);
          setCity(result.city || '');
        }
      }
    },
    [reverseGeocodeWithCity],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearchChange = (text: string) => {
    setSearchText(text);
    activeSearchText.current = text;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      forwardGeocode(text).then((res) => {
        if (activeSearchText.current === text) {
          setSuggestions(res);
        }
      });
    }, 350);
  };

  const onSelectSuggestion = async (item: GeocodeSuggestion) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    activeSearchText.current = '';
    setAddress(item.place_name);
    setCity(item.place_name.split(',').slice(-2, -1)[0]?.trim() ?? '');
    setSearchText(item.place_name);
    setSuggestions([]);
    // forwardGeocode returns center=[0,0]; must call resolvePlace to get real coords
    const coords = await resolvePlace(item.id);
    if (coords) {
      const [pLng, pLat] = coords;
      flyTo(pLat, pLng);
    }
  };

  const handleConfirm = () => {
    onConfirm({ address, lat, lng, city });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Map ── */}
        <View style={styles.mapWrapper}>
          <BaseMap
            cameraRef={cameraRef}
            center={[lng, lat]}
            zoom={16}
            onRegionChange={handleRegionChange}
            onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton
          />

          {/* Fixed center pin */}
          <View style={styles.centerPinContainer} pointerEvents="none">
            <PinMarker color={pinColor} isDragging={isDragging} />
          </View>

          {/* Floating close button */}
          <TouchableOpacity style={styles.floatingCloseBtn} onPress={onClose}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* ── Bottom Card (Search + Address + Confirm) ── */}
        <View style={styles.bottomCard}>
          <Text style={styles.bottomCardTitle}>{displayTitle}</Text>

          <View style={styles.searchWrapper}>
            <View style={styles.searchInputRow}>
              <Search size={18} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder={t.savedAddresses?.searchPlaceholder ?? 'Search address…'}
                placeholderTextColor="#9ca3af"
                value={searchText}
                onChangeText={onSearchChange}
                autoCorrect={false}
              />
              {geocodeLoading && <ActivityIndicator size="small" color="#6b7280" />}
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <FlatList
                  style={styles.searchList}
                  keyboardShouldPersistTaps="handled"
                  data={suggestions}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchRow}
                      onPress={() => onSelectSuggestion(item)}
                    >
                      <MapPin size={16} color="#9ca3af" style={{ marginRight: 8, marginTop: 2 }} />
                      <Text style={styles.searchDesc} numberOfLines={2}>
                        {item.place_name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>

          <Text style={styles.mapHintText}>
            {t.savedAddresses?.mapHintMovePin ??
              'Move the pin to your building entrance to help your courier find you faster'}
          </Text>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: pinColor }]}
            onPress={handleConfirm}
            disabled={geocodeLoading}
          >
            <Text style={styles.confirmBtnText}>
              {t.savedAddresses?.setAddress ?? 'Set address'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Custom pin marker ─────────────────────────────────────────────────────────
function PinMarker({ color, isDragging }: { color: string; isDragging: SharedValue<boolean> }) {
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(isDragging.value ? -15 : 0, {
            duration: 150,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
        },
      ],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isDragging.value ? 0.2 : 0, { duration: 150 }),
      transform: [
        {
          scaleX: withTiming(isDragging.value ? 1.5 : 0.5, {
            duration: 150,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
        },
        {
          scaleY: withTiming(isDragging.value ? 1.5 : 0.5, {
            duration: 150,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
        },
      ],
    };
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'flex-end', height: 84 }}>
      {/* Base shadow - fades out when placed to remove the black dot effect */}
      <Animated.View style={[{ position: 'absolute', bottom: 1 }, shadowStyle]}>
        <View style={styles.pinBaseShadow} />
      </Animated.View>
      <Animated.View style={[{ alignItems: 'center', paddingBottom: 2 }, containerStyle]}>
        {/* Head circle */}
        <View
          style={[
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 4,
              zIndex: 2,
            },
          ]}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.white,
            }}
          />
        </View>
        {/* Stick */}
        <View
          style={[
            {
              width: 4,
              height: 18,
              backgroundColor: '#111827',
              marginTop: -2,
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
              zIndex: 1,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  mapWrapper: { flex: 1, position: 'relative' },

  floatingCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  centerPinContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 42,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  pinBaseShadow: {
    width: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#000',
  },

  bottomCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 20,
  },
  bottomCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },

  searchWrapper: {
    marginBottom: 16,
    zIndex: 10,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6', // Light gray background
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 54, // just below the input row
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 200,
    zIndex: 100,
  },
  searchList: {},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchDesc: { fontSize: 15, color: '#374151', flex: 1 },

  mapHintText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6b7280',
    marginBottom: 24,
  },

  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24, // pill shaped
  },
  confirmBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 17,
  },
});
