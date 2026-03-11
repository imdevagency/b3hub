/**
 * order-request.tsx
 *
 * Clean material ordering flow:
 *   ONBOARDING (first time) → MAP → MATERIAL → CONFIGURE → SEARCHING → QUOTES → CONFIRM → SUCCESS
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
  Easing,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Lazy-load: native module crashes Expo Go when statically imported
let MapboxGL: typeof import('@rnmapbox/maps').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MapboxGL = require('@rnmapbox/maps').default;
} catch {
  /* Expo Go */
}
import { BaseMap, UserLayer, useGeocode, RIGA_CENTER } from '@/components/map';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type {
  MaterialCategory,
  MaterialUnit,
  SupplierOffer,
  QuoteRequest,
  QuoteResponse,
} from '@/lib/api';
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
} from 'lucide-react-native';
const { width: SW } = Dimensions.get('window');
const ONBOARDING_KEY = '@b3hub:material_order_onboarding_v1';

// ── Types ────────────────────────────────────────────────────────

interface LatLng {
  latitude: number;
  longitude: number;
}

type MaterialCategoryAll = MaterialCategory | 'ALL';

type Step =
  | 'onboarding'
  | 'map'
  | 'material'
  | 'configure'
  | 'offers'
  | 'searching'
  | 'quotes'
  | 'confirm'
  | 'success';

// ── Constants ────────────────────────────────────────────────────

const RIGA: LatLng = { latitude: 56.9496, longitude: 24.1052 };

