/**
 * order-request.tsx
 *
 * Clean material ordering flow:
 *   ONBOARDING (first time) → MAP → MATERIAL → CONFIGURE → [OFFERS | SENT] → QUOTES → CONFIRM → SUCCESS
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseMap, UserLayer, useGeocode, RIGA_CENTER } from '@/components/map';
import type { GeocodeSuggestion } from '@/components/map';
import { Marker } from 'react-native-maps';
import { AddressPickerModal } from '@/components/wizard/AddressPickerModal';
import type { PickedAddress } from '@/components/wizard/AddressPickerModal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UNIT_SHORT, CATEGORY_ICON, CATEGORY_LABELS } from '@/lib/materials';
import type {
  MaterialCategory,
  MaterialUnit,
  SupplierOffer,
  QuoteRequest,
  QuoteResponse,
} from '@/lib/api';
import { sa } from '@/components/order/order-request-styles';
import { FlowProgress, STEP_ORDER } from '@/components/order/FlowProgress';
import type {
  LatLng,
  Step,
  MaterialCategoryAll,
  GlobalMaterial,
} from '@/components/order/order-request-types';
import {
  CATEGORIES,
  GLOBAL_MATERIALS,
  FRACTIONS,
  VEHICLES,
} from '@/components/order/order-request-types';
import {
  ChevronLeft,
  MapPin,
  CheckCircle,
  Star,
  Clock,
  Truck,
  Search,
  X,
  Leaf,
  Layers,
  Navigation2,
  RotateCcw,
} from 'lucide-react-native';
import * as Location from 'expo-location';
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SW = SCREEN_W; // kept for layout refs inside this file
/** Map height when the location step is active (big map, ~46% of screen) */
const MAP_FULL = Math.round(SCREEN_H * 0.46);
/** Map height for all non-location steps (small strip, ~22% of screen) */
const MAP_SMALL = Math.round(SCREEN_H * 0.22);

// ── Main screen ──────────────────────────────────────────────────

