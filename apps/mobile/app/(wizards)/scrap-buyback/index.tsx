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
  TextInput,
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
import { WizardSummaryCard } from '@/components/wizard/WizardSummaryCard';
import { WizardPaymentMethodPicker } from '@/components/wizard/WizardPaymentMethodPicker';
import { WizardTimeWindowPicker } from '@/components/wizard/WizardTimeWindowPicker';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { api, fetchScrapMaterials } from '@/lib/api';
import type { WasteType, DisposalTruckType, ScrapMaterialDefinition } from '@/lib/api';
import type { BuybackQuoteCenterResult } from '@/lib/api';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius } from '@/lib/theme';

// ── Draft persistence ────────────────────────────────────────────
const BUYBACK_DRAFT_KEY = '@b3hub_scrap_buyback_draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BuybackDraft {
  step: Step;
  scrapMaterialCode: string;
  weightText: string;
  hasPhoto: boolean | null;
  transport: 'pickup' | 'self';
  picked: PickedAddress | null;
  notes: string;
  pickupDate: string;
  contactName: string;
  contactPhone: string;
  savedAt: number;
}

// Fallback labels while catalogue loads
const FALLBACK_MATERIALS: ScrapMaterialDefinition[] = [
  {
    id: '',
    code: 'FERROUS_METAL',
    label: 'Ferrous Metal / Steel',
    labelLv: 'Melnais metāls / Tērauds',
    description: null,
    descriptionLv: null,
    indicativePricePerTonne: null,
    currency: 'EUR',
    selfTransportAllowed: true,
    sortOrder: 1,
  },
  {
    id: '',
    code: 'ALUMINIUM',
    label: 'Aluminium',
    labelLv: 'Alumīnijs',
    description: null,
    descriptionLv: null,
    indicativePricePerTonne: null,
    currency: 'EUR',
    selfTransportAllowed: true,
    sortOrder: 2,
  },
  {
    id: '',
    code: 'COPPER',
    label: 'Copper',
    labelLv: 'Varš',
    description: null,
    descriptionLv: null,
    indicativePricePerTonne: null,
    currency: 'EUR',
    selfTransportAllowed: true,
    sortOrder: 3,
  },
  {
    id: '',
    code: 'MIXED_METAL',
    label: 'Mixed Metal',
    labelLv: 'Jauktais metāls',
    description: null,
    descriptionLv: null,
    indicativePricePerTonne: null,
    currency: 'EUR',
    selfTransportAllowed: true,
    sortOrder: 4,
  },
  {
    id: '',
    code: 'STAINLESS_STEEL',
    label: 'Stainless Steel',
    labelLv: 'Nerūsējošais tērauds',
    description: null,
    descriptionLv: null,
    indicativePricePerTonne: null,
    currency: 'EUR',
    selfTransportAllowed: true,
    sortOrder: 5,
  },
];

