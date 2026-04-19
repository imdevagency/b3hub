/**
 * order-request-new.tsx
 *
 * Buyer material order wizard — matches web CATALOGUE → SPECS → WHERE → WHEN → OFFERS/RFQ flow.
 *
 *  Catalog page selects a category, then (location-first — Schüttflix style):
 *  Step 1 – WHERE   : delivery address picker (first, so offers show real prices for that site)
 *  Step 2 – SPECS   : material type, fraction, order type, truck, quantity
 *  Step 3 – WHEN    : preferred delivery date
 *  Step 4 – OFFERS  : instant supplier offers sorted by price/distance → buyer picks one;
 *                     OR no offers → send RFQ (quote request)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api/common';
import { UNIT_SHORT, CATEGORY_LABELS, DEFAULT_MATERIAL_NAMES } from '@/lib/materials';
import type { MaterialCategory, MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';
import {
  MapPin,
  Check,
  Truck,
  Calendar,
  Minus,
  Plus,
  Send,
  Clock,
  Sun,
  Moon,
  CalendarClock,
  Zap as ZapIcon,
  CheckCircle2,
  ChevronDown,
  Package,
  Camera,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import type { TruckType } from '@/components/ui/TruckIllustration';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { OfferCard } from '@/components/order/OfferCard';
import { s, oc } from './order-request-new-styles';

const DRAFT_KEY = '@b3hub_wizard_draft';

type WizardDraft = {
  category: string;
  materialName: string;
  unit: MaterialUnit;
  quantity: number;
  notes: string;
  step: Step;
  pickedAddress: PickedAddress | null;
  deliveryDate: string;
  deliveryWindow: 'ANY' | 'AM' | 'PM';
  truckCount: number;
  truckIntervalMinutes: number;
  savedAt: number;
  // Structured specs fields (added in redesign)
  selectedFraction?: string;
  orderType?: OrderType;
  selectedTruckId?: string;
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'specs' | 'address' | 'when' | 'offers';
type SubmitResult = 'order' | 'rfq';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS: Step[] = ['address', 'specs', 'when', 'offers'];

/** Category-specific default unit; all others default to TONNE. */
const CATEGORY_DEFAULT_UNIT: Partial<Record<string, MaterialUnit>> = {
  CONCRETE: 'M3',
};

const STEP_TITLES: Record<Step, string> = {
  address: 'Kur piegādāt?',
  specs: 'Ko pasūtīt?',
  when: 'Kad piegādāt?',
  offers: 'Piedāvājumi',
};

/** Bulk density t/m³ for volume → weight conversion */
const MATERIAL_DENSITY: Partial<Record<string, number>> = {
  SAND: 1.6,
  GRAVEL: 1.8,
  STONE: 2.7,
  CONCRETE: 2.4,
  SOIL: 1.7,
  RECYCLED_CONCRETE: 1.5,
  RECYCLED_SOIL: 1.5,
  ASPHALT: 2.3,
  CLAY: 1.8,
  OTHER: 1.7,
};

// ── Truck options ──────────────────────────────────────────────────────────

type TruckOption = {
  id: string;
  label: string;
  subtitle: string;
  capacity: number;
  truckType: TruckType;
};

const TRUCK_OPTIONS: TruckOption[] = [
  {
    id: 'SEMI_26',
    label: '26 t',
    subtitle: 'Piekabes',
    capacity: 26,
    truckType: 'ARTICULATED_TIPPER',
  },
  { id: 'TIPPER_17', label: '17 t', subtitle: '8×4', capacity: 17, truckType: 'TIPPER_LARGE' },
  {
    id: 'TIPPER_12',
    label: '12 t',
    subtitle: 'Standarta',
    capacity: 12,
    truckType: 'TIPPER_SMALL',
  },
];

// ── Order type ─────────────────────────────────────────────────────────────

type OrderType = 'BY_WEIGHT' | 'BY_VOLUME' | 'BY_LOAD';

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  BY_WEIGHT: 'Pēc svara (tonnas)',
  BY_VOLUME: 'Pēc apjoma (m³)',
  BY_LOAD: 'Kravas pēc skaita',
};

const ORDER_TYPE_UNIT_MAP: Record<OrderType, MaterialUnit> = {
  BY_WEIGHT: 'TONNE',
  BY_VOLUME: 'M3',
  BY_LOAD: 'LOAD',
};

const ORDER_TYPE_UNIT_LABEL: Record<OrderType, string> = {
  BY_WEIGHT: 'tonnas',
  BY_VOLUME: 'm³',
  BY_LOAD: 'kravas',
};

// ── Fractions per material category ────────────────────────────────────────

