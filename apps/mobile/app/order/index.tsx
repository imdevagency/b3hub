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
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Marker } from 'react-native-maps';
import { BaseMap } from '@/components/map';
import { useGeocode } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import { useOrder } from '@/lib/order-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import type { SkipSize, SkipWasteCategory } from '@/lib/api';
import * as Location from 'expo-location';
import { ChevronLeft } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { MAP_FULL, MAP_SMALL, RIGA, SKIP_PRICES, toISO, addDays } from '@/components/order/skip-hire-types';
import { StepProgressBar } from '@/components/order/StepProgressBar';
import { Step1Location } from '@/components/order/Step1Location';
import { Step2WasteType } from '@/components/order/Step2WasteType';
import { Step3Size } from '@/components/order/Step3Size';
import { Step4Date } from '@/components/order/Step4Date';

// ── Constants ─────────────────────────────────────────────────────────────────

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

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

  // ── CTA gating (only step 1 + step 4 have explicit CTAs now) ──
  const canNext = step === 1 ? !!confirmedAddress : !!(startDate && endDate);

  // ── CTA unlock bounce — only fires on step 1 and step 4 ─────
  useEffect(() => {
    if (step !== 1 && step !== 4) return;
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
  }, [canNext, step]);

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

  // ── Auto-advance timer (steps 2 + 3) ─────────────────────────
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current); }, []);

  const handleWasteSelect = useCallback(
    (waste: SkipWasteCategory) => {
      setSelectedWaste(waste);
      setWasteCategory(waste);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => transitionTo(3, 'forward'), 320);
    },
    [setWasteCategory, transitionTo],
  );

  const handleSizeSelect = useCallback(
    (size: SkipSize) => {
      setSelectedSize(size);
      setSkipSize(size);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = setTimeout(() => transitionTo(4, 'forward'), 350);
    },
    [setSkipSize, transitionTo],
  );

  // ── Step 4 submit ─────────────────────────────────────────────
  const onSubmit = useCallback(async () => {
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
  }, [startDate, minDate, state, token, setDeliveryDate, setConfirmedOrder, router]);

  // ── Step 1 CTA ────────────────────────────────────────────────
  const onLocationCTA = useCallback(() => {
    if (!confirmedAddress) return;
    goNext();
  }, [confirmedAddress, goNext]);

  const price = SKIP_PRICES[state.skipSize ?? selectedSize ?? 'MIDI'] ?? 129;

  const TITLES = [
    t.skipHire.step1.title,
    t.skipHire.step2.title,
    t.skipHire.step3.title,
    t.skipHire.step4.title,
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
                {/* Inline back button for steps 2–3 (no footer CTA on those steps) */}
                {(step === 2 || step === 3) && (
                  <TouchableOpacity style={s.backBtnInline} onPress={goBack} activeOpacity={0.8}>
                    <ChevronLeft size={18} color="#6b7280" />
                  </TouchableOpacity>
                )}
                <Text style={s.stepTitle}>{TITLES[step - 1]}</Text>
              </View>
            </Animated.View>

            {/* Step content */}
            <View style={s.content}>
              {step === 2 && (
                <Step2WasteType selected={selectedWaste} onSelect={handleWasteSelect} />
              )}
              {step === 3 && <Step3Size selected={selectedSize} onSelect={handleSizeSelect} />}
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

        {/* Footer — only on step 4 (steps 2+3 auto-advance on tap, no CTA needed) */}
        {step === 4 && (
          <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.priceRow}>
              <View>
                <Text style={s.priceLabel}>Kopā ar PVN 21%</Text>
                <Text style={s.priceSub}>bez PVN €{(price / 1.21).toFixed(2)}</Text>
              </View>
              <Text style={s.priceAmount}>€{price}</Text>
            </View>
            <View style={s.ctaRow}>
              <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.8}>
                <ChevronLeft size={20} color="#111827" />
              </TouchableOpacity>
              <Animated.View style={[{ flex: 1 }, { transform: [{ scale: ctaScale }] }]}>
                <TouchableOpacity
                  style={[s.cta, (!canNext || submitting) && s.ctaDisabled, { flex: 1 }]}
                  disabled={!canNext || submitting}
                  onPress={onSubmit}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[s.ctaText, !canNext && s.ctaTextDisabled]}>
                      {t.skipHire.step4.placeOrder}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}
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
            onPress={onLocationCTA}
            activeOpacity={0.85}
          >
            <Text style={[s.ctaText, !canNext && s.ctaTextDisabled]}>{t.skipHire.step1.next} →</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtnInline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
