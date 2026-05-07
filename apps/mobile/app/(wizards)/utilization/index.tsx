/**
 * Utilization wizard — construction waste collection by truck
 *
 *   Step 1 – Waste type      (grouped grid; hazardous marked)
 *   Step 2 – Location + weight
 *   Step 3 – Contact + confirm
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Hammer,
  Trees,
  Wrench,
  Package,
  Layers,
  Trash2,
  AlertTriangle,
  Zap,
  FlameKindling,
  CircleDot,
  Leaf,
  type LucideIcon,
} from 'lucide-react-native';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import { TextInputField } from '@/components/ui/TextInputField';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius } from '@/lib/theme';

// ── Types ────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface WasteOption {
  id: WasteType;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

interface WasteGroup {
  label: string;
  hint?: string;
  items: WasteOption[];
}

// ── Constants ────────────────────────────────────────────────────

const WASTE_GROUPS: WasteGroup[] = [
  {
    label: 'Celtniecības atkritumi',
    hint: 'Konteineri · Pašizgāzēji',
    items: [
      { id: 'CONCRETE', label: 'Betons / Bruģis', desc: 'Betona gabali, plātnes', Icon: Hammer },
      { id: 'BRICK', label: 'Ķieģeļi / Mūris', desc: 'Nojaukšanas atkritumi', Icon: Hammer },
      { id: 'WOOD', label: 'Koks', desc: 'Dēļi, sijas, finiera atgriezumi', Icon: Trees },
      { id: 'SOIL', label: 'Augsne / Grunts', desc: 'Z0/Z1 grunts, smilts, māls', Icon: Layers },
      { id: 'PLASTIC', label: 'Plastmasa', desc: 'Caurules, pārsegi, maisi', Icon: Package },
      {
        id: 'PACKAGING_WASTE',
        label: 'Iepakojums',
        desc: 'Kartoni, paletes, plēve',
        Icon: Package,
      },
      { id: 'ASPHALT', label: 'Asfalta lauskas', desc: 'Vecs asfalta segums', Icon: Layers },
      {
        id: 'MIXED',
        label: 'Jaukti celtniec.',
        desc: 'Dažādi celtniecības atkritumi',
        Icon: Trash2,
      },
    ],
  },
  {
    label: 'Bīstami / Licencēti',
    hint: 'Maršrutēti uz licencētiem partneriem',
    items: [
      {
        id: 'HAZARDOUS',
        label: 'Bīstami atkritumi',
        desc: 'Azbests, krāsas, šķīdinātāji',
        Icon: AlertTriangle,
      },
      { id: 'WEEE', label: 'Elektroatkritumi', desc: 'Elektronikas, sadzīves tehnika', Icon: Zap },
      {
        id: 'OIL_WASTE',
        label: 'Eļļošanas atkritumi',
        desc: 'Motoreļļa, hidraulika',
        Icon: FlameKindling,
      },
      { id: 'TIRES', label: 'Riepas', desc: 'Nolietots auto un tehnikas gumija', Icon: CircleDot },
    ],
  },
  {
    label: 'Otrreizēji izejmateriāli',
    hint: 'Var tikt atpirkts vai pārstrādāts',
    items: [
      { id: 'METAL', label: 'Metāls / Lūžņi', desc: 'Profili, stiegrojums, lūžņi', Icon: Wrench },
      { id: 'GREEN_WASTE', label: 'Zaļie atkritumi', desc: 'Zari, lapas, žogs, dārzs', Icon: Leaf },
    ],
  },
];

const WASTE_OPTIONS: WasteOption[] = WASTE_GROUPS.flatMap((g) => g.items);

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koks',
  METAL: 'Metāls / Lūžņi',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti celtniecības',
  HAZARDOUS: 'Bīstami atkritumi',
  ASPHALT: 'Asfalta lauskas',
  GREEN_WASTE: 'Zaļie atkritumi',
  WEEE: 'Elektroatkritumi',
  OIL_WASTE: 'Eļļošanas atkritumi',
  TIRES: 'Riepas',
  PACKAGING_WASTE: 'Iepakojums',
};

const STEP_TITLES: Record<Step, string> = {
  1: 'Kas jāizved?',
  2: 'Kur paņemt atkritumus?',
  3: 'Apstiprini izvešanu',
};

// ── Helpers ──────────────────────────────────────────────────────

function deriveTruck(weightT: number): {
  truckType: DisposalTruckType;
  truckCount: number;
  fromPrice: number;
} {
  if (weightT <= 7) return { truckType: 'TIPPER_SMALL', truckCount: 1, fromPrice: 89 };
  if (weightT <= 15) return { truckType: 'TIPPER_LARGE', truckCount: 1, fromPrice: 149 };
  const count = Math.ceil(weightT / 20);
  return { truckType: 'ARTICULATED_TIPPER', truckCount: count, fromPrice: 219 * count };
}

// ── Component ────────────────────────────────────────────────────

export default function UtilizationWizard() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const toast = useToast();
  const { user, token } = useAuth();

  const [step, setStep] = useState<Step>(1);

  // Step 1 — waste types (multi-select; resolves to MIXED if >1)
  const [selectedWastes, setSelectedWastes] = useState<WasteType[]>([]);

  // Step 2 — location + weight
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [weightText, setWeightText] = useState('');
  const [notes, setNotes] = useState('');

  // Step 3 — contact
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Sync contact fields when user authenticates mid-wizard
  useEffect(() => {
    if (!user) return;
    if (!contactName.trim())
      setContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!contactPhone.trim()) setContactPhone(user.phone ?? '');
  }, [user?.id]);

  const toggleWaste = (id: WasteType) => {
    setSelectedWastes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const resolvedWasteType: WasteType | null =
    selectedWastes.length > 1 ? 'MIXED' : (selectedWastes[0] ?? null);

  const weightT = parseFloat(weightText);
  const derived = deriveTruck(!isNaN(weightT) && weightT > 0 ? weightT : 1);

  // ── Navigation ───────────────────────────────────────────────

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    } else {
      setStep((s) => (s - 1) as Step);
    }
  }, [step, router]);

  const ctaDisabled =
    (step === 1 && (selectedWastes.length === 0 || !(parseFloat(weightText) > 0))) ||
    (step === 2 && !picked) ||
    (step === 3 && (!contactName.trim() || !contactPhone.trim())) ||
    submitting;

  // ── Submit ───────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!token) {
      toast.error('Lūdzu, piesakieties vēlreiz.');
      return;
    }
    if (!resolvedWasteType || !picked) return;

    const estimatedWeight = !isNaN(weightT) && weightT > 0 ? weightT : 1;
    const wasteBreakdown =
      selectedWastes.length > 1
        ? `Atkritumu sastāvs: ${selectedWastes.map((w) => WASTE_LABELS[w]).join(', ')}\n`
        : '';

    setSubmitting(true);
    try {
      const result = await api.disposal.create(
        {
          pickupAddress: picked.address,
          pickupCity: picked.city ?? '',
          pickupLat: picked.lat,
          pickupLng: picked.lng,
          wasteType: resolvedWasteType,
          truckType: derived.truckType,
          truckCount: derived.truckCount,
          estimatedWeight,
          description: wasteBreakdown || undefined,
          requestedDate: new Date().toISOString().split('T')[0],
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
          quotedRate: derived.fromPrice,
          projectId: projectId || undefined,
        },
        token,
      );
      const jn = result?.jobNumber ?? '';
      router.replace({ pathname: '/(buyer)/orders' as never, params: { highlight: jn } });
      toast.success(`Pasūtījums ${jn} nosūtīts!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kļūda. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setSubmitting(false);
    }
  }, [
    token,
    resolvedWasteType,
    picked,
    weightT,
    selectedWastes,
    derived,
    contactName,
    contactPhone,
    notes,
    projectId,
    router,
    toast,
  ]);

  // ── CTA press ────────────────────────────────────────────────

  const handleCTA = useCallback(() => {
    // Hazardous alert before advancing past step 1
    if (step === 1 && selectedWastes.includes('HAZARDOUS')) {
      Alert.alert(
        'Bīstami atkritumi',
        'Azbesta, krāsu un šķīdinātāju utilizācijai nepieciešama īpaša atļauja.\n\nSazinieties ar mums tieši:',
        [
          { text: 'Zvanīt: +371 2000 0000', onPress: () => Linking.openURL('tel:+37120000000') },
          {
            text: 'E-pasts: info@b3hub.lv',
            onPress: () => Linking.openURL('mailto:info@b3hub.lv'),
          },
          {
            text: 'Turpināt',
            onPress: () => {
              haptics.medium();
              setStep(2);
            },
          },
          { text: 'Atcelt', style: 'cancel' },
        ],
      );
      return;
    }
    haptics.medium();
    if (step < 3) setStep((s) => (s + 1) as Step);
    else handleSubmit();
  }, [step, selectedWastes, handleSubmit]);

  const wasteLabel = resolvedWasteType
    ? selectedWastes.length > 1
      ? `Jaukti (${selectedWastes.length} veidi)`
      : (WASTE_LABELS[resolvedWasteType] ?? resolvedWasteType)
    : '-';

  return (
    <WizardLayout
      title={STEP_TITLES[step]}
      step={step}
      totalSteps={3}
      onBack={goBack}
      ctaLabel={step === 3 ? 'Nosūtīt pieprasījumu' : 'Turpināt'}
      onCTA={handleCTA}
      ctaDisabled={ctaDisabled}
      ctaLoading={submitting}
      stepKey={step}
    >
      {step === 1 && (
        <StepWasteType
          selected={selectedWastes}
          onToggle={toggleWaste}
          weightText={weightText}
          onWeightChange={setWeightText}
          onGoToBuyback={() => router.push('/scrap-buyback' as never)}
        />
      )}
      {step === 2 && (
        <StepLocation
          picked={picked}
          onPickChange={setPicked}
          notes={notes}
          onNotesChange={setNotes}
        />
      )}
      {step === 3 && (
        <StepConfirm
          wasteLabel={wasteLabel}
          picked={picked}
          weightText={weightText}
          derived={derived}
          contactName={contactName}
          onContactNameChange={setContactName}
          contactPhone={contactPhone}
          onContactPhoneChange={setContactPhone}
        />
      )}
    </WizardLayout>
  );
}

// ── Step 1: Waste type + weight ──────────────────────────────────

function StepWasteType({
  selected,
  onToggle,
  weightText,
  onWeightChange,
  onGoToBuyback,
}: {
  selected: WasteType[];
  onToggle: (id: WasteType) => void;
  weightText: string;
  onWeightChange: (t: string) => void;
  onGoToBuyback: () => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.stepSub}>Izvēlieties atkritumu veidu(-s).</Text>
      {WASTE_GROUPS.map((group) => (
        <View key={group.label} style={s.group}>
          <View style={s.groupHeader}>
            <Text style={s.groupLabel}>{group.label}</Text>
            {group.hint ? <Text style={s.groupHint}>{group.hint}</Text> : null}
          </View>
          <View style={s.wasteList}>
            {group.items.map((opt) => {
              const isSel = selected.includes(opt.id);
              const Icon = opt.Icon;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.wasteRow, isSel && s.wasteRowSel]}
                  onPress={() => {
                    haptics.light();
                    onToggle(opt.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.wasteIconWrap}>
                    <Icon size={20} color={isSel ? colors.white : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.wasteLabel, isSel && s.wasteLabelSel]}>{opt.label}</Text>
                    <Text style={[s.wasteDesc, isSel && s.wasteDescSel]} numberOfLines={1}>
                      {opt.desc}
                    </Text>
                  </View>
                  {isSel && (
                    <View style={s.checkDot}>
                      <Text style={s.checkMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {selected.includes('METAL') && (
        <TouchableOpacity
          style={s.buybackBanner}
          onPress={() => {
            haptics.medium();
            onGoToBuyback();
          }}
          activeOpacity={0.8}
        >
          <Text style={s.buybackBannerTitle}>💶 Metālu var atpirkt</Text>
          <Text style={s.buybackBannerText}>
            Saņem samaksu par lūžņiem, nevis maksā par izvešanu
          </Text>
          <Text style={s.buybackBannerLink}>Pāriet uz atpirkšanu →</Text>
        </TouchableOpacity>
      )}
      <SectionLabel label="Aptuvens daudzums" style={{ marginTop: 8 }} />
      <TextInputField
        label="Svars (tonnas)"
        value={weightText}
        onChangeText={onWeightChange}
        placeholder="piem. 5"
        keyboardType="decimal-pad"
      />
    </ScrollView>
  );
}

// ── Step 2: Location ─────────────────────────────────────────────

function StepLocation({
  picked,
  onPickChange,
  notes,
  onNotesChange,
}: {
  picked: PickedAddress | null;
  onPickChange: (p: PickedAddress) => void;
  notes: string;
  onNotesChange: (t: string) => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionLabel label="Kur atrodas atkritumi?" />
      <AddressField
        value={picked?.address ?? ''}
        placeholder="Adrese, pilsēta"
        onPick={onPickChange}
      />
      <SectionLabel label="Piezīmes (neobligāti)" style={{ marginTop: 20 }} />
      <TextInputField
        label=""
        value={notes}
        onChangeText={onNotesChange}
        placeholder="Piekļuves instrukcijas, materiāla detaļas..."
        multiline
        numberOfLines={3}
      />
    </ScrollView>
  );
}

// ── Step 3: Confirm ──────────────────────────────────────────────

function StepConfirm({
  wasteLabel,
  picked,
  weightText,
  derived,
  contactName,
  onContactNameChange,
  contactPhone,
  onContactPhoneChange,
}: {
  wasteLabel: string;
  picked: PickedAddress | null;
  weightText: string;
  derived: { truckType: string; truckCount: number; fromPrice: number };
  contactName: string;
  onContactNameChange: (t: string) => void;
  contactPhone: string;
  onContactPhoneChange: (t: string) => void;
}) {
  const truckLabels: Record<string, string> = {
    TIPPER_SMALL: 'Mazais pašizgāzējs (≤10 t)',
    TIPPER_LARGE: 'Lielais pašizgāzējs (≤18 t)',
    ARTICULATED_TIPPER: 'Puspiekabe (≤26 t)',
  };
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionLabel label="Kopsavilkums" />
      <View style={s.summaryCard}>
        <DetailRow label="Atkritumu veids" value={wasteLabel} />
        <DetailRow label="Adrese" value={picked?.address ?? '-'} />
        <DetailRow label="Svars" value={weightText ? `~${weightText} t` : '-'} />
        <DetailRow
          label="Auto"
          value={
            derived.truckCount > 1
              ? `${derived.truckCount}× ${truckLabels[derived.truckType] ?? derived.truckType}`
              : (truckLabels[derived.truckType] ?? derived.truckType)
          }
        />
        <DetailRow label="Indikatīvā cena" value={`no €${derived.fromPrice}`} />
      </View>
      <SectionLabel label="Kontaktpersona" style={{ marginTop: 20 }} />
      <TextInputField
        label="Vārds Uzvārds"
        value={contactName}
        onChangeText={onContactNameChange}
        placeholder="Jānis Bērziņš"
      />
      <TextInputField
        label="Tālrunis"
        value={contactPhone}
        onChangeText={onContactPhoneChange}
        placeholder="+371 2X XXX XXX"
        keyboardType="phone-pad"
        style={{ marginTop: 12 }}
      />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrollContent: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: 40 },
  stepSub: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },
  group: { marginBottom: 16 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupHint: { fontSize: 11, color: colors.textMuted },
  wasteList: { gap: 6 },
  wasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  wasteRowSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  wasteIconWrap: { width: 32, alignItems: 'center' },
  wasteLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  wasteLabelSel: { color: colors.white },
  wasteDesc: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  wasteDescSel: { color: 'rgba(255,255,255,0.75)' },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 13, color: colors.white, fontWeight: '700' },
  buybackBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
    gap: 4,
  },
  buybackBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: '#166534' },
  buybackBannerText: { fontSize: 13, color: '#166534', opacity: 0.8 },
  buybackBannerLink: { fontSize: 13, fontWeight: '600' as const, color: '#16a34a', marginTop: 4 },
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
});
