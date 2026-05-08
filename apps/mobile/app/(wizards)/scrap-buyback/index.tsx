/**
 * Scrap Buyback wizard — sell your scrap metal/recycleables, get paid
 *
 *   Step 1 – Material type + weight
 *   Step 2 – Pickup address
 *   Step 3 – Compare offers (which center pays most?)
 *   Step 4 – Confirm + contact → submit
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Wrench, Trophy, MapPin, CheckCircle2 } from 'lucide-react-native';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { AddressField } from '@/components/ui/AddressField';
import { TextInputField } from '@/components/ui/TextInputField';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import type { BuybackQuoteCenterResult } from '@/lib/api';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius } from '@/lib/theme';

// ── Draft persistence ────────────────────────────────────────────
const BUYBACK_DRAFT_KEY = '@b3hub_scrap_buyback_draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BuybackDraft {
  step: Step;
  weightText: string;
  hasPhoto: boolean | null;
  picked: PickedAddress | null;
  notes: string;
  pickupDate: string;
  contactName: string;
  contactPhone: string;
  savedAt: number;
}

// ── Types ────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

// ── Constants ────────────────────────────────────────────────────

// Scrap buyback is METAL only — recycling centers pay you per tonne.
// WEEE, OIL_WASTE, TIRES, WOOD, PACKAGING_WASTE belong in the Disposal wizard.
const MATERIAL_LABELS: Record<string, string> = {
  METAL: 'Metāls / Dzelzslūžņi',
};

const STEP_TITLES: Record<Step, string> = {
  1: 'Kas jāatdod?',
  2: 'Kur paņemt?',
  3: 'Salīdzini cenas',
  4: 'Apstiprinājums',
};

// Truck logic reused from utilization wizard
function deriveTruck(weightT: number): { truckType: DisposalTruckType; truckCount: number } {
  if (weightT <= 7) return { truckType: 'TIPPER_SMALL', truckCount: 1 };
  if (weightT <= 15) return { truckType: 'TIPPER_LARGE', truckCount: 1 };
  return { truckType: 'ARTICULATED_TIPPER', truckCount: Math.ceil(weightT / 20) };
}

// ── Component ────────────────────────────────────────────────────

export default function ScrapBuybackWizard() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const toast = useToast();
  const { user, token } = useAuth();

  const [step, setStep] = useState<Step>(1);

  // Material type is always METAL — buyback only applies to scrap metal
  const materialType: WasteType = 'METAL';
  const [weightText, setWeightText] = useState(''); // tonnes (master)
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);

  // Step 2 — pickup address
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [notes, setNotes] = useState('');

  // Step 3 — offers comparison
  const [offers, setOffers] = useState<BuybackQuoteCenterResult[] | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);

  // Step 4 — contact + submit
  const [pickupDate, setPickupDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!contactName.trim())
      setContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!contactPhone.trim()) setContactPhone(user.phone ?? '');
  }, [user?.id]);

  // ── Draft: restore on mount ───────────────────────────────────
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(BUYBACK_DRAFT_KEY)
      .then((raw) => {
        if (!raw) {
          draftLoadedRef.current = true;
          return;
        }
        try {
          const d: BuybackDraft = JSON.parse(raw);
          if (d.savedAt && Date.now() - d.savedAt > DRAFT_TTL_MS) {
            AsyncStorage.removeItem(BUYBACK_DRAFT_KEY).catch(() => {});
            draftLoadedRef.current = true;
            return;
          }
          if (d.step) setStep(d.step);
          if (d.weightText) setWeightText(d.weightText);
          if (d.hasPhoto !== undefined) setHasPhoto(d.hasPhoto);
          if (d.picked) setPicked(d.picked);
          if (d.notes !== undefined) setNotes(d.notes);
          if (d.pickupDate) setPickupDate(d.pickupDate);
          if (d.contactName !== undefined) setContactName(d.contactName);
          if (d.contactPhone !== undefined) setContactPhone(d.contactPhone);
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

  // ── Draft: save on state change ───────────────────────────────
  useEffect(() => {
    if (!draftLoadedRef.current) return;
    const draft: BuybackDraft = {
      step,
      weightText,
      hasPhoto,
      picked,
      notes,
      pickupDate,
      contactName,
      contactPhone,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(BUYBACK_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [step, weightText, hasPhoto, picked, notes, pickupDate, contactName, contactPhone]);

  const weightT = parseFloat(weightText);
  const validWeight = !isNaN(weightT) && weightT > 0;

  const selectedOffer = offers?.find((o) => o.centerId === selectedCenterId) ?? null;

  // ── Load offers when entering step 3 ─────────────────────────

  const loadOffers = useCallback(async () => {
    if (!materialType || !validWeight || !token) return;
    setLoadingOffers(true);
    setOffers(null);
    setSelectedCenterId(null);
    try {
      const res = await api.recyclingCenters.getBuybackQuote(
        {
          wasteType: materialType,
          weightKg: weightT * 1000,
          lat: picked?.lat,
          lng: picked?.lng,
        },
        token,
      );
      setOffers(res.data);
      if (res.data.length > 0) {
        setSelectedCenterId(res.data[0].centerId); // pre-select best offer
      }
    } catch {
      toast.error('Neizdevās ielādēt piedāvājumus. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setLoadingOffers(false);
    }
  }, [materialType, validWeight, weightT, token, picked, toast]);

  // ── Navigation ───────────────────────────────────────────────

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    } else {
      setStep((s) => (s - 1) as Step);
    }
  }, [step, router]);

  const handleCTA = useCallback(async () => {
    haptics.medium();
    if (step === 2) {
      // Require auth before loading offers (payment requires account)
      if (!token) {
        setShowAuthGate(true);
        return;
      }
      // advance to step 3 and load offers
      setStep(3);
      await loadOffers();
      return;
    }
    if (step < 4) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    // step 4 — submit
    if (!token) {
      setShowAuthGate(true);
      return;
    }
    if (!materialType || !picked || !selectedOffer) return;

    const estimated = validWeight ? weightT : 1;
    const derived = deriveTruck(estimated);

    setSubmitting(true);
    try {
      const result = await api.disposal.create(
        {
          pickupAddress: picked.address,
          pickupCity: picked.city ?? '',
          pickupLat: picked.lat,
          pickupLng: picked.lng,
          wasteType: materialType,
          truckType: derived.truckType,
          truckCount: derived.truckCount,
          estimatedWeight: estimated,
          requestedDate: pickupDate,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes:
            [
              notes,
              hasPhoto === true ? '📷 Ir pieejamas foto' : hasPhoto === false ? 'Nav foto' : '',
            ]
              .filter(Boolean)
              .join('. ') || undefined,
          preferredRecyclingCenterId: selectedOffer.centerId,
          buybackPricePerTonne: selectedOffer.buybackPricePerTonne,
          projectId: projectId || undefined,
        },
        token,
      );
      const jn = result?.jobNumber ?? '';
      AsyncStorage.removeItem(BUYBACK_DRAFT_KEY).catch(() => {});
      router.replace({ pathname: '/(buyer)/orders' as never, params: { highlight: jn } });
      toast.success(`Pieprasījums ${jn} nosūtīts! Gaidiet izmaksu pēc savākšanas.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kļūda. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setSubmitting(false);
    }
  }, [
    step,
    token,
    materialType,
    picked,
    selectedOffer,
    validWeight,
    weightT,
    contactName,
    contactPhone,
    notes,
    pickupDate,
    projectId,
    router,
    toast,
    loadOffers,
  ]);

  const ctaDisabled =
    (step === 1 && !validWeight) ||
    (step === 2 && !picked) ||
    (step === 3 && (!selectedCenterId || loadingOffers)) ||
    (step === 4 && (!contactName.trim() || !contactPhone.trim())) ||
    submitting;

  return (
    <>
      <WizardLayout
        title={STEP_TITLES[step]}
        step={step}
        totalSteps={4}
        onBack={goBack}
        ctaLabel={step === 4 ? 'Nosūtīt pieprasījumu' : 'Turpināt'}
        onCTA={handleCTA}
        ctaDisabled={ctaDisabled}
        ctaLoading={submitting}
        stepKey={step}
      >
        {step === 1 && (
          <StepMaterial
            weightText={weightText}
            onWeightChange={setWeightText}
            hasPhoto={hasPhoto}
            onHasPhotoChange={setHasPhoto}
          />
        )}
        {step === 2 && (
          <StepAddress
            picked={picked}
            onPickChange={setPicked}
            notes={notes}
            onNotesChange={setNotes}
          />
        )}
        {step === 3 && (
          <StepOffers
            loading={loadingOffers}
            offers={offers}
            selectedId={selectedCenterId}
            onSelect={setSelectedCenterId}
            weightT={validWeight ? weightT : 1}
            materialLabel={materialType ? (MATERIAL_LABELS[materialType] ?? materialType) : ''}
          />
        )}
        {step === 4 && (
          <StepConfirm
            offer={selectedOffer}
            materialLabel={materialType ? (MATERIAL_LABELS[materialType] ?? materialType) : ''}
            weightText={weightText}
            picked={picked}
            pickupDate={pickupDate}
            onPickupDateChange={setPickupDate}
            contactName={contactName}
            onContactNameChange={setContactName}
            contactPhone={contactPhone}
            onContactPhoneChange={setContactPhone}
          />
        )}
      </WizardLayout>
      <WizardAuthGate
        visible={showAuthGate}
        onAuthenticated={async () => {
          setShowAuthGate(false);
          if (step === 2) {
            setStep(3);
            await loadOffers();
          } else {
            // Re-trigger CTA — token is now available
            handleCTA();
          }
        }}
        onDismiss={() => setShowAuthGate(false)}
        prefilledName={contactName}
        prefilledPhone={contactPhone}
      />
    </>
  );
}

// ── Step 1: Weight + photo ────────────────────────────────────────
// Material type is fixed to METAL — no picker needed.

function StepMaterial({
  weightText,
  onWeightChange,
  hasPhoto,
  onHasPhotoChange,
}: {
  weightText: string;
  onWeightChange: (t: string) => void;
  hasPhoto: boolean | null;
  onHasPhotoChange: (v: boolean) => void;
}) {
  // Derive kg display from tonnes master
  const kgValue = weightText
    ? (() => {
        const n = parseFloat(weightText);
        return isNaN(n) ? '' : String(Math.round(n * 1000));
      })()
    : '';

  function handleKgChange(val: string) {
    if (!val) {
      onWeightChange('');
      return;
    }
    const n = parseFloat(val);
    if (!isNaN(n)) {
      const t = n / 1000;
      onWeightChange(t % 1 === 0 ? String(t) : parseFloat(t.toFixed(3)).toString());
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.payoutBanner}>
        <Text style={s.payoutBannerText}>
          💶 Nododiet metāllūžņus — dzelzi, alumīniju, varu, nerūsējošo tēraudu — un saņemiet
          samaksu no licencētiem pārstrādātājiem
        </Text>
      </View>

      {/* Fixed material card */}
      <View style={[s.materialRow, s.materialRowSel]}>
        <View style={[s.matIconWrap, s.matIconWrapSel]}>
          <Wrench size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.matLabel, s.matLabelSel]}>Metāls / Dzelzslūžņi</Text>
          <Text style={[s.matDesc, s.matDescSel]}>
            Dzelzs, alumīnijs, varš, nerūsējošais tērauds, profili, stiegrojums
          </Text>
        </View>
        <View style={[s.hintBadge, s.hintBadgeSel]}>
          <Text style={[s.hintText, s.hintTextSel]}>Augsta vērtība</Text>
        </View>
        <CheckCircle2 size={20} color={colors.white} style={{ marginLeft: spacing.xs }} />
      </View>

      <Text style={[s.stepSub, { marginTop: spacing.sm, marginBottom: spacing.lg }]}>
        Elektroatkritumus, riepas, eļļas vai celtniecības atkritumus — izvēlieties Atkritumu
        izvešanu.
      </Text>

      {/* ── Dual t / kg weight input ── */}
      <SectionLabel label="Daudzums" style={[s.sectionLabel, { marginTop: spacing.lg }]} />
      <Text style={s.weightSubLabel}>1 t = 1000 kg · Ievadiet tonnās vai kilogramos</Text>
      <View style={s.weightRow}>
        <View style={s.weightInputWrap}>
          <TextInputField
            label=""
            value={weightText}
            onChangeText={onWeightChange}
            placeholder="0"
            keyboardType="decimal-pad"
          />
          <Text style={s.weightUnitLabel}>t</Text>
        </View>
        <View style={s.weightSep} />
        <View style={s.weightInputWrap}>
          <TextInputField
            label=""
            value={kgValue}
            onChangeText={handleKgChange}
            placeholder="0"
            keyboardType="decimal-pad"
          />
          <Text style={s.weightUnitLabel}>kg</Text>
        </View>
      </View>
      <Text style={s.weightHint}>Precīzs svars nav obligāts — vadītājs izmēra uz vietas</Text>

      {/* ── Photo availability ── */}
      <SectionLabel
        label="Vai Jums ir materiāla foto?"
        style={[s.sectionLabel, { marginTop: spacing.lg }]}
      />
      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, hasPhoto === true && s.toggleBtnSel]}
          onPress={() => {
            haptics.light();
            onHasPhotoChange(true);
          }}
          activeOpacity={0.75}
        >
          <Text style={[s.toggleBtnText, hasPhoto === true && s.toggleBtnTextSel]}>📷 Ir foto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, hasPhoto === false && s.toggleBtnSel]}
          onPress={() => {
            haptics.light();
            onHasPhotoChange(false);
          }}
          activeOpacity={0.75}
        >
          <Text style={[s.toggleBtnText, hasPhoto === false && s.toggleBtnTextSel]}>Nav foto</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Step 2: Pickup address ────────────────────────────────────────

