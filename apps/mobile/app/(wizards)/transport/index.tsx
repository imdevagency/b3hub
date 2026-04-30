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
import { Bookmark, Check, Weight } from 'lucide-react-native';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import { useTransport } from '@/lib/transport-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { TransportVehicleType } from '@/lib/api';
import { useRoute } from '@/components/map';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { useToast } from '@/components/ui/Toast';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';
import { colors } from '@/lib/theme';
import { haptics } from '@/lib/haptics';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';
import { GuestOrderSuccess } from '@/components/wizard/GuestOrderSuccess';

// ── Types ─────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5;
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

const CARGO_PRESETS = ['Būvgruži', 'Iekārtas', 'Materiāli', 'Mēbeles', 'Smiltis/Grants', 'Cits'];

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

  // ── Route (for step 4 summary) ────────────────────────────────
  const { route } = useRoute(
    step >= 3 && pickupStop ? pickupStop : null,
    step >= 3 && dropoffStop ? dropoffStop : null,
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

  const step3Valid = selectedVehicle !== null;
  const step4Valid = !!selectedDay;
  const step5Valid = !!siteContactName.trim() && !!siteContactPhone.trim();

  // Detect identical pickup/dropoff coordinates
  const sameAddress =
    !!pickupStop &&
    !!dropoffStop &&
    pickupStop.lat === dropoffStop.lat &&
    pickupStop.lng === dropoffStop.lng;

  const ctaDisabled =
    (step === 1 && !pickupPicked) ||
    (step === 2 && (!dropoffPicked || sameAddress)) ||
    (step === 3 && !step3Valid) ||
    (step === 4 && !step4Valid) ||
    (step === 5 && !step5Valid) ||
    submitting;

  const ctaLabel =
    step === 5
      ? currentVehiclePrice
        ? `Nosūtīt pieprasījumu${truckCount > 1 ? ` ${truckCount}×` : ''} — no €${currentVehiclePrice}`
        : 'Nosūtīt pieprasījumu'
      : 'Turpināt';

  const onCTA = useCallback(() => {
    if (step === 5) {
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
    1: 'Kur paņemt kravu?',
    2: 'Kur piegādāt?',
    3: 'Izvēlies transportu',
    4: 'Kad?',
    5: 'Apstiprini pasūtījumu',
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
        totalSteps={5}
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
        {/* ── Step 1: Pickup address ── */}
        {step === 1 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ paddingHorizontal: 20 }}>
              <AddressField
                value={pickupPicked}
                onPick={handlePickupConfirm}
                placeholder="Norādiet ielādes adresi"
              />
            </View>
            {pickupPicked && (
              <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                <TouchableOpacity
                  style={s.saveAddrRow}
                  onPress={() => setSavePickup((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[s.saveAddrCheck, savePickup && s.saveAddrCheckActive]}>
                    {savePickup && <Check size={12} color="#fff" strokeWidth={2.5} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.saveAddrLabel}>Saglabāt ielādes adresi</Text>
                    <Text style={s.saveAddrSub} numberOfLines={1}>
                      {pickupPicked.address.split(',')[0]}
                    </Text>
                  </View>
                  <Bookmark size={16} color={savePickup ? '#111827' : '#9ca3af'} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* ── Step 2: Dropoff address ── */}
        {step === 2 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {pickupPicked && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }}
                  />
                  <Text style={{ fontSize: 13, color: colors.textMuted }} numberOfLines={1}>
                    {pickupPicked.address.split(',')[0]}
                  </Text>
                </View>
              </View>
            )}
            <View style={{ paddingHorizontal: 20 }}>
              <AddressField
                value={dropoffPicked}
                onPick={handleDropoffConfirm}
                placeholder="Norādiet izkraušanas adresi"
              />
            </View>
            {sameAddress && (
              <View
                style={{
                  marginHorizontal: 20,
                  marginTop: 10,
                  backgroundColor: '#fef2f2',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: '#fecaca',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: '#dc2626',
                    fontFamily: 'Inter_500Medium',
                    fontWeight: '500',
                  }}
                >
                  Izkraušanas adresei jāatšķiras no iekraušanas adreses.
                </Text>
              </View>
            )}
            {dropoffPicked && (
              <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
                <TouchableOpacity
                  style={s.saveAddrRow}
                  onPress={() => setSaveDropoff((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[s.saveAddrCheck, saveDropoff && s.saveAddrCheckActive]}>
                    {saveDropoff && <Check size={12} color="#fff" strokeWidth={2.5} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.saveAddrLabel}>Saglabāt izkraušanas adresi</Text>
                    <Text style={s.saveAddrSub} numberOfLines={1}>
                      {dropoffPicked.address.split(',')[0]}
                    </Text>
                  </View>
                  <Bookmark size={16} color={saveDropoff ? '#111827' : '#9ca3af'} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* ── Step 3: Vehicle + Cargo ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.routeLiteCard}>
              <RouteStops
                pickupAddress={pickupPicked?.address ?? 'Iekraušanas adrese nav izvēlēta'}
                dropoffAddress={dropoffPicked?.address ?? 'Izkraušanas adrese nav izvēlēta'}
              />
              {route && (
                <Text
                  style={[s.routeMeta, { textAlign: 'center', marginTop: 8, letterSpacing: 0.5 }]}
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
                      setSelectedVehicle(v.type);
                      setVehicleType(v.type);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={{ width: 80, alignItems: 'center', justifyContent: 'center' }}>
                      <TruckIllustration type={v.type} />
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={[s.vehicleLabel, isSel && s.vehicleLabelSel]}>{v.label}</Text>
                      <Text style={[s.vehicleSub, isSel && s.vehicleSubSel]}>{v.sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.vehiclePrice, isSel && s.vehiclePriceSel]}>
                        €{v.fromPrice}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionTitle}>Kravas veids</Text>
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
                <Text style={s.truckCountUnit}>{truckCount === 1 ? 'auto' : 'auto'}</Text>
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
          </ScrollView>
        )}

        {/* ── Step 4: Date + time window ── */}
        {step === 4 && (
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
              minDate={new Date().toISOString().split('T')[0]}
            />

            <SectionLabel label="Vēlamais iekraušanas laiks" />
            <View style={s.windowRow}>
              {(
                [
                  ['ANY', 'Jebkurā laikā'],
                  ['AM', 'Rīts  8–12'],
                  ['PM', 'Diena  12–17'],
                ] as const
              ).map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.windowChip, pickupWindow === val && s.windowChipActive]}
                  onPress={() => setPickupWindow(val)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.windowChipText, pickupWindow === val && s.windowChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* ── Step 5: Review + contact + confirm ── */}
        {step === 5 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <SectionLabel label="Cena un Kopsavilkums" />
            <View style={s.detailCard}>
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
                label="Datums"
                value={
                  selectedDay
                    ? new Date(selectedDay).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'
                }
              />
              <DetailRow
                label="Laiks"
                value={
                  pickupWindow === 'AM'
                    ? 'Rīts (8–12)'
                    : pickupWindow === 'PM'
                      ? 'Diena (12–17)'
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
            </View>

            <SectionLabel label="Norēķinu veids" style={{ marginTop: 20 }} />
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
                  onPress={() => setPricingMode(val)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.windowChipText, pricingMode === val && s.windowChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <SectionLabel label="Sūtīšana" />
            <View style={[s.summaryCard, { marginBottom: 12 }]}>
              <RouteStops
                pickupAddress={pickupPicked?.address ?? '—'}
                dropoffAddress={dropoffPicked?.address ?? '—'}
              />
            </View>

            <SectionLabel label="Kontaktinformācija" style={{ marginTop: 20 }} />
            <View style={{ gap: 10, marginBottom: 8 }}>
              <TextInputField
                placeholder="Kontaktpersona *"
                value={siteContactName}
                onChangeText={setSiteContactName}
              />
              <TextInputField
                placeholder="Tālrunis *"
                keyboardType="phone-pad"
                value={siteContactPhone}
                onChangeText={setSiteContactPhone}
              />
              <TextInputField
                placeholder="Piezīmes un norādījumi (piem., bīstamas kravas brīdinājumi, iekraušanas instrukcijas)"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
              {pricingMode === 'FLAT' ? (
                <TextInputField
                  placeholder="Jūsu piedāvātā cena (€) — pēc izvēles"
                  keyboardType="numeric"
                  value={offeredRateText}
                  onChangeText={setOfferedRateText}
                />
              ) : (
                <TextInputField
                  placeholder="Cena par tonnu (€/t)"
                  keyboardType="numeric"
                  value={pricePerTonneText}
                  onChangeText={setPricePerTonneText}
                />
              )}
            </View>
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
        prefilledName={siteContactName}
        prefilledPhone={siteContactPhone}
        onDismiss={() => setShowAuthGate(false)}
      />
    </>
  );
}

// ── Summary helper ────────────────────────────────────────────────
function RouteStops({
  pickupAddress,
  dropoffAddress,
}: {
  pickupAddress?: string;
  dropoffAddress?: string;
}) {
  return (
    <View style={s.uberRouteBox}>
      <View style={s.uberTimeline}>
        <View style={s.uberDot} />
        <View style={s.uberLineFill} />
        <View style={s.uberSquare} />
      </View>
      <View style={s.uberRouteTexts}>
        <View style={s.uberRouteTextRow}>
          <Text style={s.uberRouteValue} numberOfLines={1}>
            {pickupAddress || 'Ielādes adrese'}
          </Text>
        </View>
        <View style={s.uberRouteDivider} />
        <View style={s.uberRouteTextRow}>
          <Text style={s.uberRouteValue} numberOfLines={1}>
            {dropoffAddress || 'Izkraušanas adrese'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
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

  // Pickup reference row (step 2)
  refRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 4 },
  refDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 8 },
  refLabel: { flex: 1, fontSize: 13, color: colors.textMuted },
  refLine: { width: 2, height: 20, backgroundColor: '#e5e7eb', marginLeft: 7, marginBottom: 4 },

  // Vehicle cards
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  vehicleCardSel: {
    borderColor: '#166534',
    backgroundColor: '#f8fafc',
  },
  vehicleCheckBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10b981',
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
  vehicleLabelSel: { color: '#000' },
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
  vehiclePriceSel: { color: '#000' },

  // Cargo chips
  cargoChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cargoChipSel: {
    backgroundColor: '#166534',
    borderColor: '#166534',
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
    backgroundColor: '#166534',
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

  // Day chips
  dayChip: {
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.bgSubtle,
    minWidth: 54,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.textPrimary },
  dayChipAsap: { borderColor: '#fca5a5', backgroundColor: '#fff7f7', minWidth: 62 },
  dayDow: {
    fontSize: 11,
    color: colors.textDisabled,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  dayNum: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginVertical: 2,
  },
  dayMon: {
    fontSize: 11,
    color: colors.textDisabled,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: '#d1d5db' },
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
  windowChipActive: { backgroundColor: '#000000' },
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
    backgroundColor: colors.bgSubtle,
    borderRadius: 16,
    padding: 16,
    paddingVertical: 12,
  },
  uberTimeline: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
    paddingVertical: 2,
  },
  uberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 14 },
  uberSquare: { width: 8, height: 8, backgroundColor: colors.primary, marginBottom: 14 },
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
  saveAddrCheckActive: { backgroundColor: colors.primary, borderColor: colors.textPrimary },
  saveAddrLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveAddrSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