const CATEGORY_LABELS: Record<MaterialCategoryAll, string> = {
  ALL: 'Visi',
  SAND: 'Smiltis',
  GRAVEL: 'Šķembas',
  STONE: 'Akmens',
  CONCRETE: 'Betons',
  SOIL: 'Zeme',
  RECYCLED_CONCRETE: 'Rec. betons',
  RECYCLED_SOIL: 'Rec. zeme',
  ASPHALT: 'Asfalta gran.',
  CLAY: 'Māls',
  OTHER: 'Cits',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MaterialCategoryAll[];

const CATEGORY_COLOR: Record<string, string> = {
  ALL: '#6b7280',
  SAND: '#6b7280',
  GRAVEL: '#64748b',
  STONE: '#6b7280',
  CONCRETE: '#4b5563',
  SOIL: '#6b7280',
  RECYCLED_CONCRETE: '#059669',
  RECYCLED_SOIL: '#111827',
  ASPHALT: '#374151',
  CLAY: '#6b7280',
  OTHER: '#6b7280',
};

// ── Global material catalogue ────────────────────────────────────
type GlobalMaterial = {
  id: string;
  name: string;
  description: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  isRecycled: boolean;
};

const GLOBAL_MATERIALS: GlobalMaterial[] = [
  {
    id: 'sand-0-5',
    name: 'Smiltis 0/5',
    description: 'Celtniecības smiltis, frakc. 0–5 mm',
    category: 'SAND',
    unit: 'TONNE',
    basePrice: 8,
    isRecycled: false,
  },
  {
    id: 'sand-lake',
    name: 'Ezersmiltis',
    description: 'Sīkgraudaina filtrēta ezersmiltis',
    category: 'SAND',
    unit: 'TONNE',
    basePrice: 10,
    isRecycled: false,
  },
  {
    id: 'sand-fine',
    name: 'Smalka smiltis',
    description: 'Apbērsmes un apdares smiltis',
    category: 'SAND',
    unit: 'TONNE',
    basePrice: 7,
    isRecycled: false,
  },
  {
    id: 'gravel-816',
    name: 'Šķembas 8/16',
    description: 'Granīta šķembas, frakc. 8–16 mm',
    category: 'GRAVEL',
    unit: 'TONNE',
    basePrice: 15,
    isRecycled: false,
  },
  {
    id: 'gravel-1632',
    name: 'Šķembas 16/32',
    description: 'Granīta šķembas, frakc. 16–32 mm',
    category: 'GRAVEL',
    unit: 'TONNE',
    basePrice: 14,
    isRecycled: false,
  },
  {
    id: 'gravel-3263',
    name: 'Šķembas 32/63',
    description: 'Grants, frakc. 32–63 mm',
    category: 'GRAVEL',
    unit: 'TONNE',
    basePrice: 13,
    isRecycled: false,
  },
  {
    id: 'stone-granite',
    name: 'Granīta šķemba 5/40',
    description: 'Universāla šķemba ceļu un pamatu darbiem',
    category: 'STONE',
    unit: 'TONNE',
    basePrice: 18,
    isRecycled: false,
  },
  {
    id: 'stone-field',
    name: 'Lauku akmeņi',
    description: 'Dabīgi akmeņi ainavaim, d = 10–40 cm',
    category: 'STONE',
    unit: 'TONNE',
    basePrice: 20,
    isRecycled: false,
  },
  {
    id: 'soil-black',
    name: 'Augsne (melnzeme)',
    description: 'Auglīga melnzeme dārziem un apzaļumošanai',
    category: 'SOIL',
    unit: 'TONNE',
    basePrice: 12,
    isRecycled: false,
  },
  {
    id: 'soil-sandclay',
    name: 'Smilšmāls',
    description: 'Smilšmāls pamatu un terases izbēršanai',
    category: 'SOIL',
    unit: 'TONNE',
    basePrice: 9,
    isRecycled: false,
  },
  {
    id: 'clay',
    name: 'Māls',
    description: 'Blīvēšanas māls dambju celtniecībai',
    category: 'CLAY',
    unit: 'TONNE',
    basePrice: 11,
    isRecycled: false,
  },
  {
    id: 'recycled-conc',
    name: 'Pārstrādāts betons',
    description: 'Sasmalcināts betona materiāls pamatu izbēršanai',
    category: 'RECYCLED_CONCRETE',
    unit: 'TONNE',
    basePrice: 7,
    isRecycled: true,
  },
  {
    id: 'recycled-soil',
    name: 'Pārstrādāta augsne',
    description: 'Kompostēta organiskā augsne',
    category: 'RECYCLED_SOIL',
    unit: 'TONNE',
    basePrice: 6,
    isRecycled: true,
  },
  {
    id: 'asphalt-milled',
    name: 'Frēzēts asfalts',
    description: 'Pārstrādāts asfalts ceļu remontdarbiem',
    category: 'ASPHALT',
    unit: 'TONNE',
    basePrice: 9,
    isRecycled: true,
  },
  {
    id: 'concrete-fill',
    name: 'Apbērsmes grants',
    description: 'Smalka šķemba pamatu un ietvju izbēršanai',
    category: 'CONCRETE',
    unit: 'TONNE',
    basePrice: 13,
    isRecycled: false,
  },
];

const ONBOARDING_SLIDES = [
  {
    step: '01',
    icon: '📍',
    accent: '#111827',
    bg: '#fef2f2',
    title: 'Norādiet piegādes vietu',
    desc: 'Pieskarieties kartei vai meklējiet adresi. Mēs piegādāsim tieši uz jūsu norādīto vietu.',
  },
  {
    step: '02',
    icon: '🏜️',
    accent: '#6b7280',
    bg: '#f3f4f6',
    title: 'Izvēlieties materiālu',
    desc: 'Pārlūkojiet simtiem celtniecības materiālu. Filtrējiet pēc kategorijām vai meklējiet.',
  },
  {
    step: '03',
    icon: '⚡',
    accent: '#111827',
    bg: '#f3f4f6',
    title: 'Saņemiet labākās cenas',
    desc: 'Pieprasījums aiziet visiem piegādātājiem Latvijā. Jūs izvēlaties izdevīgāko piedāvājumu.',
  },
];

const UNIT_SHORT: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gab.',
  LOAD: 'krava',
};

