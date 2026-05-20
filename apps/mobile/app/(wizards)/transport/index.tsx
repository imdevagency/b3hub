/**
 * Transport wizard — full-screen step pages.
 *
 *   Step 1 – Pickup address  (inline map)
 *   Step 2 – Dropoff address (inline map)
 *   Step 3 – Vehicle + cargo + weight
 *   Step 4 – Date + route summary + contact/notes
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Bookmark,
  Check,
  Weight,
  ChevronRight,
  Search,
  ArrowUpDown,
  MapPin,
  ArrowRight,
  X,
  Truck,
} from 'lucide-react-native';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTransport } from '@/lib/transport-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { TransportVehicleType } from '@/lib/api';
import { fetchVehicleCategories } from '@/lib/api/catalogue';
import { useRoute, BaseMap, RouteLayer, PinLayer } from '@/components/map';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import { AddressPicker } from '@/components/ui/AddressPicker';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { useToast } from '@/components/ui/Toast';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';
import { WizardSummaryCard } from '@/components/wizard/WizardSummaryCard';
import { WizardTimeWindowPicker } from '@/components/wizard/WizardTimeWindowPicker';
import { WizardRouteBox } from '@/components/wizard/WizardRouteBox';
import { WizardSectionHeading } from '@/components/wizard/WizardSectionHeading';
import { WizardContactFields } from '@/components/wizard/WizardContactFields';
import { colors } from '@/lib/theme';
import { haptics } from '@/lib/haptics';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';
import { GuestOrderSuccess } from '@/components/wizard/GuestOrderSuccess';

// ── Types ─────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;
type Stop = { lat: number; lng: number };

// ── Constants ─────────────────────────────────────────────────────
const VEHICLE_OPTIONS: {
  type: TransportVehicleType;
  label: string;
  sub: string;
  fromPrice: number;
  pricePerKm: number;
}[] = [
  {
    type: 'DUMP_TRUCK_10T',
    label: 'Mazā pašizgāzēja',
    sub: 'līdz 10 t · 8 m³',
    fromPrice: 89,
    pricePerKm: 1.5,
  },
  {
    type: 'DUMP_TRUCK_18T',
    label: 'Lielā pašizgāzēja',
    sub: 'līdz 18 t · 14 m³',
    fromPrice: 149,
    pricePerKm: 2.0,
  },
  {
    type: 'DUMP_TRUCK_26T',
    label: 'Puspiekabe',
    sub: 'līdz 26 t · 22 m³',
    fromPrice: 219,
    pricePerKm: 3.0,
  },
  {
    type: 'FLATBED_TRUCK',
    label: 'Platforma',
    sub: 'līdz 20 t · garums 13.6 m',
    fromPrice: 199,
    pricePerKm: 2.5,
  },
];

const CARGO_PRESETS = [
  'Būvgruži',
  'Smiltis/Grants',
  'Materiāli',
  'Iekārtas',
  'Paletes',
  'Koks/Dēļi',
  'Metāls/Lūžņi',
  'Mēbeles',
  'Cits',
];

function buildDays(count = 14) {
  const days: { iso: string; dow: string; day: string; mon: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().split('T')[0],
      dow: d.toLocaleDateString('lv-LV', { weekday: 'short' }),
      day: String(d.getDate()),
      mon: d.toLocaleDateString('lv-LV', { month: 'short' }),
    });
  }
  return days;
}

const DAY_OPTIONS = buildDays();

// ── Draft persistence ────────────────────────────────────────────
const TRANSPORT_DRAFT_KEY = '@b3hub_transport_draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface TransportDraft {
  step: Step;
  selectedVehicle: TransportVehicleType | null;
  activeDesc: string;
  otherText: string;
  weightText: string;
  selectedDay: string;
  pickupWindow: 'ANY' | 'AM' | 'PM';
  siteContactName: string;
  siteContactPhone: string;
  receiverContactName: string;
  receiverContactPhone: string;
  specialRequirements: string[];
  notes: string;
  offeredRateText: string;
  truckCount: number;
  pricingMode: 'FLAT' | 'PER_TONNE';
  pricePerTonneText: string;
  pickupPicked: PickedAddress | null;
  dropoffPicked: PickedAddress | null;
  savedAt: number;
}

// ── Component ─────────────────────────────────────────────────────
export default function TransportWizard() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const toast = useToast();
  const {
    state,
    setPickup,
    setDropoff,
    setVehicleType,
    setLoadDescription,
    setEstimatedWeight,
    setRequestedDate,
    reset,
  } = useTransport();
  const { user, token } = useAuth();

  // ── Wizard state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  const [pickupPicked, setPickupPicked] = useState<PickedAddress | null>(null);
  const [dropoffPicked, setDropoffPicked] = useState<PickedAddress | null>(null);
  const [pickupPickerOpen, setPickupPickerOpen] = useState(false);
  const [dropoffPickerOpen, setDropoffPickerOpen] = useState(false);
  const [pickupStop, setPickupStop] = useState<Stop | null>(null);
  const [dropoffStop, setDropoffStop] = useState<Stop | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<TransportVehicleType | null>(null);
  const [activeDesc, setActiveDesc] = useState('');
  const [otherText, setOtherText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>(DAY_OPTIONS[0].iso);
  const [pickupWindow, setPickupWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');

  const [truckCount, setTruckCount] = useState(1);
  const [pricingMode, setPricingMode] = useState<'FLAT' | 'PER_TONNE'>('FLAT');
  const [pricePerTonneText, setPricePerTonneText] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [dispatchMode, setDispatchMode] = useState<'SCHEDULED' | 'ON_DEMAND'>('SCHEDULED');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [guestResult, setGuestResult] = useState<{ token: string; orderNumber: string } | null>(
    null,
  );
  const [savePickup, setSavePickup] = useState(false);
  const [saveDropoff, setSaveDropoff] = useState(false);
  const [siteContactName, setSiteContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [siteContactPhone, setSiteContactPhone] = useState(() => user?.phone ?? '');
  const [receiverContactName, setReceiverContactName] = useState('');
  const [receiverContactPhone, setReceiverContactPhone] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [offeredRateText, setOfferedRateText] = useState('');

  // ── Route (for step 3 summary) ────────────────────────────────
  const { route } = useRoute(
    step >= 2 && pickupStop ? pickupStop : null,
    step >= 2 && dropoffStop ? dropoffStop : null,
  );

  const [vehicleOptions, setVehicleOptions] = useState(VEHICLE_OPTIONS);

  const currentVehicle = vehicleOptions.find((v) => v.type === selectedVehicle);
  const currentVehiclePrice = currentVehicle?.fromPrice;

  // ── Smart vehicle suggestion ──────────────────────────────────
  const suggestedVehicle = useMemo<TransportVehicleType | null>(() => {
    const weightTonnes = weightText ? parseFloat(weightText) : null;
    const cargo = activeDesc === 'Cits' ? otherText : activeDesc;
    if (weightTonnes !== null && !isNaN(weightTonnes)) {
      if (weightTonnes <= 10.0) return 'DUMP_TRUCK_10T';
      if (weightTonnes <= 18.0) return 'DUMP_TRUCK_18T';
      return 'DUMP_TRUCK_26T';
    }
    if (cargo === 'Iekārtas') return 'FLATBED_TRUCK';
    if (cargo === 'Koks/Dēļi') return 'FLATBED_TRUCK';
    if (cargo === 'Smiltis/Grants' || cargo === 'Būvgruži' || cargo === 'Metāls/Lūžņi')
      return 'DUMP_TRUCK_10T';
    return null;
  }, [weightText, activeDesc, otherText]);

  // Auto-select suggested vehicle if user hasn't manually picked one yet
  useEffect(() => {
    if (suggestedVehicle && !selectedVehicle) {
      setSelectedVehicle(suggestedVehicle);
      setVehicleType(suggestedVehicle);
    }
  }, [suggestedVehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync contact fields when user authenticates mid-wizard
  useEffect(() => {
    if (!user) return;
    if (!siteContactName.trim())
      setSiteContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!siteContactPhone.trim()) setSiteContactPhone(user.phone ?? '');
  }, [user?.id]);

  // ── Draft: restore from AsyncStorage on mount ──
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(TRANSPORT_DRAFT_KEY)
      .then((raw) => {
        if (!raw) {
          draftLoadedRef.current = true;
          return;
        }
        try {
          const d: TransportDraft = JSON.parse(raw);
          if (d.savedAt && Date.now() - d.savedAt > DRAFT_TTL_MS) {
            AsyncStorage.removeItem(TRANSPORT_DRAFT_KEY).catch(() => {});
            draftLoadedRef.current = true;
            return;
          }
          if (d.step) setStep(d.step);
          if (d.selectedVehicle) setSelectedVehicle(d.selectedVehicle);
          if (d.activeDesc) setActiveDesc(d.activeDesc);
          if (d.otherText) setOtherText(d.otherText);
          if (d.weightText) setWeightText(d.weightText);
          if (d.selectedDay) setSelectedDay(d.selectedDay);
          if (d.pickupWindow) setPickupWindow(d.pickupWindow);
          if (d.siteContactName !== undefined) setSiteContactName(d.siteContactName);
          if (d.siteContactPhone !== undefined) setSiteContactPhone(d.siteContactPhone);
          if (d.receiverContactName !== undefined) setReceiverContactName(d.receiverContactName);
          if (d.receiverContactPhone !== undefined) setReceiverContactPhone(d.receiverContactPhone);
          if (d.specialRequirements) setSpecialRequirements(d.specialRequirements);
          if (d.notes !== undefined) setNotes(d.notes);
          if (d.offeredRateText) setOfferedRateText(d.offeredRateText);
          if (d.truckCount) setTruckCount(d.truckCount);
          if (d.pricingMode) setPricingMode(d.pricingMode);
          if (d.pricePerTonneText) setPricePerTonneText(d.pricePerTonneText);
          if (d.pickupPicked) {
            setPickupPicked(d.pickupPicked);
            setPickupStop({ lat: d.pickupPicked.lat, lng: d.pickupPicked.lng });
            setPickup(
              d.pickupPicked.address,
              d.pickupPicked.city ?? '',
              d.pickupPicked.lat,
              d.pickupPicked.lng,
            );
          }
          if (d.dropoffPicked) {
            setDropoffPicked(d.dropoffPicked);
            setDropoffStop({ lat: d.dropoffPicked.lat, lng: d.dropoffPicked.lng });
            setDropoff(
              d.dropoffPicked.address,
              d.dropoffPicked.city ?? '',
              d.dropoffPicked.lat,
              d.dropoffPicked.lng,
            );
          }
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

  // ── Draft: save progressively ──
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    const draft: TransportDraft = {
      step,
      selectedVehicle,
      activeDesc,
      otherText,
      weightText,
      selectedDay,
      pickupWindow,
      siteContactName,
      siteContactPhone,
      receiverContactName,
      receiverContactPhone,
      specialRequirements,
      notes,
      offeredRateText,
      truckCount,
      pricingMode,
      pricePerTonneText,
      pickupPicked,
      dropoffPicked,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(TRANSPORT_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [
    step,
    selectedVehicle,
    activeDesc,
    otherText,
    weightText,
    selectedDay,
    pickupWindow,
    siteContactName,
    siteContactPhone,
    receiverContactName,
    receiverContactPhone,
    specialRequirements,
    notes,
    offeredRateText,
    truckCount,
    pricingMode,
    pricePerTonneText,
    dropoffPicked,
  ]);

  // ── Load vehicle categories from catalogue ─────────────────
  useEffect(() => {
    fetchVehicleCategories()
      .then((cats) => {
        if (!cats.length) return;
        setVehicleOptions(
          cats.map((cat) => ({
            type: cat.code as TransportVehicleType,
            label: cat.labelLv ?? cat.label,
            sub: cat.descriptionLv ?? cat.description ?? '',
            fromPrice: cat.fromPrice ?? 0,
            pricePerKm: cat.pricePerKm ?? 0,
          })),
        );
      })
      .catch(() => {
        /* keep hardcoded fallback */
      });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────
  const handlePickupConfirm = useCallback(
    (p: PickedAddress) => {
      setPickupPicked(p);
      setPickupStop({ lat: p.lat, lng: p.lng });
      setPickup(p.address, p.city, p.lat, p.lng);
    },
    [setPickup],
  );

  const handleDropoffConfirm = useCallback(
    (p: PickedAddress) => {
      setDropoffPicked(p);
      setDropoffStop({ lat: p.lat, lng: p.lng });
      setDropoff(p.address, p.city, p.lat, p.lng);
    },
    [setDropoff],
  );

  const swapAddresses = useCallback(() => {
    const tempPicked = pickupPicked;
    const tempStop = pickupStop;
    setPickupPicked(dropoffPicked);
    setPickupStop(dropoffStop);
    setDropoffPicked(tempPicked);
    setDropoffStop(tempStop);
    if (dropoffPicked) {
      setPickup(
        dropoffPicked.address,
        dropoffPicked.city ?? '',
        dropoffPicked.lat,
        dropoffPicked.lng,
      );
    }
    if (tempPicked) {
      setDropoff(tempPicked.address, tempPicked.city ?? '', tempPicked.lat, tempPicked.lng);
    }
    haptics.light();
  }, [pickupPicked, dropoffPicked, pickupStop, dropoffStop, setPickup, setDropoff]);

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    } else setStep((s) => (s - 1) as Step);
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    if (!user || !token || !pickupStop || !dropoffStop || !selectedVehicle) return;
    if (submittingRef.current) return;
    setSubmitting(true);
    submittingRef.current = true;
    try {
      const resolvedDesc = activeDesc === 'Cits' ? otherText.trim() || 'Cits' : activeDesc;
      // quotedRate is required by the backend DTO (@IsNumber @Min(0)). Derive from
      // the route-adjusted estimate, falling back to the vehicle base price.
      const quotedRate = currentVehicle
        ? route
          ? Math.round(currentVehicle.fromPrice + route.distanceKm * currentVehicle.pricePerKm)
          : currentVehicle.fromPrice
        : 0;
      const parsedPricePerTonne = parseFloat(pricePerTonneText);
      const job = await api.transport.create(
        {
          pickupAddress: pickupPicked?.address ?? '',
          pickupCity: state.pickupCity,
          pickupLat: pickupStop.lat,
          pickupLng: pickupStop.lng,
          dropoffAddress: dropoffPicked?.address ?? '',
          dropoffCity: state.dropoffCity,
          dropoffLat: dropoffStop.lat,
          dropoffLng: dropoffStop.lng,
          vehicleType: selectedVehicle,
          loadDescription: resolvedDesc,
          estimatedWeight: weightText ? parseFloat(weightText) : undefined,
          requestedDate: selectedDay || new Date().toISOString().split('T')[0],
          pickupWindow: pickupWindow !== 'ANY' ? pickupWindow : undefined,
          siteContactName: siteContactName || undefined,
          siteContactPhone: siteContactPhone || undefined,
          receiverContactName: receiverContactName || undefined,
          receiverContactPhone: receiverContactPhone || undefined,
          specialRequirements:
            specialRequirements.length > 0 ? specialRequirements.join(',') : undefined,
          notes: notes || undefined,
          quotedRate,
          buyerOfferedRate:
            pricingMode === 'FLAT' && offeredRateText ? parseFloat(offeredRateText) : undefined,
          pricingMode,
          pricePerTonne:
            pricingMode === 'PER_TONNE' && !isNaN(parsedPricePerTonne)
              ? parsedPricePerTonne
              : undefined,
          truckCount: truckCount > 1 ? truckCount : undefined,
          projectId: projectId || undefined,
          dispatchMode,
        },
        token,
      );
      const jn = job.jobNumber ?? job.id.slice(0, 8).toUpperCase();
      // Save addresses if opted in
      if (savePickup && pickupPicked && token) {
        api.savedAddresses
          .create(
            {
              label: pickupPicked.address.split(',')[0],
              address: pickupPicked.address,
              city: pickupPicked.city ?? '',
              lat: pickupPicked.lat,
              lng: pickupPicked.lng,
            },
            token,
          )
          .catch(() => {});
      }
      if (saveDropoff && dropoffPicked && token) {
        api.savedAddresses
          .create(
            {
              label: dropoffPicked.address.split(',')[0],
              address: dropoffPicked.address,
              city: dropoffPicked.city ?? '',
              lat: dropoffPicked.lat,
              lng: dropoffPicked.lng,
            },
            token,
          )
          .catch(() => {});
      }
      reset();
      AsyncStorage.removeItem(TRANSPORT_DRAFT_KEY).catch(() => {});
      router.replace({
        pathname: '/transport/confirmation' as never,
        params: {
          jobNumber: jn,
          pickupAddress: pickupPicked?.address ?? '',
          pickupCity: state.pickupCity ?? '',
          dropoffAddress: dropoffPicked?.address ?? '',
          dropoffCity: state.dropoffCity ?? '',
          vehicleType: selectedVehicle,
          requestedDate: selectedDay,
          cargo: activeDesc === 'Cits' ? otherText : activeDesc || '—',
          estimatedPrice: currentVehiclePrice
            ? route && currentVehicle
              ? `~€${Math.round(currentVehicle.fromPrice + route.distanceKm * currentVehicle.pricePerKm)}`
              : `no €${currentVehiclePrice}`
            : '',
        },
      } as never);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Neizdevās izveidot pasūtījumu');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [
    user,
    token,
    pickupStop,
    dropoffStop,
    selectedVehicle,
    route,
    activeDesc,
    otherText,
    weightText,
    selectedDay,
    pickupWindow,
    pickupPicked,
    dropoffPicked,
    state,
    siteContactName,
    siteContactPhone,
    receiverContactName,
    receiverContactPhone,
    specialRequirements,
    notes,
    savePickup,
    saveDropoff,
    reset,
    truckCount,
    pricingMode,
    offeredRateText,
    pricePerTonneText,
  ]);

  // ── Guest submit handler ─────────────────────────────────────────────────
  const handleGuestSubmit = useCallback(
    async (contact: { name: string; phone: string; email?: string }) => {
      if (!pickupPicked || !dropoffPicked || !selectedVehicle) return;
      if (submittingRef.current) return;
      setSubmitting(true);
      submittingRef.current = true;
      try {
        const resolvedDesc = activeDesc === 'Cits' ? otherText.trim() || 'Cits' : activeDesc;
        const result = await api.guestOrders.create({
          category: 'TRANSPORT',
          pickupAddress: pickupPicked.address,
          pickupCity: pickupPicked.city ?? '',
          pickupLat: pickupPicked.lat,
          pickupLng: pickupPicked.lng,
          deliveryAddress: dropoffPicked.address,
          deliveryCity: dropoffPicked.city ?? '',
          deliveryLat: dropoffPicked.lat,
          deliveryLng: dropoffPicked.lng,
          vehicleType: selectedVehicle,
          cargoDescription: resolvedDesc || undefined,
          estimatedWeight: weightText ? parseFloat(weightText) : undefined,
          deliveryDate: selectedDay,
          deliveryWindow: pickupWindow !== 'ANY' ? pickupWindow : undefined,
          contactName: contact.name,
          contactPhone: contact.phone,
          contactEmail: contact.email,
          notes: notes || undefined,
        });
        haptics.success();
        setGuestResult({ token: result.token, orderNumber: result.orderNumber });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt pieprasījumu.');
      } finally {
        setSubmitting(false);
        submittingRef.current = false;
      }
    },
    [
      pickupPicked,
      dropoffPicked,
      selectedVehicle,
      activeDesc,
      otherText,
      weightText,
      selectedDay,
      pickupWindow,
      notes,
    ],
  );

  const step2Valid =
    selectedVehicle !== null &&
    (activeDesc !== '' && activeDesc !== 'Cits'
      ? true
      : activeDesc === 'Cits' && otherText.trim() !== '');
  const step3Valid = dispatchMode === 'ON_DEMAND' || !!selectedDay;
  const step4Valid =
    (user
      ? true // logged-in: contact comes from profile
      : !!siteContactName.trim() && siteContactPhone.trim().replace(/\D/g, '').length >= 8) &&
    (pricingMode !== 'PER_TONNE' ||
      (!!pricePerTonneText.trim() && !isNaN(parseFloat(pricePerTonneText))));

  // Detect identical pickup/dropoff coordinates
  const sameAddress =
    !!pickupStop &&
    !!dropoffStop &&
    pickupStop.lat === dropoffStop.lat &&
    pickupStop.lng === dropoffStop.lng;

  const ctaDisabled =
    (step === 1 && (!pickupPicked || !dropoffPicked || sameAddress)) ||
    (step === 2 && !step2Valid) ||
    (step === 3 && !step3Valid) ||
    (step === 4 && !step4Valid) ||
    submitting;

  const estimatedPrice =
    currentVehicle && route
      ? `~€${Math.round(currentVehicle.fromPrice + route.distanceKm * currentVehicle.pricePerKm)}`
      : currentVehiclePrice
        ? `no €${currentVehiclePrice}`
        : null;

  const ctaLabel =
    step === 4
      ? estimatedPrice
        ? `Nosūtīt pieprasījumu${truckCount > 1 ? ` ${truckCount}×` : ''} — ${estimatedPrice}`
        : 'Nosūtīt pieprasījumu'
      : 'Turpināt';

  const onCTA = useCallback(() => {
    if (step === 4) {
      if (!user) {
        setShowAuthGate(true);
        return;
      }
      handleSubmit();
      return;
    }
    haptics.medium();
    setStep((s) => (s + 1) as Step);
  }, [step, user, handleSubmit]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'Maršruts',
    2: 'Izvēlies transportu',
    3: 'Servisa veids',
    4: 'Apstiprini pasūtījumu',
  };

  // ── Guest success screen ──────────────────────────────────────────────────
  if (guestResult) {
    return (
      <GuestOrderSuccess
        orderNumber={guestResult.orderNumber}
        guestToken={guestResult.token}
        category="TRANSPORT"
        onBack={() => router.replace('/(buyer)/home' as never)}
      />
    );
  }

  // ── B2B gate — logged-in personal accounts cannot place freight orders ────
  if (user && !user.isCompany) {
    return (
      <ScreenContainer>
        <ScreenHeader
          title="Kravu pārvadājumi"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(buyer)/home' as never);
          }}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#f3f4f6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <Truck size={32} color="#6b7280" />
          </View>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 20,
              color: '#111827',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            Tikai uzņēmumiem
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 15,
              color: '#6b7280',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 32,
            }}
          >
            Kravu pārvadājumu pakalpojums ir pieejams tikai reģistrētiem uzņēmumiem. Reģistrē savu
            uzņēmumu, lai turpinātu.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(buyer)/profile' as never)}
            style={{
              backgroundColor: '#111827',
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 32,
            }}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' }}>
              Pievienot uzņēmumu
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <>
      <WizardLayout
        title={STEP_TITLES[step]}
        step={step}
        totalSteps={4}
        onBack={goBack}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(buyer)/home' as never);
        }}
        ctaLabel={ctaLabel}
        onCTA={onCTA}
        ctaDisabled={ctaDisabled}
        ctaLoading={submitting}
        stepKey={step}
      >
        {/* ── Step 1: Route (pickup + dropoff combined) ── */}
        {step === 1 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ paddingHorizontal: 20 }}>
              {/* Uber-style absolute-precision route card */}
              <View
                style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: 16,
                  marginBottom: 24,
                  overflow: 'hidden',
                }}
              >
                <View style={{ position: 'relative' }}>
                  {/* Left track: Absolutely positioned so it perfectly aligns regardless of device scaling */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 23,
                      top: 30,
                      bottom: 30,
                      width: 2,
                      backgroundColor: '#d1d5db',
                      zIndex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        position: 'absolute',
                        top: -4,
                        left: -3,
                      }}
                    />
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        backgroundColor: '#111827',
                        position: 'absolute',
                        bottom: -4,
                        left: -3,
                      }}
                    />
                  </View>

                  {/* Right Swap Button: Absolutely positioned right right in the middle */}
                  {(pickupPicked || dropoffPicked) && (
                    <TouchableOpacity
                      onPress={swapAddresses}
                      style={{
                        position: 'absolute',
                        right: 16,
                        top: 64 - 18,
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: '#f3f4f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 3,
                        elevation: 3,
                        zIndex: 10,
                      }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <ArrowUpDown size={15} color="#111827" />
                    </TouchableOpacity>
                  )}

                  <View>
                    {/* Row 1: Pickup */}
                    <View
                      style={{
                        height: 64,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingLeft: 48,
                        paddingRight: pickupPicked || dropoffPicked ? 56 : 16,
                      }}
                    >
                      <TouchableOpacity
                        style={{ flex: 1, height: '100%', justifyContent: 'center' }}
                        onPress={() => setPickupPickerOpen(true)}
                        activeOpacity={0.7}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 16,
                            color: pickupPicked ? '#111827' : '#9ca3af',
                            fontWeight: pickupPicked ? '600' : '500',
                          }}
                        >
                          {pickupPicked ? pickupPicked.address : 'Iekraušanas vieta...'}
                        </Text>
                      </TouchableOpacity>
                      {pickupPicked && (
                        <TouchableOpacity
                          onPress={() => {
                            haptics.light();
                            setPickupPicked(null);
                          }}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={{ marginLeft: 8 }}
                        >
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: '#e5e7eb',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <X size={14} color="#6b7280" />
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: '#e5e7eb', marginLeft: 48 }} />

                    {/* Row 2: Dropoff */}
                    <View
                      style={{
                        height: 64,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingLeft: 48,
                        paddingRight: pickupPicked || dropoffPicked ? 56 : 16,
                      }}
                    >
                      <TouchableOpacity
                        style={{ flex: 1, height: '100%', justifyContent: 'center' }}
                        onPress={() => setDropoffPickerOpen(true)}
                        activeOpacity={0.7}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 16,
                            color: dropoffPicked ? '#111827' : '#9ca3af',
                            fontWeight: dropoffPicked ? '600' : '500',
                          }}
                        >
                          {dropoffPicked ? dropoffPicked.address : 'Kāds ir galamērķis?'}
                        </Text>
                      </TouchableOpacity>
                      {dropoffPicked && (
                        <TouchableOpacity
                          onPress={() => {
                            haptics.light();
                            setDropoffPicked(null);
                          }}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={{ marginLeft: 8 }}
                        >
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: '#e5e7eb',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <X size={14} color="#6b7280" />
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {sameAddress && (
                <View
                  style={{
                    backgroundColor: '#fef2f2',
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#fecaca',
                    marginBottom: 20,
                  }}
                >
                  <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '500' }}>
                    Izkraušanas adresei jāatšķiras no iekraušanas adreses.
                  </Text>
                </View>
              )}

              {route && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#fff',
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>
                      {'Aptuvenais maršruts'}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                      {`${route.distanceKm.toFixed(1)} km \u00b7 ${route.durationLabel}`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* AddressPicker modals — rendered at wizard level, not inside ScrollView */}
        {pickupPickerOpen && (
          <AddressPicker
            visible={pickupPickerOpen}
            title="Ielādes adrese"
            initialAddress={pickupPicked?.address}
            initialLat={pickupPicked?.lat}
            initialLng={pickupPicked?.lng}
            pinColor="#111827"
            onConfirm={(loc) => {
              handlePickupConfirm({
                address: loc.address,
                lat: loc.lat,
                lng: loc.lng,
                city: loc.city || '',
              });
              setPickupPickerOpen(false);
            }}
            onClose={() => setPickupPickerOpen(false)}
          />
        )}
        {dropoffPickerOpen && (
          <AddressPicker
            visible={dropoffPickerOpen}
            title="Izkraušanas adrese"
            initialAddress={dropoffPicked?.address}
            initialLat={dropoffPicked?.lat}
            initialLng={dropoffPicked?.lng}
            pinColor="#111827"
            onConfirm={(loc) => {
              handleDropoffConfirm({
                address: loc.address,
                lat: loc.lat,
                lng: loc.lng,
                city: loc.city || '',
              });
              setDropoffPickerOpen(false);
            }}
            onClose={() => setDropoffPickerOpen(false)}
          />
        )}

        {/* ── Step 2: Vehicle + Cargo ── */}
        {step === 2 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.routeLiteCard}>
              <WizardRouteBox
                pickup={pickupPicked?.address ?? 'Iekraušanas adrese nav izvēlēta'}
                dropoff={dropoffPicked?.address ?? 'Izkraušanas adrese nav izvēlēta'}
              />
              {route && (
                <Text
                  style={[s.routeMeta, { textAlign: 'center', marginTop: 4, letterSpacing: 0.5 }]}
                >
                  {route.distanceKm.toFixed(1)} km · {route.durationLabel}
                </Text>
              )}
            </View>

            <Text
              style={{
                fontSize: 24,
                fontWeight: '700',
                color: '#111827',
                marginTop: 12,
                marginBottom: 16,
                letterSpacing: -0.5,
              }}
            >
              Transportdarba detaļas
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
              Atrodi īsto auto
            </Text>
            <View style={{ gap: 10, marginBottom: 32 }}>
              {vehicleOptions.map((v) => {
                const isSel = selectedVehicle === v.type;
                const isSuggested = suggestedVehicle === v.type;
                return (
                  <TouchableOpacity
                    key={v.type}
                    style={[
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#fff',
                        borderRadius: 16,
                        padding: 14,
                        minHeight: 80,
                        borderWidth: isSel ? 2.5 : 1,
                        borderColor: isSel ? '#111827' : '#e5e7eb',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isSel ? 0 : 0.04,
                        shadowRadius: 6,
                        elevation: isSel ? 0 : 1,
                      },
                    ]}
                    onPress={() => {
                      haptics.light();
                      setSelectedVehicle(v.type);
                      setVehicleType(v.type);
                    }}
                    activeOpacity={0.75}
                  >
                    {isSuggested && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -9,
                          left: 12,
                          backgroundColor: '#1a362a',
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          zIndex: 1,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
                          ⚡ Ieteiktais
                        </Text>
                      </View>
                    )}
                    <View style={{ width: 64, alignItems: 'center', justifyContent: 'center' }}>
                      <TruckIllustration type={v.type} />
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: '#111827',
                          marginBottom: 2,
                        }}
                      >
                        {v.label}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#6b7280' }}>{v.sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                      {route ? (
                        <>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                            ~€{Math.round(v.fromPrice + route.distanceKm * v.pricePerKm)}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: '#6b7280',
                              marginTop: 2,
                            }}
                          >
                            {route.distanceKm.toFixed(0)} km
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                            no €{v.fromPrice}
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
              Kas tiks vērts?
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 8, paddingRight: 20 }}
            >
              {CARGO_PRESETS.map((c) => {
                const isSel = activeDesc === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: isSel ? '#111827' : '#f3f4f6',
                    }}
                    onPress={() => {
                      haptics.light();
                      setActiveDesc(c);
                      setLoadDescription(c);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={{ fontSize: 14, fontWeight: '600', color: isSel ? '#fff' : '#374151' }}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeDesc === 'Cits' && (
              <TextInputField
                containerStyle={{
                  marginBottom: 16,
                  backgroundColor: '#f3f4f6',
                  borderWidth: 0,
                  borderRadius: 12,
                }}
                placeholder="Aprakstiet kravu (piem., iekārtas, mēbeles, paletes)..."
                value={otherText}
                onChangeText={(t) => {
                  setOtherText(t);
                  setLoadDescription(t || 'Cits');
                }}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}
                >
                  Svars (t)
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f3f4f6',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                  }}
                >
                  <Weight size={16} color="#6b7280" />
                  <TextInput
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      fontSize: 15,
                      fontWeight: '500',
                      color: '#111827',
                    }}
                    placeholder="8.5"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={weightText}
                    onChangeText={(t) => {
                      setWeightText(t);
                      const w = parseFloat(t);
                      if (!isNaN(w)) setEstimatedWeight(w);
                    }}
                  />
                </View>
              </View>

              <View style={{ flex: 1.2 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}
                >
                  Automašīnu skaits
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f3f4f6',
                    borderRadius: 12,
                    padding: 4,
                  }}
                >
                  <TouchableOpacity
                    style={{
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: truckCount > 1 ? '#fff' : 'transparent',
                      borderRadius: 10,
                      shadowColor: truckCount > 1 ? '#000' : 'transparent',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: truckCount > 1 ? 2 : 0,
                    }}
                    onPress={() => setTruckCount((n) => Math.max(1, n - 1))}
                    activeOpacity={0.7}
                    disabled={truckCount <= 1}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        color: truckCount > 1 ? '#111827' : '#9ca3af',
                        lineHeight: 24,
                      }}
                    >
                      −
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                    {truckCount}
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: truckCount < 10 ? '#fff' : 'transparent',
                      borderRadius: 10,
                      shadowColor: truckCount < 10 ? '#000' : 'transparent',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: truckCount < 10 ? 2 : 0,
                    }}
                    onPress={() => setTruckCount((n) => Math.min(10, n + 1))}
                    activeOpacity={0.7}
                    disabled={truckCount >= 10}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        color: truckCount < 10 ? '#111827' : '#9ca3af',
                        lineHeight: 24,
                      }}
                    >
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {truckCount > 1 && (
              <Text
                style={{
                  fontSize: 13,
                  color: '#6b7280',
                  textAlign: 'right',
                  marginTop: -16,
                  marginBottom: 24,
                }}
              >
                {truckCount} atsevišķi pārvadājumi • iekraušana ik 30 min
              </Text>
            )}

            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
              Kā vēlies norēķināties?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(
                [
                  ['FLAT', 'Par reisu'],
                  ['PER_TONNE', 'Par tonnu'],
                ] as const
              ).map(([val, label]) => {
                const isActive = pricingMode === val;
                return (
                  <TouchableOpacity
                    key={val}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: isActive ? '#111827' : '#f3f4f6',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      haptics.light();
                      setPricingMode(val);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: isActive ? '#fff' : '#374151',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Special requirements ── */}
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#111827',
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              Īpašas prasības
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {(
                [
                  { key: 'LIFT_GATE', label: '🔧 Pacēlājs' },
                  { key: 'SIGNATURE', label: '✍️ Paraksts' },
                  { key: 'INSIDE_DELIVERY', label: '🏠 Iekštelpu piegāde' },
                  { key: 'FRAGILE', label: '⚠️ Trausls' },
                ] as const
              ).map(({ key, label }) => {
                const isOn = specialRequirements.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: isOn ? '#111827' : '#f3f4f6',
                      borderWidth: isOn ? 0 : 1,
                      borderColor: '#e5e7eb',
                    }}
                    onPress={() => {
                      haptics.light();
                      setSpecialRequirements((prev) =>
                        isOn ? prev.filter((r) => r !== key) : [...prev, key],
                      );
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: '600', color: isOn ? '#fff' : '#374151' }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Date + time window ── */}
        {step === 3 &&
          (() => {
            const basePrice = currentVehicle
              ? Math.round(
                  currentVehicle.fromPrice + (route?.distanceKm ?? 30) * currentVehicle.pricePerKm,
                )
              : null;
            const hotshotPrice = basePrice ? Math.round(basePrice * 1.35) : null;

            const SERVICE_MODES = [
              {
                val: 'ON_DEMAND' as const,
                icon: '⚡',
                label: 'Tūlītēja piegāde',
                sub: 'Šoferis apstiprina dažu minūtu laikā',
                badge: 'Ātrākais',
                badgeColor: '#1d4ed8',
                price: hotshotPrice ? `~€${hotshotPrice}` : null,
                bullets: [
                  '🚀  Šoferis dodas nekavējoties',
                  '📍  Live tracking kartē',
                  '🔔  ETA paziņojumi',
                ],
              },
              {
                val: 'SCHEDULED' as const,
                icon: '📅',
                label: 'Plānota piegāde',
                sub: 'Rezervē laiku, ietaupi uz cenas',
                badge: 'Labākā cena',
                badgeColor: '#065f46',
                price: basePrice ? `~€${basePrice}` : null,
                bullets: [
                  '💰  Zemāka cena',
                  '📅  Izvēlies datumu un laiku',
                  '🗺️  Maršruts optimizēts',
                ],
              },
            ];

            return (
              <ScrollView
                style={s.content}
                contentContainerStyle={[s.pad, { paddingTop: 24, gap: 14 }]}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{
                    fontSize: 15,
                    color: '#6b7280',
                    marginBottom: 4,
                    lineHeight: 22,
                  }}
                >
                  Izvēlies, kā vēlies saņemt piegādi.
                </Text>

                {SERVICE_MODES.map((mode) => {
                  const isActive = dispatchMode === mode.val;
                  return (
                    <TouchableOpacity
                      key={mode.val}
                      onPress={() => {
                        haptics.light();
                        setDispatchMode(mode.val);
                        if (mode.val === 'ON_DEMAND') {
                          const today = new Date().toISOString().split('T')[0];
                          setSelectedDay(today);
                          setRequestedDate(today);
                        }
                      }}
                      activeOpacity={0.75}
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: 20,
                        padding: 20,
                        borderWidth: isActive ? 2.5 : 1.5,
                        borderColor: isActive ? '#111827' : '#e5e7eb',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isActive ? 0 : 0.05,
                        shadowRadius: 12,
                        elevation: isActive ? 0 : 2,
                      }}
                    >
                      {/* Header row */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          marginBottom: 12,
                        }}
                      >
                        <Text style={{ fontSize: 28, marginRight: 12 }}>{mode.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 17,
                              fontWeight: '800',
                              color: '#111827',
                              letterSpacing: -0.3,
                            }}
                          >
                            {mode.label}
                          </Text>
                          <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                            {mode.sub}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                          {mode.price && (
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>
                              {mode.price}
                            </Text>
                          )}
                          <View
                            style={{
                              backgroundColor: mode.badgeColor,
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              marginTop: 4,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
                              {mode.badge}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Bullet features */}
                      <View style={{ gap: 6 }}>
                        {mode.bullets.map((b) => (
                          <Text key={b} style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>
                            {b}
                          </Text>
                        ))}
                      </View>

                      {/* Inline calendar for SCHEDULED when selected */}
                      {mode.val === 'SCHEDULED' && isActive && (
                        <View style={{ marginTop: 20 }}>
                          <WizardCalendar
                            selectedDate={selectedDay || ''}
                            onDateChange={(d) => {
                              setSelectedDay(d);
                              setRequestedDate(d);
                            }}
                            minDate={DAY_OPTIONS[0].iso}
                          />
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: '#111827',
                              marginTop: 24,
                              marginBottom: 12,
                            }}
                          >
                            Cikos?
                          </Text>
                          <WizardTimeWindowPicker value={pickupWindow} onChange={setPickupWindow} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            );
          })()}

        {/* ── Step 4: Uber-style review + confirm ── */}
        {step === 4 && (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Edge-to-edge map ── */}
              <View style={{ height: 260, overflow: 'hidden' }}>
                {route?.coords && pickupStop && dropoffStop ? (
                  <BaseMap
                    style={StyleSheet.absoluteFill}
                    center={[
                      (pickupStop.lng + dropoffStop.lng) / 2,
                      (pickupStop.lat + dropoffStop.lat) / 2,
                    ]}
                    zoom={10}
                    mapPadding={{ top: 30, bottom: 30, left: 40, right: 40 }}
                  >
                    <RouteLayer id="route" coordinates={route.coords} />
                    <PinLayer
                      id="pickup"
                      coordinate={{ lat: pickupStop.lat, lng: pickupStop.lng }}
                      type="elegant-pickup"
                    />
                    <PinLayer
                      id="dropoff"
                      coordinate={{ lat: dropoffStop.lat, lng: dropoffStop.lng }}
                      type="uber-destination"
                    />
                  </BaseMap>
                ) : (
                  <View style={{ flex: 1, backgroundColor: '#f5f5f5' }} />
                )}
              </View>

              {/* ── Content below map ── */}
              <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                {/* Minimal FROM → TO strip */}
                <View
                  style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 20,
                    gap: 12,
                  }}
                >
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#111827' }}
                  />
                  <Text
                    style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' }}
                    numberOfLines={1}
                  >
                    {pickupPicked?.address?.split(',')[0] ?? state.pickupCity ?? '—'}
                  </Text>
                  <ArrowRight size={14} color="#9ca3af" />
                  <Text
                    style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' }}
                    numberOfLines={1}
                  >
                    {dropoffPicked?.address?.split(',')[0] ?? state.dropoffCity ?? '—'}
                  </Text>
                  {route && (
                    <View
                      style={{
                        backgroundColor: '#e5e7eb',
                        borderRadius: 10,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        marginLeft: 4,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#111827' }}>
                        {route.distanceKm.toFixed(1)} km
                      </Text>
                    </View>
                  )}
                </View>
                {/* ── Price hero ── */}
                {currentVehiclePrice && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      marginBottom: 18,
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 38,
                        fontWeight: '800',
                        color: '#111827',
                        letterSpacing: -1.5,
                      }}
                    >
                      {route && currentVehicle
                        ? `~€${Math.round(
                            currentVehicle.fromPrice + route.distanceKm * currentVehicle.pricePerKm,
                          )}${truckCount > 1 ? ` × ${truckCount}` : ''}`
                        : `no €${currentVehiclePrice}`}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500' }}>
                      aptuvenā cena
                    </Text>
                  </View>
                )}

                {/* ── Summary chips ── */}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 22,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: '#f3f4f6',
                      borderRadius: 20,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                      {vehicleOptions.find((v) => v.type === selectedVehicle)?.label ?? '—'}
                    </Text>
                  </View>
                  {activeDesc ? (
                    <View
                      style={{
                        backgroundColor: '#f3f4f6',
                        borderRadius: 20,
                        paddingHorizontal: 13,
                        paddingVertical: 7,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                        {activeDesc}
                      </Text>
                    </View>
                  ) : null}
                  {selectedDay ? (
                    <View
                      style={{
                        backgroundColor: '#f3f4f6',
                        borderRadius: 20,
                        paddingHorizontal: 13,
                        paddingVertical: 7,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                        {new Date(selectedDay).toLocaleDateString('lv-LV', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={{
                      backgroundColor: '#f3f4f6',
                      borderRadius: 20,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                      {pickupWindow === 'AM'
                        ? '8:00–12:00'
                        : pickupWindow === 'PM'
                          ? '12:00–17:00'
                          : 'Jebkurā laikā'}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: '#f3f4f6',
                      borderRadius: 20,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                      {pricingMode === 'FLAT' ? 'Par pārvadājumu' : 'Par tonnu'}
                    </Text>
                  </View>
                  {truckCount > 1 && (
                    <View
                      style={{
                        backgroundColor: '#f3f4f6',
                        borderRadius: 20,
                        paddingHorizontal: 13,
                        paddingVertical: 7,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                        {truckCount} auto
                      </Text>
                    </View>
                  )}
                </View>

                {/* ── Save address toggles ── */}
                {user && (
                  <View style={{ marginBottom: 20 }}>
                    <TouchableOpacity
                      style={s.saveAddrRow}
                      onPress={() => setSavePickup((v) => !v)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          s.saveAddrCheck,
                          savePickup && { backgroundColor: '#111827', borderColor: '#111827' },
                        ]}
                      >
                        {savePickup && <Check size={14} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.saveAddrLabel}>Saglabāt iekraušanas adresi</Text>
                        <Text style={s.saveAddrSub} numberOfLines={1}>
                          {pickupPicked?.address}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.saveAddrRow, { borderBottomWidth: 0 }]}
                      onPress={() => setSaveDropoff((v) => !v)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          s.saveAddrCheck,
                          saveDropoff && { backgroundColor: '#111827', borderColor: '#111827' },
                        ]}
                      >
                        {saveDropoff && <Check size={14} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.saveAddrLabel}>Saglabāt izkraušanas adresi</Text>
                        <Text style={s.saveAddrSub} numberOfLines={1}>
                          {dropoffPicked?.address}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── Contact form ── */}
                <WizardSectionHeading
                  label="Kontaktpersona iekraušanā"
                  icon={<Bookmark size={16} color="#111827" />}
                  style={{ marginBottom: 12 }}
                />
                {user ? (
                  <View
                    style={{
                      backgroundColor: '#f0fdf4',
                      borderWidth: 1.5,
                      borderColor: '#bbf7d0',
                      borderRadius: 14,
                      padding: 16,
                      marginBottom: 20,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#16a34a',
                        }}
                      />
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 13,
                          color: '#15803d',
                        }}
                      >
                        Pasūtījums tiks pievienots jūsu kontam
                      </Text>
                    </View>
                    <View style={{ gap: 4 }}>
                      {(user.firstName || user.lastName) && (
                        <Text
                          style={{
                            fontFamily: 'Inter_500Medium',
                            fontSize: 14,
                            color: '#111827',
                          }}
                        >
                          {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                        </Text>
                      )}
                      {user.phone && (
                        <Text
                          style={{
                            fontFamily: 'Inter_400Regular',
                            fontSize: 13,
                            color: '#6b7280',
                          }}
                        >
                          {user.phone}
                        </Text>
                      )}
                      {user.email && (
                        <Text
                          style={{
                            fontFamily: 'Inter_400Regular',
                            fontSize: 13,
                            color: '#6b7280',
                          }}
                        >
                          {user.email}
                        </Text>
                      )}
                    </View>
                    <TextInputField
                      placeholder="Piezīmes (vārtu kods, bīstama krava...)"
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      containerStyle={{
                        backgroundColor: '#fff',
                        borderColor: '#d1fae5',
                        borderRadius: 10,
                        marginTop: 4,
                      }}
                    />
                  </View>
                ) : (
                  <WizardContactFields
                    name={siteContactName}
                    onChangeName={setSiteContactName}
                    namePlaceholder="Kontaktpersona *"
                    phone={siteContactPhone}
                    onChangePhone={setSiteContactPhone}
                    notes={notes}
                    onChangeNotes={setNotes}
                    notesPlaceholder="Piezīmes (vārtu kods, bīstama krava...)"
                    style={{ marginBottom: 20 }}
                  />
                )}

                {/* ── Receiver / dropoff contact ── */}
                <WizardSectionHeading
                  label="Saņēmējs izkraušanā"
                  icon={<MapPin size={16} color="#111827" />}
                  style={{ marginBottom: 12, marginTop: 24 }}
                />
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <TextInputField
                    placeholder="Saņēmēja vārds, uzvārds"
                    value={receiverContactName}
                    onChangeText={setReceiverContactName}
                    containerStyle={{
                      backgroundColor: '#f3f4f6',
                      borderWidth: 0,
                      borderRadius: 12,
                    }}
                  />
                  <TextInputField
                    placeholder="Saņēmēja tālrunis"
                    value={receiverContactPhone}
                    onChangeText={setReceiverContactPhone}
                    keyboardType="phone-pad"
                    containerStyle={{
                      backgroundColor: '#f3f4f6',
                      borderWidth: 0,
                      borderRadius: 12,
                    }}
                  />
                </View>

                {/* ── Pricing ── */}
                <View style={{ gap: 12, marginBottom: 20 }}>
                  {pricingMode === 'FLAT' ? (
                    (() => {
                      const minRate = currentVehicle
                        ? Math.round(currentVehicle.fromPrice * 0.7)
                        : 50;
                      const maxRate = currentVehicle
                        ? Math.round(currentVehicle.fromPrice * 1.8)
                        : 300;
                      const stepSize = Math.max(5, Math.round((maxRate - minRate) / 20));
                      const currentVal = offeredRateText ? parseFloat(offeredRateText) : null;
                      const displayVal =
                        currentVal !== null && !isNaN(currentVal) ? currentVal : null;
                      const fraction =
                        displayVal !== null
                          ? Math.max(0, Math.min(1, (displayVal - minRate) / (maxRate - minRate)))
                          : null;
                      return (
                        <>
                          <View
                            style={{
                              backgroundColor: '#111827',
                              borderRadius: 16,
                              padding: 18,
                              gap: 14,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Text
                                style={{
                                  color: '#9ca3af',
                                  fontSize: 13,
                                  fontWeight: '600',
                                }}
                              >
                                {vehicleOptions.find((v) => v.type === selectedVehicle)?.label ??
                                  '—'}
                              </Text>
                              <Text
                                style={{
                                  color: displayVal !== null ? '#fff' : '#4b5563',
                                  fontSize: 24,
                                  fontWeight: '800',
                                  letterSpacing: -0.5,
                                }}
                              >
                                {displayVal !== null ? `€${displayVal}` : 'Nav norādīts'}
                              </Text>
                            </View>
                            {/* Visual bar */}
                            <View
                              style={{ height: 4, backgroundColor: '#374151', borderRadius: 2 }}
                            >
                              {fraction !== null && (
                                <View
                                  style={{
                                    height: 4,
                                    width: `${Math.round(fraction * 100)}%`,
                                    backgroundColor: '#10b981',
                                    borderRadius: 2,
                                  }}
                                />
                              )}
                            </View>
                            {/* Step controls */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <Text style={{ color: '#6b7280', fontSize: 12 }}>€{minRate}</Text>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 8,
                                  flex: 1,
                                  justifyContent: 'center',
                                }}
                              >
                                {[-stepSize * 2, -stepSize, stepSize, stepSize * 2].map((delta) => (
                                  <TouchableOpacity
                                    key={delta}
                                    onPress={() => {
                                      const base =
                                        displayVal ??
                                        (currentVehicle
                                          ? Math.round(
                                              currentVehicle.fromPrice +
                                                (route?.distanceKm ?? 30) *
                                                  currentVehicle.pricePerKm,
                                            )
                                          : minRate);
                                      const next = Math.min(
                                        maxRate,
                                        Math.max(minRate, base + delta),
                                      );
                                      setOfferedRateText(String(next));
                                      haptics.light();
                                    }}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 7,
                                      borderRadius: 8,
                                      backgroundColor: '#1f2937',
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text
                                      style={{
                                        color: '#d1d5db',
                                        fontSize: 13,
                                        fontWeight: '700',
                                      }}
                                    >
                                      {delta > 0 ? `+${delta}` : `${delta}`}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                              <Text style={{ color: '#6b7280', fontSize: 12 }}>€{maxRate}</Text>
                            </View>
                          </View>
                          {displayVal === null && (
                            <Text
                              style={{
                                fontSize: 13,
                                color: '#6b7280',
                                paddingHorizontal: 4,
                              }}
                            >
                              Neobligāti — norādiet summu, lai ātrāk atrastu pārvadātāju.
                            </Text>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <TextInputField
                        placeholder="Cena par tonnu (€/t) *"
                        keyboardType="numeric"
                        value={pricePerTonneText}
                        onChangeText={setPricePerTonneText}
                        containerStyle={{
                          backgroundColor: '#f3f4f6',
                          borderWidth: 0,
                          borderRadius: 12,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          color: '#6b7280',
                          marginTop: -4,
                          paddingHorizontal: 4,
                        }}
                      >
                        Obligāti — cena tiek aprēķināta pēc kravas svara.
                      </Text>
                    </>
                  )}
                </View>

                {/* ── Footnote ── */}
                <View style={{ paddingTop: 16, paddingBottom: 4 }}>
                  <Text
                    style={{
                      fontFamily: 'Inter_400Regular',
                      fontSize: 13,
                      color: colors.textMuted,
                      textAlign: 'center',
                      lineHeight: 18,
                    }}
                  >
                    {dispatchMode === 'ON_DEMAND'
                      ? 'Šoferis apstiprinās dažu minūtu laikā. Sekojiet piegādei reāllaikā.'
                      : 'Cenu un izbraukšanas laiku apstiprināsim pa tālruni.'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </WizardLayout>
      <WizardAuthGate
        visible={showAuthGate}
        onAuthenticated={() => {
          setShowAuthGate(false);
          handleSubmit();
        }}
        onGuestContact={(contact) => {
          setShowAuthGate(false);
          handleGuestSubmit(contact);
        }}
        onRegister={() => {
          setShowAuthGate(false);
          router.push('/(auth)/register' as never);
        }}
        prefilledName={siteContactName}
        prefilledPhone={siteContactPhone}
        onDismiss={() => setShowAuthGate(false)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Uber-like inputs route block — legacy styles kept for reference
  content: { flex: 1 },
  pad: { padding: 20, paddingBottom: 32 },
  hint: { fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    marginTop: 8,
  },

  routeLiteCard: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    marginBottom: 18,
  },
  routeMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },

  // Address cards
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    lineHeight: 20,
  },
  placeholder: { color: colors.textDisabled, fontFamily: 'Inter_400Regular', fontWeight: '400' },

  // Pickup reference row — unused, kept for compatibility
  refRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 4 },

  // Vehicle cards
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  vehicleCardSel: {
    borderColor: '#111827',
    backgroundColor: '#f8fafc',
  },
  vehicleCheckBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#111827',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  vehicleLabel: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  vehicleLabelSel: { color: '#111827' },
  vehicleSub: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
  vehicleSubSel: { color: '#4b5563' },
  vehiclePrice: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  vehiclePriceSel: { color: '#111827' },

  // Cargo chips
  cargoChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cargoChipSel: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  cargoText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
  },
  cargoTextSel: { color: '#fff' },

  // Weight input
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  weightInput: { flex: 1, fontSize: 15, color: colors.textPrimary, paddingVertical: 0 },
  weightUnit: { fontSize: 13, color: colors.textMuted, marginLeft: 8 },

  // Truck count picker
  truckCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 8,
  },
  truckCountBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckCountBtnDisabled: { backgroundColor: colors.bgMuted },
  truckCountBtnText: {
    fontSize: 22,
    color: '#fff',
    lineHeight: 26,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  truckCountValue: { alignItems: 'center', minWidth: 48 },
  truckCountNum: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 32,
  },
  truckCountUnit: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  truckCountHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  windowRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  windowChip: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
  },
  windowChipActive: { backgroundColor: '#111827' },
  windowChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
  windowChipTextActive: { color: colors.white },

  // Summary card
  summaryCard: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },

  summaryMetaRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  summaryMetaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },

  uberRouteBox: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  uberTimeline: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
    paddingVertical: 2,
  },
  uberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9ca3af', marginTop: 14 },
  uberSquare: { width: 8, height: 8, backgroundColor: '#111827', marginBottom: 14 },
  uberLineFill: { width: 2, flex: 1, backgroundColor: '#d1d5db', marginVertical: 4 },
  uberRouteTexts: { flex: 1 },
  uberRouteTextRow: { height: 36, justifyContent: 'center' },
  uberRouteValue: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textPrimary,
  },
  uberRouteDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },

  detailCard: {
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  saveAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  saveAddrCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAddrLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveAddrSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  routeFieldLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  routeDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 28,
    marginVertical: 12,
  },
  routeDividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  routeDividerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
    marginHorizontal: 10,
  },
  payMethodRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
  },
  payMethodRowActive: { borderColor: '#111827', backgroundColor: '#f9fafb' },
  payMethodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payMethodRadioActive: { borderColor: '#111827' },
  payMethodRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
  },
  payMethodLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  payMethodLabelActive: { color: '#111827' },
  payMethodSub: { fontSize: 12, color: '#6b7280', marginTop: 2, fontFamily: 'Inter_400Regular' },
});
