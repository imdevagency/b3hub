/**
 * Transport wizard — Uber-style map + bottom sheet.
 *
 * Single screen. An animated sheet cycles through 4 steps:
 *   1. Pickup   — search bar + map pin  (map full height)
 *   2. Dropoff  — search bar + map pin  (map full height, pickup pin stays)
 *   3. Vehicle + cargo                  (map shrinks, shows A→B route)
 *   4. Date + confirm                   (map stays small strip)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Marker } from 'react-native-maps';
import { BaseMap, RouteLayer, useRoute, useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import { useTransport } from '@/lib/transport-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { TransportVehicleType } from '@/lib/api';
import * as Location from 'expo-location';
import {
  X,
  Search,
  MapPin,
  Navigation2,
  Truck,
  Check,
  ChevronLeft,
  CheckCircle,
  ArrowRight,
  Weight,
} from 'lucide-react-native';

/* ─── constants ─────────────────────────────────────────────────── */

const SCREEN_H = Dimensions.get('window').height;
const MAP_FULL = SCREEN_H * 0.46;
const MAP_SMALL = SCREEN_H * 0.24;

const VEHICLE_OPTIONS: { type: TransportVehicleType; label: string; sub: string; fromPrice: number }[] = [
  { type: 'TIPPER_SMALL', label: 'Mazā pašizgāzēja', sub: 'līdz 5 t · 6 m³', fromPrice: 89 },
  { type: 'TIPPER_LARGE', label: 'Lielā pašizgāzēja', sub: 'līdz 15 t · 18 m³', fromPrice: 149 },
  { type: 'ARTICULATED_TIPPER', label: 'Puspiekabe', sub: 'līdz 25 t · 90 m³', fromPrice: 219 },
];

const CARGO_PRESETS = ['Smiltis', 'Šķembas/grants', 'Betons', 'Koks', 'Metāls', 'Būvgruži', 'Cits'];

type Stop = { lat: number; lng: number };

/* ─── component ──────────────────────────────────────────────────── */