const FRACTIONS: Record<string, string[]> = {
  DEFAULT: ['0/4', '0/8', '0/16', '0/32', '0/45', '4/16', '8/32', '16/45'],
  SAND: ['0/4', '0/8', '0.1/0.3', '0.5/1', 'Smalkas', 'Rupjas'],
  GRAVEL: ['0/8', '0/16', '0/32', '4/8', '8/16', '16/32', '16/45', '32/63'],
  STONE: ['0/32', '0/45', '16/45', '32/63', '45/90'],
  CONCRETE: ['B20', 'B25', 'B30', 'B35', 'B40'],
  ASPHALT: ['0/8', '0/11', '0/16', 'SMA-11', 'SMA-16'],
  RECYCLED_CONCRETE: ['0/32', '0/45', '16/45', '32/63'],
  RECYCLED_SOIL: ['0/45', '0/63', 'Jaukta'],
};

const VEHICLES = [
  { id: 'TIPPER_26T', label: '26 t', emoji: '🚛', sub: '6×4' },
  { id: 'TIPPER_20T', label: '20 t', emoji: '🚚', sub: '8×4' },
  { id: 'TIPPER_15T', label: '15 t', emoji: '🚜', sub: '4×4' },
];

const CATEGORY_ICON: Record<string, string> = {
  ALL: '📦',
  SAND: '🏜️',
  GRAVEL: '🪨',
  STONE: '🗿',
  CONCRETE: '🧱',
  SOIL: '🌱',
  RECYCLED_CONCRETE: '♻️',
  RECYCLED_SOIL: '🌿',
  ASPHALT: '🛣️',
  CLAY: '🟤',
  OTHER: '📦',
};

// ── Pulsing animation ────────────────────────────────────────────

function SearchingAnimation() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ).start();

    pulse(ring1, 0);
    pulse(ring2, 600);
    pulse(ring3, 1200);
    return () => {
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
    };
  }, []);

  const ringStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.25, 0] }),
  });

  return (
    <View style={sa.ringContainer}>
      <Animated.View style={[sa.ring, ringStyle(ring1)]} />
      <Animated.View style={[sa.ring, ringStyle(ring2)]} />
      <Animated.View style={[sa.ring, ringStyle(ring3)]} />
      <View style={sa.ringCenter}>
        <CheckCircle size={28} color="#4ade80" strokeWidth={1.8} />
      </View>
    </View>
  );
}

// ── Progress stepper ──────────────────────────────────────────────

const STEP_ORDER: Step[] = ['map', 'material', 'configure', 'offers', 'confirm'];

