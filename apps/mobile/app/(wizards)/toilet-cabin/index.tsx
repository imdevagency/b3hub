/**
 * Toilet Cabin Hire wizard
 *
 *   Step 1 – Cabin type (STANDARD / DISABLED_ACCESS / VIP / HEATED)
 *   Step 2 – Cabin count
 *   Step 3 – Delivery address
 *   Step 4 – Kad? (hire period chips + date picker with range preview)
 *   Step 5 – Review + contact details + confirm
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, Thermometer, Star, Accessibility } from 'lucide-react-native';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';
import { GuestOrderSuccess } from '@/components/wizard/GuestOrderSuccess';
import { WizardPaymentMethodPicker } from '@/components/wizard/WizardPaymentMethodPicker';
import { WizardTimeWindowPicker } from '@/components/wizard/WizardTimeWindowPicker';
import { WizardDateRangeSummary } from '@/components/wizard/WizardDateRangeSummary';
import { WizardSectionHeading } from '@/components/wizard/WizardSectionHeading';
import { WizardContactFields } from '@/components/wizard/WizardContactFields';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { api } from '@/lib/api';
import { addGuestOrder } from '@/lib/guest-token-storage';
import { addDays, toISO } from '@/components/wizard/skip-hire/_types';
import type { ToiletCabinType } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5;

// ── Draft persistence ──────────────────────────────────────────────
const TOILET_CABIN_DRAFT_KEY = '@b3hub_toilet_cabin_draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ToiletCabinDraft {
  step: Step;
  cabinType: ToiletCabinType;
  cabinCount: number;
  hireDays: number;
  picked: PickedAddress | null;
  selectedDay: string | null;
  deliveryWindow: 'ANY' | 'AM' | 'PM';
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  paymentMethod: 'CARD' | 'INVOICE';
  servicingFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  savedAt: number;
}

const today = new Date();
const MIN_DATE = toISO(addDays(today, 1));

function isoToDisplay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('lv-LV', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function isoToLong(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Hire period options ─────────────────────────────────────────────
const HIRE_PERIOD_OPTIONS: Array<{ days: number; label: string }> = [
  { days: 3, label: '3 dienas' },
  { days: 7, label: '1 nedēļa' },
  { days: 14, label: '2 nedēļas' },
  { days: 30, label: '1 mēnesis' },
  { days: 60, label: '2 mēneši' },
  { days: 90, label: '3 mēneši' },
];

const BASE_PRICE_PER_CABIN_PER_DAY = 12;

const CABIN_TYPES: Array<{
  value: ToiletCabinType;
  label: string;
  sub: string;
  features: string[];
  fromPrice: number;
  Icon: React.ElementType;
}> = [
  {
    value: 'STANDARD',
    label: 'Standarta',
    sub: 'Būvlaukumiem un pastākā remontu darbiem',
    features: ['Tvertne', 'Pisuārs', 'Tualetes papīrs'],
    fromPrice: 1.0,
    Icon: Building2,
  },
  {
    value: 'DISABLED_ACCESS',
    label: 'Cilvēkiem ar īpašām vajadzībām',
    sub: 'Plašāka ieeja, rūpju telpa',
    features: ['Tvertne', 'Tualetes papīrs', 'Plata ieeja'],
    fromPrice: 2.7,
    Icon: Accessibility,
  },
  {
    value: 'VIP',
    label: 'VIP',
    sub: 'Pastākākiem pasākumiem un ofisa objektiem',
    features: ['Iekšējā izlietne', 'Pisuārs', 'Ziepju dozators', 'Tualetes papīrs'],
    fromPrice: 1.7,
    Icon: Star,
  },
  {
    value: 'HEATED',
    label: 'Siltināta',
    sub: 'Ziemas sezonai un ilgtirmīna nomām',
    features: ['Elektrisks radiators', 'Apgaismojums', 'Spogulis', 'VIP aprīkojums'],
    fromPrice: 2.7,
    Icon: Thermometer,
  },
];

const STEP_TITLES: Record<Step, string> = {
  1: 'Kabīnes veids',
  2: 'Kabīnes',
  3: 'Adrese',
  4: 'Kad?',
  5: 'Apstiprīnāt',
};

// ── Component ───────────────────────────────────────────────────────
export default function ToiletCabinWizard() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [cabinType, setCabinType] = useState<ToiletCabinType>('STANDARD');
  const [cabinCount, setCabinCount] = useState(1);
  const [hireDays, setHireDays] = useState(7);
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  // ISO date string e.g. '2026-06-01'
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [pickingDate, setPickingDate] = useState<'START' | 'END'>('START');
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(() => user?.email ?? '');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'INVOICE'>('CARD');
  const [servicingFrequency, setServicingFrequency] = useState<
    'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null
  >(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [guestResult, setGuestResult] = useState<{ token: string; orderNumber: string } | null>(
    null,
  );
  const [showAuthGate, setShowAuthGate] = useState(false);
  const draftLoadedRef = useRef(false);

  // End-of-hire ISO date (derived from delivery date + hireDays)
  const collectionDay = selectedDay
    ? toISO(addDays(new Date(selectedDay + 'T00:00:00'), hireDays))
    : null;

  const handleCalendarPress = useCallback(
    (iso: string) => {
      haptics.light();
      const tapped = new Date(iso + 'T00:00:00');
      const start = selectedDay ? new Date(selectedDay + 'T00:00:00') : null;

      if (pickingDate === 'START' || !start) {
        setSelectedDay(iso);
        setHireDays(1); // Reset length so the user visually sees the selection dragging
        setPickingDate('END');
      } else {
        if (tapped < start) {
          setSelectedDay(iso);
          setHireDays(1);
          setPickingDate('END');
        } else {
          const diffDays = Math.round((tapped.getTime() - start.getTime()) / 86400000);
          setHireDays(diffDays > 0 ? diffDays : 1);
          setPickingDate('START');
        }
      }
    },
    [pickingDate, selectedDay],
  );

  // Sync contact from auth on login mid-wizard
  useEffect(() => {
    if (!user) return;
    if (!contactName.trim())
      setContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!contactPhone.trim()) setContactPhone(user.phone ?? '');
    if (!contactEmail.trim()) setContactEmail(user.email ?? '');
  }, [user?.id]);

  // Draft load on mount
  useEffect(() => {
    AsyncStorage.getItem(TOILET_CABIN_DRAFT_KEY)
      .then((raw) => {
        if (!raw) {
          draftLoadedRef.current = true;
          return;
        }
        try {
          const d: ToiletCabinDraft = JSON.parse(raw);
          if (d.savedAt && Date.now() - d.savedAt > DRAFT_TTL_MS) {
            AsyncStorage.removeItem(TOILET_CABIN_DRAFT_KEY).catch(() => {});
            draftLoadedRef.current = true;
            return;
          }
          if (d.step) setStep(d.step);
          if (d.cabinType) setCabinType(d.cabinType);
          if (d.cabinCount) setCabinCount(d.cabinCount);
          if (d.hireDays) setHireDays(d.hireDays);
          if (d.picked) setPicked(d.picked);
          if (d.selectedDay) setSelectedDay(d.selectedDay);
          if (d.deliveryWindow) setDeliveryWindow(d.deliveryWindow);
          if (d.contactName !== undefined) setContactName(d.contactName);
          if (d.contactPhone !== undefined) setContactPhone(d.contactPhone);
          if (d.contactEmail !== undefined) setContactEmail(d.contactEmail);
          if (d.notes !== undefined) setNotes(d.notes);
          if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
          if (d.servicingFrequency !== undefined) setServicingFrequency(d.servicingFrequency);
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

  // Draft save on state change
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    const draft: ToiletCabinDraft = {
      step,
      cabinType,
      cabinCount,
      hireDays,
      picked,
      selectedDay,
      deliveryWindow,
      contactName,
      contactPhone,
      contactEmail,
      notes,
      paymentMethod,
      servicingFrequency,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(TOILET_CABIN_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [
    step,
    cabinType,
    cabinCount,
    hireDays,
    picked,
    selectedDay,
    deliveryWindow,
    contactName,
    contactPhone,
    contactEmail,
    notes,
    paymentMethod,
    servicingFrequency,
  ]);

  const BASE_PRICE_BY_TYPE: Record<string, number> = {
    STANDARD: 1.0,
    DISABLED_ACCESS: 2.7,
    VIP: 1.7,
    HEATED: 2.7,
  };
  const estimatedPrice = (cabinCount * hireDays * (BASE_PRICE_BY_TYPE[cabinType] ?? 1.0)).toFixed(
    2,
  );

  // ── CTA config ────────────────────────────────────────────────────
  const ctaDisabled =
    (step === 1 && !cabinType) ||
    (step === 2 && cabinCount < 1) ||
    (step === 3 && !picked) ||
    (step === 4 && !selectedDay) ||
    (step === 5 && (!contactPhone.trim() || !contactName.trim())) ||
    loading;

  const ctaLabel = step === 5 ? 'Apstiprīnāt pasūtījumu' : 'Turpināt';

  // ── Guest submit handler ─────────────────────────────────────────
  const handleGuestSubmit = useCallback(
    async (contact: { name: string; phone: string; email?: string }) => {
      if (!picked || !selectedDay) return;
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      const servicingNote =
        servicingFrequency === 'WEEKLY'
          ? 'Tīrīšana: katru nedēļu'
          : servicingFrequency === 'BIWEEKLY'
            ? 'Tīrīšana: reizi 2 nedēļās'
            : servicingFrequency === 'MONTHLY'
              ? 'Tīrīšana: reizi mēnesī'
              : null;
      const cabinTypeLabel = CABIN_TYPES.find((c) => c.value === cabinType)?.label ?? cabinType;
      const combinedNotes = [`Kabīnes veids: ${cabinTypeLabel}`, servicingNote, notes]
        .filter(Boolean)
        .join('. ');
      try {
        const result = await api.guestOrders.create({
          category: 'TOILET_CABIN',
          quantity: cabinCount,
          unit: 'CABIN',
          materialName: 'Tualetes kabīne',
          hireDays,
          collectionDate: collectionDay ?? undefined,
          deliveryAddress: picked.address,
          deliveryCity: picked.city ?? '',
          deliveryLat: picked.lat,
          deliveryLng: picked.lng,
          deliveryDate: selectedDay,
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          contactName: contact.name,
          contactPhone: contact.phone,
          contactEmail: contact.email,
          notes: combinedNotes || undefined,
        });
        AsyncStorage.removeItem(TOILET_CABIN_DRAFT_KEY).catch(() => {});
        haptics.success();
        await addGuestOrder({
          token: result.token,
          orderNumber: result.orderNumber,
          category: 'TOILET_CABIN',
          createdAt: Date.now(),
        });
        setGuestResult({ token: result.token, orderNumber: result.orderNumber });
      } catch (err: unknown) {
        haptics.error();
        Alert.alert(
          'Kļūda',
          err instanceof Error ? err.message : 'Neizdevās iesniegt pieprasījumu',
        );
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [
      picked,
      selectedDay,
      cabinType,
      cabinCount,
      hireDays,
      collectionDay,
      deliveryWindow,
      notes,
      servicingFrequency,
    ],
  );

  // ── Submit ────────────────────────────────────────────────────────
  const doSubmit = useCallback(
    async (authToken: string) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      const servicingNote =
        servicingFrequency === 'WEEKLY'
          ? 'Tīrīšana: katru nedēļu'
          : servicingFrequency === 'BIWEEKLY'
            ? 'Tīrīšana: reizi 2 nedēļās'
            : servicingFrequency === 'MONTHLY'
              ? 'Tīrīšana: reizi mēnesī'
              : null;
      const cabinTypeLabel = CABIN_TYPES.find((c) => c.value === cabinType)?.label ?? cabinType;
      const combinedNotes = [`Kabīnes veids: ${cabinTypeLabel}`, servicingNote, notes]
        .filter(Boolean)
        .join('. ');
      try {
        const result = await api.createToiletCabinOrder(
          {
            address: picked!.address,
            city: picked!.city ?? '',
            lat: picked!.lat,
            lng: picked!.lng,
            cabinType,
            cabinCount,
            hireDays,
            deliveryDate: selectedDay!,
            deliveryWindow,
            contactName,
            contactPhone,
            contactEmail,
            notes: combinedNotes || undefined,
            paymentMethod,
          },
          authToken,
        );
        AsyncStorage.removeItem(TOILET_CABIN_DRAFT_KEY).catch(() => {});
        haptics.success();
        setConfirmedOrderNumber(result.orderNumber);
      } catch (err: unknown) {
        haptics.error();
        Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās iesniegt pasūtījumu');
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [
      picked,
      cabinType,
      cabinCount,
      hireDays,
      selectedDay,
      deliveryWindow,
      contactName,
      contactPhone,
      contactEmail,
      notes,
      servicingFrequency,
    ],
  );

  const onCTA = useCallback(async () => {
    haptics.medium();
    if (step < 5) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    if (!token) {
      setShowAuthGate(true);
      return;
    }
    await doSubmit(token);
  }, [step, token, doSubmit]);

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    } else {
      setStep((s) => (s - 1) as Step);
    }
  }, [step, router]);

  // ── Success screen ─────────────────────────────────────────────
  if (guestResult) {
    return (
      <GuestOrderSuccess
        orderNumber={guestResult.orderNumber}
        guestToken={guestResult.token}
        contactEmail={contactEmail || undefined}
        onBack={() => router.replace('/(buyer)/home' as never)}
        category="TOILET_CABIN"
      />
    );
  }

  if (confirmedOrderNumber) {
    return (
      <GuestOrderSuccess
        orderNumber={confirmedOrderNumber}
        contactEmail={contactEmail || undefined}
        onBack={() => router.replace('/(buyer)/home' as never)}
        category="TOILET_CABIN"
      />
    );
  }

  return (
    <>
      <WizardLayout
        title={STEP_TITLES[step]}
        totalSteps={5}
        step={step}
        onBack={goBack}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(buyer)/home' as never);
        }}
        ctaLabel={ctaLabel}
        onCTA={onCTA}
        ctaDisabled={ctaDisabled}
        ctaLoading={loading}
        stepKey={step}
      >
        {/* ── Step 1: Cabin type ── */}
        {step === 1 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.stepSub}>Kādu tualetes kabīni nepieciešams nomāt?</Text>
            <View style={{ gap: 12, marginTop: 16 }}>
              {CABIN_TYPES.map((ct) => {
                const isSel = cabinType === ct.value;
                return (
                  <TouchableOpacity
                    key={ct.value}
                    style={[s.cabinTypeCard, isSel && s.cabinTypeCardSel]}
                    onPress={() => {
                      haptics.light();
                      setCabinType(ct.value);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={s.cabinTypeCardHeader}>
                      <ct.Icon
                        size={22}
                        color={isSel ? colors.primary : '#6b7280'}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cabinTypeTitle, isSel && s.cabinTypeTitleSel]}>
                          {ct.label}
                        </Text>
                        <Text style={s.cabinTypeSub}>{ct.sub}</Text>
                      </View>
                      <View style={[s.cabinTypeBadge, isSel && s.cabinTypeBadgeSel]}>
                        <Text style={[s.cabinTypeBadgeText, isSel && s.cabinTypeBadgeTextSel]}>
                          no €{ct.fromPrice.toFixed(2)}/d.
                        </Text>
                      </View>
                    </View>
                    <View style={s.cabinTypeFeatures}>
                      {ct.features.map((f) => (
                        <View key={f} style={s.cabinTypeFeatureRow}>
                          <Text style={s.cabinTypeFeatureDot}>•</Text>
                          <Text style={s.cabinTypeFeatureText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ── Step 2: Cabin count ── */}
        {step === 2 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.stepSub}>Cik tualetes kabīnes nepieciešamas?</Text>

            <SectionLabel label="Kabīņu skaits" style={{ marginTop: 16 }} />
            <View style={s.counterRow}>
              <TouchableOpacity
                style={s.counterBtn}
                onPress={() => {
                  haptics.light();
                  setCabinCount((n) => Math.max(1, n - 1));
                }}
              >
                <Text style={s.counterBtnText}>−</Text>
              </TouchableOpacity>
              <View style={s.counterValue}>
                <Building2 size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={s.counterValueText}>{cabinCount}</Text>
              </View>
              <TouchableOpacity
                style={s.counterBtn}
                onPress={() => {
                  haptics.light();
                  setCabinCount((n) => Math.min(20, n + 1));
                }}
              >
                <Text style={s.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={s.cabinHint}>
              <Text style={s.cabinHintText}>Tipiskais ieteikums: 1 kabīne uz 10 darbiniekiem.</Text>
            </View>

            {/* Live price estimate based on current count + default hire period */}
            <View style={s.priceEstimate}>
              <Text style={s.priceEstimateMain}>
                ~€{(cabinCount * (BASE_PRICE_BY_TYPE[cabinType] ?? 1.0)).toFixed(2)}/dienā
              </Text>
              <Text style={s.priceEstimateSub}>
                ~€{estimatedPrice} par {hireDays} dienām · + PVN 21%
              </Text>
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Address ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={s.stepSub}>Kur piegādāt kabīnes?</Text>
              <AddressField
                label="Piegādes adrese"
                placeholder="Iela, pilsēta"
                value={picked}
                onPick={(addr) => setPicked(addr)}
              />
            </View>
          </ScrollView>
        )}

        {/* ── Step 4: Kad? (period + calendar together) ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
                Nomas periods
              </Text>
              <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 24, lineHeight: 22 }}>
                Cik ilgi plānojat nomāt kabīni?
              </Text>
            </View>

            {/* Horizontal Scroll for Period */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 12, paddingBottom: 16 }}
            >
              {HIRE_PERIOD_OPTIONS.map((opt) => {
                const isSel = hireDays === opt.days;
                return (
                  <TouchableOpacity
                    key={opt.days}
                    onPress={() => {
                      haptics.light();
                      setHireDays(opt.days);
                      setPickingDate('START');
                    }}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderRadius: 24,
                      backgroundColor: isSel ? '#111827' : '#f9fafb',
                      borderWidth: 1,
                      borderColor: isSel ? '#111827' : '#e5e7eb',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isSel ? '600' : '500',
                        color: isSel ? '#fff' : '#4b5563',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
              {/* Range summary block */}
              <WizardDateRangeSummary
                startDate={selectedDay}
                endDate={collectionDay}
                dayCount={hireDays}
              />

              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 }}>
                {pickingDate === 'START' ? 'Kurā datumā piegādāt?' : 'Līdz kuram datumam nomāt?'}
              </Text>

              <WizardCalendar
                selectedDate={selectedDay ?? ''}
                onDateChange={handleCalendarPress}
                minDate={MIN_DATE}
                rangeEndDate={collectionDay ?? undefined}
              />

              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#111827',
                  marginTop: 32,
                  marginBottom: 16,
                }}
              >
                Piegādes laiks
              </Text>
              <WizardTimeWindowPicker value={deliveryWindow} onChange={setDeliveryWindow} />

              {hireDays >= 14 && (
                <>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: '#111827',
                      marginTop: 32,
                      marginBottom: 16,
                    }}
                  >
                    Apkopes biežums
                  </Text>
                  <View style={{ gap: 12 }}>
                    {(
                      [
                        { value: 'WEEKLY' as const, label: 'Katru nedēļu' },
                        { value: 'BIWEEKLY' as const, label: 'Reizi 2 nedēļās' },
                        { value: 'MONTHLY' as const, label: 'Reizi mēnesī' },
                      ] as const
                    ).map((opt) => {
                      const isSel = servicingFrequency === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 16,
                            borderRadius: 16,
                            backgroundColor: isSel ? '#f8fafc' : '#fff',
                            borderWidth: isSel ? 2 : 1,
                            borderColor: isSel ? '#111827' : '#e5e7eb',
                          }}
                          onPress={() => {
                            haptics.light();
                            setServicingFrequency(opt.value);
                          }}
                          activeOpacity={0.7}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              borderWidth: 2,
                              borderColor: isSel ? '#111827' : '#d1d5db',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 16,
                            }}
                          >
                            {isSel && (
                              <View
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 5,
                                  backgroundColor: '#111827',
                                }}
                              />
                            )}
                          </View>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: isSel ? '600' : '500',
                              color: '#111827',
                            }}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        )}

        {/* ── Step 5: Contact + confirm ── */}
        {step === 5 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 24 }}>
                Pārbaudiet informāciju
              </Text>

              {/* Summary Card */}
              <View
                style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: '#f3f4f6',
                  marginBottom: 32,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Kabīnes veids</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {CABIN_TYPES.find((c) => c.value === cabinType)?.label ?? cabinType}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Daudzums</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {cabinCount} gab.
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Periods</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {hireDays} dienas
                  </Text>
                </View>
                {servicingFrequency && hireDays >= 14 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: '#6b7280' }}>Tīrīšana</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                      {servicingFrequency === 'WEEKLY'
                        ? 'Katru nedēļu'
                        : servicingFrequency === 'BIWEEKLY'
                          ? 'Reizi 2 nedēļās'
                          : 'Reizi mēnesī'}
                    </Text>
                  </View>
                )}

                <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 }} />

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Piegāde</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {selectedDay ? isoToDisplay(selectedDay) : '—'}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Savākšana</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                    {collectionDay ? isoToDisplay(collectionDay) : '—'}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Adrese</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#111827',
                      flex: 1,
                      textAlign: 'right',
                      marginLeft: 16,
                    }}
                    numberOfLines={1}
                  >
                    {picked?.address ?? '—'}
                  </Text>
                </View>

                <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 }} />

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                    Aptuvenā cena
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                    €{estimatedPrice}{' '}
                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#6b7280' }}>+ PVN</Text>
                  </Text>
                </View>
              </View>

              <WizardSectionHeading label="Kontakti" style={{ marginBottom: 12 }} />

              <WizardContactFields
                name={contactName}
                onChangeName={setContactName}
                namePlaceholder="Vārds, uzvārds"
                phone={contactPhone}
                onChangePhone={setContactPhone}
                email={contactEmail}
                onChangeEmail={setContactEmail}
                notes={notes}
                onChangeNotes={setNotes}
              />

              <WizardSectionHeading label="Apmaksa" style={{ marginBottom: 12 }} />
              <WizardPaymentMethodPicker
                value={paymentMethod}
                onChange={setPaymentMethod}
                isLoggedIn={!!user}
              />
            </View>
          </ScrollView>
        )}
      </WizardLayout>

      {/* Auth gate — fires when unauthenticated user tries to submit */}
      <WizardAuthGate
        visible={showAuthGate}
        onAuthenticated={() => {
          setShowAuthGate(false);
          // token will be updated in the next render via useAuth; re-trigger via onCTA
          setTimeout(() => onCTA(), 0);
        }}
        onGuestContact={(contact) => {
          setShowAuthGate(false);
          handleGuestSubmit(contact);
        }}
        onRegister={() => {
          setShowAuthGate(false);
          router.push('/(auth)/register' as never);
        }}
        onDismiss={() => setShowAuthGate(false)}
        prefilledName={contactName}
        prefilledPhone={contactPhone}
        prefilledEmail={contactEmail}
      />
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  content: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  contentPad: { paddingTop: 0, paddingHorizontal: 20, paddingBottom: 40 },
  stepSub: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 22,
  },

  // Cabin type cards
  cabinTypeCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 14,
  },
  cabinTypeCardSel: {
    borderColor: colors.primary,
    backgroundColor: '#f0fdf4',
  },
  cabinTypeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cabinTypeTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cabinTypeTitleSel: {
    color: colors.primary,
  },
  cabinTypeSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
    lineHeight: 16,
  },
  cabinTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.bgMuted,
    marginLeft: 8,
  },
  cabinTypeBadgeSel: {
    backgroundColor: colors.primary + '20',
  },
  cabinTypeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
  },
  cabinTypeBadgeTextSel: {
    color: colors.primary,
  },
  cabinTypeFeatures: {
    marginTop: 10,
    gap: 4,
    paddingLeft: 32,
  },
  cabinTypeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cabinTypeFeatureDot: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cabinTypeFeatureText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },

  // Counter
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  counterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: 24,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  counterValue: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'center',
  },
  counterValueText: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Period chips
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  periodChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.bgMuted,
  },
  periodChipSel: {
    backgroundColor: colors.primary,
  },
  periodChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  periodChipTextSel: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },

  // Cabin step hint
  cabinHint: {
    marginTop: 28,
    padding: 16,
    backgroundColor: colors.bgMuted,
    borderRadius: 12,
  },
  cabinHintText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },

  priceEstimate: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  priceEstimateMain: {
    fontSize: 22,
    fontWeight: '700',
    color: '#166534',
  },
  priceEstimateSub: {
    fontSize: 13,
    color: '#166534',
    marginTop: 4,
    opacity: 0.8,
  },

  // Range summary bar (matches skip-hire Step 3)
  rangeSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 16,
    marginBottom: 4,
  },
  rangeSummaryCol: {
    flex: 1,
    gap: 4,
  },
  rangeSummaryLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rangeSummaryDate: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  rangeSummaryDateEmpty: {
    color: colors.textDisabled,
  },
  rangeSummaryArrow: {
    paddingHorizontal: 12,
  },
  rangeSummaryArrowText: {
    fontSize: 18,
    color: colors.textMuted,
  },

  // Window chips (matches skip-hire)
  windowRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  windowChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgMuted,
  },
  windowChipActive: { backgroundColor: colors.primary },
  windowChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  windowChipTextActive: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
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
  payMethodRowActive: { borderColor: '#166534', backgroundColor: '#f0fdf4' },
  payMethodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payMethodRadioActive: { borderColor: '#166534' },
  payMethodRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#166534' },
  payMethodLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  payMethodLabelActive: { color: '#166534' },
  payMethodSub: { fontSize: 12, color: '#6b7280', marginTop: 2, fontFamily: 'Inter_400Regular' },
});