const CATEGORY_FRACTIONS: Record<MaterialCategory, string[]> = {
  SAND: ['Smalkā', 'Rupjā', 'Betonsmilts', '0–4 mm', 'Nav norādīts'],
  GRAVEL: ['0–4 mm', '4–8 mm', '8–16 mm', '16–32 mm', '32–63 mm', 'Nav norādīts'],
  STONE: ['0–4 mm', '4–8 mm', '8–16 mm', '16–32 mm', '32–63 mm', '63+ mm', 'Nav norādīts'],
  CONCRETE: ['B15', 'B20', 'B22.5', 'B25', 'B30', 'Nav norādīts'],
  SOIL: ['Izmestā augsne', 'Melnzeme', 'Dārza zeme', 'Nav norādīts'],
  RECYCLED_CONCRETE: ['0–8 mm', '8–32 mm', '32–63 mm', 'Nav norādīts'],
  RECYCLED_SOIL: ['Nav norādīts'],
  ASPHALT: ['Karstais asfalts', 'Aukstais asfalts', 'Nav norādīts'],
  CLAY: ['Nav norādīts'],
  OTHER: ['Nav norādīts'],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrderRequestWizard() {
  const router = useRouter();
  const { user, token } = useAuth();
  const params = useLocalSearchParams<{
    initialCategory?: string;
    prefillMaterial?: string;
    prefillAddress?: string;
    prefillCity?: string;
    projectId?: string;
    resumeDraft?: string;
    prefilledQty?: string;
    schedule?: string;
  }>();

  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>(
    (params.initialCategory as MaterialCategory) || 'GRAVEL',
  );
  const category = selectedCategory; // backward-compat alias used in API calls

  // ── Step state ──
  // Start at 'address' on fresh entry; skip it when arriving from catalog with a pre-filled address or quantity.
  const [step, setStep] = useState<Step>(
    params.prefillAddress || params.prefilledQty ? 'specs' : 'address',
  );
  const stepIndex = STEPS.indexOf(step);

  // ── Specs step ──
  const [materialName, setMaterialName] = useState(
    () =>
      params.prefillMaterial ||
      DEFAULT_MATERIAL_NAMES[(params.initialCategory as MaterialCategory) || 'GRAVEL'] ||
      '',
  );
  const [unit, setUnit] = useState<MaterialUnit>(
    CATEGORY_DEFAULT_UNIT[(params.initialCategory as MaterialCategory) || 'GRAVEL'] ?? 'TONNE',
  );
  const [quantity, setQuantity] = useState(() => {
    const prefill = params.prefilledQty ? parseFloat(params.prefilledQty) : NaN;
    return !isNaN(prefill) && prefill > 0 ? prefill : TRUCK_OPTIONS[0].capacity;
  });
  const [notes, setNotes] = useState('');
  const [sitePhotoUri, setSitePhotoUri] = useState<string | null>(null);
  const [sitePhotoUrl, setSitePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Volume calculator modal ──
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcLength, setCalcLength] = useState('');
  const [calcWidth, setCalcWidth] = useState('');
  const [calcDepth, setCalcDepth] = useState('');

  const calcM3 = (() => {
    const l = parseFloat(calcLength);
    const w = parseFloat(calcWidth);
    const d = parseFloat(calcDepth);
    if (isNaN(l) || isNaN(w) || isNaN(d) || l <= 0 || w <= 0 || d <= 0) return null;
    return parseFloat((l * w * (d / 100)).toFixed(2));
  })();

  const calcTonnes =
    calcM3 != null ? parseFloat((calcM3 * (MATERIAL_DENSITY[category] ?? 1.7)).toFixed(1)) : null;

  function applyCalc() {
    if (calcM3 == null) return;
    if (orderType === 'BY_VOLUME') {
      setQuantity(calcM3);
    } else {
      setQuantity(calcTonnes ?? calcM3);
    }
    setCalcOpen(false);
  }

  // ── Structured specs (new pickers) ──
  const [selectedFraction, setSelectedFraction] = useState<string>(
    () => CATEGORY_FRACTIONS[(params.initialCategory as MaterialCategory) || 'GRAVEL'][0],
  );
  const [orderType, setOrderType] = useState<OrderType>('BY_WEIGHT');
  const [selectedTruckId, setSelectedTruckId] = useState<string>(TRUCK_OPTIONS[0].id);
  // Picker modal open state

  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [fractionPickerOpen, setFractionPickerOpen] = useState(false);
  const [orderTypePickerOpen, setOrderTypePickerOpen] = useState(false);

  // ── Address step ──
  const [pickedAddress, setPickedAddress] = useState<PickedAddress | null>(null);

  // ── When step ──
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [truckCount, setTruckCount] = useState(1);
  const [truckIntervalMinutes, setTruckIntervalMinutes] = useState(60);
  // Repeat / schedule
  const [repeatEnabled, setRepeatEnabled] = useState(() => params.schedule === '1');
  const [repeatInterval, setRepeatInterval] = useState<7 | 14 | 30>(7);

  // ── Offers step ──
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [offersSort, setOffersSort] = useState<'price' | 'distance' | 'eta' | 'rating'>('price');
  const [priceMaxFilter, setPriceMaxFilter] = useState<number | null>(null);
  const [distanceMaxFilter, setDistanceMaxFilter] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [rfqNumber, setRfqNumber] = useState('');
  const [rfqId, setRfqId] = useState('');

  // ── Contact — pre-filled from user profile ──
  const [contactName] = useState(() => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [contactPhone] = useState(() => user?.phone ?? '');

  // ── Draft: restore from AsyncStorage when 'resumeDraft' param is set ──
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (params.resumeDraft !== 'true') {
      draftLoadedRef.current = true;
      return;
    }
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (!raw) {
          draftLoadedRef.current = true;
          return;
        }
        try {
          const d: WizardDraft = JSON.parse(raw);
          // Discard drafts older than 7 days — construction orders are time-sensitive.
          const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
          if (d.savedAt && Date.now() - d.savedAt > DRAFT_TTL_MS) {
            AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
            draftLoadedRef.current = true;
            return;
          }
          setMaterialName(d.materialName || materialName);
          setUnit(d.unit || unit);
          setQuantity(d.quantity || quantity);
          setNotes(d.notes || '');
          setStep(d.step || 'address');
          if (d.pickedAddress) setPickedAddress(d.pickedAddress);
          if (d.deliveryDate) setDeliveryDate(d.deliveryDate);
          setDeliveryWindow(d.deliveryWindow || 'ANY');
          setTruckCount(d.truckCount || 1);
          setTruckIntervalMinutes(d.truckIntervalMinutes || 60);
          if (d.category) setSelectedCategory(d.category as MaterialCategory);
          if (d.selectedFraction) setSelectedFraction(d.selectedFraction);
          if (d.orderType) setOrderType(d.orderType as OrderType);
          if (d.selectedTruckId) setSelectedTruckId(d.selectedTruckId);
        } catch {
          /* ignore corrupt draft */
        }
        draftLoadedRef.current = true;
      })
      .catch(() => {
        draftLoadedRef.current = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draft: save progressively to AsyncStorage ──
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (submitted) return; // don't overwrite cleared draft after submission
    const draft: WizardDraft = {
      category,
      materialName,
      unit,
      quantity,
      notes,
      step,
      pickedAddress,
      deliveryDate,
      deliveryWindow,
      truckCount,
      truckIntervalMinutes,
      selectedFraction,
      orderType,
      selectedTruckId,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [
    category,
    materialName,
    unit,
    quantity,
    notes,
    step,
    pickedAddress,
    deliveryDate,
    deliveryWindow,
    truckCount,
    truckIntervalMinutes,
    submitted,
  ]);

  // ── Persist last delivery address for catalog live pricing ──
  useEffect(() => {
    if (!pickedAddress) return;
    AsyncStorage.setItem('@b3hub_last_delivery', JSON.stringify(pickedAddress)).catch(() => {});
  }, [pickedAddress]);

  // ── Quantity quick-values ──
  const stepAmt = 1;

  // ── Sync materialName from structured pickers ──
  useEffect(() => {
    const name =
      selectedFraction !== 'Nav norādīts'
        ? `${CATEGORY_LABELS[selectedCategory]} ${selectedFraction}`
        : CATEGORY_LABELS[selectedCategory];
    setMaterialName(name);
  }, [selectedCategory, selectedFraction]);

  // ── Sync unit from order type ──
  useEffect(() => {
    setUnit(ORDER_TYPE_UNIT_MAP[orderType]);
  }, [orderType]);

  // ── Load offers when entering the offers step ──
  useEffect(() => {
    if (step !== 'offers' || !token || !pickedAddress) return;
    setOffersLoading(true);
    setOffersError('');
    setOffers([]);
    api.materials
      .getOffers(
        {
          category: selectedCategory,
          quantity,
          lat: pickedAddress.lat,
          lng: pickedAddress.lng,
        },
        token,
      )
      .then(setOffers)
      .catch(() => {
        setOffersError('Neizdevās ielādēt piedāvājumus. Jūs joprojām varat nosūtīt pieprasījumu.');
      })
      .finally(() => setOffersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Navigation ──
  const goBack = useCallback(() => {
    if (submitted) {
      if (submitted === 'order' && orderId) {
        router.replace(`/(buyer)/order/${orderId}` as never);
      } else {
        router.replace('/(buyer)/orders' as never);
      }
      return;
    }
    if (stepIndex === 0) {
      const hasDraft = notes.trim() !== '' || pickedAddress !== null;
      if (hasDraft) {
        Alert.alert('Iziet no pasūtīšanas?', 'Ievadītie dati tiks zaudēti.', [
          { text: 'Turpināt', style: 'cancel' },
          {
            text: 'Iziet',
            style: 'destructive',
            onPress: () => {
              if (router.canGoBack()) router.back();
              else router.replace('/(buyer)/home' as never);
            },
          },
        ]);
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  }, [stepIndex, router, submitted]);

  const goNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      haptics.medium();
      setStep(STEPS[stepIndex + 1]);
    }
  }, [stepIndex]);

  // ── Site photo upload ──
  const handlePickSitePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert(
          'Atļauja liegta',
          'Lai pievienotu foto, atļaujiet piekļuvi kamerai vai galerijā.',
        );
        return;
      }
    }
    Alert.alert('Izkraušanas vietas foto', 'Izvēlieties avotu', [
      {
        text: 'Kamera',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadSitePhotoAsset(result.assets[0]);
          }
        },
      },
      {
        text: 'Galerija',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadSitePhotoAsset(result.assets[0]);
          }
        },
      },
      { text: 'Atcelt', style: 'cancel' },
    ]);
  };

  const uploadSitePhotoAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64 || !token) return;
    setUploadingPhoto(true);
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const { url } = await api.orders.uploadSitePhoto(asset.base64, mimeType, token);
      setSitePhotoUri(asset.uri);
      setSitePhotoUrl(url);
    } catch {
      Alert.alert('Kļūda', 'Foto augšupielāde neizdevās. Mēģiniet vēlreiz.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Submit: buyer selects a specific supplier offer ──
  const handleSelectOffer = async (offer: SupplierOffer) => {
    if (!token || !pickedAddress) return;
    // Validate min order quantity
    if (offer.minOrder && quantity < offer.minOrder) {
      setSubmitError(
        `Minimālais pasūtījuma daudzums šim piegādātājam ir ${offer.minOrder} ${
          UNIT_SHORT[unit] ?? unit
        }`,
      );
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await api.materials.createOrder(
        {
          buyerId: user!.id,
          materialId: offer.id,
          quantity,
          unit,
          unitPrice: offer.basePrice,
          deliveryAddress: pickedAddress.address,
          deliveryCity: pickedAddress.city,
          deliveryDate: deliveryDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          deliveryFee: offer.deliveryFee ?? undefined,
          deliveryLat: pickedAddress.lat,
          deliveryLng: pickedAddress.lng,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
          sitePhotoUrl: sitePhotoUrl || undefined,
          projectId: params.projectId || undefined,
          truckCount,
          truckIntervalMinutes: truckCount > 1 ? truckIntervalMinutes : undefined,
        },
        token,
      );

      // Also create a recurring schedule if buyer opted in
      if (repeatEnabled) {
        const firstRun = new Date(Date.now() + repeatInterval * 86_400_000).toISOString();
        await api.schedules.create(
          {
            orderType: 'MATERIAL',
            deliveryAddress: pickedAddress.address,
            deliveryCity: pickedAddress.city,
            deliveryState: '',
            deliveryPostal: '',
            deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
            notes: notes || undefined,
            siteContactName: contactName || undefined,
            siteContactPhone: contactPhone || undefined,
            projectId: params.projectId || undefined,
            items: [{ materialId: offer.id, quantity, unit }],
            intervalDays: repeatInterval,
            nextRunAt: firstRun,
          },
          token,
        );
      }

      setOrderNumber(order.orderNumber);
      setOrderId(order.id);
      setSubmitted('order');
      haptics.success();
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { code?: string; currentPrice?: number };
        if (data?.code === 'PRICE_CHANGED' && data.currentPrice !== undefined) {
          Alert.alert(
            'Cena ir mainījusies',
            `Materiāla cena ir mainījusies uz €${data.currentPrice.toFixed(2)}. Vai vēlaties turpināt?`,
            [
              { text: 'Atcelt', style: 'cancel' },
              {
                text: 'Apstiprināt',
                onPress: () => handleSelectOffer({ ...offer, basePrice: data.currentPrice! }),
              },
            ],
          );
          return;
        }
      }
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit: send RFQ when no offers (or as alternative) ──
  const handleSendRFQ = async () => {
    if (!token || !pickedAddress) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.quoteRequests.create(
        {
          materialCategory: category,
          materialName,
          quantity,
          unit,
          deliveryAddress: pickedAddress.address,
          deliveryCity: pickedAddress.city,
          deliveryLat: pickedAddress.lat,
          deliveryLng: pickedAddress.lng,
          notes: notes || undefined,
        },
        token,
      );
      setRfqNumber(result.requestNumber);
      setRfqId(result.id);
      setSubmitted('rfq');
      haptics.success();
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── CTA config ──
  const canProceed =
    step === 'address'
      ? !!pickedAddress
      : step === 'specs'
        ? quantity > 0
        : step === 'when'
          ? true
          : !offersLoading && !submitting && !submitted;

  const ctaLabel = submitted
    ? submitted === 'rfq'
      ? 'Skatīt pieprasījumu'
      : 'Apmaksāt pasūtījumu'
    : step === 'offers'
      ? 'Nosūtīt pieprasījumu'
      : 'Turpināt';

  const handleCTA = submitted
    ? submitted === 'rfq'
      ? () => router.replace(`/(buyer)/rfq/${rfqId}` as never)
      : () => router.replace(`/(buyer)/order/${orderId}` as never)
    : step === 'offers'
      ? handleSendRFQ
      : goNext;

  // ── Step renders ──────────────────────────────────────────────────────────

  const renderSpecs = () => (
    <ScrollView
      className="px-6 pt-5 pb-12"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row gap-4 mb-6">
        <TouchableOpacity
          className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-200"
          onPress={() => setCatPickerOpen(true)}
          activeOpacity={0.8}
        >
          <Text className="text-gray-400 text-sm font-semibold mb-1">Materiāls</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 font-extrabold text-lg line-clamp-1" numberOfLines={1}>
              {CATEGORY_LABELS[selectedCategory]}
            </Text>
            <ChevronDown size={18} color="#9ca3af" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-200"
          onPress={() => setFractionPickerOpen(true)}
          activeOpacity={0.8}
        >
          <Text className="text-gray-400 text-sm font-semibold mb-1">Frakcija</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 font-extrabold text-lg line-clamp-1" numberOfLines={1}>
              {selectedFraction}
            </Text>
            <ChevronDown size={18} color="#9ca3af" />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6"
        onPress={() => setOrderTypePickerOpen(true)}
        activeOpacity={0.8}
      >
        <Text className="text-gray-400 text-sm font-semibold mb-1">Pasūtījuma veids</Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-900 font-extrabold text-lg">
            {ORDER_TYPE_LABELS[orderType]}
          </Text>
          <ChevronDown size={18} color="#9ca3af" />
        </View>
      </TouchableOpacity>

      <View className="mb-10 items-center justify-center">
        <Text className="text-gray-400 text-sm font-bold tracking-widest uppercase mb-6">
          Kopējais apjoms
        </Text>

        <View className="flex-row items-center justify-center gap-6">
          <TouchableOpacity
            className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center"
            onPress={() => setQuantity((q) => Math.max(1, Math.round(q - stepAmt)))}
            activeOpacity={0.8}
          >
            <Minus size={24} color="#111827" />
          </TouchableOpacity>

          <View className="items-center px-4 w-[160px]">
            <View className="flex-row items-end">
              <Text
                className="text-5xl font-black text-gray-900 tracking-tighter"
                numberOfLines={1}
              >
                {quantity.toString()}
              </Text>
              <Text
                className="text-xl font-bold text-gray-400 mb-1 ml-1"
                style={{ marginBottom: 6 }}
              >
                {ORDER_TYPE_UNIT_LABEL[orderType]}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center"
            onPress={() => setQuantity((q) => Math.round(q + stepAmt))}
            activeOpacity={0.8}
          >
            <Plus size={24} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Truck load info (visual context) */}
      <View className="bg-gray-50 rounded-2xl p-4 mb-6 flex-row items-center border border-gray-200">
        <View className="bg-white w-10 h-10 rounded-xl items-center justify-center mr-4 shadow-sm border border-gray-100">
          <Truck size={18} color="#111827" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 font-bold text-sm mb-0.5">Tehniska informācija</Text>
          <Text className="text-gray-500 font-medium text-xs leading-tight">
            Nepieciešami {Math.ceil(quantity / 26)} reisi (26 {ORDER_TYPE_UNIT_LABEL[orderType]}{' '}
            ietilpība automašīnai)
          </Text>
        </View>
      </View>

      <View className="mt-8">
        <Text className="text-gray-400 text-sm font-semibold mb-2 ml-1">Piezīmes (neobligāti)</Text>
        <TextInput
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 pt-4 text-gray-900 font-medium text-sm"
          placeholder="Ievadiet papildu informāciju piegādātājam..."
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
      </View>

      {/* Site photo */}
      <View className="mt-6 mb-2">
        <Text className="text-gray-400 text-sm font-semibold mb-2 ml-1">
          Izkraušanas vietas foto (neobligāti)
        </Text>
        {sitePhotoUri ? (
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: sitePhotoUri }}
              style={{ width: '100%', height: 180, borderRadius: 16 }}
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => {
                setSitePhotoUri(null);
                setSitePhotoUrl(null);
              }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 16,
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePickSitePhoto}
            disabled={uploadingPhoto}
            className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-row items-center justify-center"
            activeOpacity={0.8}
            style={{ minHeight: 72 }}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <>
                <Camera size={20} color="#6b7280" />
                <Text className="text-gray-500 font-semibold text-sm ml-2">Pievienot foto</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderWhen = () => (
    <ScrollView
      className="px-6 pt-5 pb-12"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Inline calendar */}
      <View className="mb-10">
        <Text className="text-gray-900 text-base font-bold tracking-tight mb-4 ml-1">
          Piegādes datums
        </Text>
        <View className="bg-transparent">
          <RNCalendar
            current={deliveryDate || new Date().toISOString().split('T')[0]}
            minDate={new Date().toISOString().split('T')[0]}
            markedDates={
              deliveryDate
                ? {
                    [deliveryDate]: {
                      selected: true,
                      selectedColor: '#111827',
                      selectedTextColor: '#fff',
                    },
                  }
                : {}
            }
            onDayPress={(day: { dateString: string }) => {
              setDeliveryDate(day.dateString);
              haptics.light();
            }}
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: '#6b7280',
              selectedDayBackgroundColor: '#111827',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#111827',
              dayTextColor: '#111827',
              textDisabledColor: '#d1d5db',
              arrowColor: '#111827',
              monthTextColor: '#111827',
              textDayFontSize: 15,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 13,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
            }}
            firstDay={1}
            enableSwipeMonths
          />
        </View>
      </View>

      {/* Time window selection (Any, AM, PM) */}
      <View className="mb-10">
        <Text className="text-gray-900 text-base font-bold tracking-tight mb-4 ml-1">
          Dienas laiks
        </Text>
        <View className="flex-row gap-3">
          {(
            [
              { id: 'ANY', label: 'Jebkurā laikā', icon: CalendarClock },
              { id: 'AM', label: 'Rīta pusē', icon: Sun },
              { id: 'PM', label: 'Pēcpusdienā', icon: Moon },
            ] as const
          ).map((w, i) => {
            const active = deliveryWindow === w.id;
            const Icon = w.icon;
            return (
              <TouchableOpacity
                key={i}
                className={`flex-1 rounded-2xl p-4 items-center justify-center ${
                  active ? 'bg-gray-900' : 'bg-gray-50'
                }`}
                onPress={() => setDeliveryWindow(w.id)}
                activeOpacity={0.8}
              >
                <Icon size={20} color={active ? '#ffffff' : '#9ca3af'} className="mb-2" />
                <Text className={`font-bold text-xs ${active ? 'text-white' : 'text-gray-500'}`}>
                  {w.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View className="flex-row items-center mt-2 mb-6 px-1">
        <ZapIcon size={16} color="#9ca3af" className="mr-3" />
        <View className="flex-1">
          <Text className="text-gray-500 flex-wrap font-medium text-xs leading-snug">
            Pārdevēji piedāvās labāko cenu atbilstoši izvēlētajam piegādes laikam.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderOffers = () => {
    // ── Success: order placed ──
    if (submitted === 'order') {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={s.successWrap}>
            <View style={s.successIconBg}>
              <CheckCircle2 size={36} color="#fff" />
            </View>
            <Text style={s.successTitle}>Pasūtījums izveidots</Text>
            <Text style={s.successNum}>Nr. {orderNumber}</Text>
            <Text style={[s.successSub, { marginTop: 4 }]}>
              Piegādātājs saņēma jūsu pasūtījumu. Lai to apstiprinātu, veiciet apmaksu.
            </Text>
          </View>

          {/* Payment CTA */}
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 12,
            }}
            onPress={() => {
              if (orderId) router.replace(`/(buyer)/order/${orderId}` as never);
            }}
            activeOpacity={0.85}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#fff',
                fontFamily: 'Inter_700Bold',
              }}
            >
              Apmaksāt pasūtījumu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}
            onPress={() => {
              if (orderId) router.replace(`/(buyer)/order/${orderId}` as never);
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, color: colors.textMuted, fontFamily: 'Inter_500Medium' }}>
              Skatīt pasūtījumu
            </Text>
          </TouchableOpacity>

          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <MapPin size={16} color="#111827" />
              <Text style={s.summaryText} numberOfLines={2}>
                {pickedAddress?.address}
              </Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryRow}>
              <Truck size={16} color="#111827" />
              <Text style={s.summaryText}>
                {quantity} {UNIT_SHORT[unit]} · {materialName}
                {truckCount > 1 ? ` · ${truckCount} auto (ik ${truckIntervalMinutes} min)` : ''}
              </Text>
            </View>
            {deliveryDate ? (
              <>
                <View style={s.summaryDivider} />
                <View style={s.summaryRow}>
                  <Calendar size={16} color="#111827" />
                  <Text style={s.summaryText}>
                    {new Date(deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      );
    }

    // ── Success: RFQ sent ──
    if (submitted === 'rfq') {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={s.successWrap}>
            <View style={[s.successIconBg, { backgroundColor: colors.primary }]}>
              <Send size={36} color="#fff" />
            </View>
            <Text style={s.successTitle}>Pieprasījums nosūtīts!</Text>
            <Text style={s.successNum}>Nr. {rfqNumber}</Text>
            <Text style={s.successSub}>
              Piegādātāji jūsu rajonā saņēma paziņojumu. Kad kāds atbildēs ar cenu, jūs saņemsiet
              paziņojumu.
            </Text>
          </View>
        </ScrollView>
      );
    }

    // ── Loading ──
    if (offersLoading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '500' }}>
            Meklējam pieejamos piegādātājus...
          </Text>
        </View>
      );
    }

    // ── Error or no offers ──
    if (offersError || offers.length === 0) {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
          {offersError ? (
            <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '500' }}>
              {offersError}
            </Text>
          ) : (
            <>
              <Text style={s.offersTitle}>Nav tūlītēju piedāvājumu</Text>
              <Text style={s.offersSub}>
                Nosūtiet pieprasījumu — piegādātāji atbildēs ar savām cenām.
              </Text>
            </>
          )}
          {submitError ? (
            <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '500' }}>
              {submitError}
            </Text>
          ) : null}
          <View style={s.rfqBox}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={s.rfqIconBg}>
                <Send size={20} color="#111827" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rfqTitle}>Nosūtīt cenu pieprasījumu</Text>
                <Text style={s.rfqSub}>
                  Jūsu pieprasījums tiks nosūtīts visiem atbilstošajiem piegādātājiem jūsu rajonā.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

    // ── Offers list ──
    const sorted = [...offers]
      .filter((o) => priceMaxFilter == null || o.effectiveUnitPrice <= priceMaxFilter)
      .filter(
        (o) =>
          distanceMaxFilter == null || (o.distanceKm != null && o.distanceKm <= distanceMaxFilter),
      )
      .sort((a, b) => {
        if (offersSort === 'distance') {
          const da = a.distanceKm ?? Infinity;
          const db = b.distanceKm ?? Infinity;
          return da - db;
        }
        if (offersSort === 'eta') {
          const ea = a.etaHours ?? a.etaDays * 8;
          const eb = b.etaHours ?? b.etaDays * 8;
          return ea - eb;
        }
        if (offersSort === 'rating') {
          const ra = a.supplier.rating ?? 0;
          const rb = b.supplier.rating ?? 0;
          return rb - ra;
        }
        return a.totalPrice - b.totalPrice; // default: price
      });

    const SORT_OPTIONS: { key: typeof offersSort; label: string }[] = [
      { key: 'price', label: 'Cena' },
      { key: 'distance', label: 'Attālums' },
      { key: 'eta', label: 'Piegādes laiks' },
      { key: 'rating', label: 'Vērtējums' },
    ];

    return (
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.textPrimary,
              fontFamily: 'Inter_700Bold',
            }}
          >
            {sorted.length} piedāvājum{sorted.length === 1 ? 's' : 'i'}
          </Text>

          {/* Combined Filters Horizontal Scroller */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ overflow: 'visible' }}
          >
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  marginRight: 4,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                Sortēt:
              </Text>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    haptics.light();
                    setOffersSort(opt.key);
                  }}
                  style={[
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 100,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      backgroundColor: '#fff',
                    },
                    offersSort === opt.key && {
                      borderColor: colors.textPrimary,
                      backgroundColor: colors.bgMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      { fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_500Medium' },
                      offersSort === opt.key && {
                        color: colors.textPrimary,
                        fontWeight: '600',
                        fontFamily: 'Inter_600SemiBold',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <View
                style={{ width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 6 }}
              />

              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  marginRight: 4,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                Max €/t:
              </Text>
              {[null, 10, 20, 50].map((cap) => (
                <TouchableOpacity
                  key={cap === null ? 'all' : cap}
                  onPress={() => {
                    haptics.light();
                    setPriceMaxFilter(cap);
                  }}
                  style={[
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 100,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      backgroundColor: '#fff',
                    },
                    priceMaxFilter === cap && {
                      borderColor: colors.textPrimary,
                      backgroundColor: colors.bgMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      { fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_500Medium' },
                      priceMaxFilter === cap && {
                        color: colors.textPrimary,
                        fontWeight: '600',
                        fontFamily: 'Inter_600SemiBold',
                      },
                    ]}
                  >
                    {cap === null ? 'Visi' : `≤€${cap}`}
                  </Text>
                </TouchableOpacity>
              ))}

              <View
                style={{ width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 6 }}
              />

              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  marginRight: 4,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                Max km:
              </Text>
              {([null, 25, 50, 100] as (number | null)[]).map((km) => (
                <TouchableOpacity
                  key={km === null ? 'all-km' : km}
                  onPress={() => {
                    haptics.light();
                    setDistanceMaxFilter(km);
                  }}
                  style={[
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 100,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      backgroundColor: '#fff',
                    },
                    distanceMaxFilter === km && {
                      borderColor: colors.textPrimary,
                      backgroundColor: colors.bgMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      { fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_500Medium' },
                      distanceMaxFilter === km && {
                        color: colors.textPrimary,
                        fontWeight: '600',
                        fontFamily: 'Inter_600SemiBold',
                      },
                    ]}
                  >
                    {km === null ? 'Visi' : `≤${km}km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {submitError ? (
            <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '500' }}>
              {submitError}
            </Text>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: 32,
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
        >
          {sorted.map((offer, idx) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              unit={unit}
              isCheapest={offersSort === 'price' && idx === 0}
              submitting={submitting}
              onSelect={() => handleSelectOffer(offer)}
            />
          ))}

          {/* RFQ fallback */}
          <View
            style={{
              marginTop: 12,
              padding: 16,
              backgroundColor: colors.bgSubtle,
              borderRadius: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#f3f4f6',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              Neesat apmierināts ar cenām?
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: '#fff',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '#d1d5db',
                borderRadius: 8,
              }}
              onPress={handleSendRFQ}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Send size={14} color="#111827" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                Pieprasīt spec. cenas
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  if (step === 'address') {
    return (
      <InlineAddressStep
        picked={pickedAddress}
        onPick={(p) => setPickedAddress(p)}
        onConfirm={goNext}
        onCancel={goBack}
        initialText={params.prefillAddress}
        contextLabel="Piegādes adrese"
        pricePreviewCategory={selectedCategory}
        pricePreviewQuantity={quantity}
      />
    );
  }

  return (
    <>
      <WizardLayout
        title={
          submitted === 'order'
            ? 'Pasūtījums veikts!'
            : submitted === 'rfq'
              ? 'Pieprasījums nosūtīts!'
              : STEP_TITLES[step]
        }
        step={stepIndex + 1}
        totalSteps={STEPS.length}
        onBack={goBack}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(buyer)/home' as never);
        }}
        ctaLabel={ctaLabel}
        onCTA={handleCTA}
        ctaDisabled={!canProceed || submitting}
        ctaLoading={submitting && step !== 'offers'}
        footerLeft={
          step === 'specs' ? (
            <View>
              <Text
                style={{ fontSize: 13, color: colors.textDisabled, fontFamily: 'Inter_500Medium' }}
              >
                Pasūtījuma apjoms
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: colors.textPrimary,
                  fontFamily: 'Inter_600SemiBold',
                  marginTop: 2,
                }}
              >
                {quantity.toFixed(2)} {ORDER_TYPE_UNIT_LABEL[orderType]}
              </Text>
            </View>
          ) : undefined
        }
      >
        {step === 'specs' && renderSpecs()}
        {step === 'when' && renderWhen()}
        {step === 'offers' && renderOffers()}
      </WizardLayout>

      {/* ── Category picker ── */}
      <BottomSheet
        visible={catPickerOpen}
        onClose={() => setCatPickerOpen(false)}
        title="Materiāla veids"
        scrollable
        maxHeightPct={0.6}
      >
        {(Object.keys(CATEGORY_FRACTIONS) as MaterialCategory[]).map((item) => (
          <TouchableOpacity
            key={item}
            style={s.sheetItem}
            onPress={() => {
              setSelectedCategory(item);
              setSelectedFraction(CATEGORY_FRACTIONS[item][0]);
              setCatPickerOpen(false);
              haptics.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.sheetItemText, selectedCategory === item && s.sheetItemTextActive]}>
              {CATEGORY_LABELS[item]}
            </Text>
            {selectedCategory === item && <Check size={16} color="#111827" />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* ── Fraction picker ── */}
      <BottomSheet
        visible={fractionPickerOpen}
        onClose={() => setFractionPickerOpen(false)}
        title="Frakcija"
        scrollable
        maxHeightPct={0.5}
      >
        {CATEGORY_FRACTIONS[selectedCategory].map((item) => (
          <TouchableOpacity
            key={item}
            style={s.sheetItem}
            onPress={() => {
              setSelectedFraction(item);
              setFractionPickerOpen(false);
              haptics.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.sheetItemText, selectedFraction === item && s.sheetItemTextActive]}>
              {item}
            </Text>
            {selectedFraction === item && <Check size={16} color="#111827" />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* ── Order type picker ── */}
      <BottomSheet
        visible={orderTypePickerOpen}
        onClose={() => setOrderTypePickerOpen(false)}
        title="Pasūtījuma veids"
        maxHeightPct={0.4}
      >
        {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((ot) => (
          <TouchableOpacity
            key={ot}
            style={s.sheetItem}
            onPress={() => {
              setOrderType(ot);
              setOrderTypePickerOpen(false);
              haptics.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.sheetItemText, orderType === ot && s.sheetItemTextActive]}>
              {ORDER_TYPE_LABELS[ot]}
            </Text>
            {orderType === ot && <Check size={16} color="#111827" />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* ── Volume / Weight Calculator ── */}
      <BottomSheet
        visible={calcOpen}
        onClose={() => setCalcOpen(false)}
        title="Daudzuma kalkulators"
        subtitle="Ievadiet platības izmērus, lai aprēķinātu nepieciešamo daudzumu"
        scrollable={false}
      >
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: 'Inter_500Medium',
                  marginBottom: 4,
                }}
              >
                Garums (m)
              </Text>
              <TextInput
                style={[s.textInput, { marginTop: 0 }]}
                value={calcLength}
                onChangeText={setCalcLength}
                placeholder="piem. 10"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: 'Inter_500Medium',
                  marginBottom: 4,
                }}
              >
                Platums (m)
              </Text>
              <TextInput
                style={[s.textInput, { marginTop: 0 }]}
                value={calcWidth}
                onChangeText={setCalcWidth}
                placeholder="piem. 5"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: 'Inter_500Medium',
                  marginBottom: 4,
                }}
              >
                Dziļums (cm)
              </Text>
              <TextInput
                style={[s.textInput, { marginTop: 0 }]}
                value={calcDepth}
                onChangeText={setCalcDepth}
                placeholder="piem. 20"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {calcM3 != null && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#eff6ff',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#1d4ed8' }}>
                  {calcM3}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#3b82f6',
                    fontFamily: 'Inter_500Medium',
                    marginTop: 2,
                  }}
                >
                  m³
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#f0fdf4',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#16a34a' }}>
                  {calcTonnes}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#22c55e',
                    fontFamily: 'Inter_500Medium',
                    marginTop: 2,
                  }}
                >
                  tonnas ({MATERIAL_DENSITY[category] ?? 1.7} t/m³)
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.nextBtn, calcM3 == null && { backgroundColor: '#e5e7eb' }]}
            onPress={applyCalc}
            disabled={calcM3 == null}
            activeOpacity={0.85}
          >
            <Text style={[s.nextBtnTxt, calcM3 == null && { color: colors.textDisabled }]}>
              Izmantot{' '}
              {orderType === 'BY_VOLUME' ? `${calcM3 ?? '—'} m³` : `${calcTonnes ?? '—'} t`}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </>
  );
}
