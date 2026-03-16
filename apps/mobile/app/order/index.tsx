/**
 * Container order wizard — Bolt/Uber-style map + bottom sheet.
 *
 * Single screen with persistent Google Maps backdrop. A draggable
 * bottom sheet cycles through 4 steps without new screen pushes:
 *   1. Location   — search bar + map pin
 *   2. Waste type — 2-col grid
 *   3. Skip size  — visual size cards
 *   4. Date       — quick-date picker + order summary → submit
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Marker } from 'react-native-maps';
import { Calendar } from 'react-native-calendars';
import { BaseMap } from '@/components/map';
import { useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import { useOrder } from '@/lib/order-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import type { SkipSize, SkipWasteCategory } from '@/lib/api';
import * as Location from 'expo-location';
import {
  X,
  Search,
  MapPin,
  Navigation2,
  Trash2,
  Leaf,
  Hammer,
  TreePine,
  Wrench,
  Cpu,
  Check,
  ChevronLeft,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import type { LucideIcon } from 'lucide-react-native';

// ── Constants ─────────────────────────────────────────────────────────────────

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const RIGA: [number, number] = [24.1052, 56.9496];
const GOOGLE_KEY = 'AIzaSyBNIZk1VBorD3kU02BNjz_2m4Dlek_gsx8';

/** Map section heights — animates between step 1 (large) and steps 2-4 (small strip) */
const MAP_FULL = Math.round(SCREEN_H * 0.46); // step 1: map takes ~46% of screen
const MAP_SMALL = Math.round(SCREEN_H * 0.22); // steps 2-4: map is a ~22% preview strip

// ── Data ──────────────────────────────────────────────────────────────────────

const WASTE_ICONS: Record<SkipWasteCategory, LucideIcon> = {
  MIXED: Trash2,
  GREEN_GARDEN: Leaf,
  CONCRETE_RUBBLE: Hammer,
  WOOD: TreePine,
  METAL_SCRAP: Wrench,
  ELECTRONICS_WEEE: Cpu,
};
const WASTE_TYPES: SkipWasteCategory[] = [
  'MIXED',
  'GREEN_GARDEN',
  'CONCRETE_RUBBLE',
  'WOOD',
  'METAL_SCRAP',
  'ELECTRONICS_WEEE',
];

const SIZES: Array<{ id: SkipSize; price: number; color: string; heightPct: number }> = [
  { id: 'MINI', price: 89, color: '#374151', heightPct: 0.28 },
  { id: 'MIDI', price: 129, color: '#111827', heightPct: 0.48 },
  { id: 'BUILDERS', price: 169, color: '#9ca3af', heightPct: 0.68 },
  { id: 'LARGE', price: 199, color: '#111827', heightPct: 0.88 },
];

const SKIP_PRICES: Record<string, number> = { MINI: 89, MIDI: 129, BUILDERS: 169, LARGE: 199 };

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'short',
  });
}

// ── Main component ────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