export default function TransportWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, setPickup, setDropoff, setVehicleType, setLoadDescription, setEstimatedWeight, setRequestedDate, reset } =
    useTransport();
  const { user } = useAuth();

  /* step */
  const [step, setStep] = useState(1);

  /* map */
  const mapHeightAnim = useRef(new Animated.Value(MAP_FULL)).current;
  const mapRef = useRef<any>(null);

  /* geocode */
  const { forwardGeocode, resolvePlace } = useGeocode();

  /* pickup */
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupSugs, setPickupSugs] = useState<GeocodeSuggestion[]>([]);
  const [pickupStop, setPickupStop] = useState<Stop | null>(null);
  const [pickupLabel, setPickupLabel] = useState('');
  const [pickupLoading, setPickupLoading] = useState(false);

  /* dropoff */
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoffSugs, setDropoffSugs] = useState<GeocodeSuggestion[]>([]);
  const [dropoffStop, setDropoffStop] = useState<Stop | null>(null);
  const [dropoffLabel, setDropoffLabel] = useState('');
  const [dropoffLoading, setDropoffLoading] = useState(false);

  /* step 3 */
  const [selectedVehicle, setSelectedVehicle] = useState<TransportVehicleType | null>(null);
  const [activeDesc, setActiveDesc] = useState('');
  const [weightText, setWeightText] = useState('');

  /* step 4 */
  const DAY_OPTIONS = buildDays();
  const [selectedDay, setSelectedDay] = useState<string>(DAY_OPTIONS[0].iso);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [jobNumber, setJobNumber] = useState('');

  /* route */
  const { route } = useRoute(
    step >= 3 && pickupStop ? pickupStop : null,
    step >= 3 && dropoffStop ? dropoffStop : null,
  );

  /* ── map resize ── */
  useEffect(() => {
    const toValue = step <= 2 ? MAP_FULL : MAP_SMALL;
    Animated.spring(mapHeightAnim, {
      toValue,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [step]);

  /* ── camera pan ── */
  useEffect(() => {
    if (!mapRef.current) return;
    if (step === 1 && pickupStop) {
      mapRef.current.animateToRegion({ latitude: pickupStop.lat, longitude: pickupStop.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    }
    if (step === 2 && dropoffStop) {
      mapRef.current.animateToRegion({ latitude: dropoffStop.lat, longitude: dropoffStop.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    }
  }, [pickupStop, dropoffStop, step]);

  /* ── geocode helpers ── */
  const onPickupChange = useCallback(async (t: string) => {
    setPickupQuery(t);
    if (t.length < 2) { setPickupSugs([]); return; }
    setPickupLoading(true);
    const sugs = await forwardGeocode(t);
    setPickupSugs(sugs);
    setPickupLoading(false);
  }, [forwardGeocode]);

  const onDropoffChange = useCallback(async (t: string) => {
    setDropoffQuery(t);
    if (t.length < 2) { setDropoffSugs([]); return; }
    setDropoffLoading(true);
    const sugs = await forwardGeocode(t);
    setDropoffSugs(sugs);
    setDropoffLoading(false);
  }, [forwardGeocode]);

  const confirmPickup = useCallback(async (sug: GeocodeSuggestion) => {
    const place = await resolvePlace(sug.placeId);
    if (!place) return;
    setPickupStop({ lat: place.lat, lng: place.lng });
    setPickupLabel(sug.description);
    setPickupQuery(sug.description);
    setPickupSugs([]);
    const cityPart = sug.description.split(',').slice(-2, -1)[0]?.trim() ?? '';
    setPickup(sug.description, cityPart, place.lat, place.lng);
  }, [resolvePlace, setPickup]);

  const confirmDropoff = useCallback(async (sug: GeocodeSuggestion) => {
    const place = await resolvePlace(sug.placeId);
    if (!place) return;
    setDropoffStop({ lat: place.lat, lng: place.lng });
    setDropoffLabel(sug.description);
    setDropoffQuery(sug.description);
    setDropoffSugs([]);
    const cityPart = sug.description.split(',').slice(-2, -1)[0]?.trim() ?? '';
    setDropoff(sug.description, cityPart, place.lat, place.lng);
  }, [resolvePlace, setDropoff]);

  /* my location */
  const useMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const { latitude: lat, longitude: lng } = loc.coords;
    const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const first = geo[0];
    const label = [first?.street, first?.city, first?.country].filter(Boolean).join(', ');
    setPickupStop({ lat, lng });
    setPickupLabel(label);
    setPickupQuery(label);
    setPickupSugs([]);
    setPickup(label, first?.city ?? '', lat, lng);
  }, [setPickup]);

  /* step 1 valid */
  const step1Valid = pickupStop !== null;
  /* step 2 valid */
  const step2Valid = dropoffStop !== null;
  /* step 3 valid */
  const step3Valid = selectedVehicle !== null && activeDesc.trim().length >= 2;
  /* step 4 valid */
  const step4Valid = selectedDay.length > 0;

  /* ── submit ── */
  const handleSubmit = useCallback(async () => {
    if (!user || !pickupStop || !dropoffStop || !selectedVehicle) return;
    setSubmitting(true);
    try {
      const job = await api.transportJobs.create({
        pickupAddress: pickupLabel,
        pickupCity: state.pickupCity,
        pickupLat: pickupStop.lat,
        pickupLng: pickupStop.lng,
        dropoffAddress: dropoffLabel,
        dropoffCity: state.dropoffCity,
        dropoffLat: dropoffStop.lat,
        dropoffLng: dropoffStop.lng,
        vehicleType: selectedVehicle,
        loadDescription: activeDesc,
        estimatedWeight: weightText ? parseFloat(weightText) : undefined,
        requestedDate: selectedDay,
      });
      setJobNumber(job.jobNumber ?? job.id.slice(0, 8).toUpperCase());
      reset();
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('Kļūda', e?.message ?? 'Neizdevās izveidot pasūtījumu');
    } finally {
      setSubmitting(false);
    }
  }, [user, pickupStop, dropoffStop, selectedVehicle, activeDesc, weightText, selectedDay, pickupLabel, dropoffLabel, state, reset]);

  /* ── success screen ── */
  if (success) {
    return (
      <View style={ss.successRoot}>
        <CheckCircle size={72} color="#22c55e" />
        <Text style={ss.successTitle}>Pasūtījums pieņemts!</Text>
        <Text style={ss.successSubtitle}>Mēs sazināsimies drīzumā</Text>
        {jobNumber ? (
          <View style={ss.jobBadge}>
            <Text style={ss.jobBadgeText}>#{jobNumber}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={ss.successBtn} onPress={() => router.replace('/(buyer)/orders')}>
          <Text style={ss.successBtnText}>Skatīt pasūtījumus</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setSuccess(false); setStep(1); }} style={{ marginTop: 12 }}>
          <Text style={{ color: '#6b7280', fontSize: 14 }}>Jauns pasūtījums</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ── main wizard ── */
  const progressPct = `${(step / 4) * 100}%`;
  const currentVehiclePrice = VEHICLE_OPTIONS.find(v => v.type === selectedVehicle)?.fromPrice;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* MAP */}
      <Animated.View style={{ height: mapHeightAnim }}>
        <BaseMap ref={mapRef} style={StyleSheet.absoluteFill}>
          {step >= 3 && route && <RouteLayer coords={route.coords} />}
          {pickupStop && (
            <Marker coordinate={{ latitude: pickupStop.lat, longitude: pickupStop.lng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={ss.pinA}><Text style={ss.pinLetter}>A</Text></View>
            </Marker>
          )}
          {dropoffStop && (
            <Marker coordinate={{ latitude: dropoffStop.lat, longitude: dropoffStop.lng }} anchor={{ x: 0.5, y: 1 }}>
              <View style={ss.pinB}><Text style={ss.pinLetter}>B</Text></View>
            </Marker>
          )}
        </BaseMap>
      </Animated.View>

      {/* SHEET */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[ss.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* drag pill */}
          <View style={ss.dragPill} />

          {/* header row */}
          <View style={ss.sheetHeader}>
            {step > 1 ? (
              <TouchableOpacity onPress={() => setStep(s => s - 1)} style={ss.backBtn}>
                <ChevronLeft size={20} color="#374151" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
                <X size={18} color="#374151" />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <View style={ss.progressTrack}>
                <View style={[ss.progressFill, { width: progressPct as any }]} />
              </View>
            </View>
            <Text style={ss.stepLabel}>{step}/4</Text>
          </View>

          {/* ── STEP 1: PICKUP ── */}
          {step === 1 && (
            <View style={ss.stepBody}>
              <Text style={ss.stepTitle}>Kur ielādēt?</Text>
              <Text style={ss.stepSub}>Iekraušanas adrese</Text>
              <View style={ss.searchRow}>
                <Search size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={ss.searchInput}
                  placeholder="Meklēt adresi..."
                  placeholderTextColor="#9ca3af"
                  value={pickupQuery}
                  onChangeText={onPickupChange}
                  autoFocus
                />
                {pickupLoading && <ActivityIndicator size="small" color="#9ca3af" />}
              </View>
              {pickupSugs.length > 0 && (
                <ScrollView style={ss.sugList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {pickupSugs.map(s => (
                    <TouchableOpacity key={s.placeId} style={ss.sugRow} onPress={() => confirmPickup(s)}>
                      <MapPin size={14} color="#6b7280" style={{ marginRight: 8, flexShrink: 0 }} />
                      <Text style={ss.sugText} numberOfLines={2}>{s.description}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity style={ss.myLocBtn} onPress={useMyLocation}>
                <Navigation2 size={14} color="#111827" />
                <Text style={ss.myLocText}>Izmantot manu atrašanās vietu</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: DROPOFF ── */}
          {step === 2 && (
            <View style={ss.stepBody}>
              <Text style={ss.stepTitle}>Kur izkraut?</Text>
              <Text style={ss.stepSub}>Izkraušanas adrese</Text>
              {pickupLabel.length > 0 && (
                <View style={ss.confirmedRow}>
                  <View style={ss.pinDotA} />
                  <Text style={ss.confirmedText} numberOfLines={1}>{pickupLabel}</Text>
                </View>
              )}
              <View style={ss.searchRow}>
                <Search size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={ss.searchInput}
                  placeholder="Meklēt galamērķi..."
                  placeholderTextColor="#9ca3af"
                  value={dropoffQuery}
                  onChangeText={onDropoffChange}
                  autoFocus
                />
                {dropoffLoading && <ActivityIndicator size="small" color="#9ca3af" />}
              </View>
              {dropoffSugs.length > 0 && (
                <ScrollView style={ss.sugList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {dropoffSugs.map(s => (
                    <TouchableOpacity key={s.placeId} style={ss.sugRow} onPress={() => confirmDropoff(s)}>
                      <MapPin size={14} color="#6b7280" style={{ marginRight: 8, flexShrink: 0 }} />
                      <Text style={ss.sugText} numberOfLines={2}>{s.description}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ── STEP 3: VEHICLE + CARGO ── */}
          {step === 3 && (
            <ScrollView style={ss.stepBody} showsVerticalScrollIndicator={false}>
              <Text style={ss.stepTitle}>Krava un transports</Text>
              {route && (
                <Text style={ss.routeInfo}>
                  {route.distanceKm.toFixed(1)} km · {route.durationLabel}
                </Text>
              )}
              <Text style={ss.fieldLabel}>Transportlīdzeklis</Text>
              {VEHICLE_OPTIONS.map(v => (
                <TouchableOpacity
                  key={v.type}
                  style={[ss.vehicleCard, selectedVehicle === v.type && ss.vehicleCardActive]}
                  onPress={() => { setSelectedVehicle(v.type); setVehicleType(v.type); }}
                  activeOpacity={0.75}
                >
                  <Truck size={20} color={selectedVehicle === v.type ? '#fff' : '#374151'} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[ss.vehicleName, selectedVehicle === v.type && { color: '#fff' }]}>{v.label}</Text>
                    <Text style={[ss.vehicleSub, selectedVehicle === v.type && { color: '#d1d5db' }]}>{v.sub}</Text>
                  </View>
                  <Text style={[ss.vehiclePrice, selectedVehicle === v.type && { color: '#d1fae5' }]}>
                    no €{v.fromPrice}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={[ss.fieldLabel, { marginTop: 18 }]}>Kravas veids</Text>
              <View style={ss.chipWrap}>
                {CARGO_PRESETS.map(preset => {
                  const active = activeDesc === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[ss.chip, active && ss.chipActive]}
                      onPress={() => { setActiveDesc(preset); setLoadDescription(preset); }}
                    >
                      <Text style={[ss.chipText, active && ss.chipTextActive]}>{preset}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[ss.fieldLabel, { marginTop: 18 }]}>Svars (tonnas) — neobligāti</Text>
              <View style={ss.weightRow}>
                <Weight size={16} color="#6b7280" />
                <TextInput
                  style={ss.weightInput}
                  placeholder="piem. 3.5"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  value={weightText}
                  onChangeText={setWeightText}
                />
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
          )}

          {/* ── STEP 4: DATE + CONFIRM ── */}
          {step === 4 && (
            <ScrollView style={ss.stepBody} showsVerticalScrollIndicator={false}>
              <Text style={ss.stepTitle}>Kad pārvadāt?</Text>
              <Text style={ss.stepSub}>Izvēlieties vēlamo datumu</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {DAY_OPTIONS.map(d => (
                  <TouchableOpacity
                    key={d.iso}
                    style={[ss.dayChip, selectedDay === d.iso && ss.dayChipActive]}
                    onPress={() => { setSelectedDay(d.iso); setRequestedDate(d.iso); }}
                  >
                    <Text style={[ss.dayChipSub, selectedDay === d.iso && { color: '#fff' }]}>{d.dow}</Text>
                    <Text style={[ss.dayChipNum, selectedDay === d.iso && { color: '#fff' }]}>{d.day}</Text>
                    <Text style={[ss.dayChipSub, selectedDay === d.iso && { color: '#d1d5db' }]}>{d.mon}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* summary card */}
              <View style={ss.summaryCard}>
                <SummaryRow icon="📍" label="No" value={pickupLabel} />
                <SummaryRow icon="🏁" label="Uz" value={dropoffLabel} />
                {route && <SummaryRow icon="🛣" label="Distance" value={`${route.distanceKm.toFixed(1)} km · ${route.durationLabel}`} />}
                <SummaryRow icon="🚛" label="Auto" value={VEHICLE_OPTIONS.find(v => v.type === selectedVehicle)?.label ?? ''} />
                <SummaryRow icon="📦" label="Krava" value={activeDesc} />
              </View>

              {/* price estimate */}
              {currentVehiclePrice && (
                <View style={ss.priceEstRow}>
                  <Text style={ss.priceEstLabel}>Aptuveni cena</Text>
                  <Text style={ss.priceEstValue}>no €{currentVehiclePrice}</Text>
                </View>
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          )}

          {/* CTA */}
          <View style={ss.ctaRow}>
            {step < 4 ? (
              <TouchableOpacity
                style={[ss.nextBtn, !(step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid) && ss.nextBtnDisabled]}
                disabled={!(step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid)}
                onPress={() => setStep(s => s + 1)}
                activeOpacity={0.85}
              >
                <Text style={[ss.nextTxt, !(step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid) && ss.nextTxtDisabled]}>
                  Turpināt <ArrowRight size={16} color="#fff" />
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[ss.nextBtn, (!step4Valid || submitting) && ss.nextBtnDisabled]}
                disabled={!step4Valid || submitting}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={ss.nextTxt}>Iesniegt pasūtījumu</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ─── helpers ──────────────────────────────────────────────────────── */

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={ss.sumRow}>
      <Text style={{ fontSize: 16, marginRight: 8 }}>{icon}</Text>
      <Text style={ss.sumLabel}>{label}</Text>
      <Text style={ss.sumValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function buildDays() {
  const days: { iso: string; dow: string; day: string; mon: string }[] = [];
  const DOW = ['Ne', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jūn', 'Jūl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      dow: DOW[d.getDay()],
      day: String(d.getDate()),
      mon: MON[d.getMonth()],
    });
  }
  return days;
}

/* ─── styles ────────────────────────────────────────────────────────── */

const ss = StyleSheet.create({
  /* success */
  successRoot: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successTitle: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 24, marginBottom: 8 },
  successSubtitle: { fontSize: 16, color: '#9ca3af', marginBottom: 24 },
  jobBadge: { backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 32 },
  jobBadgeText: { color: '#22c55e', fontWeight: '700', fontSize: 22, letterSpacing: 2 },
  successBtn: { backgroundColor: '#fff', borderRadius: 100, paddingHorizontal: 40, paddingVertical: 16 },
  successBtnText: { color: '#111827', fontWeight: '700', fontSize: 16 },
  /* map pins */
  pinA: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  pinB: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  pinLetter: { color: '#fff', fontSize: 13, fontWeight: '700' },
  /* sheet */
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, flex: 1, paddingTop: 8, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  dragPill: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#111827', borderRadius: 2 },
  stepLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  stepSub: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  /* search */
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  sugList: { maxHeight: 180, marginBottom: 8 },
  sugRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  sugText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 18 },
  myLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  myLocText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, padding: 10, marginBottom: 12, gap: 8 },
  confirmedText: { flex: 1, fontSize: 13, color: '#6b7280' },
  pinDotA: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  routeInfo: { fontSize: 13, color: '#22c55e', fontWeight: '600', marginBottom: 14, backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  /* vehicle */
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 10 },
  vehicleCardActive: { backgroundColor: '#111827', borderColor: '#111827' },
  vehicleName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  vehicleSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  vehiclePrice: { fontSize: 15, fontWeight: '700', color: '#111827' },
  /* chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  /* weight */
  weightRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  weightInput: { flex: 1, fontSize: 15, color: '#111827' },
  /* day chips */
  dayChip: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', marginRight: 8, minWidth: 56, backgroundColor: '#f9fafb' },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayChipSub: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  dayChipNum: { fontSize: 20, fontWeight: '700', color: '#111827', marginVertical: 2 },
  /* summary */
  summaryCard: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, marginBottom: 14 },
  sumRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 4 },
  sumLabel: { fontSize: 13, color: '#9ca3af', width: 60 },
  sumValue: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '500' },
  /* price estimate */
  priceEstRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  priceEstLabel: { fontSize: 14, color: '#166534' },
  priceEstValue: { fontSize: 18, fontWeight: '700', color: '#166534' },
  /* CTA */
  ctaRow: { paddingTop: 12 },
  nextBtn: { backgroundColor: '#111827', borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#f3f4f6' },
  nextTxt: { fontSize: 16, fontWeight: '600', color: '#fff' },
  nextTxtDisabled: { color: '#9ca3af' },
});