function StepAddress({
  picked,
  onPickChange,
  notes,
  onNotesChange,
}: {
  picked: PickedAddress | null;
  onPickChange: (a: PickedAddress) => void;
  notes: string;
  onNotesChange: (t: string) => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.stepSub}>Kur atrodas materiāls? Mūsu auto ieradīsies, lai paņemtu.</Text>
      <AddressField
        label="Savākšanas adrese"
        value={picked}
        onPick={onPickChange}
        placeholder="Ievadiet adresi vai izvēlieties kartē"
      />
      <TextInputField
        label="Papildu piezīmes (nav obligāti)"
        value={notes}
        onChangeText={onNotesChange}
        placeholder="piem., metāls pagalmā aiz vārtiem"
        multiline
        numberOfLines={3}
        style={{ marginTop: spacing.md }}
      />
    </ScrollView>
  );
}

// ── Step 3: Offers comparison ─────────────────────────────────────

function StepOffers({
  loading,
  offers,
  selectedId,
  onSelect,
  weightT,
  materialLabel,
}: {
  loading: boolean;
  offers: BuybackQuoteCenterResult[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  weightT: number;
  materialLabel: string;
}) {
  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Meklē labākās cenas...</Text>
      </View>
    );
  }

  if (offers && offers.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTitle}>Šobrīd nav piedāvājumu</Text>
        <Text style={s.emptyDesc}>
          Neviens pārstrādātājs šobrīd nepiedāvā atpirkšanas cenu {materialLabel} materiālam. Lūdzu,
          mēģiniet vēlāk vai sazinieties ar mums.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.stepSub}>
        Izvēlieties izdevīgāko piedāvājumu. Cenas aprēķinātas par ~{weightT} t.
      </Text>
      {offers?.map((offer, idx) => {
        const isSel = offer.centerId === selectedId;
        const isBest = idx === 0;
        return (
          <TouchableOpacity
            key={offer.centerId}
            style={[s.offerCard, isSel && s.offerCardSel]}
            onPress={() => {
              haptics.light();
              onSelect(offer.centerId);
            }}
            activeOpacity={0.75}
          >
            {isBest && (
              <View style={s.bestBadge}>
                <Trophy size={12} color={colors.white} />
                <Text style={s.bestBadgeText}>Labākā cena</Text>
              </View>
            )}
            <View style={s.offerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.offerName, isSel && s.offerNameSel]} numberOfLines={1}>
                  {offer.name}
                </Text>
                <View style={s.offerLocation}>
                  <MapPin size={12} color={isSel ? colors.white : colors.textMuted} />
                  <Text style={[s.offerCity, isSel && s.offerCitySel]}>
                    {offer.city}
                    {offer.distanceKm != null ? ` · ${offer.distanceKm} km` : ''}
                    {offer.licensed ? ' · Licencēts' : ''}
                  </Text>
                </View>
              </View>
              <View style={s.payoutWrap}>
                <Text style={[s.payoutAmount, isSel && s.payoutAmountSel]}>
                  +€{offer.totalPayoutEur.toFixed(2)}
                </Text>
                <Text style={[s.payoutRate, isSel && s.payoutRateSel]}>
                  €{offer.buybackPricePerTonne.toFixed(0)}/t
                </Text>
              </View>
            </View>
            {offer.centerNotes ? (
              <Text style={[s.offerNotes, isSel && s.offerNotesSel]} numberOfLines={2}>
                {offer.centerNotes}
              </Text>
            ) : null}
            {isSel && (
              <View style={s.selectedCheck}>
                <CheckCircle2 size={16} color={colors.white} />
                <Text style={s.selectedCheckText}>Izvēlēts</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Step 4: Confirm ───────────────────────────────────────────────

function StepConfirm({
  offer,
  materialLabel,
  weightText,
  picked,
  pickupDate,
  onPickupDateChange,
  contactName,
  onContactNameChange,
  contactPhone,
  onContactPhoneChange,
}: {
  offer: BuybackQuoteCenterResult | null;
  materialLabel: string;
  weightText: string;
  picked: PickedAddress | null;
  pickupDate: string;
  onPickupDateChange: (d: string) => void;
  contactName: string;
  onContactNameChange: (t: string) => void;
  contactPhone: string;
  onContactPhoneChange: (t: string) => void;
}) {
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {offer && (
        <View style={s.payoutSummaryCard}>
          <Text style={s.payoutSummaryLabel}>Paredzamā izmaksa</Text>
          <Text style={s.payoutSummaryAmount}>+€{offer.totalPayoutEur.toFixed(2)}</Text>
          <Text style={s.payoutSummaryNote}>
            {offer.name} · €{offer.buybackPricePerTonne.toFixed(0)}/t
          </Text>
          <Text style={s.payoutSummaryDisclaimer}>
            Galīgā summa tiks precizēta pēc faktiskā svara mērījuma
          </Text>
        </View>
      )}

      <SectionLabel label="Kopsavilkums" style={s.sectionLabel} />
      <View style={s.summaryCard}>
        <DetailRow label="Materiāls" value={materialLabel} />
        <DetailRow label="Aptuvens svars" value={weightText ? `${weightText} t` : 'nav norādīts'} />
        <DetailRow label="Adrese" value={picked?.address ?? '-'} />
        {offer && <DetailRow label="Pārstrādātājs" value={offer.name} />}
      </View>

      <SectionLabel
        label="Vēlamais savākšanas datums"
        style={[s.sectionLabel, { marginTop: spacing.lg }]}
      />
      <WizardCalendar
        selectedDate={pickupDate}
        onDateChange={onPickupDateChange}
        minDate={minDate}
      />

      <SectionLabel label="Kontaktpersona" style={[s.sectionLabel, { marginTop: spacing.lg }]} />
      <TextInputField
        label="Vārds, uzvārds"
        value={contactName}
        onChangeText={onContactNameChange}
        placeholder="piem., Jānis Bērziņš"
      />
      <TextInputField
        label="Tālrunis"
        value={contactPhone}
        onChangeText={onContactPhoneChange}
        placeholder="+371 2000 0000"
        keyboardType="phone-pad"
        style={{ marginTop: spacing.sm }}
      />
      <Text style={s.submitHint}>
        Pēc savākšanas un svara mērījuma tiks veikts pārskaitījums uz jūsu kontu.
      </Text>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  stepSub: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  // Payout banner
  payoutBanner: {
    backgroundColor: colors.successLight ?? '#d1fae5',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  payoutBannerText: {
    fontSize: 13,
    color: colors.success ?? '#065f46',
    lineHeight: 19,
    fontWeight: '500',
  },
  // Material selection
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  materialRowSel: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  matIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matIconWrapSel: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  matLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 1,
  },
  matLabelSel: {
    color: colors.white,
  },
  matDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
  matDescSel: {
    color: 'rgba(255,255,255,0.75)',
  },
  hintBadge: {
    backgroundColor: colors.successLight ?? '#d1fae5',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hintBadgeSel: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  hintText: {
    fontSize: 11,
    color: colors.success ?? '#065f46',
    fontWeight: '600',
  },
  hintTextSel: {
    color: colors.white,
  },
  weightSubLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  weightInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weightSep: {
    width: 12,
    height: 1.5,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  weightUnitLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    paddingBottom: 2,
  },
  // Photo toggle
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  toggleBtnSel: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  toggleBtnTextSel: {
    color: colors.white,
  },
  weightHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  // Loading / empty
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyWrap: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Offer cards
  offerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  offerCardSel: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warning ?? '#f59e0b',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  bestBadgeText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '700',
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  offerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  offerNameSel: {
    color: colors.white,
  },
  offerLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  offerCity: {
    fontSize: 12,
    color: colors.textMuted,
  },
  offerCitySel: {
    color: 'rgba(255,255,255,0.75)',
  },
  payoutWrap: {
    alignItems: 'flex-end',
  },
  payoutAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success ?? '#059669',
  },
  payoutAmountSel: {
    color: colors.white,
  },
  payoutRate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  payoutRateSel: {
    color: 'rgba(255,255,255,0.7)',
  },
  offerNotes: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  offerNotesSel: {
    color: 'rgba(255,255,255,0.7)',
  },
  selectedCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  selectedCheckText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  // Summary / confirm
  payoutSummaryCard: {
    backgroundColor: colors.successLight ?? '#d1fae5',
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  payoutSummaryLabel: {
    fontSize: 13,
    color: colors.success ?? '#065f46',
    fontWeight: '500',
    marginBottom: 4,
  },
  payoutSummaryAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.success ?? '#065f46',
  },
  payoutSummaryNote: {
    fontSize: 13,
    color: colors.success ?? '#065f46',
    marginTop: 4,
  },
  payoutSummaryDisclaimer: {
    fontSize: 11,
    color: colors.success ?? '#065f46',
    opacity: 0.7,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  submitHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 18,
    textAlign: 'center',
  },
});