export default function OrderWizard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    state,
    setLocationWithCoords,
    setWasteCategory,
    setSkipSize,
    setDeliveryDate,
    setConfirmedOrder,
  } = useOrder();
  const { token } = useAuth();
  const { forwardGeocode, resolvePlace } = useGeocode();

  // ── Wizard step ───────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ── Location state ────────────────────────────────────────────
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    state.locationLat != null && state.locationLng != null
      ? { latitude: state.locationLat, longitude: state.locationLng }
      : null,
  );
  const [searchText, setSearchText] = useState(state.location || '');
  const [confirmedAddress, setConfirmedAddress] = useState(state.location || '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Selections ────────────────────────────────────────────────
  const [selectedWaste, setSelectedWaste] = useState<SkipWasteCategory | null>(state.wasteCategory);
  const [selectedSize, setSelectedSize] = useState<SkipSize | null>(state.skipSize);
  const today = new Date();
  const minDate = toISO(addDays(today, 1));
  const [startDate, setStartDate] = useState<string | null>(state.deliveryDate || null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Map ref ───────────────────────────────────────────────────
  const cameraRef = useRef<any>(null);

  // ── Map pin pulse (expanding ripple ring) ──────────────────────────────
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (pin) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(0);
    }
    return () => pulseLoop.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pin]);

  // ── CTA unlock bounce ───────────────────────────────────────────────────
  const ctaScale = useRef(new Animated.Value(0.95)).current;
  const prevCanNext = useRef(false);

  // ── Map height animation (shrinks on steps 2-4) ──────────────
  const mapHeight = useRef(new Animated.Value(MAP_FULL)).current;

  // ── Sheet card visibility — 0 = step 1 (transparent), 1 = steps 2-4 (white card) ──
  const sheetBgAnim = useRef(new Animated.Value(0)).current;
  // Interpolated background colour driven by sheetBgAnim (no native driver)
  const sheetBg = useRef(
    sheetBgAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,1)'],
    }),
  ).current;
  // Floating CTA fades in when sheet is transparent (step 1)
  const floatingCtaOpacity = useRef(
    sheetBgAnim.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
  ).current;

  // ── Step slide transition ─────────────────────────────────
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateMap = useCallback(
    (toStep: Step) => {
      Animated.spring(mapHeight, {
        toValue: toStep === 1 ? MAP_FULL : MAP_SMALL,
        useNativeDriver: false,
        tension: 60,
        friction: 14,
      }).start();
      // Fade the sheet card in/out with the map transition
      Animated.timing(sheetBgAnim, {
        toValue: toStep === 1 ? 0 : 1,
        duration: 280,
        useNativeDriver: false,
      }).start();
    },
    [mapHeight, sheetBgAnim],
  );

  const transitionTo = useCallback(
    (nextStep: Step, direction: 'forward' | 'back') => {
      haptics.light();
      const fromX = direction === 'forward' ? SCREEN_W : -SCREEN_W;
      // Snap to off-screen position, update step, then spring into place
      slideAnim.setValue(fromX);
      fadeAnim.setValue(0.6);
      setStep(nextStep);
      animateMap(nextStep);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [slideAnim, fadeAnim, animateMap],
  );

  // ── Search debounce ───────────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchText.trim() || searchText === confirmedAddress) {
      setSuggestions([]);
      return;
    }
    setLoadingSug(true);
    searchTimer.current = setTimeout(async () => {
      const res = await forwardGeocode(searchText);
      setSuggestions(res);
      setLoadingSug(false);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // ── Pick address suggestion ───────────────────────────────────
  const pickSuggestion = useCallback(
    async (s: GeocodeSuggestion) => {
      haptics.medium();
      setConfirmedAddress(s.place_name);
      setSearchText(s.place_name);
      setSuggestions([]);
      // Resolve coords from place_id via Place Details API
      const coords = await resolvePlace(s.id);
      if (coords) {
        const [lng, lat] = coords;
        setPin({ latitude: lat, longitude: lng });
        setLocationWithCoords(s.place_name, lat, lng);
        cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: 15,
          animationDuration: 700,
        });
      } else {
        // Coords unavailable — store address text only (rare fallback)
        setLocationWithCoords(s.place_name, 0, 0);
      }
    },
    [setLocationWithCoords, resolvePlace],
  );

  // ── Use device GPS ────────────────────────────────────────────
  const useMyLocation = useCallback(async () => {
    haptics.light();
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;
    setPin({ latitude, longitude });
    cameraRef.current?.setCamera({
      centerCoordinate: [longitude, latitude],
      zoomLevel: 15,
      animationDuration: 700,
    });
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=lv&key=${GOOGLE_KEY}`,
      );
      const json = await res.json();
      const addr: string =
        (json.results?.[0]?.formatted_address as string | undefined) ??
        `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setConfirmedAddress(addr);
      setSearchText(addr);
      setLocationWithCoords(addr, latitude, longitude);
    } catch {
      const addr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setConfirmedAddress(addr);
      setSearchText(addr);
      setLocationWithCoords(addr, latitude, longitude);
    }
  }, [setLocationWithCoords]);

  // ── CTA gating ────────────────────────────────────────────────
  const canNext =
    step === 1
      ? !!confirmedAddress
      : step === 2
        ? !!selectedWaste
        : step === 3
          ? !!selectedSize
          : !!(startDate && endDate);

  // ── Step navigation ───────────────────────────────────────────
  // ── CTA unlock bounce effect ──────────────────────────────────────────
  useEffect(() => {
    if (canNext && !prevCanNext.current) {
      haptics.selection();
      Animated.sequence([
        Animated.spring(ctaScale, {
          toValue: 1.04,
          useNativeDriver: true,
          tension: 200,
          friction: 6,
        }),
        Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      ]).start();
    } else if (!canNext) {
      ctaScale.setValue(0.95);
    }
    prevCanNext.current = canNext;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canNext]);

  const goNext = useCallback(() => {
    const next = Math.min(4, step + 1) as Step;
    transitionTo(next, 'forward');
  }, [step, transitionTo]);

  const goBack = useCallback(() => {
    if (step === 1) {
      router.back();
    } else {
      const prev = Math.max(1, step - 1) as Step;
      transitionTo(prev, 'back');
    }
  }, [step, router, transitionTo]);

  // ── CTA handler ───────────────────────────────────────────────
  const onCTA = useCallback(async () => {
    if (step === 1) {
      if (!confirmedAddress) return;
      goNext();
    } else if (step === 2) {
      if (!selectedWaste) return;
      setWasteCategory(selectedWaste);
      goNext();
    } else if (step === 3) {
      if (!selectedSize) return;
      setSkipSize(selectedSize);
      goNext();
    } else {
      // Step 4 — submit
      if (!state.location || !state.wasteCategory || !state.skipSize) return;
      setSubmitting(true);
      setDeliveryDate(startDate ?? minDate);
      try {
        const order = await api.skipHire.create(
          {
            location: state.location,
            wasteCategory: state.wasteCategory,
            skipSize: state.skipSize,
            deliveryDate: startDate ?? minDate,
          },
          token ?? undefined,
        );
        haptics.success();
        setConfirmedOrder(order);
        router.push('/order/confirmation');
      } catch (err) {
        Alert.alert(t.skipHire.errorTitle, err instanceof Error ? err.message : t.skipHire.error);
      } finally {
        setSubmitting(false);
      }
    }
  }, [
    step,
    confirmedAddress,
    selectedWaste,
    selectedSize,
    startDate,
    endDate,
    minDate,
    state,
    token,
    goNext,
    setWasteCategory,
    setSkipSize,
    setDeliveryDate,
    setConfirmedOrder,
    router,
  ]);

  const price = SKIP_PRICES[state.skipSize ?? selectedSize ?? 'MIDI'] ?? 129;

  const CTA_LABELS = [
    t.skipHire.step1.next,
    t.skipHire.step2.next,
    t.skipHire.step3.next,
    t.skipHire.step4.placeOrder,
  ];

  const TITLES = [
    t.skipHire.step1.title,
    t.skipHire.step2.title,
    t.skipHire.step3.title,
    t.skipHire.step4.title,
  ];
  const SUBTITLES = [
    t.skipHire.step1.subtitle,
    t.skipHire.step2.subtitle,
    t.skipHire.step3.subtitle,
    t.skipHire.step4.subtitle,
  ];

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Full-screen map — true 100vh, camera inset via mapPadding */}
      <View style={StyleSheet.absoluteFillObject}>
        <BaseMap
          cameraRef={cameraRef}
          center={RIGA}
          zoom={11}
          showsMyLocationButton={false}
          mapPadding={{ bottom: step === 1 ? SCREEN_H - MAP_FULL : SCREEN_H - MAP_SMALL }}
        >
          {pin && (
            <Marker coordinate={pin} tappable={false}>
              <View style={s.mapPin}>
                <Animated.View
                  style={[
                    s.mapPinPulse,
                    {
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 0.4, 1],
                        outputRange: [0.7, 0.3, 0],
                      }),
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.8],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <View style={s.mapPinRing} />
                <View style={s.mapPinDot} />
              </View>
            </Marker>
          )}
        </BaseMap>
      </View>

      {/* Floating back button — always top-left over the map */}
      <TouchableOpacity
        style={[s.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <ChevronLeft size={20} color="#111827" />
      </TouchableOpacity>

      {/* Search card — floats at top of map, only on step 1 */}
      {step === 1 && (
        <View style={[s.mapSearchOverlay, { top: insets.top + 66 }]}>
          <Step1Location
            floating
            searchText={searchText}
            onSearchChange={setSearchText}
            loadingSug={loadingSug}
            suggestions={suggestions}
            confirmedAddress={confirmedAddress}
            onPickSuggestion={pickSuggestion}
            onUseMyLocation={useMyLocation}
            onClearSearch={() => {
              setSearchText('');
              setSuggestions([]);
            }}
          />
        </View>
      )}

      {/* Sheet — absolute overlay, top edge springs with mapHeight */}
      {/* backgroundColor drives iOS shadow too — transparent bg = no shadow on step 1 */}
      <Animated.View style={[s.sheet, { top: mapHeight, backgroundColor: sheetBg }]}>
        {/* Handle nub — fades out on step 1 */}
        <Animated.View style={[s.handleArea, { opacity: sheetBgAnim }]} pointerEvents="none">
          <View style={s.handle} />
        </Animated.View>

        {/* Clip container — prevents sliding content from bleeding outside the sheet */}
        <View style={s.slideClip}>
          {/* Step header + content wrapped together so they slide as one unit */}
          <Animated.View
            style={[s.slideWrapper, { transform: [{ translateX: slideAnim }], opacity: fadeAnim }]}
          >
            {/* Step progress bar + header — fades out on step 1 */}
            <Animated.View style={{ opacity: sheetBgAnim }}>
              <StepProgressBar step={step} />
              <View style={s.stepHeader}>
                <Text style={s.stepTitle}>{TITLES[step - 1]}</Text>
              </View>
            </Animated.View>

            {/* Step content */}
            <View style={s.content}>
              {step === 2 && (
                <Step2WasteType selected={selectedWaste} onSelect={setSelectedWaste} />
              )}
              {step === 3 && <Step3Size selected={selectedSize} onSelect={setSelectedSize} />}
              {step === 4 && (
                <Step4Date
                  minDate={minDate}
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={(s, e) => {
                    setStartDate(s);
                    setEndDate(e);
                  }}
                  wasteLabel={
                    state.wasteCategory
                      ? (t.skipHire.step2.types[state.wasteCategory]?.label ?? '—')
                      : '—'
                  }
                  sizeLabel={
                    state.skipSize ? (t.skipHire.step3.sizes[state.skipSize]?.label ?? '—') : '—'
                  }
                  location={state.location}
                />
              )}
            </View>
          </Animated.View>
        </View>

        {/* Footer CTA — fades out on step 1 (replaced by floating CTA) */}
        <Animated.View
          style={{ opacity: sheetBgAnim }}
          pointerEvents={step === 1 ? 'none' : 'box-none'}
        >
          <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
            {step === 4 && (
              <View style={s.priceRow}>
                <View>
                  <Text style={s.priceLabel}>Kopā ar PVN 21%</Text>
                  <Text style={s.priceSub}>bez PVN €{(price / 1.21).toFixed(2)}</Text>
                </View>
                <Text style={s.priceAmount}>€{price}</Text>
              </View>
            )}
            <View style={s.ctaRow}>
              {step > 1 && (
                <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.8}>
                  <ChevronLeft size={20} color="#111827" />
                </TouchableOpacity>
              )}
              <Animated.View style={[{ flex: 1 }, { transform: [{ scale: ctaScale }] }]}>
                <TouchableOpacity
                  style={[s.cta, (!canNext || submitting) && s.ctaDisabled, { flex: 1 }]}
                  disabled={!canNext || submitting}
                  onPress={onCTA}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[s.ctaText, !canNext && s.ctaTextDisabled]}>
                      {CTA_LABELS[step - 1]}
                      {step < 4 ? '  →' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Floating CTA — only on step 1, fades out as sheet card appears */}
      <Animated.View
        style={[s.floatingCta, { bottom: insets.bottom + 20, opacity: floatingCtaOpacity }]}
        pointerEvents={step === 1 ? 'box-none' : 'none'}
      >
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity
            style={[s.cta, !canNext && s.ctaDisabled]}
            disabled={!canNext}
            onPress={onCTA}
            activeOpacity={0.85}
          >
            <Text style={[s.ctaText, !canNext && s.ctaTextDisabled]}>{CTA_LABELS[0]} →</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ── Step progress bar ───────────────────────────────────────────────────────────