export default function OrderRequestScreen() {
  // Backward-compat: params may arrive from old catalog-based nav
  const params = useLocalSearchParams<{
    materialId?: string;
    materialName?: string;
    materialCategory?: string;
    basePrice?: string;
    unit?: string;
    supplier?: string;
    supplierId?: string;
  }>();

  const router = useRouter();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);

  // ── Animation refs ─────────────────────────────────────────────
  const mapHeight = useRef(new Animated.Value(MAP_FULL)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Sheet transparency: 0 = transparent (map step), 1 = white (all other steps)
  const sheetBgAnim = useRef(new Animated.Value(0)).current;
  const sheetBg = sheetBgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,1)'],
  });
  const floatingCtaOpacity = sheetBgAnim.interpolate({
    inputRange: [0, 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const ctaScale = useRef(new Animated.Value(1)).current;

  const {
    forwardGeocode,
    resolvePlace,
    reverseGeocodeWithCity,
    loading: geoLoading,
  } = useGeocode();

  // ── Step ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('map');

  // ── Location ──────────────────────────────────────────────────
  const [pin, setPin] = useState<LatLng | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [satellite, setSatellite] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(true);
  // ── Geo-search (address autocomplete) ───────────────────────────────
  const [geoSearchText, setGeoSearchText] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoSuggestions, setGeoSuggestions] = useState<any[]>([]);
  const geoSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Material selection ────────────────────────────────────────
  const [selectedMaterial, setSelectedMaterial] = useState<GlobalMaterial | null>(null);
  const [materials, setMaterials] = useState<GlobalMaterial[]>(GLOBAL_MATERIALS);
  const [matSearch, setMatSearch] = useState('');
  const [matCat, setMatCat] = useState<MaterialCategoryAll>('ALL');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Configure ─────────────────────────────────────────────────
  const resolvedCategory =
    selectedMaterial?.category?.toUpperCase() ??
    params.materialCategory?.toUpperCase() ??
    'DEFAULT';
  const fractionList = FRACTIONS[resolvedCategory] ?? FRACTIONS.DEFAULT;
  const [fraction, setFraction] = useState(fractionList[0] ?? '0/45');
  const [quantity, setQuantity] = useState(26);
  const [vehicleId, setVehicleId] = useState('TIPPER_26T');

  // ── Instant offers (marketplace path) ────────────────────────
  const [instantOffers, setInstantOffers] = useState<SupplierOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<SupplierOffer | null>(null);

  // ── RFQ / quote-request path ───────────────────────────────────
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);
  const [selectedQuoteResponse, setSelectedQuoteResponse] = useState<QuoteResponse | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // ── Contact / Notes ───────────────────────────────────────────────────────
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');

  // ── Resolved material props ───────────────────────────────────
  const matName = selectedMaterial?.name ?? params.materialName ?? '';
  const matDescription = selectedMaterial?.description ?? '';
  const matCategoryValue = (selectedMaterial?.category ??
    params.materialCategory ??
    'OTHER') as MaterialCategory;
  const matBasePrice = selectedMaterial?.basePrice ?? parseFloat(params.basePrice ?? '0') ?? 0;
  const matUnit = (selectedMaterial?.unit ?? params.unit ?? 'TONNE') as MaterialUnit;

  const selectedVehicle = VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0];
  const maxTonnes = parseInt(selectedVehicle.label, 10) || 26;

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    setStep('map');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === 'map') setShowLocationPicker(true);
  }, [step]);

  // ── Filter global material catalogue ─────────────────────────
  const filterMaterials = useCallback((q: string, cat: MaterialCategoryAll) => {
    let list = GLOBAL_MATERIALS;
    if (cat !== 'ALL') list = list.filter((m) => m.category === cat);
    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      list = list.filter(
        (m) => m.name.toLowerCase().includes(lq) || m.description.toLowerCase().includes(lq),
      );
    }
    setMaterials(list);
  }, []);

  useEffect(() => {
    if (step === 'material') {
      setMatSearch('');
      setMatCat('ALL');
      setMaterials(GLOBAL_MATERIALS);
    }
  }, [step]);

  const onMatSearch = (text: string) => {
    setMatSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => filterMaterials(text, matCat), 150);
  };

  const onMatCategory = (cat: MaterialCategoryAll) => {
    setMatCat(cat);
    filterMaterials(matSearch, cat);
  };

  const onSelectMaterial = (mat: GlobalMaterial) => {
    setSelectedMaterial(mat);
    const fl = FRACTIONS[mat.category?.toUpperCase() ?? 'DEFAULT'] ?? FRACTIONS.DEFAULT;
    setFraction(fl[0] ?? '0/45');
    transitionTo('configure', 'forward');
  };

  // ── Step 1: tap map to drop pin ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMapPress = useCallback(
    async (feature: any) => {
      const coords = feature?.geometry?.coordinates as number[] | undefined;
      if (!Array.isArray(coords) || coords.length < 2) return;
      const [longitude, latitude] = coords;
      setPin({ latitude, longitude });
      setAddress('Nosakām adresi...');
      const { address: addr, city: c } = await reverseGeocodeWithCity(latitude, longitude);
      setAddress(addr);
      setCity(c);
    },
    [reverseGeocodeWithCity],
  );

  // ── Draggable pin drag-end handler ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPinDragEnd = useCallback(
    async (e: any) => {
      const { latitude, longitude } = e?.nativeEvent?.coordinate ?? {};
      if (latitude == null || longitude == null) return;
      setPin({ latitude, longitude });
      setAddress('Nosakām adresi...');
      const { address: addr, city: c } = await reverseGeocodeWithCity(latitude, longitude);
      setAddress(addr);
      setCity(c);
    },
    [reverseGeocodeWithCity],
  );

  // ── Locate-me: jump camera + drop pin at GPS position ─────────
  const locateMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setPin({ latitude, longitude });
      setAddress('Nosakām adresi...');
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 16,
        animationDuration: 700,
      });
      const { address: addr, city: c } = await reverseGeocodeWithCity(latitude, longitude);
      setAddress(addr);
      setCity(c);
    } catch {
      // permission denied or GPS unavailable — fail silently
    }
  }, [reverseGeocodeWithCity]);

  const onGeoSearchChange = useCallback(
    (text: string) => {
      setGeoSearchText(text);
      if (geoSearchTimer.current) clearTimeout(geoSearchTimer.current);
      geoSearchTimer.current = setTimeout(async () => {
        const results = await forwardGeocode(text);
        setGeoSuggestions(results);
      }, 350);
    },
    [forwardGeocode],
  );

  const onPlaceSelected = useCallback(
    async (feature: GeocodeSuggestion) => {
      setAddress(feature.place_name);
      setGeoSearchText(feature.place_name);
      setGeoSuggestions([]);
      const coords = await resolvePlace(feature.id);
      if (coords) {
        const [pLng, pLat] = coords;
        const latLng: LatLng = { latitude: pLat, longitude: pLng };
        setPin(latLng);
        cameraRef.current?.setCamera({
          centerCoordinate: [pLng, pLat],
          zoomLevel: 14,
          animationDuration: 600,
        });
        const { city: c } = await reverseGeocodeWithCity(pLat, pLng);
        setCity(c);
      }
    },
    [resolvePlace, reverseGeocodeWithCity],
  );

  // ── Step 2: quantity stepper ─────────────────────────────────
  const stepQty = (delta: number) =>
    setQuantity((prev) => Math.max(1, Math.min(maxTonnes, prev + delta)));

  // ── Map height animation ──────────────────────────────────────
  const animateMap = useCallback(
    (toStep: Step) => {
      Animated.spring(mapHeight, {
        toValue: toStep === 'map' ? MAP_FULL : MAP_SMALL,
        useNativeDriver: false,
        tension: 60,
        friction: 14,
      }).start();
    },
    [mapHeight],
  );

  // ── Step transition with slide + fade ─────────────────────────
  const transitionTo = useCallback(
    (nextStep: Step, direction: 'forward' | 'back') => {
      const fromX = direction === 'forward' ? SCREEN_W : -SCREEN_W;
      slideAnim.setValue(fromX);
      fadeAnim.setValue(0.6);
      setStep(nextStep);
      animateMap(nextStep);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 68,
          friction: 14,
        }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetBgAnim, {
          toValue: nextStep === 'map' ? 0 : 1,
          duration: 280,
          useNativeDriver: false,
        }),
      ]).start();
    },
    [slideAnim, fadeAnim, animateMap, sheetBgAnim],
  );

  // ── Back navigation ───────────────────────────────────────────
  const goBack = useCallback(() => {
    const backMap: Partial<Record<Step, Step>> = {
      material: 'map',
      configure: 'material',
      offers: 'configure',
      quotes: 'configure',
      confirm: selectedOffer ? 'offers' : 'quotes',
    };
    const target = backMap[step];
    if (target) transitionTo(target, 'back');
    else router.back();
  }, [step, selectedOffer, transitionTo, router]);

  // ── Submit RFQ (fire-and-forget) ──────────────────────────────
  const submitRFQ = useCallback(
    async (onError: () => void) => {
      if (!token) return;
      try {
        const req = await api.quoteRequests.create(
          {
            materialCategory: matCategoryValue,
            materialName: matName,
            quantity,
            unit: matUnit,
            deliveryAddress: address,
            deliveryCity: city,
            deliveryLat: pin?.latitude,
            deliveryLng: pin?.longitude,
          },
          token,
        );
        setQuoteRequest(req);
        transitionTo('sent', 'forward');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Neizdevās nosūtīt pieprasījumu';
        Alert.alert('Kļūda', msg);
        onError();
      }
    },
    [token, matCategoryValue, matName, matUnit, quantity, address, city, pin, transitionTo],
  );

  // ── Step 3: fetch instant offers or fall back to fire-and-forget RFQ ──
  const requestQuotes = useCallback(async () => {
    if (!token) return;
    setInstantOffers([]);
    setSelectedOffer(null);
    setQuoteRequest(null);
    setSelectedQuoteResponse(null);

    try {
      const offers = await api.materials.getOffers(
        {
          category: matCategoryValue,
          quantity,
          lat: pin?.latitude,
          lng: pin?.longitude,
        },
        token,
      );

      if (offers.length > 0) {
        // Instant inventory — show offers immediately
        const sorted = [...offers].sort((a, b) => a.totalPrice - b.totalPrice);
        setInstantOffers(sorted);
        setSelectedOffer(sorted[0]);
        transitionTo('offers', 'forward');
        return;
      }
    } catch {
      /* fall through to RFQ */
    }

    // No instant stock — submit RFQ and let user leave
    await submitRFQ(() => transitionTo('configure', 'back'));
  }, [token, matCategoryValue, quantity, pin, transitionTo, submitRFQ]);

  // ── Step confirm: instant offer OR accepted RFQ response ──────
  const confirmOrder = async () => {
    if (!user || !token || !pin) return;
    setSubmitting(true);
    try {
      if (selectedOffer) {
        // Instant marketplace path → POST /orders
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + (selectedOffer.etaDays || 1));
        const order = await api.materials.createOrder(
          {
            buyerId: user.id,
            materialId: selectedOffer.id,
            quantity,
            unit: matUnit,
            unitPrice: selectedOffer.basePrice,
            deliveryAddress: address,
            deliveryCity: city || selectedOffer.supplier.city || '',
            deliveryDate: deliveryDate.toISOString().split('T')[0],
            siteContactName: contactName || undefined,
            siteContactPhone: contactPhone || undefined,
            notes: notes || undefined,
          },
          token,
        );
        setOrderNumber(order.orderNumber);
      } else if (quoteRequest && selectedQuoteResponse) {
        // RFQ path → accept the chosen response (server creates Order automatically)
        const order = await api.quoteRequests.accept(
          quoteRequest.id,
          selectedQuoteResponse.id,
          token,
        );
        setOrderNumber(order.orderNumber);
      } else {
        Alert.alert('Kļūda', 'Nav izvēlēts piedāvājums');
        setSubmitting(false);
        return;
      }
      transitionTo('success', 'forward');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Neizdevās izveidot pasūtījumu';
      Alert.alert('Kļūda', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // Step renders
  // ════════════════════════════════════════════════════════════

  // ── STEP: Location — search card is now an absolute overlay at top of map (Uber-style)
  //    Rendered separately in the main JSX, NOT inside the sheet.
  const renderMapContent = () => (
    <TouchableOpacity
      style={sa.mapAddressCard}
      onPress={() => setShowLocationPicker(true)}
      activeOpacity={0.75}
    >
      <MapPin size={18} color={address ? '#111827' : '#9ca3af'} style={{ marginRight: 10 }} />
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          color: address ? '#111827' : '#9ca3af',
          fontWeight: address ? '500' : '400',
        }}
        numberOfLines={2}
      >
        {address || 'Pieskarieties, lai izvēlētos piegādes adresi'}
      </Text>
    </TouchableOpacity>
  );

  // ── STEP 2 — Configure ───────────────────────────────────────
  const renderConfigure = () => (
    <ScrollView
      contentContainerStyle={sa.configScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Material preview */}
      <View style={sa.materialCard}>
        <Text style={sa.materialIcon}>
          {CATEGORY_ICON[matCategoryValue?.toUpperCase() ?? 'OTHER'] ?? '📦'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={sa.materialName}>{matName}</Text>
          <Text style={sa.materialSup}>{matDescription}</Text>
        </View>
        <Text style={sa.materialPrice}>
          €{matBasePrice.toFixed(2)}/{UNIT_SHORT[matUnit]}
        </Text>
      </View>

      {/* Delivery location */}
      <View style={sa.locationCard}>
        <MapPin size={15} color="#111827" />
        <Text style={sa.locationCardText} numberOfLines={2}>
          {address}
        </Text>
        <TouchableOpacity onPress={() => transitionTo('map', 'back')}>
          <Text style={sa.locationChange}>Mainīt</Text>
        </TouchableOpacity>
      </View>

      {/* Fraction */}
      <View style={sa.section}>
        <Text style={sa.sectionLabel}>Frakcija</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {fractionList.map((f) => (
            <TouchableOpacity
              key={f}
              style={[sa.fractionChip, fraction === f && sa.fractionChipActive]}
              onPress={() => setFraction(f)}
              activeOpacity={0.75}
            >
              <Text style={[sa.fractionChipText, fraction === f && sa.fractionChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Quantity stepper */}
      <View style={sa.section}>
        <Text style={sa.sectionLabel}>Apjoms</Text>
        <View style={sa.stepper}>
          <TouchableOpacity style={sa.stepperBtn} onPress={() => stepQty(-5)} activeOpacity={0.7}>
            <Text style={sa.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <View style={sa.stepperDisplay}>
            <Text style={sa.stepperValue}>{quantity}</Text>
            <Text style={sa.stepperUnit}>{UNIT_SHORT[matUnit]}</Text>
          </View>
          <TouchableOpacity style={sa.stepperBtn} onPress={() => stepQty(5)} activeOpacity={0.7}>
            <Text style={sa.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 }}>
          {[5, 10, 20, 26].map((n) => (
            <TouchableOpacity
              key={n}
              style={[sa.qtyQuick, quantity === n && sa.qtyQuickActive]}
              onPress={() => setQuantity(Math.min(n, maxTonnes))}
            >
              <Text style={[sa.qtyQuickText, quantity === n && sa.qtyQuickTextActive]}>
                {n} {UNIT_SHORT[matUnit]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Vehicle type */}
      <View style={sa.section}>
        <Text style={sa.sectionLabel}>Transportlīdzeklis</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {VEHICLES.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[sa.vehicleCard, vehicleId === v.id && sa.vehicleCardActive]}
              onPress={() => {
                setVehicleId(v.id);
                setQuantity((q) => Math.min(q, parseInt(v.label, 10)));
              }}
              activeOpacity={0.75}
            >
              <Text style={sa.vehicleEmoji}>{v.emoji}</Text>
              <Text style={[sa.vehicleLabel, vehicleId === v.id && sa.vehicleLabelActive]}>
                {v.label}
              </Text>
              <Text style={sa.vehicleSub}>{v.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Estimate */}
      <View style={sa.estimateRow}>
        <Text style={sa.estimateLabel}>Orientējoša summa:</Text>
        <Text style={sa.estimateValue}>€{(matBasePrice * quantity).toFixed(2)}</Text>
      </View>
    </ScrollView>
  );

  // ── STEP — Instant Offers (marketplace) ─────────────────────
  const renderOffers = () => (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 12,
        gap: 12,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={sa.locationCard}>
        <MapPin size={14} color="#111827" />
        <Text style={sa.locationCardText} numberOfLines={1}>
          {address}
        </Text>
      </View>

      {instantOffers.map((offer, idx) => (
        <TouchableOpacity
          key={offer.id}
          style={[sa.quoteCard, selectedOffer?.id === offer.id && sa.quoteCardSelected]}
          onPress={() => setSelectedOffer(offer)}
          activeOpacity={0.85}
        >
          {idx === 0 && (
            <View style={sa.recommendedBadge}>
              <Star size={10} color="#fff" fill="#fff" />
              <Text style={sa.recommendedText}>Labākā cena</Text>
            </View>
          )}
          <View style={sa.quoteTop}>
            <View style={sa.supplierIcon}>
              <Text style={{ fontSize: 22 }}>🏭</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sa.supplierName}>{offer.supplier.name}</Text>
              <Text style={sa.supplierCity}>{offer.supplier.city ?? ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={sa.quotePrice}>
                €{offer.basePrice.toFixed(2)}
                <Text style={sa.quoteUnit}>/{UNIT_SHORT[offer.unit]}</Text>
              </Text>
              <Text style={sa.quoteTotal}>Kopā: €{offer.totalPrice.toFixed(2)}</Text>
            </View>
          </View>
          <View style={sa.quoteMeta}>
            <View style={sa.quoteMetaChip}>
              <Clock size={11} color="#6b7280" />
              <Text style={sa.quoteMetaText}>{offer.etaDays} d.d.</Text>
            </View>
            {offer.distanceKm != null && (
              <View style={sa.quoteMetaChip}>
                <Truck size={11} color="#6b7280" />
                <Text style={sa.quoteMetaText}>{offer.distanceKm.toFixed(0)} km</Text>
              </View>
            )}
            {offer.supplier.rating != null && (
              <View style={sa.quoteMetaChip}>
                <Star size={11} color="#9ca3af" fill="#9ca3af" />
                <Text style={sa.quoteMetaText}>{offer.supplier.rating.toFixed(1)}</Text>
              </View>
            )}
            {selectedOffer?.id === offer.id && (
              <View style={[sa.quoteMetaChip, sa.selectedChip]}>
                <CheckCircle size={11} color="#111827" />
                <Text style={[sa.quoteMetaText, { color: '#111827' }]}>Izvēlēts</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}

      {/* Fallback: request custom quote */}
      <TouchableOpacity
        style={sa.rfqFallbackCard}
        onPress={() => {
          setSelectedOffer(null);
          requestQuotesFallback();
        }}
        activeOpacity={0.8}
      >
        <Text style={sa.rfqFallbackTitle}>Nav piemērota cena?</Text>
        <Text style={sa.rfqFallbackDesc}>
          Pieprasīt individuālu piedāvājumu no visiem piegādātājiem
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── RFQ fallback (user pressed "no good price" from offers list) ──
  const requestQuotesFallback = useCallback(async () => {
    await submitRFQ(() => transitionTo('offers', 'back'));
  }, [submitRFQ, transitionTo]);

  // ── STEP — Sent (fire-and-forget RFQ confirmation) ──────────
  const renderSent = () => (
    <View style={[sa.searchingScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Static checkmark — no spinning animation */}
      <View style={sa.successCircle}>
        <CheckCircle size={52} color="#111827" strokeWidth={1.5} />
      </View>

      <Text style={sa.searchingTitle}>Pieprasījums nosūtīts!</Text>
      <Text style={sa.searchingDesc}>
        Paziņosim, kad piegādātāji{'\n'}atbildēs ar saviem piedāvājumiem
      </Text>

      {/* Request summary */}
      <View style={sa.searchingSummary}>
        <View style={sa.searchingSummaryRow}>
          <Text style={sa.searchingSummaryLabel}>Materiāls</Text>
          <Text style={sa.searchingSummaryValue} numberOfLines={1}>
            {matName}
          </Text>
        </View>
        <View style={sa.searchingSummaryDivider} />
        <View style={sa.searchingSummaryRow}>
          <Text style={sa.searchingSummaryLabel}>Daudzums</Text>
          <Text style={sa.searchingSummaryValue}>
            {quantity} {UNIT_SHORT[matUnit]}
          </Text>
        </View>
        <View style={sa.searchingSummaryDivider} />
        <View style={sa.searchingSummaryRow}>
          <Text style={sa.searchingSummaryLabel}>Piegāde</Text>
          <Text style={sa.searchingSummaryValue} numberOfLines={1}>
            {city || address}
          </Text>
        </View>
      </View>

      {/* Primary CTA — user leaves now, checks later */}
      <TouchableOpacity
        style={[sa.ctaBtn, { marginTop: 8, minWidth: 260 }]}
        onPress={() => router.replace('/(buyer)/orders')}
        activeOpacity={0.85}
      >
        <Text style={sa.ctaBtnText}>Skatīt manus pieprasījumus →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
        <Text style={sa.dimText}>Atgriezties sākumā</Text>
      </TouchableOpacity>
    </View>
  );

  // ── STEP — RFQ Quotes (responses from suppliers) ────────────
  const rfqResponses = quoteRequest?.responses ?? [];
  const renderQuotes = () => (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 12,
        gap: 12,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={sa.locationCard}>
        <MapPin size={14} color="#111827" />
        <Text style={sa.locationCardText} numberOfLines={1}>
          {address}
        </Text>
      </View>

      {rfqResponses.map((resp, idx) => (
        <TouchableOpacity
          key={resp.id}
          style={[sa.quoteCard, selectedQuoteResponse?.id === resp.id && sa.quoteCardSelected]}
          onPress={() => setSelectedQuoteResponse(resp)}
          activeOpacity={0.85}
        >
          {idx === 0 && (
            <View style={sa.recommendedBadge}>
              <Star size={10} color="#fff" fill="#fff" />
              <Text style={sa.recommendedText}>Labākā cena</Text>
            </View>
          )}
          <View style={sa.quoteTop}>
            <View style={sa.supplierIcon}>
              <Text style={{ fontSize: 22 }}>🏭</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sa.supplierName}>{resp.supplier.name}</Text>
              <Text style={sa.supplierCity}>{resp.supplier.city ?? ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={sa.quotePrice}>
                €{resp.pricePerUnit.toFixed(2)}
                <Text style={sa.quoteUnit}>/{UNIT_SHORT[resp.unit]}</Text>
              </Text>
              <Text style={sa.quoteTotal}>Kopā: €{resp.totalPrice.toFixed(2)}</Text>
            </View>
          </View>
          <View style={sa.quoteMeta}>
            <View style={sa.quoteMetaChip}>
              <Clock size={11} color="#6b7280" />
              <Text style={sa.quoteMetaText}>{resp.etaDays} d.d.</Text>
            </View>
            {resp.supplier.rating != null && (
              <View style={sa.quoteMetaChip}>
                <Star size={11} color="#9ca3af" fill="#9ca3af" />
                <Text style={sa.quoteMetaText}>{resp.supplier.rating.toFixed(1)}</Text>
              </View>
            )}
            {selectedQuoteResponse?.id === resp.id && (
              <View style={[sa.quoteMetaChip, sa.selectedChip]}>
                <CheckCircle size={11} color="#111827" />
                <Text style={[sa.quoteMetaText, { color: '#111827' }]}>Izvēlēts</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── STEP — Confirm ────────────────────────────────────────────
  // Unified confirm view: works for both instant offer and RFQ response
  const activeSupplierName = selectedOffer
    ? selectedOffer.supplier.name
    : (selectedQuoteResponse?.supplier.name ?? '');
  const activePricePerUnit = selectedOffer
    ? selectedOffer.basePrice
    : (selectedQuoteResponse?.pricePerUnit ?? 0);
  const activeTotalPrice = selectedOffer
    ? selectedOffer.totalPrice
    : (selectedQuoteResponse?.totalPrice ?? 0);
  const activeEta = selectedOffer
    ? `${selectedOffer.etaDays} darba dienas`
    : selectedQuoteResponse
      ? `${selectedQuoteResponse.etaDays} darba dienas`
      : '';

  const renderConfirm = () => (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 24,
        paddingTop: 16,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Summary */}
      <View style={sa.summaryCard}>
        <Text style={sa.summaryTitle}>Pasūtījuma kopsavilkums</Text>
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Materiāls</Text>
          <Text style={sa.summaryValue}>{matName}</Text>
        </View>
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Frakcija</Text>
          <Text style={sa.summaryValue}>{fraction}</Text>
        </View>
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Apjoms</Text>
          <Text style={sa.summaryValue}>
            {quantity} {UNIT_SHORT[matUnit]}
          </Text>
        </View>
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Transportlīdzeklis</Text>
          <Text style={sa.summaryValue}>
            {selectedVehicle.emoji} {selectedVehicle.label}
          </Text>
        </View>
        <View style={sa.summaryDivider} />
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Piegādātājs</Text>
          <Text style={sa.summaryValue}>{activeSupplierName}</Text>
        </View>
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Cena</Text>
          <Text style={sa.summaryValue}>
            €{activePricePerUnit.toFixed(2)}/{UNIT_SHORT[matUnit]}
          </Text>
        </View>
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Piegāde</Text>
          <Text style={sa.summaryValue}>{activeEta}</Text>
        </View>
        <View style={sa.summaryDivider} />
        <View style={sa.summaryRow}>
          <Text style={sa.summaryLabel}>Piegādes adrese</Text>
          <Text style={[sa.summaryValue, { flex: 1, textAlign: 'right' }]} numberOfLines={3}>
            {address}
          </Text>
        </View>
      </View>

      {/* Contact */}
      <View style={sa.summaryCard}>
        <Text style={sa.summaryTitle}>Kontaktinformācija</Text>
        <View style={{ gap: 10 }}>
          <TextInput
            style={sa.contactInput}
            placeholder="Kontaktpersona"
            placeholderTextColor="#9ca3af"
            value={contactName}
            onChangeText={setContactName}
          />
          <TextInput
            style={sa.contactInput}
            placeholder="Tālrunis"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={setContactPhone}
          />
          <TextInput
            style={[sa.contactInput, { height: 72, textAlignVertical: 'top' }]}
            placeholder="Piezīmes un norādījumi (neobligāti)"
            placeholderTextColor="#9ca3af"
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </View>

      {/* Total */}
      <View style={sa.totalCard}>
        <Text style={sa.totalLabel}>Kopā jāmaksā</Text>
        <Text style={sa.totalValue}>€{activeTotalPrice.toFixed(2)}</Text>
        <Text style={sa.totalNote}>* Cena var mainīties atkarībā no faktiskā svara</Text>
      </View>
    </ScrollView>
  );

  // ── SUCCESS ──────────────────────────────────────────────────
  const renderSuccess = () => (
    <View style={[sa.searchingScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={sa.successCircle}>
        <CheckCircle size={52} color="#111827" strokeWidth={1.5} />
      </View>
      <Text style={sa.searchingTitle}>Pasūtījums apstiprināts!</Text>
      <Text style={sa.searchingDesc}>
        Pasūtījums Nr. <Text style={{ fontWeight: '800', color: '#fff' }}>{orderNumber}</Text>
        {'\n'}Piegādātājs sazināsies ar Tevi{'\n'}tuvākajā laikā
      </Text>
      <TouchableOpacity
        style={[sa.ctaBtn, sa.ctaBtnGreen, { marginTop: 32, minWidth: SW * 0.6 }]}
        onPress={() => router.replace('/(buyer)/orders')}
      >
        <Text style={sa.ctaBtnText}>Skatīt pasūtījumus</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
        <Text style={sa.dimText}>Atgriezties sākumā</Text>
      </TouchableOpacity>
    </View>
  );

  // ── MATERIAL SELECTION ───────────────────────────────────────
  const renderMaterial = () => (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={sa.matSearchBar}>
        <Search size={15} color="#9ca3af" />
        <TextInput
          style={sa.matSearchInput}
          placeholder="Meklēt materiālu..."
          placeholderTextColor="#9ca3af"
          value={matSearch}
          onChangeText={onMatSearch}
          returnKeyType="search"
        />
        {matSearch.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setMatSearch('');
              filterMaterials('', matCat);
            }}
            hitSlop={8}
          >
            <View style={sa.matSearchClear}>
              <X size={10} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(c) => c}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[sa.fractionChip, matCat === cat && sa.fractionChipActive]}
            onPress={() => onMatCategory(cat)}
            activeOpacity={0.75}
          >
            <Text style={[sa.fractionChipText, matCat === cat && sa.fractionChipTextActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Material list */}
      <FlatList
        data={materials}
        keyExtractor={(m) => m.id}
        contentContainerStyle={sa.matList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={sa.matCard}
            onPress={() => onSelectMaterial(item)}
            activeOpacity={0.85}
          >
            <View style={sa.matCardBody}>
              <View style={sa.matCardIconWrap}>
                <Text style={sa.matCardIcon}>{CATEGORY_ICON[item.category] ?? '📦'}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={sa.matCardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={sa.matCardSup} numberOfLines={2}>
                  {item.description}
                </Text>
                {item.isRecycled && (
                  <View style={sa.recycledBadge}>
                    <Leaf size={9} color="#15803d" />
                    <Text style={sa.recycledText}>Pārstrādāts</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <Text style={sa.matCardPrice}>
                  €{item.basePrice.toFixed(2)}
                  <Text style={sa.matCardUnit}>/{UNIT_SHORT[item.unit] ?? item.unit}</Text>
                </Text>
                <View style={sa.selectBtn}>
                  <Text style={sa.selectBtnText}>Izvēlēties →</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={sa.matEmpty}>
            <Text style={sa.matEmptyEmoji}>🔍</Text>
            <Text style={sa.matEmptyTitle}>Nav atrasts neviens materiāls</Text>
            <Text style={sa.matEmptyDesc}>Mēģiniet mainīt meklēšanas vai kategorijas filtru</Text>
          </View>
        }
      />
    </View>
  );

  // ── Root render ──────────────────────────────────────────────
  const canCTA =
    step === 'map'
      ? !!(pin && address && address !== 'Nosakām adresi...')
      : step === 'configure'
        ? true
        : step === 'offers'
          ? !!selectedOffer
          : step === 'quotes'
            ? !!selectedQuoteResponse
            : step === 'confirm'
              ? !submitting
              : false;

  const CTA_LABEL: Partial<Record<Step, string>> = {
    map: 'Izvēlēties materiālu →',
    configure: 'Pieprasīt piedāvājumus →',
    offers: 'Turpināt →',
    quotes: 'Turpināt →',
    confirm: submitting ? 'Apstrādājam...' : 'Apstiprināt pasūtījumu ✓',
  };

  const SHEET_TITLE: Partial<Record<Step, string>> = {
    map: 'Piegādes vieta',
    material: 'Izvēlieties materiālu',
    configure: 'Konfigurēt pasūtījumu',
    offers: `${instantOffers.length} piedāvājumi`,
    quotes: `${rfqResponses.length} piedāvājumi saņemti`,
    confirm: 'Apstiprināt pasūtījumu',
  };

  const SHEET_SUB: Partial<Record<Step, string>> = {
    material: city || address,
    configure: matName,
    offers: `${matName} · ${quantity} ${UNIT_SHORT[matUnit]}`,
    quotes: `${matName} · ${quantity} ${UNIT_SHORT[matUnit]}`,
    confirm: activeSupplierName,
  };

  const onSheetCTA = () => {
    if (step === 'map') transitionTo(params.materialId ? 'configure' : 'material', 'forward');
    else if (step === 'configure') requestQuotes();
    else if (step === 'offers' && selectedOffer) transitionTo('confirm', 'forward');
    else if (step === 'quotes' && selectedQuoteResponse) transitionTo('confirm', 'forward');
    else if (step === 'confirm') confirmOrder();
  };

  const isSheetStep = !['sent', 'success'].includes(step);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1 }}>
        {/* Always-on background map — true 100vh, camera inset via mapPadding */}
        <View style={StyleSheet.absoluteFillObject}>
          <BaseMap
            cameraRef={cameraRef}
            center={pin ? [pin.longitude, pin.latitude] : RIGA_CENTER}
            zoom={pin ? 14 : 10}
            onPress={step === 'map' ? onMapPress : undefined}
            mapType={satellite ? 'hybrid' : 'standard'}
            mapPadding={{
              top: 0,
              right: 0,
              left: 0,
              bottom: step === 'map' ? SCREEN_H - MAP_FULL : SCREEN_H - MAP_SMALL,
            }}
          >
            <UserLayer />
            {pin && (
              <Marker
                coordinate={pin}
                draggable={step === 'map'}
                onDragEnd={step === 'map' ? onPinDragEnd : undefined}
              >
                <View style={sa.markerWrap}>
                  <View style={sa.markerOuter}>
                    <View style={sa.markerInner} />
                  </View>
                  <View style={sa.markerStem} />
                </View>
              </Marker>
            )}
          </BaseMap>
        </View>

        {/* Floating back button — always top-left, visible on map step, fades as sheet appears */}
        <Animated.View
          style={[sa.mapBackBtn, { top: insets.top + 12, opacity: floatingCtaOpacity }]}
          pointerEvents={step === 'map' ? 'box-none' : 'none'}
        >
          <TouchableOpacity style={sa.mapFab} onPress={() => router.back()} activeOpacity={0.8}>
            <ChevronLeft size={20} color="#111827" />
          </TouchableOpacity>
        </Animated.View>

        {/* Sheet — transparent on map step, white on all other steps */}
        {isSheetStep && (
          <Animated.View style={[sa.sheet, { top: mapHeight, backgroundColor: sheetBg }]}>
            {/* Handle — fades out on map step */}
            <Animated.View style={[sa.sheetHandleWrap, { opacity: sheetBgAnim }]}>
              <View style={sa.sheetHandle} />
            </Animated.View>

            {/* Title row — fades out on map step */}
            <Animated.View style={{ opacity: sheetBgAnim }}>
              <View style={sa.sheetTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={sa.sheetTitle} numberOfLines={1}>
                    {SHEET_TITLE[step] ?? ''}
                  </Text>
                  {SHEET_SUB[step] ? (
                    <Text style={sa.sheetSub} numberOfLines={1}>
                      {SHEET_SUB[step]}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={sa.sheetCloseBtn}
                  onPress={() => router.back()}
                  activeOpacity={0.8}
                >
                  <X size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            <View style={sa.sheetSlideClip}>
              <Animated.View
                style={[
                  sa.sheetSlideWrapper,
                  { transform: [{ translateX: slideAnim }], opacity: fadeAnim },
                ]}
              >
                {step === 'map' && renderMapContent()}
                {step === 'material' && renderMaterial()}
                {step === 'configure' && renderConfigure()}
                {step === 'offers' && renderOffers()}
                {step === 'quotes' && renderQuotes()}
                {step === 'confirm' && renderConfirm()}
              </Animated.View>
            </View>

            {/* Footer CTA — fades out on map step; floating CTA takes over */}
            <Animated.View
              style={{ opacity: sheetBgAnim }}
              pointerEvents={step === 'map' ? 'none' : 'box-none'}
            >
              <View style={[sa.sheetFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {step !== 'map' && (
                  <TouchableOpacity style={sa.backFooterBtn} onPress={goBack} activeOpacity={0.8}>
                    <ChevronLeft size={20} color="#374151" />
                  </TouchableOpacity>
                )}
                {CTA_LABEL[step] && (
                  <TouchableOpacity
                    style={[sa.ctaBtn, { flex: 1 }, !canCTA && sa.ctaBtnDisabled]}
                    onPress={onSheetCTA}
                    disabled={!canCTA && step !== 'configure'}
                    activeOpacity={0.85}
                  >
                    <Text style={[sa.ctaBtnText, !canCTA && sa.ctaBtnTextDisabled]}>
                      {CTA_LABEL[step]}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </Animated.View>
        )}

        <AddressPickerModal
          visible={showLocationPicker}
          title="Piegādes vieta"
          onClose={() => {
            if (!address) router.back();
            else setShowLocationPicker(false);
          }}
          onConfirm={(p: PickedAddress) => {
            setPin({ latitude: p.lat, longitude: p.lng });
            setAddress(p.address);
            setCity(p.city);
            setShowLocationPicker(false);
            if (step === 'map') {
              transitionTo(params.materialId ? 'configure' : 'material', 'forward');
            }
          }}
          initial={
            address
              ? { address, lat: pin?.latitude ?? 0, lng: pin?.longitude ?? 0, city }
              : undefined
          }
        />

        {/* Full-screen overlays */}
        {step === 'sent' && <View style={StyleSheet.absoluteFillObject}>{renderSent()}</View>}
        {step === 'success' && <View style={StyleSheet.absoluteFillObject}>{renderSuccess()}</View>}
      </View>
    </View>
  );
}
