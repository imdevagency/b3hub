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
import React, { useRef, useState, useCallback } from 'react';
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
import { Marker } from 'react-native-maps';
import { MapPin, X, Check, Search } from 'lucide-react-native';
import { BaseMap, useGeocode, GeocodeSuggestion } from '@/components/map';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PickedLocation {
  address: string;
  lat: number;
  lng: number;
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
  title = 'Select location',
  initialAddress,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
  pinColor = '#111827',
}: AddressPickerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  const { forwardGeocode, reverseGeocode, loading: geocodeLoading } = useGeocode();

  const [lat, setLat] = useState(initialLat ?? DEFAULT_LAT);
  const [lng, setLng] = useState(initialLng ?? DEFAULT_LNG);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // User tapped the map → move pin + reverse-geocode
  const handleMapPress = useCallback(
    async (feature: any) => {
      const coords = (feature?.geometry?.coordinates ?? feature?.coordinates) as
        | number[]
        | undefined;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const [longitude, latitude] = coords;
      setLat(latitude);
      setLng(longitude);
      const label = await reverseGeocode(latitude, longitude);
      if (label) setAddress(label);
    },
    [reverseGeocode],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearchChange = (text: string) => {
    setSearchText(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      forwardGeocode(text).then(setSuggestions);
    }, 350);
  };

  const onSelectSuggestion = (item: GeocodeSuggestion) => {
    const [pLng, pLat] = item.center;
    setAddress(item.place_name);
    setSearchText(item.place_name);
    setSuggestions([]);
    flyTo(pLat, pLng);
  };

  const handleConfirm = () => {
    onConfirm({ address, lat, lng });
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
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchInputRow}>
            <Search size={16} color="#9ca3af" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address…"
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={onSearchChange}
              autoCorrect={false}
            />
            {geocodeLoading && (
              <ActivityIndicator size="small" color="#6b7280" style={{ marginRight: 10 }} />
            )}
          </View>
          {suggestions.length > 0 && (
            <FlatList
              style={styles.searchList}
              keyboardShouldPersistTaps="handled"
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchRow} onPress={() => onSelectSuggestion(item)}>
                  <MapPin size={13} color="#9ca3af" style={{ marginRight: 6, marginTop: 1 }} />
                  <Text style={styles.searchDesc} numberOfLines={2}>
                    {item.place_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* ── Map ── */}
        <View style={styles.mapWrapper}>
          <BaseMap cameraRef={cameraRef} center={[lng, lat]} zoom={13} onPress={handleMapPress}>
            <Marker
              identifier="pin"
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={false}
            >
              <PinMarker color={pinColor} />
            </Marker>
          </BaseMap>

          {/* Hint overlay */}
          <View style={styles.mapHint}>
            <Text style={styles.mapHintText}>Tap the map to move the pin</Text>
          </View>
        </View>

        {/* ── Selected address bar + confirm ── */}
        <View style={styles.footer}>
          <View style={styles.footerAddr}>
            <MapPin size={16} color={pinColor} style={{ marginTop: 2 }} />
            <Text style={styles.footerAddrText} numberOfLines={2}>
              {geocodeLoading ? (
                <ActivityIndicator size="small" color="#6b7280" />
              ) : (
                address || 'Tap the map or search above'
              )}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: pinColor }]}
            onPress={handleConfirm}
            disabled={geocodeLoading}
          >
            <Check size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Custom pin marker ─────────────────────────────────────────────────────────
function PinMarker({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 5,
          elevation: 6,
        }}
      >
        <MapPin size={16} color="#fff" />
      </View>
      {/* teardrop tail */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 9,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
          marginTop: -1,
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  searchWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    height: 44,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingRight: 12,
  },
  searchList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 4,
  },
  searchRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  searchDesc: { fontSize: 14, color: '#374151' },

  mapWrapper: { flex: 1, position: 'relative' },

  mapHint: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapHintText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },

  footer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 16,
    gap: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  footerAddr: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerAddrText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