function StepProgressBar({ step }: { step: Step }) {
  const anims = useRef([
    new Animated.Value(step === 1 ? 1 : 0.35),
    new Animated.Value(step === 2 ? 1 : step > 2 ? 0.55 : 0.2),
    new Animated.Value(step === 3 ? 1 : step > 3 ? 0.55 : 0.2),
    new Animated.Value(step === 4 ? 1 : 0.2),
  ]).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      const target = i + 1 === step ? 1 : i + 1 < step ? 0.55 : 0.2;
      Animated.spring(anim, {
        toValue: target,
        useNativeDriver: false,
        tension: 80,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 20, marginBottom: 10 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            height: 3,
            borderRadius: 2,
            flex: 1,
            backgroundColor: anim.interpolate({
              inputRange: [0.2, 0.55, 1],
              outputRange: ['#e5e7eb', '#9ca3af', '#111827'],
            }),
            opacity: anim.interpolate({
              inputRange: [0.2, 1],
              outputRange: [0.5, 1],
            }),
          }}
        />
      ))}
    </View>
  );
}

// ── Step 1 — Location ─────────────────────────────────────────────────────────

interface Step1Props {
  floating?: boolean;
  searchText: string;
  onSearchChange: (v: string) => void;
  loadingSug: boolean;
  suggestions: GeocodeSuggestion[];
  confirmedAddress: string;
  onPickSuggestion: (s: GeocodeSuggestion) => void;
  onUseMyLocation: () => void;
  onClearSearch: () => void;
}

