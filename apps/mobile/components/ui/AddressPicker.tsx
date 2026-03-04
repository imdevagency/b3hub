/**
 * AddressPicker — full-screen Google Places address picker with draggable pin.
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
 *   1. Type an address → Google Places autocomplete
 *   2. Tap a suggestion → map flies to that location
 *   3. Drag the pin to fine-tune the exact gate/bay/entrance
 *   4. Press Confirm → returns address + precise coords
 *
 * API key is read from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY env var.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent, Region } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { MapPin, X, Check } from 'lucide-react-native';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

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
  /** Pin colour. Default '#dc2626' (red for delivery) */
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
  pinColor = '#dc2626',
}: AddressPickerProps) {
  const mapRef = useRef<MapView>(null);

  const [lat, setLat] = useState(initialLat ?? DEFAULT_LAT);
  const [lng, setLng] = useState(initialLng ?? DEFAULT_LNG);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [geocoding, setGeocoding] = useState(false);

  // Fly the map to given coords with a tight zoom
  const flyTo = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    const region: Region = {
      latitude: newLat,
      longitude: newLng,
      latitudeDelta: 0.004,
      longitudeDelta: 0.004,
    };
    mapRef.current?.animateToRegion(region, 500);
  };

  // User tapped the map directly → move pin, reverse-geocode address
  const handleMapPress = async (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLat(latitude);
    setLng(longitude);
    await reverseGeocode(latitude, longitude);
  };

  // Drag ended → reverse-geocode
  const handleDragEnd = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLat(latitude);
    setLng(longitude);
    await reverseGeocode(latitude, longitude);
  };

  const reverseGeocode = async (rlat: number, rlng: number) => {
    if (!GOOGLE_KEY) return;
    setGeocoding(true);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${rlat},${rlng}&key=${GOOGLE_KEY}&language=lv`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.results?.[0]) {
        setAddress(json.results[0].formatted_address);
      }
    } catch {
      // silently ignore — user still has the pin coords
    } finally {
      setGeocoding(false);
    }
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

        {/* ── Autocomplete search bar ── */}
        <View style={styles.searchWrapper}>
          <GooglePlacesAutocomplete
            placeholder="Search address…"
            query={{
              key: GOOGLE_KEY,
              language: 'lv',
              components: 'country:lv|country:lt|country:ee|country:de',
            }}
            fetchDetails
            onPress={(data, details) => {
              if (!details) return;
              const { lat: pLat, lng: pLng } = details.geometry.location;
              setAddress(data.description);
              flyTo(pLat, pLng);
            }}
            styles={{
              container: { flex: 0 },
              textInput: styles.searchInput,
              listView: styles.searchList,
              row: styles.searchRow,
              description: styles.searchDesc,
              poweredContainer: { display: 'none' },
            }}
            textInputProps={{
              defaultValue: initialAddress,
              clearButtonMode: 'while-editing',
              placeholderTextColor: '#9ca3af',
            }}
            enablePoweredByContainer={false}
            keepResultsAfterBlur
          />
        </View>

        {/* ── Map ── */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
          >
            <Marker
              coordinate={{ latitude: lat, longitude: lng }}
              draggable
              onDragEnd={handleDragEnd}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <PinMarker color={pinColor} />
            </Marker>
          </MapView>

          {/* Hint overlay */}
          <View style={styles.mapHint}>
            <Text style={styles.mapHintText}>Drag pin to fine-tune exact location</Text>
          </View>
        </View>

        {/* ── Selected address bar + confirm ── */}
        <View style={styles.footer}>
          <View style={styles.footerAddr}>
            <MapPin size={16} color={pinColor} style={{ marginTop: 2 }} />
            <Text style={styles.footerAddrText} numberOfLines={2}>
              {geocoding ? (
                <ActivityIndicator size="small" color="#6b7280" />
              ) : (
                address || 'Tap the map or search above'
              )}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: pinColor }]}
            onPress={handleConfirm}
            disabled={geocoding}
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
  searchInput: {
    height: 44,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    borderWidth: 0,
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
