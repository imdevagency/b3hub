/**
 * order-request-new.tsx
 *
 * Buyer material order wizard — matches web CATALOGUE → SPECS → WHERE → WHEN → OFFERS/RFQ flow.
 *
 *  Catalog page selects a category, then:
 *  Step 1 – SPECS   : free-form material name (pre-filled), quantity, unit, optional notes
 *  Step 2 – WHERE   : delivery address picker
 *  Step 3 – WHEN    : preferred delivery date
 *  Step 4 – OFFERS  : instant supplier offers → buyer picks one → order placed;
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
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
  Star,
  Clock,
  Zap as ZapIcon,
  CheckCircle2,
  ChevronDown,
  Package,
} from 'lucide-react-native';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import type { TruckType } from '@/components/ui/TruckIllustration';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '@/lib/haptics';

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

const STEPS: Step[] = ['specs', 'address', 'when', 'offers'];

/** Category-specific default unit; all others default to TONNE. */
const CATEGORY_DEFAULT_UNIT: Partial<Record<string, MaterialUnit>> = {
  CONCRETE: 'M3',
};

const STEP_TITLES: Record<Step, string> = {
  specs: 'Ko pasūtīt?',
  address: 'Kur piegādāt?',
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
  }>();

  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>(
    (params.initialCategory as MaterialCategory) || 'GRAVEL',
  );
  const category = selectedCategory; // backward-compat alias used in API calls

  // ── Step state ──
  const [step, setStep] = useState<Step>('specs');
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
  const [quantity, setQuantity] = useState(TRUCK_OPTIONS[0].capacity);
  const [notes, setNotes] = useState('');

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
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState<7 | 14 | 30>(7);

  // ── Offers step ──
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [offersSort, setOffersSort] = useState<'price' | 'distance' | 'eta' | 'rating'>('price');
  const [priceMaxFilter, setPriceMaxFilter] = useState<number | null>(null);
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
          setMaterialName(d.materialName || materialName);
          setUnit(d.unit || unit);
          setQuantity(d.quantity || quantity);
          setNotes(d.notes || '');
          setStep(d.step || 'specs');
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
      const hasDraft = notes.trim() !== '';
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

  // ── Submit: buyer selects a specific supplier offer ──
  const handleSelectOffer = async (offer: SupplierOffer) => {
    if (!token || !pickedAddress) return;
    // Validate min order quantity
    if (offer.minOrder && quantity < offer.minOrder) {
      setSubmitError(
        `Minimālais pasūtījuma daudzums šim piegādātājam ir ${offer.minOrder} ${UNIT_SHORT[unit] ?? unit}`,
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
    step === 'specs'
      ? quantity > 0
      : step === 'address'
        ? !!pickedAddress
        : step === 'when'
          ? true
          : !offersLoading && !submitting && !submitted;

  const ctaLabel = submitted
    ? submitted === 'rfq'
      ? 'Skatīt pieprasījumu'
      : 'Skatīt pasūtījumu'
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
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Row 1: Material type + Fraction */}
      <View style={{ flexDirection: 'row', gap: 24, marginBottom: 24 }}>
        <View style={s.lineFieldWrap}>
          <Text style={s.lineFieldLabel}>Materiāla veids</Text>
          <TouchableOpacity
            style={s.lineFieldBtn}
            onPress={() => setCatPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={s.lineFieldValue} numberOfLines={1}>
              {CATEGORY_LABELS[selectedCategory]}
            </Text>
            <ChevronDown size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={s.lineFieldWrap}>
          <Text style={s.lineFieldLabel}>Frakcija</Text>
          <TouchableOpacity
            style={s.lineFieldBtn}
            onPress={() => setFractionPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={s.lineFieldValue} numberOfLines={1}>
              {selectedFraction}
            </Text>
            <ChevronDown size={20} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: Order type */}
      <View style={[s.lineFieldWrap, { marginBottom: 36 }]}>
        <Text style={s.lineFieldLabel}>Pasūtījuma veids</Text>
        <TouchableOpacity
          style={s.lineFieldBtn}
          onPress={() => setOrderTypePickerOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={s.lineFieldValue}>{ORDER_TYPE_LABELS[orderType]}</Text>
          <ChevronDown size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Truck selection */}
      <Text style={s.sectionTitleCenter}>Kravas auto izvēle</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 40 }}>
        {TRUCK_OPTIONS.map((truck) => {
          const active = selectedTruckId === truck.id;
          return (
            <TouchableOpacity
              key={truck.id}
              style={[s.truckCardPlain, { opacity: active ? 1 : 0.4 }]}
              onPress={() => {
                setSelectedTruckId(truck.id);
                setQuantity(truck.capacity);
                haptics.light();
              }}
              activeOpacity={0.8}
            >
              <View style={s.truckImageWrap}>
                <TruckIllustration type={truck.truckType} height={38} />
                {active && (
                  <View style={s.truckCheckCircle}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </View>
              <Text style={s.truckLabelPlain}>{truck.label}</Text>
              {truck.subtitle !== 'Standarta' && truck.subtitle !== 'Piekabes' && (
                <Text style={s.truckSubPlain}>{truck.subtitle}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quantity stepper */}
      <Text style={s.sectionTitleCenter}>
        {ORDER_TYPE_UNIT_LABEL[orderType].charAt(0).toUpperCase() +
          ORDER_TYPE_UNIT_LABEL[orderType].slice(1)}
      </Text>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={s.stepperLineRow}>
          <TouchableOpacity
            style={s.stepBtnDark}
            onPress={() => setQuantity((q) => Math.max(1, q - stepAmt))}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Minus size={20} color="#fff" />
          </TouchableOpacity>

          <View style={s.stepperValueBox}>
            <Text style={s.stepperValueLine}>{quantity}</Text>
          </View>

          <TouchableOpacity
            style={s.stepBtnDark}
            onPress={() => setQuantity((q) => q + stepAmt)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notes */}
      <View style={s.field}>
        <Text style={s.fieldLabel}>
          Papildu prasības <Text style={{ color: '#9ca3af', fontWeight: '400' }}>(neobligāti)</Text>
        </Text>
        <TextInput
          style={[s.textInput, s.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="piem., piegāde ar mazo auto, nesasaldēts..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />
      </View>
    </ScrollView>
  );

  // Removed inline renderAddress mapping, since it takes over the layout completely.

  const renderWhen = () => {
    const todayISO = new Date().toISOString().split('T')[0];
    const isAsap = deliveryDate === '';

    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.stepSub}>Izvēlieties vēlamo piegādes datumu</Text>

        <TouchableOpacity
          style={[s.asapCard, isAsap && s.asapCardActive]}
          onPress={() => setDeliveryDate('')}
          activeOpacity={0.8}
        >
          <View style={[s.asapIcon, isAsap && s.asapIconActive]}>
            <Truck size={20} color={isAsap ? '#111827' : '#6b7280'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.asapTitle, isAsap && s.asapTitleActive]}>Cik drīz iespējams</Text>
            <Text style={s.asapSub}>Piegādātājs sazināsies par laiku</Text>
          </View>
          {isAsap && <Check size={18} color="#111827" />}
        </TouchableOpacity>

        {/* Earliest delivery hint — time-of-day aware (14:00 EET cutoff) */}
        {(() => {
          const nowHourLocal = (new Date().getUTCHours() + 2) % 24;
          const canDeliverToday = nowHourLocal < 14;
          return (
            <View style={s.etaHintRow}>
              <Clock size={13} color={canDeliverToday ? '#059669' : '#6b7280'} />
              <Text style={[s.etaHintText, { color: canDeliverToday ? '#059669' : '#6b7280' }]}>
                {canDeliverToday
                  ? 'Ātrākā piegāde: Šodien (~2–4 h)'
                  : 'Ātrākā piegāde: Rīt (pasūtot šodien)'}
              </Text>
            </View>
          );
        })()}

        <RNCalendar
          minDate={todayISO}
          current={deliveryDate || todayISO}
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
          onDayPress={(day: { dateString: string }) => setDeliveryDate(day.dateString)}
          theme={{
            calendarBackground: '#ffffff',
            backgroundColor: '#ffffff',
            selectedDayBackgroundColor: '#111827',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#6b7280',
            dayTextColor: '#111827',
            textDisabledColor: '#d1d5db',
            arrowColor: '#111827',
            monthTextColor: '#111827',
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 15,
            textMonthFontSize: 16,
          }}
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#F9FAFB',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}
          enableSwipeMonths
        />

        <View style={s.hint}>
          <Text style={s.hintText}>
            Datums ir orientējošs — piegādātājs apstiprinās precīzu laiku.
          </Text>
        </View>

        {/* Delivery time window */}
        <View style={{ marginTop: 4 }}>
          <Text style={[s.fieldLabel, { marginBottom: 10 }]}>Vēlamais piegādes laiks</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['ANY', 'AM', 'PM'] as const).map((w) => {
              const labels = { ANY: 'Jebkurā laikā', AM: 'Rīts (8–13)', PM: 'Pēcpusdiena (13–18)' };
              const isActive = deliveryWindow === w;
              return (
                <TouchableOpacity
                  key={w}
                  style={[
                    s.unitToggleBtn,
                    isActive && s.unitToggleBtnActive,
                    { flex: 1, paddingVertical: 10 },
                  ]}
                  onPress={() => setDeliveryWindow(w)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.unitToggleText,
                      isActive && s.unitToggleTextActive,
                      { textAlign: 'center' },
                    ]}
                  >
                    {labels[w]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Repeat / recurring order toggle */}
        <View style={{ marginTop: 8 }}>
          {/* Multi-truck staggered delivery */}
          <View style={{ marginTop: 8 }}>
            <Text style={[s.fieldLabel, { marginBottom: 10 }]}>Kravas automašīnu skaits</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setTruckCount((n) => Math.max(1, n - 1))}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Minus size={20} color="#111827" />
              </TouchableOpacity>
              <View
                style={{
                  minWidth: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: '#111827' }}>
                  {truckCount}
                </Text>
              </View>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setTruckCount((n) => n + 1)}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Plus size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={{ fontSize: 13, color: '#6B7280', flex: 1 }}>
                {truckCount === 1 ? 'Viena piegāde' : `${truckCount} atsevišķas piegādes`}
              </Text>
            </View>

            {truckCount > 1 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[s.fieldLabel, { marginBottom: 8 }]}>Intervāls starp automašīnām</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([30, 60, 90, 120] as const).map((mins) => {
                    const labels = { 30: '30 min', 60: '1 h', 90: '1.5 h', 120: '2 h' };
                    const active = truckIntervalMinutes === mins;
                    return (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          s.unitToggleBtn,
                          active && s.unitToggleBtnActive,
                          { flex: 1, paddingVertical: 10 },
                        ]}
                        onPress={() => setTruckIntervalMinutes(mins)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            s.unitToggleText,
                            active && s.unitToggleTextActive,
                            { textAlign: 'center' },
                          ]}
                        >
                          {labels[mins]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                  1. automašīna: {deliveryDate || 'jebkurā laikā'}, 2. automašīna: +
                  {truckIntervalMinutes} min, utt.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Repeat / recurring order toggle */}
        <View style={{ marginTop: 8 }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: repeatEnabled ? '#111827' : '#F9FAFB',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: repeatEnabled ? '#111827' : '#E5E7EB',
            }}
            onPress={() => setRepeatEnabled((v) => !v)}
            activeOpacity={0.8}
          >
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Inter_600SemiBold',
                  color: repeatEnabled ? '#fff' : '#111827',
                }}
              >
                Atkārtot pasūtījumu
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: repeatEnabled ? '#D1D5DB' : '#6B7280',
                  marginTop: 2,
                }}
              >
                Automātiski atjaunot katru nedēļu/mēnesi
              </Text>
            </View>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: repeatEnabled ? '#fff' : 'transparent',
                borderWidth: repeatEnabled ? 0 : 2,
                borderColor: '#9CA3AF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {repeatEnabled && <Check size={13} color="#111827" />}
            </View>
          </TouchableOpacity>

          {repeatEnabled && (
            <View style={{ marginTop: 10 }}>
              <Text style={[s.fieldLabel, { marginBottom: 8 }]}>Atkārtošanas biežums</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([7, 14, 30] as const).map((days) => {
                  const labels = { 7: 'Katru nedēļu', 14: 'Reizi 2 nedēļās', 30: 'Katru mēnesi' };
                  const active = repeatInterval === days;
                  return (
                    <TouchableOpacity
                      key={days}
                      style={[
                        s.unitToggleBtn,
                        active && s.unitToggleBtnActive,
                        { flex: 1, paddingVertical: 10 },
                      ]}
                      onPress={() => setRepeatInterval(days)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          s.unitToggleText,
                          active && s.unitToggleTextActive,
                          { textAlign: 'center' },
                        ]}
                      >
                        {labels[days]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderOffers = () => {
    // ── Success: order placed ──
    if (submitted === 'order') {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={s.successWrap}>
            <View style={s.successIconBg}>
              <CheckCircle2 size={36} color="#fff" />
            </View>
            <Text style={s.successTitle}>Pasūtījums veikts!</Text>
            <Text style={s.successNum}>Nr. {orderNumber}</Text>
          </View>
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
            <View style={[s.successIconBg, { backgroundColor: '#2563eb' }]}>
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
          <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500' }}>
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
            <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{offersError}</Text>
          ) : (
            <>
              <Text style={s.offersTitle}>Nav tūlītēju piedāvājumu</Text>
              <Text style={s.offersSub}>
                Nosūtiet pieprasījumu — piegādātāji atbildēs ar savām cenām.
              </Text>
            </>
          )}
          {submitError ? (
            <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{submitError}</Text>
          ) : null}
          <View style={s.rfqBox}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={s.rfqIconBg}>
                <Send size={20} color="#2563eb" />
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        <Text style={s.offersTitle}>
          {sorted.length}
          {sorted.length < offers.length ? `/${offers.length}` : ''} piedāvājum
          {sorted.length === 1 ? 's' : 'i'}
        </Text>

        {/* Sort pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  haptics.light();
                  setOffersSort(opt.key);
                }}
                style={[s.sortPill, offersSort === opt.key && s.sortPillActive]}
              >
                <Text style={[s.sortPillText, offersSort === opt.key && s.sortPillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Price cap filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginRight: 2 }}>Max €/t:</Text>
            {[null, 10, 20, 30, 50, 100].map((cap) => (
              <TouchableOpacity
                key={cap === null ? 'all' : cap}
                onPress={() => {
                  haptics.light();
                  setPriceMaxFilter(cap);
                }}
                style={[s.sortPill, priceMaxFilter === cap && s.sortPillActive]}
              >
                <Text style={[s.sortPillText, priceMaxFilter === cap && s.sortPillTextActive]}>
                  {cap === null ? 'Visi' : `≤€${cap}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {submitError ? (
          <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{submitError}</Text>
        ) : null}
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
        {/* RFQ fallback — always visible below offers */}
        <View style={[s.rfqBox, { marginTop: 4 }]}>
          <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            Vēlaties saņemt vairāk piedāvājumu?
          </Text>
          <TouchableOpacity
            style={[s.rfqBtn, submitting && { opacity: 0.5 }]}
            onPress={handleSendRFQ}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Send size={14} color="#111827" />
            <Text style={s.rfqBtnText}>Pieprasīt vairāk piedāvājumu</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
        contextLabel="Izkraušanas vieta"
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
              <Text style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_500Medium' }}>
                Pasūtījuma apjoms
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: '#111827',
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
    </>
  );
}

// ── Offer Card ────────────────────────────────────────────────────────────────

function OfferCard({
  offer,
  unit,
  isCheapest,
  submitting,
  onSelect,
}: {
  offer: SupplierOffer;
  unit: MaterialUnit;
  isCheapest: boolean;
  submitting: boolean;
  onSelect: () => void;
}) {
  return (
    <View style={[oc.card, isCheapest && oc.cardBest]}>
      {/* Product image strip */}
      {offer.images && offer.images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 10 }}
          contentContainerStyle={{ gap: 6 }}
        >
          {offer.images.slice(0, 5).map((uri, i) => (
            <Image key={i} source={{ uri }} style={oc.productImage} resizeMode="cover" />
          ))}
        </ScrollView>
      )}

      <View style={oc.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={oc.supplierName} numberOfLines={1}>
              {offer.supplier.name}
            </Text>
            {isCheapest && (
              <View style={oc.bestBadge}>
                <Star size={10} color="#166534" />
                <Text style={oc.bestText}>Labākais</Text>
              </View>
            )}
          </View>
          {offer.supplier.city ? <Text style={oc.supplierCity}>{offer.supplier.city}</Text> : null}
          {offer.supplier.rating != null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={11}
                  color="#f59e0b"
                  fill={n <= Math.round(offer.supplier.rating!) ? '#f59e0b' : 'transparent'}
                />
              ))}
              <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 2 }}>
                {offer.supplier.rating!.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={oc.price}>€{offer.totalPrice.toFixed(2)}</Text>
          <Text style={oc.priceUnit}>
            €{offer.effectiveUnitPrice.toFixed(2)} / {UNIT_SHORT[unit]}
          </Text>
          {offer.deliveryFee != null ? (
            <Text style={[oc.priceUnit, { color: '#6b7280' }]}>
              + €{offer.deliveryFee.toFixed(2)} piegāde
            </Text>
          ) : null}
        </View>
      </View>

      <View style={oc.meta}>
        {offer.distanceKm !== null && offer.distanceKm !== undefined ? (
          <View style={oc.metaItem}>
            <Truck size={13} color="#6b7280" />
            <Text style={oc.metaText}>{offer.distanceKm.toFixed(0)} km</Text>
          </View>
        ) : null}
        <View style={oc.metaItem}>
          <Clock size={13} color="#6b7280" />
          <Text style={oc.metaText}>{offer.etaLabel ?? `${offer.etaDays} d.`}</Text>
        </View>
        {offer.isInstant ? (
          <View style={oc.metaItem}>
            <ZapIcon size={13} color="#d97706" />
            <Text style={[oc.metaText, { color: '#d97706', fontWeight: '600' }]}>Tūlītējs</Text>
          </View>
        ) : null}
        {offer.completionRate !== null && offer.completionRate !== undefined ? (
          <View
            style={[
              oc.metaItem,
              {
                backgroundColor:
                  offer.completionRate >= 90
                    ? '#f0fdf4'
                    : offer.completionRate >= 75
                      ? '#fefce8'
                      : '#fef2f2',
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              },
            ]}
          >
            <Text
              style={[
                oc.metaText,
                {
                  color:
                    offer.completionRate >= 90
                      ? '#166534'
                      : offer.completionRate >= 75
                        ? '#854d0e'
                        : '#991b1b',
                  fontWeight: '600',
                },
              ]}
            >
              {offer.completionRate}% izpilde
            </Text>
          </View>
        ) : null}
        {offer.minOrder ? (
          <View style={oc.metaItem}>
            <Text style={oc.metaText}>
              Min: {offer.minOrder} {UNIT_SHORT[unit] ?? unit}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Stock availability pill */}
      {offer.stockQty != null && (
        <View style={oc.stockRow}>
          <Package size={12} color={offer.stockQty > 0 ? '#16a34a' : '#dc2626'} />
          <Text style={[oc.stockText, { color: offer.stockQty > 0 ? '#16a34a' : '#dc2626' }]}>
            {offer.stockQty > 0
              ? `${offer.stockQty} ${UNIT_SHORT[unit] ?? unit} noliktavā`
              : 'Nav noliktavā'}
          </Text>
        </View>
      )}

      {/* Volume price tiers */}
      {offer.priceTiers && offer.priceTiers.length > 0 && (
        <View style={{ marginTop: 8, marginBottom: 2 }}>
          <Text
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              fontFamily: 'Inter_600SemiBold',
              marginBottom: 4,
            }}
          >
            APJOMA ATLAIDES
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {offer.priceTiers.map((tier) => (
              <View
                key={tier.minQty}
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: '#374151', fontFamily: 'Inter_500Medium' }}>
                  ≥{tier.minQty} {UNIT_SHORT[unit] ?? unit} → €{tier.unitPrice.toFixed(2)}/
                  {UNIT_SHORT[unit] ?? unit}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[oc.btn, submitting && { opacity: 0.6 }]}
        onPress={onSelect}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={oc.btnText}>Izvēlēties šo piedāvājumu</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Specs step ──
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4F5F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  catBadgeMin: {
    backgroundColor: '#F4F5F7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  catBadgeTextMin: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#6b7280' },

  // ── Dropdown button ──
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 6,
  },
  dropdownBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },

  // ── Truck cards ──
  truckCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
    position: 'relative',
  },
  truckCardActive: {
    backgroundColor: '#ffffff',
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  truckCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#6B7280',
  },
  truckLabelActive: {
    color: '#111827',
  },
  truckSub: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#9CA3AF',
  },

  // ── BottomSheet picker rows ──
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F5F7',
  },
  sheetItemText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  sheetItemTextActive: {
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },

  // ── Line style inputs ──
  lineFieldWrap: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  lineFieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  lineFieldBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  lineFieldValue: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
    letterSpacing: -0.2,
  },

  // ── Plain section title ──
  sectionTitleCenter: {
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#4B5563',
    marginBottom: 6,
  },

  // ── Truck flat cards ──
  truckCardPlain: {
    alignItems: 'center',
    gap: 8,
  },
  truckImageWrap: {
    position: 'relative',
  },
  truckCheckCircle: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981', // green like attachment
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  truckLabelPlain: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#4B5563',
  },
  truckSubPlain: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
  },

  // ── Line Stepper ──
  stepperLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
  },
  stepBtnDark: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#312e81', // dark purple like attachment
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueBox: {
    minWidth: 100,
    height: 60,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueLine: {
    fontSize: 32,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
  },

  field: { gap: 10 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af', // lighter label since the form is focused
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18, // taller tap target
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },

  // ── Quantity stepper ──
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 12,
  },
  stepBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  stepperValueWrap: { minWidth: 100, alignItems: 'center' },
  stepperValue: {
    fontSize: 72, // Mega large quantity size
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
    letterSpacing: -2.5,
    includeFontPadding: false,
  },

  // ── Unit Toggle ──
  unitToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#F4F5F7',
    borderRadius: 16,
    padding: 6,
    marginTop: 16,
  },
  unitToggleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  unitToggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  unitToggleText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af',
  },
  unitToggleTextActive: {
    color: '#111827',
  },

  // ── When step ──
  stepSub: { fontSize: 15, color: '#6b7280', fontFamily: 'Inter_500Medium', lineHeight: 22 },
  asapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  asapCardActive: {
    backgroundColor: '#ffffff',
    borderColor: '#111827',
    borderWidth: 2,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  asapIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  asapIconActive: { backgroundColor: '#F4F5F7', shadowOpacity: 0, elevation: 0 },
  asapTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  asapTitleActive: { color: '#111827' },
  asapSub: { fontSize: 13, color: '#6b7280', marginTop: 2, fontFamily: 'Inter_500Medium' },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F4F5F7',
    borderRadius: 12,
    marginTop: 8,
  },
  hintText: { fontSize: 13, color: '#4b5563', lineHeight: 18, fontFamily: 'Inter_500Medium' },
  etaHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  etaHintText: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // ── Calculator ──
  calcWrap: {
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    overflow: 'hidden',
  },
  calcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  calcHeaderText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#6b7280',
  },
  calcBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  calcHint: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
  calcRow: {
    flexDirection: 'row',
    gap: 8,
  },
  calcField: { flex: 1, gap: 4 },
  calcFieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  calcInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  calcResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  calcResultLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  calcResultValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginTop: 2,
  },
  calcResultSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
  },
  calcApplyBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  calcApplyText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#ffffff',
  },

  // ── Offers step ──
  offersTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  offersSub: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter_500Medium',
    marginTop: -8,
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  sortPillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  sortPillText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#6b7280',
  },
  sortPillTextActive: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  rfqBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
  },
  rfqIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfqTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  rfqSub: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginTop: 4,
    fontFamily: 'Inter_500Medium',
  },
  rfqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 100,
    backgroundColor: '#F4F5F7',
  },
  rfqBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#111827' },

  // ── Success state ──
  successWrap: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  successIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  successNum: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#6b7280' },
  successSub: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 16,
    fontFamily: 'Inter_500Medium',
  },
  summaryCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  summaryText: { flex: 1, fontSize: 15, color: '#111827', fontFamily: 'Inter_500Medium' },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F4F5F7',
    marginHorizontal: 16,
  },
});

// ── Offer card styles ──────────────────────────────────────────────────────────

const oc = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardBest: { borderColor: '#111827' },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  supplierName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  supplierCity: { fontSize: 14, color: '#6b7280', marginTop: 2, fontFamily: 'Inter_500Medium' },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bestText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: '#6b7280', fontFamily: 'Inter_500Medium' },
  btn: {
    margin: 12,
    marginTop: 0,
    backgroundColor: '#F4F5F7',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  productImage: {
    width: 80,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    marginBottom: 2,
  },
  stockText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
