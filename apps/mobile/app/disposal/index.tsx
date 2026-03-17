/**
 * Disposal wizard — Uber-style map + bottom sheet.
 *
 * Single screen with persistent Google Maps backdrop. An animated sheet
 * cycles through 4 steps without new screen pushes:
 *   1. Location   — search bar + map pin  (map is full-height)
 *   2. Waste type — 2-col grid            (map shrinks to preview strip)
 *   3. Volume     — 4 preset cards + desc (map persists as strip)
 *   4. Date+Confirm — day chips + summary → submit
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
import { BaseMap } from '@/components/map';
import { useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import { useDisposal } from '@/lib/disposal-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import * as Location from 'expo-location';
import {
  X,
  Search,
  MapPin,
  Navigation2,
  Hammer,
  Trees,
  Wrench,
  Package,
  Layers,
  Trash2,
  AlertTriangle,
  Check,
  ChevronLeft,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react-native';

// ── Constants ─────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_FULL = Math.round(SCREEN_H * 0.46);
const MAP_SMALL = Math.round(SCREEN_H * 0.24);
const RIGA: [number, number] = [24.1052, 56.9496];

// ── Waste type data ───────────────────────────────────────────────────────────

interface WasteOption {
  id: WasteType;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

const WASTE_OPTIONS: WasteOption[] = [
  { id: 'CONCRETE', label: 'Betons / Bruģis', desc: 'Betona gabali, plātnes', Icon: Hammer },
  { id: 'SOIL', label: 'Augsne / Grunts', desc: 'Z0/Z1 grunts, smilts, māls', Icon: Layers },
  { id: 'BRICK', label: 'Ķieģeļi / Mūris', desc: 'Nojaukšanas atkritumi', Icon: Hammer },
  { id: 'WOOD', label: 'Koks', desc: 'Dēļi, sijas, finiera atgriezumi', Icon: Trees },
  { id: 'METAL', label: 'Metāls', desc: 'Profili, stiegrojums, lūžņi', Icon: Wrench },
  { id: 'PLASTIC', label: 'Plastmasa', desc: 'Caurules, pārsegi, maisi', Icon: Package },
  { id: 'MIXED', label: 'Jaukti celtniec.', desc: 'Dažādi celtniecības atkritumi', Icon: Trash2 },
  {
    id: 'HAZARDOUS',
    label: 'Bīstami atkritumi',
    desc: 'Azbests, krāsas, šķīdinātāji',
    Icon: AlertTriangle,
  },
];

// ── Volume presets ────────────────────────────────────────────────────────────

const VOLUME_PRESETS: Array<{
  key: string;
  label: string;
  sublabel: string;
  emoji: string;
  truckType: DisposalTruckType;
  truckCount: number;
  fromPrice: number;
}> = [
  {
    key: 'xs',
    label: 'Neliela',
    sublabel: '~5 m³ / ~4 t',
    emoji: '🧺',
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
    fromPrice: 89,
  },
  {
    key: 'sm',
    label: 'Vidēja',
    sublabel: '~10 m³ / ~8 t',
    emoji: '🏗️',
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
    fromPrice: 89,
  },
  {
    key: 'md',
    label: 'Liela',
    sublabel: '~18 m³ / ~14 t',
    emoji: '🚛',
    truckType: 'TIPPER_LARGE',
    truckCount: 1,
    fromPrice: 149,
  },
  {
    key: 'lg',
    label: 'Ļoti liela',
    sublabel: '~36 m³ / ~26 t',
    emoji: '🏭',
    truckType: 'ARTICULATED_TIPPER',
    truckCount: 2,
    fromPrice: 219,
  },
];

const TRUCK_CONFIG: Record<string, { label: string; capacity: number; volume: number }> = {
  TIPPER_SMALL: { label: 'Pašizgāzējs (10 t)', capacity: 10, volume: 8 },
  TIPPER_LARGE: { label: 'Pašizgāzējs lielais (18 t)', capacity: 18, volume: 12 },
  ARTICULATED_TIPPER: { label: 'Sattelkipper (26 t)', capacity: 26, volume: 18 },
};

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti celtniecības',
  HAZARDOUS: 'Bīstami atkritumi',
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Main component ────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

export default function DisposalWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    state,
    setLocation,
    setWasteType,
    setTruckType,
    setTruckCount,
    setDescription,
    setRequestedDate,
    reset,
  } = useDisposal();
  const { user, token } = useAuth();
  const { forwardGeocode, resolvePlace, reverseGeocodeWithCity } = useGeocode();

  // ── Step state ────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ── Map height animation ──────────────────────────────────────
  const mapHeightAnim = useRef(new Animated.Value(MAP_FULL)).current;
  useEffect(() => {
    Animated.spring(mapHeightAnim, {
      toValue: step === 1 ? MAP_FULL : MAP_SMALL,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [step]);

  // ── Location step state ───────────────────────────────────────
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    state.locationLat != null
      ? { latitude: state.locationLat, longitude: state.locationLng! }
      : null,
  );
  const [searchText, setSearchText] = useState(state.location || '');
  const [confirmedAddress, setConfirmedAddress] = useState(state.location || '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Waste type step state ─────────────────────────────────────
  const [selectedWaste, setSelectedWaste] = useState<WasteType | null>(state.wasteType);

  // ── Volume step state ─────────────────────────────────────────
  const defaultKey =
    state.truckCount > 1
      ? 'lg'
      : state.truckType === 'TIPPER_SMALL'
        ? 'xs'
        : state.truckType === 'ARTICULATED_TIPPER'
          ? 'lg'
          : 'md';
  const [volumeKey, setVolumeKey] = useState(defaultKey);
  const [desc, setDesc] = useState(state.description);

  // ── Date step state ───────────────────────────────────────────
  const minDate = addDays(new Date(), 1);
  const [date, setDate] = useState<Date>(minDate);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [jobNumber, setJobNumber] = useState('');

  // ── Contact / Notes ──────────────────────────────────────────────────
  const [contactName, setContactName] = useState(() => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');

  // ── Geocode search ────────────────────────────────────────────
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (!text.trim()) {
        setSuggestions([]);
        return;
      }
      searchTimer.current = setTimeout(async () => {
        setLoadingSug(true);
        const results = await forwardGeocode(text);
        setSuggestions(results);
        setLoadingSug(false);
      }, 350);
    },
    [forwardGeocode],
  );

  const handleSelectSuggestion = useCallback(
    async (sug: GeocodeSuggestion) => {
      setSuggestions([]);
      setSearchText(sug.place_name);
      const coords = await resolvePlace(sug.id);
      if (coords) {
        const [lng, lat] = coords;
        setPin({ latitude: lat, longitude: lng });
        setConfirmedAddress(sug.place_name);
      }
    },
    [resolvePlace],
  );

  const handleMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = loc.coords;
    setPin({ latitude, longitude });
    const { address, city } = await reverseGeocodeWithCity(latitude, longitude);
    setSearchText(address);
    setConfirmedAddress(address);
  }, [reverseGeocodeWithCity]);

  const handleConfirmLocation = useCallback(() => {
    if (!pin || !confirmedAddress) return;
    const cityPart = confirmedAddress.split(',').slice(-2, -1)[0]?.trim() ?? '';
    setLocation(confirmedAddress, cityPart, pin.latitude, pin.longitude);
    setStep(2);
    setSuggestions([]);
  }, [pin, confirmedAddress, setLocation]);

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!token) {
      Alert.alert('Kļūda', 'Jūs neesat pieteicies. Lūdzu, piesakieties vēlreiz.');
      return;
    }
    if (!state.wasteType) {
      Alert.alert('Kļūda', 'Lūdzu, izvēlieties atkritumu veidu.');
      return;
    }
    const preset = VOLUME_PRESETS.find((p) => p.key === volumeKey) ?? VOLUME_PRESETS[2];
    const truck = TRUCK_CONFIG[preset.truckType];
    setTruckType(preset.truckType);
    setTruckCount(preset.truckCount);
    setDescription(desc);
    setRequestedDate(toISO(date));
    setLoading(true);
    try {
      const result = await api.disposal.create(
        {
          pickupAddress: state.location,
          pickupCity: state.locationCity,
          pickupLat: state.locationLat ?? undefined,
          pickupLng: state.locationLng ?? undefined,
          wasteType: state.wasteType,
          truckType: preset.truckType,
          truckCount: preset.truckCount,
          estimatedWeight: truck.capacity * preset.truckCount,
          description: desc || undefined,
          requestedDate: toISO(date),
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
        },
        token,
      );
      reset();
      setJobNumber(result?.jobNumber ?? '—');
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Kļūda', err?.message ?? 'Neizdevās nosūtīt pieprasījumu. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  }, [state, volumeKey, desc, date, token, contactName, contactPhone, notes]);

  // ── Back action per step ──────────────────────────────────────
  const handleBack = () => {
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as Step);
  };

  // ── Success ───────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={s.successBg}>
        <View style={s.successInner}>
          <View style={s.successCircle}>
            <CheckCircle size={56} color="#fff" strokeWidth={1.5} />
          </View>
          <Text style={s.successTitle}>Pieprasījums nosūtīts!</Text>
          <Text style={s.successDesc}>
            Jūsu atkritumu savākšanas pieprasījums{`\n`}ir reģistrēts.
          </Text>
          {!!jobNumber && (
            <View style={s.jobNumBadge}>
              <Text style={s.jobNumLabel}>Numurs</Text>
              <Text style={s.jobNumValue}>{jobNumber}</Text>
            </View>
          )}
          <Text style={s.successHint}>
            Tuvākajā laikā tiks piešķirts pārvadātājs{`\n`}un Jūs saņemsiet paziņojumu.
          </Text>
          <TouchableOpacity
            style={s.successBtn}
            onPress={() => router.replace('/(buyer)/orders')}
            activeOpacity={0.85}
          >
            <Text style={s.successBtnText}>Skatīt pasūtījumus →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Map center ────────────────────────────────────────────────
  const mapCenter: [number, number] = pin ? [pin.longitude, pin.latitude] : RIGA;

  const preset = VOLUME_PRESETS.find((p) => p.key === volumeKey) ?? VOLUME_PRESETS[2];
  const truck = TRUCK_CONFIG[preset.truckType];

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* ── Map ── */}
      <Animated.View style={[s.mapWrap, { height: mapHeightAnim }]}>
        <BaseMap center={mapCenter} zoom={13} style={StyleSheet.absoluteFillObject}>
          {pin && (
            <Marker coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}>
              <View style={s.mapPin} />
            </Marker>
          )}
        </BaseMap>

        {/* Floating close button */}
        <TouchableOpacity
          style={[s.mapClose, { top: insets.top + 12 }]}
          onPress={handleBack}
          activeOpacity={0.85}
        >
          {step === 1 ? <X size={18} color="#111827" /> : <ChevronLeft size={18} color="#111827" />}
        </TouchableOpacity>

        {/* Step label pill */}
        <View style={s.stepPill}>
          <Text style={s.stepPillText}>
            {step === 1
              ? 'Atkritumu novietne'
              : step === 2
                ? 'Atkritumu veids'
                : step === 3
                  ? 'Apjoms'
                  : 'Datums un apstiprinājums'}
          </Text>
        </View>
      </Animated.View>

      {/* ── Bottom sheet ── */}
      <KeyboardAvoidingView
        style={s.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${step * 25}%` as any }]} />
        </View>

        {/* ── STEP 1: Location ── */}
        {step === 1 && (
          <>
            <View style={s.sheetBody}>
              <Text style={s.sheetTitle}>Kur atrodas atkritumi?</Text>
              <Text style={s.sheetSub}>Norādiet būvlaukuma vai objekta adresi.</Text>

              {/* Search input */}
              <View style={s.searchRow}>
                <Search size={16} color="#9ca3af" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Meklēt adresi..."
                  placeholderTextColor="#9ca3af"
                  value={searchText}
                  onChangeText={handleSearchChange}
                  autoCorrect={false}
                />
                {loadingSug && <ActivityIndicator size="small" color="#9ca3af" />}
              </View>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <View style={s.suggList}>
                  {suggestions.slice(0, 4).map((sug) => (
                    <TouchableOpacity
                      key={sug.id}
                      style={s.suggItem}
                      onPress={() => handleSelectSuggestion(sug)}
                      activeOpacity={0.7}
                    >
                      <MapPin size={14} color="#6b7280" />
                      <Text style={s.suggText} numberOfLines={2}>
                        {sug.place_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* My location */}
              <TouchableOpacity style={s.myLocBtn} onPress={handleMyLocation} activeOpacity={0.7}>
                <Navigation2 size={15} color="#111827" />
                <Text style={s.myLocText}>Izmantot manu atrašanās vietu</Text>
              </TouchableOpacity>
            </View>

            <View style={s.footer}>
              <TouchableOpacity
                style={[s.nextBtn, !pin && s.nextBtnDisabled]}
                disabled={!pin}
                onPress={handleConfirmLocation}
                activeOpacity={0.8}
              >
                <Text style={[s.nextText, !pin && s.nextTextDisabled]}>Turpināt →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 2: Waste Type ── */}
        {step === 2 && (
          <>
            <ScrollView
              style={s.scrollArea}
              contentContainerStyle={s.sheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.sheetTitle}>Ko nodot?</Text>
              <Text style={s.sheetSub}>Izvēlieties galveno atkritumu veidu.</Text>
              <View style={s.wasteGrid}>
                {WASTE_OPTIONS.map((opt) => {
                  const isSel = selectedWaste === opt.id;
                  const WasteIcon = opt.Icon;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[s.wasteCard, isSel && s.wasteCardSel]}
                      onPress={() => setSelectedWaste(opt.id)}
                      activeOpacity={0.7}
                    >
                      {isSel && (
                        <View style={s.checkBadge}>
                          <Check size={11} color="#fff" />
                        </View>
                      )}
                      <WasteIcon
                        size={26}
                        color={isSel ? '#fff' : '#6b7280'}
                        style={{ marginBottom: 6 }}
                      />
                      <Text style={[s.wasteLabel, isSel && s.wasteLabelSel]}>{opt.label}</Text>
                      <Text style={[s.wasteDesc, isSel && s.wasteDescSel]} numberOfLines={2}>
                        {opt.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={s.footer}>
              <TouchableOpacity
                style={[s.nextBtn, !selectedWaste && s.nextBtnDisabled]}
                disabled={!selectedWaste}
                onPress={() => {
                  setWasteType(selectedWaste!);
                  setStep(3);
                }}
                activeOpacity={0.8}
              >
                <Text style={[s.nextText, !selectedWaste && s.nextTextDisabled]}>Turpināt →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 3: Volume ── */}
        {step === 3 && (
          <>
            <ScrollView
              style={s.scrollArea}
              contentContainerStyle={s.sheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.sheetTitle}>Cik materiāla ir jāizved?</Text>
              <Text style={s.sheetSub}>Izvēlieties aptuvenu apjomu.</Text>

              {selectedWaste === 'HAZARDOUS' && (
                <View style={s.hazardRow}>
                  <AlertTriangle size={14} color="#b91c1c" />
                  <Text style={s.hazardText}>Bīstamu atkritumu nodošana jāsaskaņo atsevišķi!</Text>
                </View>
              )}

              <View style={s.volGrid}>
                {VOLUME_PRESETS.map((p) => {
                  const isSel = volumeKey === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[s.volCard, isSel && s.volCardSel]}
                      onPress={() => setVolumeKey(p.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.volEmoji}>{p.emoji}</Text>
                      <Text style={[s.volLabel, isSel && s.volLabelSel]}>{p.label}</Text>
                      <Text style={s.volSub}>{p.sublabel}</Text>
                      <Text style={[s.volPrice, isSel && s.volPriceSel]}>
                        no €{p.fromPrice * p.truckCount}
                      </Text>
                      {isSel && (
                        <View style={s.checkBadge}>
                          <Check size={11} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.sectionLabel}>Papildu informācija (neobligāti)</Text>
              <View style={s.descCard}>
                <TextInput
                  style={s.descInput}
                  placeholder="piem., Z0 Grunts, asfalta segums..."
                  placeholderTextColor="#9ca3af"
                  value={desc}
                  onChangeText={setDesc}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
            <View style={s.footer}>
              <TouchableOpacity
                style={[s.nextBtn, selectedWaste === 'HAZARDOUS' && s.nextBtnHazard]}
                onPress={() => {
                  if (selectedWaste === 'HAZARDOUS') {
                    Alert.alert('Bīstami atkritumi', 'Sazinieties ar mums tieši.', [
                      { text: 'Sapratu' },
                    ]);
                    return;
                  }
                  setStep(4);
                }}
                activeOpacity={0.8}
              >
                <Text style={[s.nextText, selectedWaste === 'HAZARDOUS' && s.nextTextHazard]}>
                  {selectedWaste === 'HAZARDOUS' ? 'Sazināties →' : 'Turpināt →'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 4: Date + Confirm ── */}
        {step === 4 && (
          <>
            <ScrollView
              style={s.scrollArea}
              contentContainerStyle={s.sheetScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.sheetTitle}>Kad braukt?</Text>
              <Text style={s.sheetSub}>Izvēlieties vēlamo savākšanas datumu.</Text>

              {/* Day chip strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.dayRow}
                style={{ marginBottom: 20 }}
              >
                {Array.from({ length: 14 }, (_, i) => {
                  const d = addDays(minDate, i);
                  const isSel = toISO(d) === toISO(date);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.dayChip, isSel && s.dayChipActive]}
                      onPress={() => setDate(d)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.dayChipName, isSel && s.dayChipNameActive]}>
                        {d.toLocaleDateString('lv-LV', { weekday: 'short' })}
                      </Text>
                      <Text style={[s.dayChipNum, isSel && s.dayChipNumActive]}>{d.getDate()}</Text>
                      <Text style={[s.dayChipMon, isSel && s.dayChipMonActive]}>
                        {d.toLocaleDateString('lv-LV', { month: 'short' })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Summary */}
              <Text style={s.sectionLabel}>Kopsavilkums</Text>
              <View style={s.summaryCard}>
                <View style={s.sumRow}>
                  <MapPin size={14} color="#6b7280" />
                  <View style={s.sumContent}>
                    <Text style={s.sumLabel}>Adrese</Text>
                    <Text style={s.sumValue} numberOfLines={2}>
                      {state.location || '—'}
                    </Text>
                  </View>
                </View>
                <View style={s.sumDivider} />
                <View style={s.sumRow}>
                  <Trash2 size={14} color="#6b7280" />
                  <View style={s.sumContent}>
                    <Text style={s.sumLabel}>Atkritumu veids</Text>
                    <Text style={s.sumValue}>
                      {state.wasteType ? WASTE_LABELS[state.wasteType] : '—'}
                    </Text>
                  </View>
                </View>
                <View style={s.sumDivider} />
                <View style={s.sumRow}>
                  <Wrench size={14} color="#6b7280" />
                  <View style={s.sumContent}>
                    <Text style={s.sumLabel}>Transports</Text>
                    <Text style={s.sumValue}>
                      {preset.truckCount} × {truck.label}
                    </Text>
                  </View>
                </View>
                <View style={s.sumDivider} />
                <View style={s.sumRow}>
                  <Package size={14} color="#6b7280" />
                  <View style={s.sumContent}>
                    <Text style={s.sumLabel}>Apjoms</Text>
                    <Text style={s.sumValue}>
                      {truck.capacity * preset.truckCount} t ≈ {truck.volume * preset.truckCount} m³
                    </Text>
                  </View>
                </View>
                <View style={s.sumDivider} />
                <View style={s.sumPriceRow}>
                  <View style={s.sumContent}>
                    <Text style={s.sumLabel}>Orientējošā cena</Text>
                    <Text style={s.sumValue}>
                      no €{preset.fromPrice * preset.truckCount} + PVN 21%
                    </Text>
                  </View>
                  <View style={s.sumPriceBadge}>
                    <Text style={s.sumPriceBadgeText}>Aptuveni</Text>
                  </View>
                </View>
              </View>

              {/* Contact & Notes */}
              <Text style={[s.sectionLabel, { marginTop: 20 }]}>Kontaktinformācija</Text>
              <View style={{ gap: 10, marginBottom: 8 }}>
                <TextInput
                  style={s.contactInput}
                  placeholder="Kontaktpersona"
                  placeholderTextColor="#9ca3af"
                  value={contactName}
                  onChangeText={setContactName}
                />
                <TextInput
                  style={s.contactInput}
                  placeholder="Tālrunis"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                />
                <TextInput
                  style={[s.contactInput, { height: 72, textAlignVertical: 'top' }]}
                  placeholder="Piezīmes un norādījumi (neobligāti)"
                  placeholderTextColor="#9ca3af"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity
                style={[s.nextBtn, loading && s.nextBtnDisabled]}
                disabled={loading}
                onPress={handleSubmit}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.nextText}>Iesniegt pieprasījumu →</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  // ── Root ──────────────────────────────────────────────────────
  root: { flex: 1, backgroundColor: '#fff' },

  // ── Map ───────────────────────────────────────────────────────
  mapWrap: { width: '100%', overflow: 'hidden', backgroundColor: '#e5e7eb' },
  mapPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111827',
    borderWidth: 3,
    borderColor: '#fff',
  },
  mapClose: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stepPill: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(17,24,39,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  stepPillText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  // ── Bottom sheet ──────────────────────────────────────────────
  sheet: { flex: 1, backgroundColor: '#fff' },
  progressTrack: { height: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#111827' },

  // Step 1 body (non-scrolling)
  sheetBody: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sheetSub: { fontSize: 14, color: '#6b7280', marginBottom: 16 },

  // Scrolling steps 2-4
  scrollArea: { flex: 1 },
  sheetScroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  // ── Location step ───────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  suggList: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  suggItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggText: { flex: 1, fontSize: 14, color: '#111827' },
  myLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: 2,
  },
  myLocText: { fontSize: 14, fontWeight: '500', color: '#111827' },

  // ── Waste grid ─────────────────────────────────────────────────
  wasteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  wasteCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#f3f4f6',
    position: 'relative',
    minHeight: 100,
  },
  wasteCardSel: { borderColor: '#111827', backgroundColor: '#111827' },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wasteLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 2 },
  wasteLabelSel: { color: '#fff' },
  wasteDesc: { fontSize: 11, color: '#9ca3af', lineHeight: 14 },
  wasteDescSel: { color: 'rgba(255,255,255,0.6)' },

  // ── Volume grid ────────────────────────────────────────────────
  hazardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  hazardText: { flex: 1, fontSize: 13, color: '#b91c1c' },
  volGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 16 },
  volCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#f3f4f6',
    alignItems: 'center',
    position: 'relative',
    minHeight: 100,
  },
  volCardSel: { borderColor: '#111827', backgroundColor: '#111827' },
  volEmoji: { fontSize: 28, marginBottom: 6 },
  volLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
  volLabelSel: { color: '#fff' },
  volSub: { fontSize: 12, color: '#9ca3af' },
  volPrice: { fontSize: 13, fontWeight: '700', color: '#9ca3af', marginTop: 4 },
  volPriceSel: { color: 'rgba(255,255,255,0.85)' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  descCard: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  descInput: { fontSize: 14, color: '#111827', minHeight: 60, textAlignVertical: 'top' },

  // ── Date step ─────────────────────────────────────────────────
  dayRow: { gap: 8, paddingHorizontal: 2 },
  dayChip: {
    width: 58,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    gap: 2,
  },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayChipName: { fontSize: 11, color: '#9ca3af', textTransform: 'capitalize' },
  dayChipNameActive: { color: 'rgba(255,255,255,0.7)' },
  dayChipNum: { fontSize: 18, fontWeight: '700', color: '#111827' },
  dayChipNumActive: { color: '#fff' },
  dayChipMon: { fontSize: 11, color: '#9ca3af' },
  dayChipMonActive: { color: 'rgba(255,255,255,0.7)' },

  // ── Summary card ──────────────────────────────────────────────
  summaryCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  sumRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  sumContent: { flex: 1 },
  sumLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  sumValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  sumDivider: { height: 1, backgroundColor: '#e5e7eb' },
  sumPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: '#f9fafb',
  },
  sumPriceBadge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sumPriceBadgeText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

  // ── Footer / buttons ───────────────────────────────────────────
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  nextBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#f3f4f6' },
  nextBtnHazard: { backgroundColor: '#b91c1c' },
  nextText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  nextTextDisabled: { color: '#9ca3af' },
  nextTextHazard: { color: '#fff' },

  // ── Success screen ─────────────────────────────────────────────
  successBg: { flex: 1, backgroundColor: '#111827' },
  successInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  jobNumBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  jobNumLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  jobNumValue: { fontSize: 22, fontWeight: '700', color: '#fff' },
  successHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  successBtn: {
    backgroundColor: '#fff',
    borderRadius: 100,
    paddingVertical: 15,
    paddingHorizontal: 32,
  },
  successBtnText: { fontSize: 16, fontWeight: '600', color: '#111827' },

  // ── Contact / Notes inputs ───────────────────────────────────────────────
  contactInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
});