// ── Types ────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

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

  // Catalogue: scrap material types from DB
  const [scrapMaterials, setScrapMaterials] =
    useState<ScrapMaterialDefinition[]>(FALLBACK_MATERIALS);
  useEffect(() => {
    fetchScrapMaterials()
      .then((mats) => {
        if (mats.length > 0) setScrapMaterials(mats);
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  // Material type — always maps to WasteType.METAL for backend; code is fine-grained UI label
  const materialType: WasteType = 'METAL';
  const [scrapMaterialCode, setScrapMaterialCode] = useState('FERROUS_METAL');
  const [weightText, setWeightText] = useState(''); // tonnes (master)
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [transport, setTransport] = useState<'pickup' | 'self'>('pickup');

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
          if (d.scrapMaterialCode) setScrapMaterialCode(d.scrapMaterialCode);
          if (d.weightText) setWeightText(d.weightText);
          if (d.hasPhoto !== undefined) setHasPhoto(d.hasPhoto);
          if (d.transport) setTransport(d.transport);
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
      scrapMaterialCode,
      weightText,
      hasPhoto,
      transport,
      picked,
      notes,
      pickupDate,
      contactName,
      contactPhone,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(BUYBACK_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [
    step,
    scrapMaterialCode,
    weightText,
    hasPhoto,
    transport,
    picked,
    notes,
    pickupDate,
    contactName,
    contactPhone,
  ]);

  const weightT = parseFloat(weightText);
  const validWeight = !isNaN(weightT) && weightT > 0;

  const selectedOffer = offers?.find((o) => o.centerId === selectedCenterId) ?? null;
  const selectedMaterial = scrapMaterials.find((m) => m.code === scrapMaterialCode);
  const materialLabel = selectedMaterial?.labelLv ?? selectedMaterial?.label ?? scrapMaterialCode;

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
              `Materiāls: ${materialLabel}`,
              hasPhoto === true ? '📷 Ir pieejamas foto' : hasPhoto === false ? 'Nav foto' : '',
              transport === 'self' ? 'Pircējs atvedīs pats — nav nepieciešams transports.' : '',
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

  const getStepProps = () => {
    switch (step) {
      case 1:
        return {
          title: 'Ko vēlaties pārdot?',
          description: 'Izvēlieties materiāla veidu un ievadiet aptuveno svaru.',
        };
      case 2:
        return {
          title: transport === 'self' ? 'Jūsu lokācija' : 'Kur atrodas metāls?',
          description:
            transport === 'self'
              ? 'Norādiet atrašanās vietu, lai atrastu tuvākos punktus.'
              : 'Mūsu auto ieradīsies apstiprinātajā adresē.',
        };
      case 3:
        return {
          title: 'Izvēlieties punktu',
          description: `${materialLabel} · aptuveni ${validWeight ? weightT : 1} t`,
        };
      case 4:
        return {
          title: 'Pasūtījuma detaļas',
          description: undefined,
        };
      default:
        return { title: 'Pieprasījums', description: undefined };
    }
  };
  const currentStepInfo = getStepProps();

  return (
    <>
      <WizardLayout
        title={currentStepInfo.title}
        description={currentStepInfo.description}
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
            materials={scrapMaterials}
            selectedCode={scrapMaterialCode}
            onSelectCode={setScrapMaterialCode}
            weightText={weightText}
            onWeightChange={setWeightText}
            hasPhoto={hasPhoto}
            onHasPhotoChange={setHasPhoto}
            transport={transport}
            onTransportChange={setTransport}
          />
        )}
        {step === 2 && (
          <StepAddress
            picked={picked}
            onPickChange={setPicked}
            notes={notes}
            onNotesChange={setNotes}
            transport={transport}
          />
        )}
        {step === 3 && (
          <StepOffers
            loading={loadingOffers}
            offers={offers}
            selectedId={selectedCenterId}
            onSelect={setSelectedCenterId}
            weightT={validWeight ? weightT : 1}
            materialLabel={materialLabel}
          />
        )}
        {step === 4 && (
          <StepConfirm
            offer={selectedOffer}
            materialLabel={materialLabel}
            weightText={weightText}
            picked={picked}
            pickupDate={pickupDate}
            onPickupDateChange={setPickupDate}
            contactName={contactName}
            onContactNameChange={setContactName}
            contactPhone={contactPhone}
            onContactPhoneChange={setContactPhone}
            transport={transport}
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
        onRegister={() => {
          setShowAuthGate(false);
          router.push('/(auth)/register' as never);
        }}
        onDismiss={() => setShowAuthGate(false)}
        prefilledName={contactName}
        prefilledPhone={contactPhone}
      />
    </>
  );
}

// ── Step 1: Material type + weight + photo ────────────────────────

function StepMaterial({
  materials,
  selectedCode,
  onSelectCode,
  weightText,
  onWeightChange,
  hasPhoto,
  onHasPhotoChange,
  transport,
  onTransportChange,
}: {
  materials: ScrapMaterialDefinition[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  weightText: string;
  onWeightChange: (t: string) => void;
  hasPhoto: boolean | null;
  onHasPhotoChange: (v: boolean) => void;
  transport: 'pickup' | 'self';
  onTransportChange: (v: 'pickup' | 'self') => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Material type selector */}
      <Text style={s.uberSectionTitle}>Materiāla veids</Text>
      <View style={s.materialGrid}>
        {materials.map((mat) => {
          const isSel = mat.code === selectedCode;
          return (
            <TouchableOpacity
              key={mat.code}
              style={[s.materialCard, isSel && s.materialCardSel]}
              onPress={() => {
                haptics.light();
                onSelectCode(mat.code);
              }}
              activeOpacity={0.8}
            >
              <Text style={[s.materialCardText, isSel && s.materialCardTextSel]} numberOfLines={2}>
                {mat.labelLv ?? mat.label}
              </Text>
              {mat.indicativePricePerTonne != null && (
                <Text style={[s.materialCardPrice, isSel && s.materialCardPriceSel]}>
                  ~€{mat.indicativePricePerTonne.toFixed(0)}/t
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.uberDivider} />

      <View style={s.giantInputRow}>
        <TextInput
          value={weightText}
          onChangeText={onWeightChange}
          placeholder="0.0"
          placeholderTextColor={colors.textDisabled}
          keyboardType="decimal-pad"
          style={s.giantInput}
          maxLength={6}
        />
        <Text style={s.giantInputUnit}>tonnas</Text>
      </View>
      <Text style={s.uberHintCenter}>
        Precīzs svars nav obligāts — galīgo summu noteiksim pēc svēršanas.
      </Text>

      <View style={s.uberDivider} />

      <Text style={s.uberSectionTitle}>Vai jums ir materiāla foto?</Text>
      <View style={s.uberPillGroup}>
        <TouchableOpacity
          style={[s.uberPillBtn, hasPhoto === true && s.uberPillBtnSel]}
          onPress={() => {
            haptics.light();
            onHasPhotoChange(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={[s.uberPillText, hasPhoto === true && s.uberPillTextSel]}>📸 Ir foto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.uberPillBtn, hasPhoto === false && s.uberPillBtnSel]}
          onPress={() => {
            haptics.light();
            onHasPhotoChange(false);
          }}
          activeOpacity={0.8}
        >
          <Text style={[s.uberPillText, hasPhoto === false && s.uberPillTextSel]}>Nav foto</Text>
        </TouchableOpacity>
      </View>

      <Text style={[s.uberSectionTitle, { marginTop: spacing.xl }]}>Kā vēlaties nodot?</Text>
      <View style={s.uberPillGroup}>
        <TouchableOpacity
          style={[s.uberPillBtn, transport === 'pickup' && s.uberPillBtnSel]}
          onPress={() => {
            haptics.light();
            onTransportChange('pickup');
          }}
          activeOpacity={0.8}
        >
          <Text style={[s.uberPillText, transport === 'pickup' && s.uberPillTextSel]}>
            🚛 Atbrauks paņemt
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.uberPillBtn, transport === 'self' && s.uberPillBtnSel]}
          onPress={() => {
            haptics.light();
            onTransportChange('self');
          }}
          activeOpacity={0.8}
        >
          <Text style={[s.uberPillText, transport === 'self' && s.uberPillTextSel]}>
            🚗 Atvedīšu pats
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Step 2: Address ───────────────────────────────────────────────

function StepAddress({
  picked,
  onPickChange,
  notes,
  onNotesChange,
  transport,
}: {
  picked: PickedAddress | null;
  onPickChange: (a: PickedAddress) => void;
  notes: string;
  onNotesChange: (t: string) => void;
  transport: 'pickup' | 'self';
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AddressField
        label=""
        value={picked}
        onPick={onPickChange}
        placeholder="Ievadiet adresi vai izvēlieties kartē"
      />
      {transport === 'pickup' && picked && (
        <TextInputField
          label="Papildu piezīmes pārvadātājam"
          value={notes}
          onChangeText={onNotesChange}
          placeholder="piem., vārti pa kreisi, zvanīt..."
          multiline
          numberOfLines={3}
          containerStyle={{ marginTop: spacing.lg }}
        />
      )}
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
        <ActivityIndicator size="large" color={colors.textPrimary} />
        <Text style={s.loadingText}>Meklē labākās cenas...</Text>
      </View>
    );
  }

  if (offers && offers.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTitle}>Šobrīd nav piedāvājumu</Text>
        <Text style={s.emptyDesc}>
          Neviens pārstrādātājs šobrīd nepiedāvā atpirkšanas cenu. Lūdzu, mēģiniet vēlāk.
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
      {offers?.map((offer, idx) => {
        const isSel = offer.centerId === selectedId;
        const isBest = idx === 0;
        return (
          <TouchableOpacity
            key={offer.centerId}
            style={[s.uberOfferCard, isSel && s.uberOfferCardSel]}
            onPress={() => {
              haptics.light();
              onSelect(offer.centerId);
            }}
            activeOpacity={0.8}
          >
            <View style={s.offerHeader}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}
                >
                  <Text style={[s.uberOfferName, isSel && s.uberOfferNameSel]} numberOfLines={1}>
                    {offer.name}
                  </Text>
                  {isBest && (
                    <View style={s.uberBestBadge}>
                      <Text style={s.uberBestBadgeText}>Labākais</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.uberOfferCity, isSel && s.uberOfferCitySel]}>
                  {offer.city}
                  {offer.distanceKm != null ? ` · ${offer.distanceKm} km` : ''}
                  {offer.licensed ? ' · Licencēts' : ''}
                </Text>
              </View>
              <View style={s.payoutWrap}>
                <Text style={[s.uberOfferPayout, isSel && s.uberOfferPayoutSel]}>
                  €{offer.totalPayoutEur.toFixed(2)}
                </Text>
                <Text style={[s.uberOfferRate, isSel && s.uberOfferRateSel]}>
                  €{offer.buybackPricePerTonne.toFixed(0)}/t
                </Text>
              </View>
            </View>
            {offer.centerNotes ? (
              <Text style={[s.offerNotes, isSel && s.offerNotesSel]} numberOfLines={2}>
                {offer.centerNotes}
              </Text>
            ) : null}
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
  transport,
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
  transport: 'pickup' | 'self';
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
        <View style={s.uberSummaryGiant}>
          <Text style={s.uberSummaryGiantLabel}>Paredzamā izmaksa</Text>
          <Text style={s.uberSummaryGiantAmount}>€{offer.totalPayoutEur.toFixed(2)}</Text>
          <Text style={s.uberSummaryGiantNote}>
            Gala summa atkarīga no mērījuma uz vietas ({offer.name})
          </Text>
        </View>
      )}

      <Text style={[s.uberSectionTitle, { marginTop: spacing['2xl'] }]}>
        {transport === 'self' ? 'Plānotais datums' : 'Savākšanas datums'}
      </Text>
      <WizardCalendar
        selectedDate={pickupDate}
        onDateChange={onPickupDateChange}
        minDate={minDate}
      />

      <Text style={[s.uberSectionTitle, { marginTop: spacing['2xl'] }]}>Kontaktinformācija</Text>
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
        containerStyle={{ marginTop: spacing.sm }}
      />

      <View style={s.taxDisclaimerBox}>
        <Text style={s.taxDisclaimerText}>
          ⚠️ <Text style={{ fontWeight: '700' }}>Nodokļu informācija:</Text> fiziskām personām no
          izmaksas ietur 10% IIN. Juridiskām personām piemēro PVN reverso shēmu.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 48,
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
    backgroundColor: colors.successBg,
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
    backgroundColor: colors.bgCard,
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
    backgroundColor: colors.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matIconWrapSel: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  matLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
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
    backgroundColor: colors.successBg,
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
    backgroundColor: colors.bgCard,
  },
  toggleBtnSel: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
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
    backgroundColor: colors.bgCard,
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
    color: colors.textPrimary,
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
    backgroundColor: colors.successBg,
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
    backgroundColor: colors.bgCard,
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
  taxDisclaimerBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  taxDisclaimerText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // Uber-like Redesign
  giantInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  giantInput: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  giantInputUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textMuted,
    paddingBottom: 8,
  },
  uberHintCenter: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing['2xl'],
    lineHeight: 20,
  },
  uberDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing['2xl'],
  },
  uberSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  uberPillGroup: {
    flexDirection: 'row',
    backgroundColor: colors.bgMuted,
    borderRadius: 999,
    padding: 4,
  },
  // Material selector grid
  materialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  materialCard: {
    width: '47%',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 60,
    justifyContent: 'center',
  },
  materialCardSel: {
    backgroundColor: colors.bgCard,
    borderColor: colors.textPrimary,
  },
  materialCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  materialCardTextSel: {
    color: colors.textPrimary,
  },
  materialCardPrice: {
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 2,
  },
  materialCardPriceSel: {
    color: colors.textMuted,
  },
  uberPillBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  uberPillBtnSel: {
    backgroundColor: colors.bgCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  uberPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  uberPillTextSel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  // Step 3: Offers
  uberOfferCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  uberOfferCardSel: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.bgCard,
  },
  uberOfferName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  uberOfferNameSel: {
    color: colors.textPrimary,
  },
  uberBestBadge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  uberBestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
  },
  uberOfferCity: {
    fontSize: 13,
    color: colors.textMuted,
  },
  uberOfferCitySel: {
    color: colors.textMuted,
  },
  uberOfferPayout: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  uberOfferPayoutSel: {
    color: colors.textPrimary,
  },
  uberOfferRate: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  uberOfferRateSel: {
    color: colors.textMuted,
  },
  // offerCards removed above
  // Step 4: Confirm
  uberSummaryGiant: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  uberSummaryGiantLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  uberSummaryGiantAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  uberSummaryGiantNote: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
