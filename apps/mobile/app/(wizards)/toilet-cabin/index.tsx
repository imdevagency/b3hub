/**
 * Toilet Cabin Hire wizard
 *
 *   Step 1 – Cabin count
 *   Step 2 – Delivery address
 *   Step 3 – Kad? (hire period chips + date picker with range preview)
 *   Step 4 – Review + contact details + confirm
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';
import { GuestOrderSuccess } from '@/components/wizard/GuestOrderSuccess';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';
import { DetailRow } from '@/components/ui/DetailRow';
import { InfoSection } from '@/components/ui/InfoSection';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { api } from '@/lib/api';
import { addGuestOrder } from '@/lib/guest-token-storage';
import { addDays, toISO } from '@/components/wizard/skip-hire/_types';

// ── Types ──────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

// ── Draft persistence ──────────────────────────────────────────────
const TOILET_CABIN_DRAFT_KEY = '@b3hub_toilet_cabin_draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ToiletCabinDraft {
  step: Step;
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

const STEP_TITLES: Record<Step, string> = {
  1: 'Kabīnes',
  2: 'Adrese',
  3: 'Kad?',
  4: 'Apstiprināt',
};

// ── Component ───────────────────────────────────────────────────────
export default function ToiletCabinWizard() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [cabinCount, setCabinCount] = useState(1);
  const [hireDays, setHireDays] = useState(7);
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  // ISO date string e.g. '2026-06-01'
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
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

  const estimatedPrice = cabinCount * hireDays * BASE_PRICE_PER_CABIN_PER_DAY;

  // ── CTA config ────────────────────────────────────────────────────
  const ctaDisabled =
    (step === 1 && cabinCount < 1) ||
    (step === 2 && !picked) ||
    (step === 3 && !selectedDay) ||
    (step === 4 && (!contactPhone.trim() || !contactName.trim())) ||
    loading;

  const ctaLabel = step === 4 ? 'Apstiprināt pasūtījumu' : 'Turpināt';

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
      const combinedNotes = [servicingNote, notes].filter(Boolean).join('. ');
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
      const combinedNotes = [servicingNote, notes].filter(Boolean).join('. ');
      try {
        const result = await api.createToiletCabinOrder(
          {
            address: picked!.address,
            city: picked!.city ?? '',
            lat: picked!.lat,
            lng: picked!.lng,
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
    if (step < 4) {
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
        totalSteps={4}
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
        {/* ── Step 1: Cabin count ── */}
        {step === 1 && (
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
                ~€{cabinCount * BASE_PRICE_PER_CABIN_PER_DAY}/dienā
              </Text>
              <Text style={s.priceEstimateSub}>
                ~€{estimatedPrice} par {hireDays} dienām · + PVN 21%
              </Text>
            </View>
          </ScrollView>
        )}

        {/* ── Step 2: Address ── */}
        {step === 2 && (
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

        {/* ── Step 3: Kad? (period + calendar together) ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.contentPad}
            showsVerticalScrollIndicator={false}
          >
            {/* Hire period — first, because it drives the calendar range */}
            <SectionLabel label="Nomas periods" style={{ marginTop: 8 }} />
            <View style={[s.periodGrid, { marginBottom: 16 }]}>
              {HIRE_PERIOD_OPTIONS.map((opt) => {
                const isSel = hireDays === opt.days;
                return (
                  <TouchableOpacity
                    key={opt.days}
                    style={[s.periodChip, isSel && s.periodChipSel]}
                    onPress={() => {
                      haptics.light();
                      setHireDays(opt.days);
                    }}
                  >
                    <Text style={[s.periodChipText, isSel && s.periodChipTextSel]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date range summary bar — updates live as user picks period & date */}
            <View style={s.rangeSummaryBar}>
              <View style={s.rangeSummaryCol}>
                <Text style={s.rangeSummaryLabel}>Piegāde</Text>
                <Text style={[s.rangeSummaryDate, !selectedDay && s.rangeSummaryDateEmpty]}>
                  {selectedDay ? isoToDisplay(selectedDay) : 'Izvēlieties'}
                </Text>
              </View>
              <View style={s.rangeSummaryArrow}>
                <Text style={s.rangeSummaryArrowText}>→</Text>
              </View>
              <View style={[s.rangeSummaryCol, { alignItems: 'flex-end' }]}>
                <Text style={s.rangeSummaryLabel}>
                  Savākšana{collectionDay ? ` · ${hireDays} d.` : ''}
                </Text>
                <Text style={[s.rangeSummaryDate, !collectionDay && s.rangeSummaryDateEmpty]}>
                  {collectionDay ? isoToDisplay(collectionDay) : '—'}
                </Text>
              </View>
            </View>

            {/* Calendar — tap delivery date, range end auto-derived from period above */}
            <WizardCalendar
              selectedDate={selectedDay ?? ''}
              onDateChange={setSelectedDay}
              minDate={MIN_DATE}
              rangeEndDate={collectionDay ?? undefined}
            />

            {/* Delivery time window */}
            <SectionLabel label="Vēlamais piegādes laiks" style={{ marginTop: 4 }} />
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
                  style={[s.windowChip, deliveryWindow === val && s.windowChipActive]}
                  onPress={() => setDeliveryWindow(val)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[s.windowChipText, deliveryWindow === val && s.windowChipTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Servicing schedule — shown for hires ≥ 14 days */}
            {hireDays >= 14 && (
              <>
                <SectionLabel label="Tīrīšanas biežums" style={{ marginTop: 16 }} />
                <Text style={s.stepSub}>Kā bieži kabīne jātīra?</Text>
                <View style={[s.periodGrid, { marginBottom: 16 }]}>
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
                        style={[s.periodChip, isSel && s.periodChipSel]}
                        onPress={() => {
                          haptics.light();
                          setServicingFrequency(opt.value);
                        }}
                      >
                        <Text style={[s.periodChipText, isSel && s.periodChipTextSel]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* ── Step 4: Contact + confirm ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Summary */}
            <View style={{ marginBottom: 20 }}>
              <InfoSection title="Pasūtījuma kopsavilkums">
                <DetailRow label="Kabīnes" value={`${cabinCount} gab.`} />
                <DetailRow label="Nomas periods" value={`${hireDays} dienas`} />
                <DetailRow label="Adrese" value={picked?.address ?? '—'} />
                <DetailRow label="Piegāde" value={selectedDay ? isoToLong(selectedDay) : '—'} />
                <DetailRow
                  label="Savākšana"
                  value={collectionDay ? isoToLong(collectionDay) : '—'}
                />
                <DetailRow
                  label="Laiks"
                  value={
                    deliveryWindow === 'AM'
                      ? 'Rīts (8–12)'
                      : deliveryWindow === 'PM'
                        ? 'Diena (12–17)'
                        : 'Jebkurā laikā'
                  }
                />
                <DetailRow
                  label="Aptuvena cena"
                  value={`€${estimatedPrice} + PVN`}
                  last={!servicingFrequency || hireDays < 14}
                />
                {servicingFrequency && hireDays >= 14 && (
                  <DetailRow
                    label="Tīrīšana"
                    value={
                      servicingFrequency === 'WEEKLY'
                        ? 'Katru nedēļu'
                        : servicingFrequency === 'BIWEEKLY'
                          ? 'Reizi 2 nedēļās'
                          : 'Reizi mēnesī'
                    }
                    last
                  />
                )}
              </InfoSection>
            </View>

            {/* Contact */}
            <SectionLabel label="Kontaktinformācija *" />
            <View style={{ gap: 12, marginTop: 8 }}>
              <TextInputField
                placeholder="Vārds, uzvārds"
                value={contactName}
                onChangeText={setContactName}
              />
              <TextInputField
                placeholder="Tālrunis"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
              <TextInputField
                placeholder="E-pasts (neobligāti)"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInputField
                placeholder="Piezīmes (piem., piekļuves kods, vietas apraksts)"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Payment method */}
            <SectionLabel label="Maksājuma veids" style={{ marginTop: 16 }} />
            <View style={{ gap: 10, marginBottom: 8 }}>
              {(
                [
                  [
                    'CARD',
                    '💳 Ar karti (Paysera)',
                    'Tūlītējs maksājums ar debetkarti vai kredītkarti',
                  ],
                  ...(user
                    ? [
                        [
                          'INVOICE',
                          '🧾 Priekšapmaksas rēķins',
                          'Rēķins tiks nosūtīts uz e-pastu',
                        ] as const,
                      ]
                    : []),
                ] as const
              ).map(([val, label, sub]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.payMethodRow, paymentMethod === val && s.payMethodRowActive]}
                  onPress={() => setPaymentMethod(val)}
                  activeOpacity={0.75}
                >
                  <View style={[s.payMethodRadio, paymentMethod === val && s.payMethodRadioActive]}>
                    {paymentMethod === val && <View style={s.payMethodRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.payMethodLabel, paymentMethod === val && s.payMethodLabelActive]}
                    >
                      {label}
                    </Text>
                    <Text style={s.payMethodSub}>{sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
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