function FlowProgress({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  if (idx < 0) return null;
  return (
    <View style={sa.progressRow}>
      {STEP_ORDER.map((s, i) => (
        <React.Fragment key={s}>
          <View style={[sa.progressDot, i <= idx ? sa.progressDotActive : sa.progressDotInactive]}>
            {i < idx ? (
              <Text style={sa.progressCheck}>✓</Text>
            ) : (
              <Text
                style={[sa.progressNum, i === idx ? sa.progressNumActive : sa.progressNumInactive]}
              >
                {i + 1}
              </Text>
            )}
          </View>
          {i < STEP_ORDER.length - 1 && (
            <View
              style={[sa.progressLine, i < idx ? sa.progressLineActive : sa.progressLineInactive]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

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
  const { forwardGeocode, reverseGeocodeWithCity, loading: geoLoading } = useGeocode();

  // ── Step & onboarding ─────────────────────────────────────────
  const [step, setStep] = useState<Step>('map');
  const [onboardSlideIdx, setOnboardSlideIdx] = useState(0);

  // ── Location ──────────────────────────────────────────────────
  const [pin, setPin] = useState<LatLng | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
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
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

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

  // ── Init: onboarding check ────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (params.materialId) {
        setStep('map');
        return;
      }
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setStep(seen ? 'map' : 'onboarding');
      } catch {
        setStep('map');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* ignore */
    }
    setStep('map');
  };

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
    setStep('configure');
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPlaceSelected = useCallback((feature: any) => {
    const [pLng, pLat] = feature.geometry.coordinates as [number, number];
    const coords: LatLng = { latitude: pLat, longitude: pLng };
    setPin(coords);
    setAddress(feature.place_name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cityCtx = feature.context?.find((c: any) => c.id?.startsWith('place'));
    setCity(cityCtx?.text ?? '');
    setGeoSearchText(feature.place_name);
    setGeoSuggestions([]);
    cameraRef.current?.setCamera({
      centerCoordinate: [pLng, pLat],
      zoomLevel: 14,
      animationDuration: 600,
    });
  }, []);

  // ── Step 2: quantity stepper ─────────────────────────────────
  const stepQty = (delta: number) =>
    setQuantity((prev) => Math.max(1, Math.min(maxTonnes, prev + delta)));

  // ── Cleanup polling on unmount ────────────────────────────────
  useEffect(
    () => () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    },
    [],
  );

  // ── Step 3: fetch instant offers or fall back to RFQ ─────────
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
        // Sort cheapest first
        const sorted = [...offers].sort((a, b) => a.totalPrice - b.totalPrice);
        setInstantOffers(sorted);
        setSelectedOffer(sorted[0]);
        setStep('offers');
        return;
      }
    } catch {
      /* fall through to RFQ */
    }

    // No instant offers — start RFQ flow
    setStep('searching');
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

      // Poll every 4 s for responses
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async () => {
        try {
          const updated = await api.quoteRequests.get(req.id, token);
          setQuoteRequest(updated);
          if (updated.responses.length > 0) {
            clearInterval(pollTimer.current!);
            pollTimer.current = null;
            setSelectedQuoteResponse(updated.responses[0]);
            setStep('quotes');
          }
        } catch {
          /* keep polling */
        }
      }, 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Neizdevās nosūtīt pieprasījumu';
      Alert.alert('Kļūda', msg);
      setStep('configure');
    }
  }, [token, matCategoryValue, matName, matUnit, quantity, address, city, pin]);

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
      setStep('success');
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

  // ── STEP 1 — Map ─────────────────────────────────────────────
  const renderMap = () => (
    <View style={{ flex: 1 }}>
      {/* Map fills screen */}
      <BaseMap cameraRef={cameraRef} center={RIGA_CENTER} zoom={10} onPress={onMapPress}>
        <UserLayer />
        {pin && MapboxGL && (
          <MapboxGL.PointAnnotation id="deliveryPin" coordinate={[pin.longitude, pin.latitude]}>
            <View style={sa.markerWrap}>
              <View style={sa.markerOuter}>
                <View style={sa.markerInner} />
              </View>
              <View style={sa.markerStem} />
            </View>
          </MapboxGL.PointAnnotation>
        )}
      </BaseMap>

      {/* Top: back + address search */}
      <View style={[sa.mapTopBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={sa.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={sa.placesInputContainer}>
            <Search size={15} color="#9ca3af" style={{ marginLeft: 10 }} />
            <TextInput
              style={sa.placesTextInput}
              placeholder="Meklēt piegādes adresi..."
              placeholderTextColor="#9ca3af"
              value={geoSearchText}
              onChangeText={onGeoSearchChange}
              autoCorrect={false}
            />
            {geoLoading && (
              <ActivityIndicator size="small" color="#6b7280" style={{ marginRight: 10 }} />
            )}
          </View>
          {geoSuggestions.length > 0 && (
            <FlatList
              style={sa.placesList}
              keyboardShouldPersistTaps="handled"
              data={geoSuggestions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={sa.placesRow} onPress={() => onPlaceSelected(item)}>
                  <MapPin size={13} color="#9ca3af" style={{ marginRight: 6 }} />
                  <Text style={sa.placesDesc} numberOfLines={2}>
                    {item.place_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>

      {/* Top title strip (when no pin yet) */}
      {!pin && (
        <View style={sa.mapHintStrip}>
          <MapPin size={14} color="#111827" />
          <Text style={sa.mapHintText}>Pieskarieties kartei, lai izvēlētos piegādes vietu</Text>
        </View>
      )}

      {/* Bottom sheet */}
      <View style={[sa.mapBottomSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {pin ? (
          <>
            <View style={sa.addressRow}>
              <View style={sa.addressDot} />
              <Text style={sa.addressText} numberOfLines={2}>
                {address || 'Nosakām adresi...'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                sa.ctaBtn,
                !address || address === 'Nosakām adresi...' ? { opacity: 0.5 } : {},
              ]}
              onPress={() => {
                if (!address || address === 'Nosakām adresi...') return;
                setStep(params.materialId ? 'configure' : 'material');
              }}
              activeOpacity={0.85}
            >
              <Text style={sa.ctaBtnText}>Tālāk — izvēlēties materiālu →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={sa.mapEmptyHint}>Pieskarieties kartei vai meklējiet adresi augšā</Text>
        )}
      </View>
    </View>
  );

  // ── STEP 2 — Configure ───────────────────────────────────────
  const renderConfigure = () => (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={[sa.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={sa.backBtn} onPress={() => setStep('map')}>
          <ChevronLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={sa.headerTitle}>Konfigurēt pasūtījumu</Text>
        <View style={{ width: 36 }} />
      </View>

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
          <TouchableOpacity onPress={() => setStep('map')}>
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

      <View style={[sa.floatingCta, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={sa.ctaBtn} onPress={requestQuotes} activeOpacity={0.85}>
          <Text style={sa.ctaBtnText}>Pieprasīt piedāvājumus →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── STEP — Instant Offers (marketplace) ─────────────────────
  const renderOffers = () => (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={[sa.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={sa.backBtn} onPress={() => setStep('configure')}>
          <ChevronLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={sa.headerTitle}>{instantOffers.length} piedāvājumi</Text>
          <Text style={sa.headerSub}>
            {matName} · {quantity} {UNIT_SHORT[matUnit]}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 140,
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

      <View style={[sa.floatingCta, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[sa.ctaBtn, !selectedOffer && { opacity: 0.45 }]}
          onPress={() => selectedOffer && setStep('confirm')}
          disabled={!selectedOffer}
          activeOpacity={0.85}
        >
          <Text style={sa.ctaBtnText}>Turpināt →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── RFQ fallback (bypass instant offers) ────────────────────
  const requestQuotesFallback = useCallback(async () => {
    if (!token) return;
    setStep('searching');
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
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async () => {
        try {
          const updated = await api.quoteRequests.get(req.id, token);
          setQuoteRequest(updated);
          if (updated.responses.length > 0) {
            clearInterval(pollTimer.current!);
            pollTimer.current = null;
            setSelectedQuoteResponse(updated.responses[0]);
            setStep('quotes');
          }
        } catch {
          /* keep polling */
        }
      }, 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Neizdevās nosūtīt pieprasījumu';
      Alert.alert('Kļūda', msg);
      setStep('offers');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, matCategoryValue, matName, matUnit, quantity, address, city, pin]);

  // ── STEP — Searching / RFQ polling ──────────────────────────
  const responseCount = quoteRequest?.responses?.length ?? 0;
  const renderSearching = () => (
    <View style={[sa.searchingScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <SearchingAnimation />

      <Text style={sa.searchingTitle}>Pieprasījums iesniegts!</Text>
      <Text style={sa.searchingDesc}>
        Piegādātāji izskata Jūsu pieprasījumu{'\n'}un atbildēs tuvākajā laikā
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

      {/* Live status pill */}
      <View style={sa.searchingPill}>
        <View style={[sa.searchingDot, responseCount > 0 && sa.searchingDotActive]} />
        <Text style={sa.searchingPillText}>
          {responseCount === 0
            ? 'Gaidam piegādātāju atbildes...'
            : `${responseCount} piedāvājum${responseCount === 1 ? 's' : 'i'} saņemts`}
        </Text>
      </View>

      {/* Primary CTA — lights up when responses arrive */}
      <TouchableOpacity
        style={[
          sa.ctaBtn,
          { marginTop: 8, minWidth: 260 },
          responseCount === 0 && { opacity: 0.42 },
        ]}
        onPress={() => {
          if (responseCount > 0) {
            setSelectedQuoteResponse(quoteRequest!.responses[0]);
            setStep('quotes');
          }
        }}
        disabled={responseCount === 0}
        activeOpacity={0.85}
      >
        <Text style={sa.ctaBtnText}>
          {responseCount === 0
            ? 'Gaidam piedāvājumus...'
            : `Skatīt ${responseCount} piedāvājum${responseCount === 1 ? 'u' : 'us'} →`}
        </Text>
      </TouchableOpacity>

      {/* Escape — navigate away without losing the request */}
      <TouchableOpacity
        style={{ marginTop: 16 }}
        onPress={() => {
          if (pollTimer.current) clearInterval(pollTimer.current);
          router.replace('/(buyer)/orders');
        }}
      >
        <Text style={sa.dimText}>Doties uz pasūtījumiem</Text>
      </TouchableOpacity>
    </View>
  );

  // ── STEP — RFQ Quotes (responses from suppliers) ────────────
  const rfqResponses = quoteRequest?.responses ?? [];
  const renderQuotes = () => (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={[sa.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={sa.backBtn} onPress={() => setStep('searching')}>
          <ChevronLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={sa.headerTitle}>{rfqResponses.length} piedāvājumi saņemti</Text>
          <Text style={sa.headerSub}>
            {matName} · {quantity} {UNIT_SHORT[matUnit]}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 120,
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

      <View style={[sa.floatingCta, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[sa.ctaBtn, !selectedQuoteResponse && { opacity: 0.45 }]}
          onPress={() => selectedQuoteResponse && setStep('confirm')}
          disabled={!selectedQuoteResponse}
          activeOpacity={0.85}
        >
          <Text style={sa.ctaBtnText}>Turpināt →</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={[sa.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={sa.backBtn}
          onPress={() => setStep(selectedOffer ? 'offers' : 'quotes')}
        >
          <ChevronLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={sa.headerTitle}>Apstiprināt pasūtījumu</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120,
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

        {/* Total */}
        <View style={sa.totalCard}>
          <Text style={sa.totalLabel}>Kopā jāmaksā</Text>
          <Text style={sa.totalValue}>€{activeTotalPrice.toFixed(2)}</Text>
          <Text style={sa.totalNote}>* Cena var mainīties atkarībā no faktiskā svara</Text>
        </View>
      </ScrollView>

      <View style={[sa.floatingCta, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[sa.ctaBtn, sa.ctaBtnGreen, submitting && { opacity: 0.55 }]}
          onPress={confirmOrder}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={sa.ctaBtnText}>
            {submitting ? 'Apstrādājam...' : 'Apstiprināt pasūtījumu ✓'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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

  // ── ONBOARDING ───────────────────────────────────────────────
  const renderOnboarding = () => {
    const slide = ONBOARDING_SLIDES[onboardSlideIdx];
    const isLast = onboardSlideIdx === ONBOARDING_SLIDES.length - 1;
    return (
      <View
        style={[
          sa.onboardingScreen,
          { paddingTop: insets.top + 32, paddingBottom: Math.max(insets.bottom, 48) },
        ]}
      >
        {/* Skip */}
        <TouchableOpacity style={sa.skipBtn} onPress={finishOnboarding}>
          <Text style={sa.skipText}>Izlaist</Text>
        </TouchableOpacity>

        {/* Illustration */}
        <View style={sa.onboardingIllustration}>
          <View style={[sa.onboardingIconCircle, { backgroundColor: slide.bg }]}>
            <Text style={sa.onboardingIcon}>{slide.icon}</Text>
          </View>
          <Text style={[sa.onboardingWatermark, { color: slide.accent + '12' }]}>{slide.step}</Text>
        </View>

        {/* Dots */}
        <View style={sa.onboardDotsRow}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setOnboardSlideIdx(i)}>
              <View
                style={[
                  sa.onboardDot,
                  i === onboardSlideIdx
                    ? [sa.onboardDotActive, { backgroundColor: slide.accent }]
                    : sa.onboardDotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Text */}
        <View style={sa.onboardingContent}>
          <Text style={[sa.onboardingStepLabel, { color: slide.accent }]}>
            Solis {onboardSlideIdx + 1} / {ONBOARDING_SLIDES.length}
          </Text>
          <Text style={sa.onboardingTitle}>{slide.title}</Text>
          <Text style={sa.onboardingDesc}>{slide.desc}</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[sa.ctaBtn, { backgroundColor: slide.accent, width: '100%' }]}
          onPress={() => (isLast ? finishOnboarding() : setOnboardSlideIdx((i) => i + 1))}
          activeOpacity={0.88}
        >
          <Text style={sa.ctaBtnText}>{isLast ? 'Sākt pasūtīšanu →' : 'Tālāk →'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── MATERIAL SELECTION ───────────────────────────────────────
  const renderMaterial = () => (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View style={[sa.header, { paddingTop: insets.top + 2 }]}>
        <TouchableOpacity style={sa.backBtn} onPress={() => setStep('map')}>
          <ChevronLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
          <Text style={sa.headerTitle}>Izvēlieties materiālu</Text>
          <View style={sa.headerAddressRow}>
            <MapPin size={11} color="#111827" />
            <Text style={sa.headerAddress} numberOfLines={1}>
              {address}
            </Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

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
  const dark = step === 'searching' || step === 'success';
  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0f172a' : '#fff' }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {step === 'onboarding' && renderOnboarding()}
      {step === 'map' && renderMap()}
      {step === 'material' && renderMaterial()}
      {step === 'configure' && renderConfigure()}
      {step === 'offers' && renderOffers()}
      {step === 'searching' && renderSearching()}
      {step === 'quotes' && renderQuotes()}
      {step === 'confirm' && renderConfirm()}
      {step === 'success' && renderSuccess()}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const sa = StyleSheet.create({
  // ── Common
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#9ca3af', fontWeight: '500', marginTop: 2 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnGreen: { backgroundColor: '#111827' },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  floatingCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Map step
  mapTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    gap: 8,
  },
  placesInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    height: 44,
    gap: 6,
  },
  placesTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    paddingRight: 12,
  },
  placesList: {
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: 200,
  },
  placesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  placesDesc: { fontSize: 13, color: '#374151', flex: 1 },

  mapHintStrip: {
    position: 'absolute',
    bottom: 180,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapHintText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  markerWrap: { alignItems: 'center' },
  markerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  markerInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  markerStem: { width: 3, height: 10, backgroundColor: '#111827', borderRadius: 2 },

  mapBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    gap: 14,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
    marginTop: 5,
    flexShrink: 0,
  },
  addressText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500', lineHeight: 22 },
  mapEmptyHint: { textAlign: 'center', fontSize: 14, color: '#9ca3af', paddingVertical: 10 },

  // ── Configure step
  configScroll: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16, gap: 18 },

  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  materialIcon: { fontSize: 28 },
  materialName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  materialSup: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  materialPrice: { fontSize: 15, fontWeight: '700', color: '#111827' },

  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationCardText: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  locationChange: { fontSize: 13, color: '#111827', fontWeight: '600' },

  section: { gap: 10 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },

  fractionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  fractionChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  fractionChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  fractionChipTextActive: { color: '#fff' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  stepperBtn: { width: 64, paddingVertical: 18, alignItems: 'center', backgroundColor: '#f9fafb' },
  stepperBtnText: { fontSize: 24, fontWeight: '300', color: '#111827' },
  stepperDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  stepperValue: { fontSize: 32, fontWeight: '800', color: '#111827' },
  stepperUnit: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },

  qtyQuick: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  qtyQuickActive: { backgroundColor: '#111827' },
  qtyQuickText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  qtyQuickTextActive: { color: '#fff' },

  vehicleCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  vehicleCardActive: { borderColor: '#111827', backgroundColor: '#f9fafb' },
  vehicleEmoji: { fontSize: 24 },
  vehicleLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  vehicleLabelActive: { color: '#111827' },
  vehicleSub: { fontSize: 10, color: '#9ca3af' },

  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  estimateLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  estimateValue: { fontSize: 22, fontWeight: '800', color: '#111827' },

  // ── Searching step
  searchingScreen: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  searchingTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  searchingDesc: { fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 23 },
  searchingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  searchingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
  },
  searchingDotActive: {
    backgroundColor: '#4ade80',
  },
  searchingSummary: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginTop: 4,
  },
  searchingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  searchingSummaryDivider: {
    height: 1,
    backgroundColor: '#334155',
  },
  searchingSummaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  searchingSummaryValue: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  searchingPillText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  ringContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#374151',
  },
  ringCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dimText: { color: '#64748b', fontSize: 14, marginTop: 4 },

  // ── Quotes step
  quoteCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quoteCardSelected: { borderColor: '#111827' },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#9ca3af',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: -4,
  },
  recommendedText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  quoteTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supplierIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  supplierName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  supplierCity: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  quotePrice: { fontSize: 20, fontWeight: '800', color: '#111827' },
  quoteUnit: { fontSize: 13, fontWeight: '400', color: '#9ca3af' },
  quoteTotal: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  quoteMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quoteMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedChip: { backgroundColor: '#dcfce7' },
  quoteMetaText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },

  // ── RFQ fallback CTA card
  rfqFallbackCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 4,
  },
  rfqFallbackTitle: { fontSize: 15, fontWeight: '700', color: '#0369a1' },
  rfqFallbackDesc: { fontSize: 13, color: '#374151' },

  // ── Confirm / Summary
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 2 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  summaryValue: { fontSize: 13, color: '#111827', fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#f3f4f6' },

  totalCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 4,
  },
  totalLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  totalValue: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1.5 },
  totalNote: { fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' },

  // ── Flow Progress bar
  progressWrap: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: '#111827' },
  progressDotInactive: { backgroundColor: '#f3f4f6' },
  progressNum: { fontSize: 11, fontWeight: '700' },
  progressNumActive: { color: '#fff' },
  progressNumInactive: { color: '#9ca3af' },
  progressCheck: {},
  progressLine: { flex: 1, height: 2, marginHorizontal: 3 },
  progressLineActive: { backgroundColor: '#111827' },
  progressLineInactive: { backgroundColor: '#e5e7eb' },

  // ── Onboarding
  onboardingScreen: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  skipBtn: { position: 'absolute', top: 56, right: 28 },
  skipText: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  onboardingIllustration: { alignItems: 'center', justifyContent: 'center' },
  onboardingIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingIcon: { fontSize: 64 },
  onboardingWatermark: {
    position: 'absolute',
    fontSize: 96,
    fontWeight: '900',
    opacity: 0.07,
    zIndex: -1,
  },
  onboardDotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  onboardDot: { width: 8, height: 8, borderRadius: 4 },
  onboardDotActive: { width: 24, borderRadius: 4 },
  onboardDotInactive: { backgroundColor: '#e5e7eb' },
  onboardingContent: { alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  onboardingStepLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  onboardingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 32,
  },
  onboardingDesc: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },

  // ── Material header address
  headerAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerAddress: { fontSize: 11, color: '#9ca3af', fontWeight: '500', maxWidth: 200 },

  // ── Material search bar
  matSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  matSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    paddingVertical: 0,
  },
  matSearchClear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Material card list
  matList: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
  matCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  matCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  matCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  matCardIcon: { fontSize: 22 },
  matCardName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  matCardSup: { fontSize: 12, color: '#6b7280', fontWeight: '400', lineHeight: 17 },
  matCardPrice: { fontSize: 15, fontWeight: '800', color: '#111827' },
  matCardUnit: { fontSize: 11, fontWeight: '500', color: '#9ca3af' },
  recycledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  recycledText: { fontSize: 9, color: '#15803d', fontWeight: '700' },
  selectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  selectBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  matEmpty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  matEmptyEmoji: { fontSize: 40 },
  matEmptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  matEmptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 20 },
});