function Step1Location({
  floating,
  searchText,
  onSearchChange,
  loadingSug,
  suggestions,
  confirmedAddress,
  onPickSuggestion,
  onUseMyLocation,
  onClearSearch,
}: Step1Props) {
  return (
    <View style={{ flex: 1 }}>
      {/* Unified white card: search + GPS + suggestions */}
      <View style={floating ? s1.cardShadow : s1.cardShadowInline}>
        <View style={s1.card}>
          {/* Search row */}
          <View style={s1.cardSearchRow}>
            <Search size={15} color="#9ca3af" />
            <TextInput
              style={s1.searchInput}
              placeholder={t.skipHire.step1.placeholder}
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={onSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              autoFocus={floating}
            />
            {loadingSug ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : searchText.length > 0 ? (
              <TouchableOpacity
                onPress={onClearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={15} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Divider */}
          <View style={s1.cardDivider} />

          {/* GPS row — always first */}
          <TouchableOpacity style={s1.suggRow} onPress={onUseMyLocation} activeOpacity={0.75}>
            <View style={s1.myLocIcon}>
              <Navigation2 size={14} color="#2563eb" />
            </View>
            <Text style={[s1.suggText, { fontWeight: '600', color: '#2563eb' }]}>
              Izmantot manu atrašanās vietu
            </Text>
          </TouchableOpacity>

          {/* Typed suggestions */}
          {suggestions.map((item) => (
            <React.Fragment key={item.id}>
              <View style={s1.cardDivider} />
              <TouchableOpacity
                style={s1.suggRow}
                onPress={() => onPickSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={s1.suggDotCol}>
                  <View style={s1.suggDot} />
                </View>
                <Text style={s1.suggText} numberOfLines={2}>
                  {item.place_name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Confirmed address chip */}
      {confirmedAddress ? (
        <View style={s1.confirmedRow}>
          <MapPin size={13} color="#059669" />
          <Text style={s1.confirmedText} numberOfLines={2}>
            {confirmedAddress}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Step 2 — Waste type ───────────────────────────────────────────────────────

function Step2WasteType({
  selected,
  onSelect,
}: {
  selected: SkipWasteCategory | null;
  onSelect: (v: SkipWasteCategory) => void;
}) {
  const scales = useRef(WASTE_TYPES.map(() => new Animated.Value(1))).current;
  const stagger = useRef(WASTE_TYPES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    stagger.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        delay: i * 55,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: SkipWasteCategory, idx: number) => {
    haptics.selection();
    Animated.sequence([
      Animated.spring(scales[idx], {
        toValue: 0.92,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(scales[idx], {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 6,
      }),
    ]).start();
    onSelect(id);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s2.grid}>
      {WASTE_TYPES.map((id, idx) => {
        const info = t.skipHire.step2.types[id];
        const isSelected = selected === id;
        const Icon = WASTE_ICONS[id];
        const translateY = stagger[idx].interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
        return (
          <Animated.View
            key={id}
            style={{
              width: '47%',
              opacity: stagger[idx],
              transform: [{ scale: scales[idx] }, { translateY }],
            }}
          >
            <TouchableOpacity
              style={[s2.card, isSelected && s2.cardSelected]}
              onPress={() => handleSelect(id, idx)}
              activeOpacity={0.75}
            >
              {isSelected && (
                <View style={s2.check}>
                  <Check size={10} color="#fff" />
                </View>
              )}
              <Icon size={24} color={isSelected ? '#fff' : '#6b7280'} style={{ marginBottom: 6 }} />
              <Text style={[s2.label, isSelected && s2.labelSelected]}>{info.label}</Text>
              <Text style={[s2.desc, isSelected && s2.descSelected]}>{info.desc}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

// ── Step 3 — Skip size ────────────────────────────────────────────────────────

function Step3Size({
  selected,
  onSelect,
}: {
  selected: SkipSize | null;
  onSelect: (v: SkipSize) => void;
}) {
  const scales = useRef(SIZES.map(() => new Animated.Value(1))).current;
  const stagger = useRef(SIZES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    stagger.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        delay: i * 70,
        useNativeDriver: true,
        tension: 75,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: SkipSize, idx: number) => {
    haptics.selection();
    Animated.sequence([
      Animated.spring(scales[idx], {
        toValue: 0.96,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(scales[idx], {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }),
    ]).start();
    onSelect(id);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
      {SIZES.map((size, idx) => {
        const info = t.skipHire.step3.sizes[size.id];
        const isSel = selected === size.id;
        const boxH = Math.round(16 + size.heightPct * 26);
        const boxW = Math.round(32 + size.heightPct * 16);
        const translateY = stagger[idx].interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
        return (
          <Animated.View
            key={size.id}
            style={{ opacity: stagger[idx], transform: [{ scale: scales[idx] }, { translateY }] }}
          >
            <TouchableOpacity
              style={[s3.card, isSel && s3.cardSel]}
              onPress={() => handleSelect(size.id, idx)}
              activeOpacity={0.75}
            >
              {size.id === 'MIDI' && (
                <View style={s3.popular}>
                  <Text style={s3.popularTxt}>{t.skipHire.step3.popular}</Text>
                </View>
              )}
              <View style={s3.row}>
                {/* Visual skip container */}
                <View style={s3.skipWrap}>
                  <View
                    style={[
                      s3.skipBox,
                      {
                        height: boxH,
                        width: boxW,
                        backgroundColor: isSel ? size.color : '#e5e7eb',
                      },
                    ]}
                  />
                  <View style={s3.wheels}>
                    <View style={[s3.wheel, isSel && { backgroundColor: size.color }]} />
                    <View style={[s3.wheel, isSel && { backgroundColor: size.color }]} />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[s3.label, isSel && { color: size.color }]}>{info.label}</Text>
                  <Text style={s3.vol}>{info.volume}</Text>
                  <Text style={s3.desc}>{info.desc}</Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[s3.price, isSel && { color: size.color }]}>€{size.price}</Text>
                  {isSel && (
                    <View style={[s3.checkCircle, { backgroundColor: size.color }]}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

// ── Step 4 — Date + summary ───────────────────────────────────────────────────

/** Build period-marked dates for react-native-calendars `markingType='period'`. */
function buildPeriodMarks(
  start: string | null,
  end: string | null,
): Record<
  string,
  { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }
> {
  if (!start) return {};
  if (!end) {
    return {
      [start]: { startingDay: true, endingDay: true, color: '#111827', textColor: '#fff' },
    };
  }
  const marks: Record<
    string,
    { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }
  > = {};
  // Parse with local Date constructor (year, month-1, day) to avoid UTC offset shifts
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  let cur = new Date(sy, sm - 1, sd);
  const endD = new Date(ey, em - 1, ed);
  while (cur <= endD) {
    const iso = toISO(cur);
    marks[iso] = {
      color: '#111827',
      textColor: '#fff',
      startingDay: iso === start,
      endingDay: iso === end,
    };
    // Advance by one day using local time
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return marks;
}

function Step4Date({
  minDate,
  startDate,
  endDate,
  onRangeChange,
  wasteLabel,
  sizeLabel,
  location,
}: {
  minDate: string;
  startDate: string | null;
  endDate: string | null;
  onRangeChange: (start: string | null, end: string | null) => void;
  wasteLabel: string;
  sizeLabel: string;
  location: string;
}) {
  const handleDayPress = (day: { dateString: string }) => {
    const iso = day.dateString;
    if (!startDate || (startDate && endDate)) {
      // Start fresh selection
      onRangeChange(iso, null);
    } else {
      // Have start, waiting for end
      if (iso < startDate) {
        onRangeChange(iso, null); // tapped before start → new start
      } else if (iso === startDate) {
        onRangeChange(null, null); // deselect
      } else {
        onRangeChange(startDate, iso); // complete the range
      }
    }
  };

  const markedDates = buildPeriodMarks(startDate, endDate);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
      {/* Range calendar */}
      <Calendar
        minDate={minDate}
        current={startDate ?? minDate}
        markingType="period"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        theme={{
          calendarBackground: '#fff',
          backgroundColor: '#fff',
          selectedDayBackgroundColor: '#111827',
          selectedDayTextColor: '#fff',
          todayTextColor: '#6b7280',
          dayTextColor: '#111827',
          textDisabledColor: '#d1d5db',
          arrowColor: '#111827',
          monthTextColor: '#111827',
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 14,
          textMonthFontSize: 15,
        }}
        style={s4.calendar}
        enableSwipeMonths
      />

      {/* Order summary */}
      <Text style={s4.summTitle}>{t.skipHire.step4.summary}</Text>
      <View style={s4.summary}>
        {[
          { label: t.skipHire.confirmation.location, value: location },
          { label: t.skipHire.confirmation.wasteType, value: wasteLabel },
          { label: t.skipHire.confirmation.size, value: sizeLabel },
          {
            label: 'Nomas periods',
            value:
              startDate && endDate ? `${formatShort(startDate)} – ${formatShort(endDate)}` : '—',
          },
        ].map((row, i, arr) => (
          <View
            key={i}
            style={[
              s4.summRow,
              i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
            ]}
          >
            <Text style={s4.summLabel}>{row.label}</Text>
            <Text style={s4.summVal} numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Root styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  mapPin: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  mapPinRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17,24,39,0.15)',
  },
  mapPinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111827',
    borderWidth: 3,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: { elevation: 5 },
    }),
  },

  mapPinPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
  },

  closeBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },

  // Search card overlay — absolute, floats above map at top (step 1 only)
  mapSearchOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 30,
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // top is animated via mapHeight; backgroundColor animated via sheetBg interpolation
    // iOS: shadow is suppressed automatically when backgroundColor is transparent
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: { elevation: 20 },
    }),
  },
  floatingCta: {
    position: 'absolute',
    left: 20,
    right: 20,
    // bottom set inline with safe-area inset
  },
  handleArea: { paddingTop: 12, paddingBottom: 6, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' },

  stepHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepStepNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    lineHeight: 26,
  },
  stepSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  slideClip: { flex: 1, overflow: 'hidden' },
  slideWrapper: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, minHeight: 0 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 2,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#374151',
  },
  priceSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  priceAmount: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
  },

  cta: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: '#e5e7eb' },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  ctaTextDisabled: { color: '#9ca3af' },
});

// ── Step 1 styles ─────────────────────────────────────────────────────────────

const s1 = StyleSheet.create({
  // Shadow wrapper (floating over map)
  cardShadow: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  // Shadow wrapper (inside sheet — lighter shadow)
  cardShadowInline: {
    borderRadius: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cardSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f3f4f6',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  myLocIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  suggDotCol: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  suggText: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 20 },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
  },
  confirmedText: { flex: 1, fontSize: 13, color: '#059669', lineHeight: 18 },
});

// ── Step 2 styles ─────────────────────────────────────────────────────────────

const s2 = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  card: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#f3f4f6',
    position: 'relative',
    minHeight: 100,
  },
  cardSelected: { borderColor: '#111827', backgroundColor: '#111827' },
  check: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  labelSelected: { color: '#fff' },
  desc: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  descSelected: { color: 'rgba(255,255,255,0.6)' },
});

// ── Step 3 styles ─────────────────────────────────────────────────────────────

const s3 = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    position: 'relative',
    overflow: 'hidden',
  },
  cardSel: { borderColor: '#111827', backgroundColor: '#fff' },
  popular: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularTxt: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skipWrap: { alignItems: 'center', width: 56, justifyContent: 'flex-end' },
  skipBox: { borderRadius: 3 },
  wheels: { flexDirection: 'row', gap: 7, marginTop: 3 },
  wheel: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#d1d5db' },
  label: { fontSize: 15, fontWeight: '700', color: '#111827' },
  vol: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  desc: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  price: { fontSize: 18, fontWeight: '700', color: '#374151' },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Step 4 styles ─────────────────────────────────────────────────────────────

const s4 = StyleSheet.create({
  calendar: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  summTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summary: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  summRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  summLabel: { fontSize: 13, color: '#6b7280' },
  summVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    maxWidth: '55%',
    textAlign: 'right',
  },
});
