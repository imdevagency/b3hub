/**
 * Transport wizard — full-screen step pages.
 *
 *   Step 1 – Pickup address  (inline map)
 *   Step 2 – Dropoff address (inline map)
 *   Step 3 – Vehicle + cargo + weight
 *   Step 4 – Date + route summary + contact/notes
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Bookmark, Check, Weight, ChevronRight, Search, ArrowUpDown } from 'lucide-react-native';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import { useTransport } from '@/lib/transport-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { TransportVehicleType } from '@/lib/api';
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
import { WizardPaymentMethodPicker } from '@/components/wizard/WizardPaymentMethodPicker';
import { WizardTimeWindowPicker } from '@/components/wizard/WizardTimeWindowPicker';
import { WizardRouteBox } from '@/components/wizard/WizardRouteBox';
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
    type: 'TIPPER_SMALL',
    label: 'Mazā pašizgāzēja',
    sub: 'līdz 5 t · 6 m³',
    fromPrice: 89,
    pricePerKm: 1.5,
  },
  {
    type: 'TIPPER_LARGE',
    label: 'Lielā pašizgāzēja',
    sub: 'līdz 15 t · 18 m³',
    fromPrice: 149,
    pricePerKm: 2.0,
  },
  {
    type: 'ARTICULATED_TIPPER',
    label: 'Puspiekabe',
    sub: 'līdz 26 t · 22 m³',
    fromPrice: 219,
    pricePerKm: 3.0,
  },
  {
    type: 'FLATBED',
    label: 'Platforma',
    sub: 'līdz 20 t · garums 13.6 m',
    fromPrice: 199,
    pricePerKm: 2.5,
  },
  {
    type: 'BOX_TRUCK',
    label: 'Kravas furgons',
    sub: 'līdz 3.5 t · 20 m³',
    fromPrice: 79,
    pricePerKm: 1.2,
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
  const [notes, setNotes] = useState('');
  const [offeredRateText, setOfferedRateText] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'INVOICE'>('CARD');

  // ── Route (for step 3 summary) ────────────────────────────────
  const { route } = useRoute(
    step >= 2 && pickupStop ? pickupStop : null,
    step >= 2 && dropoffStop ? dropoffStop : null,
  );

  const currentVehicle = VEHICLE_OPTIONS.find((v) => v.type === selectedVehicle);
  const currentVehiclePrice = currentVehicle?.fromPrice;

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
    notes,
    offeredRateText,
    truckCount,
    pricingMode,
    pricePerTonneText,
    dropoffPicked,
  ]);

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
          requestedDate: selectedDay,
          pickupWindow: pickupWindow !== 'ANY' ? pickupWindow : undefined,
          siteContactName: siteContactName || undefined,
          siteContactPhone: siteContactPhone || undefined,
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
          paymentMethod,
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
  const step3Valid = !!selectedDay;
  const step4Valid =
    !!siteContactName.trim() &&
    siteContactPhone.trim().replace(/\D/g, '').length >= 8 &&
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
    3: 'Kad?',
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
              {/* Uber-style unified route card */}
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 16, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', padding: 16 }}>
                  {/* Left track: circle → line → square */}
                  <View
                    style={{
                      alignItems: 'center',
                      width: 20,
                      marginRight: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        borderWidth: 2,
                        borderColor: '#6b7280',
                        backgroundColor: '#fff',
                      }}
                    />
                    <View
                      style={{ width: 2, flex: 1, backgroundColor: '#d1d5db', marginVertical: 3 }}
                    />
                    <View
                      style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#111827' }}
                    />
                  </View>

                  {/* Right: two tappable rows */}
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        minHeight: 48,
                      }}
                      onPress={() => setPickupPickerOpen(true)}
                      activeOpacity={0.7}
                    >
                      {!pickupPicked && (
                        <Search size={15} color="#9ca3af" style={{ marginRight: 8 }} />
                      )}
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: 15,
                          color: pickupPicked ? '#111827' : '#6b7280',
                          fontWeight: pickupPicked ? '600' : '400',
                        }}
                      >
                        {pickupPicked ? pickupPicked.address : 'Pievienot ielādes vietu...'}
                      </Text>
                      <ChevronRight size={16} color="#d1d5db" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: '#e5e7eb', position: 'relative' }}>
                      {(pickupPicked || dropoffPicked) && (
                        <TouchableOpacity
                          onPress={swapAddresses}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: -14,
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: '#fff',
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <ArrowUpDown size={13} color="#6b7280" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        minHeight: 48,
                      }}
                      onPress={() => setDropoffPickerOpen(true)}
                      activeOpacity={0.7}
                    >
                      {!dropoffPicked && (
                        <Search size={15} color="#9ca3af" style={{ marginRight: 8 }} />
                      )}
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: 15,
                          color: dropoffPicked ? '#111827' : '#9ca3af',
                          fontWeight: dropoffPicked ? '600' : '400',
                        }}
                      >
                        {dropoffPicked ? dropoffPicked.address : 'Kāds ir galamērķis?'}
                      </Text>
                      <ChevronRight size={16} color="#d1d5db" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
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

            <Text style={s.sectionTitle}>Ieteicamie</Text>
            <View style={{ gap: 0, marginBottom: 24 }}>
              {VEHICLE_OPTIONS.map((v) => {
                const isSel = selectedVehicle === v.type;
                return (
                  <TouchableOpacity
                    key={v.type}
                    style={[s.vehicleCard, isSel && s.vehicleCardSel]}
                    onPress={() => {
                      haptics.light();
                      setSelectedVehicle(v.type);
                      setVehicleType(v.type);
                    }}
                    activeOpacity={0.75}
                  >
                    {isSel && (
                      <View style={s.vehicleCheckBadge}>
                        <Check size={12} color="#fff" />
                      </View>
                    )}
                    <View style={{ width: 80, alignItems: 'center', justifyContent: 'center' }}>
                      <TruckIllustration type={v.type} />
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={[s.vehicleLabel, isSel && s.vehicleLabelSel]}>{v.label}</Text>
                      <Text style={[s.vehicleSub, isSel && s.vehicleSubSel]}>{v.sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {route ? (
                        <>
                          <Text style={[s.vehiclePrice, isSel && s.vehiclePriceSel]}>
                            ~€{Math.round(v.fromPrice + route.distanceKm * v.pricePerKm)}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: isSel ? 'rgba(255,255,255,0.65)' : '#9ca3af',
                              marginTop: 1,
                            }}
                          >
                            {route.distanceKm.toFixed(0)} km
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={[s.vehiclePrice, isSel && s.vehiclePriceSel]}>
                            no €{v.fromPrice}
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionTitle}>Kravas veids *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {CARGO_PRESETS.map((c) => {
                const isSel = activeDesc === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[s.cargoChip, isSel && s.cargoChipSel]}
                    onPress={() => {
                      haptics.light();
                      setActiveDesc(c);
                      setLoadDescription(c);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.cargoText, isSel && s.cargoTextSel]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeDesc === 'Cits' && (
              <TextInputField
                containerStyle={{ marginBottom: 16 }}
                placeholder="Aprakstiet kravu (piem., iekārtas, mēbeles, paletes)..."
                value={otherText}
                onChangeText={(t) => {
                  setOtherText(t);
                  setLoadDescription(t || 'Cits');
                }}
              />
            )}

            <Text style={s.sectionTitle}>Svars (neobligāti)</Text>
            <View style={s.weightRow}>
              <Weight size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput
                style={s.weightInput}
                placeholder="piem., 8.5"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={weightText}
                onChangeText={(t) => {
                  setWeightText(t);
                  const w = parseFloat(t);
                  if (!isNaN(w)) setEstimatedWeight(w);
                }}
              />
              <Text style={s.weightUnit}>tonnas</Text>
            </View>

            <Text style={s.sectionTitle}>Automašīnu skaits</Text>
            <View style={s.truckCountRow}>
              <TouchableOpacity
                style={[s.truckCountBtn, truckCount <= 1 && s.truckCountBtnDisabled]}
                onPress={() => setTruckCount((n) => Math.max(1, n - 1))}
                activeOpacity={0.7}
                disabled={truckCount <= 1}
              >
                <Text style={s.truckCountBtnText}>−</Text>
              </TouchableOpacity>
              <View style={s.truckCountValue}>
                <Text style={s.truckCountNum}>{truckCount}</Text>
                <Text style={s.truckCountUnit}>{'auto'}</Text>
              </View>
              <TouchableOpacity
                style={[s.truckCountBtn, truckCount >= 10 && s.truckCountBtnDisabled]}
                onPress={() => setTruckCount((n) => Math.min(10, n + 1))}
                activeOpacity={0.7}
                disabled={truckCount >= 10}
              >
                <Text style={s.truckCountBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {truckCount > 1 && (
              <Text style={s.truckCountHint}>
                {truckCount} atsevišķi pārvadājuma darbi • iekraušana ik 30 min
              </Text>
            )}

            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Norēķinu veids</Text>
            <View style={s.windowRow}>
              {(
                [
                  ['FLAT', 'Par pārvadājumu'],
                  ['PER_TONNE', 'Par tonnu'],
                ] as const
              ).map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.windowChip, pricingMode === val && s.windowChipActive]}
                  onPress={() => {
                    haptics.light();
                    setPricingMode(val);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.windowChipText, pricingMode === val && s.windowChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Date + time window ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <SectionLabel label="Pārvadāšanas datums" />
            <WizardCalendar
              selectedDate={selectedDay || ''}
              onDateChange={(d) => {
                setSelectedDay(d);
                setRequestedDate(d);
              }}
              minDate={DAY_OPTIONS[0].iso}
            />

            <SectionLabel label="Vēlamais iekraušanas laiks" />
            <WizardTimeWindowPicker value={pickupWindow} onChange={setPickupWindow} />
          </ScrollView>
        )}

        {/* ── Step 4: Review + contact + confirm ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            
              {/* Map Header */}
              {route?.coords && pickupStop && dropoffStop && (
                <View style={{ height: 200, marginHorizontal: -20, marginTop: -20, marginBottom: 24, overflow: 'hidden' }}>
                  <BaseMap
                    style={StyleSheet.absoluteFill}
                    center={[pickupStop.lng, pickupStop.lat]}
                    zoom={10}
                    
                    
                    
                    
                  >
                    <RouteLayer id="route" coordinates={route.coords} />
                    <PinLayer id="pickup" coordinate={{ lat: pickupStop.lat, lng: pickupStop.lng }} type="pickup" />
                    <PinLayer id="dropoff" coordinate={{ lat: dropoffStop.lat, lng: dropoffStop.lng }} type="delivery" />
                  </BaseMap>
                  
                  {/* Fade gradient overlay at the bottom of the map */}
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(255,255,255,0.7)', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
                </View>
              )}


            <SectionLabel label="KOPSAVILKUMS" />
            <WizardSummaryCard style={{ marginBottom: 24 }}>
              <DetailRow
                label="Maršruts"
                value={route ? `${route.distanceKm.toFixed(1)} km · ${route.durationLabel}` : '—'}
              />
              <DetailRow
                label="Auto"
                value={VEHICLE_OPTIONS.find((v) => v.type === selectedVehicle)?.label ?? '—'}
              />
              <DetailRow label="Krava" value={activeDesc || '—'} />
              <DetailRow
                label="Izpildes datums"
                value={
                  selectedDay
                    ? new Date(selectedDay).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'long',
                      })
                    : '—'
                }
              />
              <DetailRow
                label="Laiks"
                value={
                  pickupWindow === 'AM'
                    ? '8:00 – 12:00'
                    : pickupWindow === 'PM'
                      ? '12:00 – 17:00'
                      : 'Jebkurā laikā'
                }
              />
              {currentVehiclePrice && (
                <DetailRow
                  label="Aptuvenā cena"
                  value={
                    route && currentVehicle
                      ? `~€${Math.round(
                          currentVehicle.fromPrice + route.distanceKm * currentVehicle.pricePerKm,
                        )}${truckCount > 1 ? ` × ${truckCount}` : ''}`
                      : `no €${currentVehiclePrice}`
                  }
                />
              )}
              {truckCount > 1 && (
                <DetailRow label="Auto skaits" value={`${truckCount} (ik 30 min)`} />
              )}
              <DetailRow
                label="Norēķins"
                value={pricingMode === 'FLAT' ? 'Par pārvadājumu' : 'Par tonnu'}
              />
            </WizardSummaryCard>

            {user && (
              <View style={{ marginBottom: 24 }}>
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

            <SectionLabel label="KONTAKTINFORMĀCIJA" />
            <View style={{ gap: 10, marginBottom: 24 }}>
              <TextInputField
                placeholder="Kontaktpersona *"
                value={siteContactName}
                onChangeText={setSiteContactName}
                containerStyle={{
                  backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: '#f0f0f0',
                    borderRadius: 16,
                }}
              />
              <TextInputField
                placeholder="Tālrunis *"
                keyboardType="phone-pad"
                value={siteContactPhone}
                onChangeText={setSiteContactPhone}
                containerStyle={{
                  backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: '#f0f0f0',
                    borderRadius: 16,
                }}
              />
              <TextInputField
                placeholder="Piezīmes (piem., vārtu kods, bīstama krava)"
                multiline
                value={notes}
                onChangeText={setNotes}
                containerStyle={{
                  backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: '#f0f0f0',
                    borderRadius: 16,
                }}
              />
              {pricingMode === 'FLAT' ? (
                <>
                  <TextInputField
                    placeholder="Piedāvātā cena (€) — pēc izvēles"
                    keyboardType="numeric"
                    value={offeredRateText}
                    onChangeText={setOfferedRateText}
                    containerStyle={{
                      backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: '#f0f0f0',
                    borderRadius: 16,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      marginTop: -4,
                      marginBottom: 4,
                      paddingHorizontal: 4,
                    }}
                  >
                    Neobligāti — norādiet summu, lai ātrāk atrastu pārvadātāju.
                  </Text>
                </>
              ) : (
                <>
                  <TextInputField
                    placeholder="Cena par tonnu (€/t) *"
                    keyboardType="numeric"
                    value={pricePerTonneText}
                    onChangeText={setPricePerTonneText}
                    containerStyle={{
                      backgroundColor: '#fff',
                    borderWidth: 1.5,
                    borderColor: '#f0f0f0',
                    borderRadius: 16,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      marginTop: -4,
                      marginBottom: 4,
                      paddingHorizontal: 4,
                    }}
                  >
                    Obligāti — cena tiek aprēķināta pēc kravas svara.
                  </Text>
                </>
              )}
            </View>

            {/* Payment method */}
            <SectionLabel label="APMAKSAS VEIDS" />
            <WizardPaymentMethodPicker
              value={paymentMethod}
              onChange={setPaymentMethod}
              isLoggedIn={!!user}
            />
            <View style={{ height: 16 }} />
            {/* Footnote: this is a request, not an instant booking */}
            <View style={{ paddingHorizontal: 4, paddingBottom: 8 }}>
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  color: colors.textMuted,
                  textAlign: 'center',
                  lineHeight: 18,
                }}
              >
                Cenu un izbraukšanas laiku apstiprināsim pa tālruni.
              </Text>
            </View>
          </ScrollView>
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
