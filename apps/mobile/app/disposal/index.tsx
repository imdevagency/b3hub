/**
 * Disposal wizard — full-screen step pages.
 *
 *   Step 1 – Waste type      (2-column grid, tap to select)
 *   Step 2 – Location        (inline map)
 *   Step 3 – Volume          (preset cards)
 *   Step 4 – Date + confirm  (day chips + summary + contact)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MapPin,
  Hammer,
  Trees,
  Wrench,
  Package,
  Layers,
  Trash2,
  AlertTriangle,
  Check,
  User,
  Phone,
  AlignLeft,
  CreditCard,
  Weight,
  Truck,
  Bookmark,
  type LucideIcon,
} from 'lucide-react-native';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import { haptics } from '@/lib/haptics';
import { useDisposal } from '@/lib/disposal-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';

LocaleConfig.locales['lv'] = {
  monthNames: [
    'Janvāris',
    'Februāris',
    'Marts',
    'Aprīlis',
    'Maijs',
    'Jūnijs',
    'Jūlijs',
    'Augusts',
    'Septembris',
    'Oktobris',
    'Novembris',
    'Decembris',
  ],
  monthNamesShort: [
    'Jan.',
    'Feb.',
    'Mar.',
    'Apr.',
    'Mai',
    'Jūn.',
    'Jūl.',
    'Aug.',
    'Sep.',
    'Okt.',
    'Nov.',
    'Dec.',
  ],
  dayNames: [
    'Svētdiena',
    'Pirmdiena',
    'Otrdiena',
    'Trešdiena',
    'Ceturtdiena',
    'Piektdiena',
    'Sestdiena',
  ],
  dayNamesShort: ['Sv', 'P', 'O', 'T', 'C', 'Pk', 'S'],
  today: 'Šodien',
};
LocaleConfig.defaultLocale = 'lv';

import { SavedAddressPicker } from '@/components/wizard/SavedAddressPicker';
import { useToast } from '@/components/ui/Toast';

// ── Draft persistence ────────────────────────────────────────────
const DISPOSAL_DRAFT_KEY = '@b3hub_disposal_draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface DisposalDraft {
  step: Step;
  selectedWastes: WasteType[];
  selectedTruckType: DisposalTruckType;
  numTrucks: number;
  desc: string;
  weightText: string;
  date: string; // ISO date string
  pickupWindow: 'ANY' | 'AM' | 'PM';
  contactName: string;
  contactPhone: string;
  notes: string;
  picked: PickedAddress | null;
  savedAt: number;
}

// ── Types ─────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

interface WasteOption {
  id: WasteType;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

// ── Constants ─────────────────────────────────────────────────────
const WASTE_OPTIONS: WasteOption[] = [
  { id: 'CONCRETE', label: 'Betons / Bruģis', desc: 'Betona gabali, plātnes', Icon: Hammer },
  { id: 'SOIL', label: 'Augsne / Grunts', desc: 'Z0/Z1 grunts, smilts, māls', Icon: Layers },
  { id: 'BRICK', label: 'Ķieģeļi / Mūris', desc: 'Nojaukšanas atkritumi', Icon: Hammer },
  { id: 'WOOD', label: 'Koks', desc: 'Dēļi, sijas, finiera atgriezumi', Icon: Trees },
  { id: 'METAL', label: 'Metāls', desc: 'Profili, stiegrojums, lūžņi', Icon: Wrench },
  { id: 'PLASTIC', label: 'Plastmasa', desc: 'Caurules, pārsegi, maisi', Icon: Package },
  { id: 'MIXED', label: 'Jaukti celtniec.', desc: 'Dažādi celtniecības atkritumi', Icon: Trash2 },
  {
    id: 'HAZARDOUS',
    label: 'Bīstami atkritumi',
    desc: 'Azbests, krāsas, šķīdinātāji',
    Icon: AlertTriangle,
  },
];

const TIPPER_TRUCKS: Array<{
  type: DisposalTruckType;
  label: string;
  sublabel: string;
  capacity: number; // tonnes per truck
  volume: number; // m³ per truck
  fromPrice: number; // price per truck
}> = [
  {
    type: 'TIPPER_SMALL',
    label: 'Mazā pašizgāzēja',
    sublabel: 'līdz 10 t · 8 m³',
    capacity: 10,
    volume: 8,
    fromPrice: 89,
  },
  {
    type: 'TIPPER_LARGE',
    label: 'Lielā pašizgāzēja',
    sublabel: 'līdz 18 t · 12 m³',
    capacity: 18,
    volume: 12,
    fromPrice: 149,
  },
  {
    type: 'ARTICULATED_TIPPER',
    label: 'Puspiekabe',
    sublabel: 'līdz 26 t · 18 m³',
    capacity: 26,
    volume: 18,
    fromPrice: 219,
  },
];

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti celtniecības',
  HAZARDOUS: 'Bīstami atkritumi',
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Component ─────────────────────────────────────────────────────
export default function DisposalWizard() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const toast = useToast();
  const {
    state,
    setLocation,
    setWasteType,
    setTruckType,
    setTruckCount,
    setDescription,
    setRequestedDate,
    setConfirmedDisposal,
  } = useDisposal();
  const { user, token } = useAuth();

  // ── Wizard state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [picked, setPicked] = useState<PickedAddress | null>(
    state.locationLat != null && state.locationLng != null && state.location
      ? {
          address: state.location,
          lat: state.locationLat,
          lng: state.locationLng,
          city: state.locationCity ?? '',
        }
      : null,
  );
  const [selectedWastes, setSelectedWastes] = useState<WasteType[]>(
    state.wasteType ? [state.wasteType] : [],
  );

  const toggleWaste = (id: WasteType) => {
    setSelectedWastes((prev) => {
      let next;
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else {
        next = [...prev, id];
      }
      const resolvedType = next.length > 1 ? 'MIXED' : next[0] || null;
      if (resolvedType) setWasteType(resolvedType);
      return next;
    });
  };
  const [selectedTruckType, setSelectedTruckType] = useState<DisposalTruckType>('TIPPER_SMALL');
  const [numTrucks, setNumTrucks] = useState(1);
  const [desc, setDesc] = useState('');
  const [weightText, setWeightText] = useState('');
  const today = new Date();
  const [date, setDate] = useState<Date>(addDays(today, 1));
  const [pickupWindow, setPickupWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [saveAddress, setSaveAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');

  const activeTruck = TIPPER_TRUCKS.find((t) => t.type === selectedTruckType) ?? TIPPER_TRUCKS[0];

  // Redirect to welcome if not authenticated
  useEffect(() => {
    if (!user) router.replace('/(auth)/welcome' as never);
  }, [user, router]);

  // ── Draft: restore from AsyncStorage on mount ──
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(DISPOSAL_DRAFT_KEY)
      .then((raw) => {
        if (!raw) {
          draftLoadedRef.current = true;
          return;
        }
        try {
          const d: DisposalDraft = JSON.parse(raw);
          if (d.savedAt && Date.now() - d.savedAt > DRAFT_TTL_MS) {
            AsyncStorage.removeItem(DISPOSAL_DRAFT_KEY).catch(() => {});
            draftLoadedRef.current = true;
            return;
          }
          if (d.step) setStep(d.step);
          if (d.selectedWastes?.length) {
            setSelectedWastes(d.selectedWastes);
            const resolved =
              d.selectedWastes.length > 1 ? ('MIXED' as WasteType) : d.selectedWastes[0];
            if (resolved) setWasteType(resolved);
          }
          if (d.selectedTruckType) setSelectedTruckType(d.selectedTruckType);
          if (d.numTrucks) setNumTrucks(d.numTrucks);
          if (d.desc) setDesc(d.desc);
          if (d.weightText) setWeightText(d.weightText);
          if (d.date) setDate(new Date(d.date));
          if (d.pickupWindow) setPickupWindow(d.pickupWindow);
          if (d.contactName !== undefined) setContactName(d.contactName);
          if (d.contactPhone !== undefined) setContactPhone(d.contactPhone);
          if (d.notes !== undefined) setNotes(d.notes);
          if (d.picked) {
            setPicked(d.picked);
            setLocation(d.picked.address, d.picked.city ?? '', d.picked.lat, d.picked.lng);
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
    const draft: DisposalDraft = {
      step,
      selectedWastes,
      selectedTruckType,
      numTrucks,
      desc,
      weightText,
      date: date.toISOString(),
      pickupWindow,
      contactName,
      contactPhone,
      notes,
      picked,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(DISPOSAL_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [
    step,
    selectedWastes,
    selectedTruckType,
    numTrucks,
    desc,
    weightText,
    date,
    pickupWindow,
    contactName,
    contactPhone,
    notes,
    picked,
  ]);

  // ── Handlers ──────────────────────────────────────────────────
  const handlePickConfirm = useCallback(
    (p: PickedAddress) => {
      setPicked(p);
      setLocation(p.address, p.city, p.lat, p.lng);
    },
    [setLocation],
  );

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    } else setStep((s) => (s - 1) as Step);
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    if (!token) {
      toast.error('Jūs neesat pieteicies. Lūdzu, piesakieties vēlreiz.');
      return;
    }
    if (!state.wasteType) {
      toast.error('Lūdzu, izvēlieties atkritumu veidu.');
      return;
    }
    setTruckType(selectedTruckType);
    setTruckCount(numTrucks);
    setDescription(desc);
    setRequestedDate(toISO(date));
    setLoading(true);
    // Derive estimated weight: user input takes priority, fall back to full-truck capacity
    const parsedWeight = parseFloat(weightText);
    const estimatedWeight =
      !isNaN(parsedWeight) && parsedWeight > 0 ? parsedWeight : activeTruck.capacity * numTrucks;
    // Build waste breakdown description prefix for operators
    const wasteBreakdownNote =
      selectedWastes.length > 1
        ? `Atkritumu sastāvs: ${selectedWastes.map((w) => WASTE_LABELS[w]).join(', ')}\n`
        : '';
    const fullDescription = wasteBreakdownNote + (desc || '');
    try {
      const result = await api.disposal.create(
        {
          pickupAddress: state.location,
          pickupCity: state.locationCity,
          pickupLat: state.locationLat ?? undefined,
          pickupLng: state.locationLng ?? undefined,
          wasteType: state.wasteType,
          truckType: selectedTruckType,
          truckCount: numTrucks,
          estimatedWeight,
          description: fullDescription || undefined,
          requestedDate: toISO(date),
          pickupWindow: pickupWindow !== 'ANY' ? pickupWindow : undefined,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
          quotedRate: activeTruck.fromPrice * numTrucks,
          projectId: projectId || undefined,
        },
        token,
      );
      const jn = result?.jobNumber ?? '';
      // Save address if user opted in
      if (saveAddress && picked && token) {
        api.savedAddresses
          .create(
            {
              label: picked.address.split(',')[0],
              address: picked.address,
              city: picked.city ?? '',
              lat: picked.lat,
              lng: picked.lng,
            },
            token,
          )
          .catch(() => {});
      }
      // Store confirmed disposal in context for access in confirmation screen
      setConfirmedDisposal({
        jobNumber: jn,
        pickupAddress: state.location ?? '',
        wasteType: state.wasteType,
        wasteBreakdown: selectedWastes,
        truckType: selectedTruckType,
        truckCount: numTrucks,
        requestedDate: toISO(date),
        estimatedWeight,
        fromPrice: activeTruck.fromPrice * numTrucks,
      });
      AsyncStorage.removeItem(DISPOSAL_DRAFT_KEY).catch(() => {});
      router.replace({
        pathname: '/disposal/confirmation' as never,
        params: {
          jobNumber: jn,
          pickupAddress: state.location ?? '',
          wasteType: state.wasteType ?? '',
          truckType: selectedTruckType,
          truckCount: String(numTrucks),
          requestedDate: toISO(date),
        },
      } as never);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Neizdevās nosūtīt pieprasījumu. Mēģiniet vēlreiz.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    state,
    selectedTruckType,
    numTrucks,
    activeTruck,
    desc,
    date,
    pickupWindow,
    saveAddress,
    token,
    contactName,
    contactPhone,
    notes,
    weightText,
    setTruckType,
    setTruckCount,
    setDescription,
    setRequestedDate,
    setConfirmedDisposal,
    selectedWastes,
    picked,
  ]);

  const ctaDisabled =
    (step === 1 && selectedWastes.length === 0) || (step === 2 && !picked) || loading;

  const ctaLabel = step === 4 ? `Pasūtīt — no €${activeTruck.fromPrice * numTrucks}` : 'Turpināt';

  const onCTA = useCallback(async () => {
    if (step === 4) {
      handleSubmit();
      return;
    }
    if (step === 1) {
      if (selectedWastes.includes('HAZARDOUS')) {
        Alert.alert(
          'Bīstami atkritumi',
          'Azbesta, krāsu un šķidājinātāju utilizācijai nepieciešama īpaša atļauja.\n\nSazinieties ar mums tieši:',
          [
            { text: 'Zvanīt: +371 2000 0000', onPress: () => Linking.openURL('tel:+37120000000') },
            {
              text: 'E-pasts: info@b3hub.lv',
              onPress: () => Linking.openURL('mailto:info@b3hub.lv'),
            },
            { text: 'Aizvert', style: 'cancel' },
          ],
        );
        return;
      }
    }
    if (step === 3 && state.wasteType && token) {
      setLoading(true);
      try {
        const result = await api.recyclingCenters.checkAvailability(state.wasteType, token);
        if (result.total === 0) {
          Alert.alert(
            'Nav pieejamu šķirošanas centru',
            'Šobrīd nav reģistrētu centru, kas pieņem šāda veida atkritumus.\n\nSazinieties ar mums:',
            [
              {
                text: 'Zvanīt: +371 2000 0000',
                onPress: () => Linking.openURL('tel:+37120000000'),
              },
              {
                text: 'E-pasts: info@b3hub.lv',
                onPress: () => Linking.openURL('mailto:info@b3hub.lv'),
              },
              { text: 'Aizvert', style: 'cancel' },
            ],
          );
          return;
        }
      } catch {
        // Fail-open: network error should not block the order flow
      } finally {
        setLoading(false);
      }
    }
    setStep((s) => (s + 1) as Step);
  }, [step, selectedWastes, handleSubmit, state.wasteType, token]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'Kas jāizved?',
    2: 'Kur paņemt atkritumus?',
    3: 'Kāds ir apjoms?',
    4: 'Apstiprini izvešanu',
  };

  if (step === 2) {
    return (
      <InlineAddressStep
        picked={picked}
        onPick={setPicked}
        onConfirm={onCTA}
        onCancel={goBack}
        contextLabel="Atkritumu adrese"
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
        ctaLoading={loading}
      >
        {/* ── Step 1: Waste type ── */}
        {step === 1 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.stepSub}>Izvēlieties galveno atkritumu veidu.</Text>
            <View style={s.wasteList}>
              {WASTE_OPTIONS.map((opt) => {
                const isSel = selectedWastes.includes(opt.id);
                const WasteIcon = opt.Icon;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.wasteRow, isSel && s.wasteRowSel]}
                    onPress={() => toggleWaste(opt.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ marginRight: 16 }}>
                      <WasteIcon
                        size={24}
                        color={isSel ? '#ffffff' : '#6b7280'}
                        strokeWidth={1.5}
                      />
                    </View>

                    <View style={s.wasteInfo}>
                      <Text style={[s.wasteLabel, isSel && { color: '#ffffff' }]}>{opt.label}</Text>
                      <Text style={[s.wasteDesc, isSel && { color: '#9ca3af' }]}>{opt.desc}</Text>
                    </View>

                    <View style={[s.checkboxOuter, isSel && s.checkboxOuterSel]}>
                      {isSel && <Check size={14} color="#111827" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Truck type + count ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {selectedWastes.includes('HAZARDOUS') && (
              <View style={s.hazardRow}>
                <AlertTriangle size={14} color="#b91c1c" />
                <Text style={s.hazardText}>Bīstamu atkritumu nodošana jāsaskaņo atsevišķi!</Text>
              </View>
            )}

            {/* ── Truck type selector ── */}
            <Text style={s.sectionLabel}>Transportlīdzekļa veids</Text>
            <View style={s.truckTypeRow}>
              {TIPPER_TRUCKS.map((t) => {
                const isSel = selectedTruckType === t.type;
                return (
                  <TouchableOpacity
                    key={t.type}
                    style={[s.truckTypeCard, isSel && s.truckTypeCardSel]}
                    onPress={() => {
                      haptics.light();
                      setSelectedTruckType(t.type);
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Truck illustration zone */}
                    <View style={[s.truckIllZone, isSel && s.truckIllZoneSel]}>
                      <TruckIllustration type={t.type} height={30} onDark={isSel} />
                    </View>
                    <Text style={[s.truckTypeName, isSel && s.truckTypeNameSel]} numberOfLines={2}>
                      {t.label}
                    </Text>
                    <Text style={[s.truckTypeCap, isSel && s.truckTypeCapSel]}>
                      {t.capacity} t · {t.volume} m³
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Count stepper ── */}
            <Text style={[s.sectionLabel, { marginTop: 4 }]}>Mašīnu skaits</Text>
            <View style={s.countCard}>
              {/* Hero truck illustration */}
              <View style={s.heroIllZone}>
                <TruckIllustration type={selectedTruckType} height={52} />
              </View>
              {/* Stepper */}
              <View style={s.stepperRow}>
                <TouchableOpacity
                  style={[s.stepperBtn, numTrucks <= 1 && s.stepperBtnDim]}
                  onPress={() => {
                    if (numTrucks > 1) {
                      haptics.light();
                      setNumTrucks((n) => n - 1);
                    }
                  }}
                  disabled={numTrucks <= 1}
                  activeOpacity={0.7}
                >
                  <Text style={s.stepperBtnText}>−</Text>
                </TouchableOpacity>

                <View style={s.stepperCountBox}>
                  <Text style={s.stepperNum}>{numTrucks}</Text>
                  <Text style={s.stepperUnit}>{numTrucks === 1 ? 'mašīna' : 'mašīnas'}</Text>
                </View>

                <TouchableOpacity
                  style={[s.stepperBtn, numTrucks >= 6 && s.stepperBtnDim]}
                  onPress={() => {
                    if (numTrucks < 6) {
                      haptics.light();
                      setNumTrucks((n) => n + 1);
                    }
                  }}
                  disabled={numTrucks >= 6}
                  activeOpacity={0.7}
                >
                  <Text style={s.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Live stats ── */}
            <View style={s.liveStats}>
              <View style={s.liveStatRow}>
                <Text style={s.liveStatLabel}>Kopā</Text>
                <Text style={s.liveStatValue}>
                  {numTrucks} × {activeTruck.label}
                </Text>
              </View>
              <View style={s.liveStatRow}>
                <Text style={s.liveStatLabel}>Apjoms</Text>
                <Text style={s.liveStatValue}>
                  ≈ {activeTruck.capacity * numTrucks} t · ≈ {activeTruck.volume * numTrucks} m³
                </Text>
              </View>
              <View style={[s.liveStatRow, { borderBottomWidth: 0 }]}>
                <Text style={s.liveStatLabel}>Kopējā cena (no)</Text>
                <Text style={[s.liveStatValue, { fontSize: 18, fontWeight: '800' }]}>
                  no €{activeTruck.fromPrice * numTrucks}
                </Text>
              </View>
            </View>

            {/* ── Optional weight override ── */}
            <Text
              style={[
                s.sectionLabel,
                { textTransform: 'none', color: '#6b7280', fontSize: 13, marginTop: 16 },
              ]}
            >
              Aptuvenais svars tonnās (neobligāti)
            </Text>
            <TextInput
              style={[
                s.uberInput,
                {
                  backgroundColor: '#f3f4f6',
                  borderRadius: 16,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                  marginBottom: 4,
                },
              ]}
              placeholder={`piem., ${activeTruck.capacity * numTrucks} t (pilna mašīna)`}
              placeholderTextColor="#9ca3af"
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text
              style={[
                s.sectionLabel,
                { textTransform: 'none', color: '#6b7280', fontSize: 13, marginTop: 10 },
              ]}
            >
              Papildu informācija (neobligāti)
            </Text>
            <TextInput
              style={[
                s.uberInput,
                s.uberInputMulti,
                {
                  backgroundColor: '#f3f4f6',
                  borderRadius: 16,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                },
              ]}
              placeholder="piem., Z0 Grunts, asfalta segums..."
              placeholderTextColor="#9ca3af"
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={3}
            />
          </ScrollView>
        )}

        {/* ── Step 4: Date + confirm ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.sectionLabel}>Savākšanas datums</Text>
            <View
              style={{
                marginBottom: 16,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <Calendar
                current={
                  date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                }
                onDayPress={(day: any) => {
                  setDate(new Date(day.dateString));
                }}
                markedDates={{
                  [date
                    ? date.toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0]]: {
                    selected: true,
                    selectedColor: '#111827',
                  },
                }}
                theme={{
                  calendarBackground: '#ffffff',
                  textSectionTitleColor: '#6B7280',
                  selectedDayBackgroundColor: '#111827',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#2563EB',
                  dayTextColor: '#111827',
                  textDisabledColor: '#D1D5DB',
                  dotColor: '#2563EB',
                  selectedDotColor: '#ffffff',
                  arrowColor: '#111827',
                  monthTextColor: '#111827',
                  textDayFontFamily: 'Geist-Medium',
                  textMonthFontFamily: 'Geist-SemiBold',
                  textDayHeaderFontFamily: 'Geist-Medium',
                  textDayFontSize: 15,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 13,
                }}
                minDate={new Date().toISOString().split('T')[0]}
                firstDay={1}
                enableSwipeMonths={true}
              />
            </View>

            {/* Pickup window */}
            <Text style={s.sectionLabel}>Vēlamais savākšanas laiks</Text>
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

            <Text style={s.sectionLabel}>Kopsavilkums</Text>
            <View style={s.summaryCard}>
              <View style={s.addressRow}>
                <MapPin size={18} color="#111827" />
                <Text style={s.addressValue} numberOfLines={2}>
                  {picked?.address ?? state.location ?? '—'}
                </Text>
              </View>
              <DetailRow
                icon={Trash2}
                label="Atkritumu veids"
                value={
                  selectedWastes.length
                    ? selectedWastes.map((w) => WASTE_LABELS[w]).join(', ')
                    : '—'
                }
              />
              <DetailRow
                icon={Truck}
                label="Transports"
                value={`${numTrucks} × ${activeTruck.label}`}
              />
              <DetailRow
                icon={Weight}
                label="Apjoms"
                value={(() => {
                  const parsed = parseFloat(weightText);
                  const w =
                    !isNaN(parsed) && parsed > 0 ? parsed : activeTruck.capacity * numTrucks;
                  return `${w} t ≈ ${activeTruck.volume * numTrucks} m³`;
                })()}
              />
              <DetailRow
                icon={CreditCard}
                label="Orientējošā cena"
                value={`no €${activeTruck.fromPrice * numTrucks} + PVN 21%`}
                isLast
              />
            </View>

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Kontaktinformācija</Text>
            <View style={{ marginBottom: 8 }}>
              <View style={s.uberInputWrapper}>
                <User size={20} color="#9ca3af" style={s.uberInputIcon} />
                <TextInput
                  style={s.uberInput}
                  placeholder="Kontaktpersona"
                  placeholderTextColor="#9ca3af"
                  value={contactName}
                  onChangeText={setContactName}
                />
              </View>
              <View style={s.uberInputWrapper}>
                <Phone size={20} color="#9ca3af" style={s.uberInputIcon} />
                <TextInput
                  style={s.uberInput}
                  placeholder="Tālrunis"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                />
              </View>
              <View style={[s.uberInputWrapper, { alignItems: 'flex-start' }]}>
                <AlignLeft size={20} color="#9ca3af" style={[s.uberInputIcon, { marginTop: 16 }]} />
                <TextInput
                  style={[s.uberInput, s.uberInputMulti]}
                  placeholder="Piezīmes un norādījumi (piem., piekļuves kods, šaurā iebraukšana)"
                  placeholderTextColor="#9ca3af"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>

            {/* Save address toggle */}
            {picked && (
              <TouchableOpacity
                style={s.saveAddrRow}
                onPress={() => setSaveAddress((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[s.saveAddrCheck, saveAddress && s.saveAddrCheckActive]}>
                  {saveAddress && <Check size={12} color="#fff" strokeWidth={2.5} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.saveAddrLabel}>Saglabāt šo adresi</Text>
                  <Text style={s.saveAddrSub} numberOfLines={1}>
                    {picked.address.split(',')[0]}
                  </Text>
                </View>
                <Bookmark size={16} color={saveAddress ? '#111827' : '#9ca3af'} />
              </TouchableOpacity>
            )}
            <View style={{ height: 16 }} />
          </ScrollView>
        )}
      </WizardLayout>
    </>
  );
}

// ── Summary helper ────────────────────────────────────────────────
function DetailRow({
  label,
  value,
  icon: Icon,
  isLast,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  isLast?: boolean;
}) {
  return (
    <View style={[s.detailRow, isLast && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={16} color="#6b7280" />}
        <Text style={s.detailLabel}>{label}</Text>
      </View>
      <Text style={s.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  content: { flex: 1 },
  pad: { padding: 20, paddingBottom: 32 },
  hint: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  stepSub: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 0,
    borderRadius: 12,
    padding: 16,
  },
  addressText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
  placeholder: { color: '#9ca3af', fontWeight: '400' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Waste grid
  // Waste list styles
  wasteList: {
    gap: 12,
    marginBottom: 24,
  },
  wasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 0,
    padding: 16,
  },
  wasteRowSel: {
    backgroundColor: '#111827',
  },
  wasteInfo: {
    flex: 1,
    paddingRight: 16,
  },
  wasteLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  wasteDesc: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  checkboxOuter: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxOuterSel: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },

  // Volume list styles
  volList: {
    gap: 12,
    marginBottom: 24,
  },
  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0,
  },
  volRowSel: {
    backgroundColor: '#111827',
  },
  volRowIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  volRowInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  volRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 22,
  },
  volRowLabelSel: {
    color: '#ffffff',
  },
  volRowSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  volRowSubSel: {
    color: '#9ca3af',
  },
  volRowPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  volRowPriceSel: {
    color: '#ffffff',
  },

  // Hazard
  hazardRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  hazardText: { flex: 1, fontSize: 12, color: '#b91c1c', fontWeight: '500' },

  // Day chips
  dayChip: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 0,
    marginRight: 10,
    backgroundColor: '#f3f4f6',
    minWidth: 70,
  },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayChipAsap: { borderColor: '#fca5a5', backgroundColor: '#fff7f7', minWidth: 62 },
  dayDow: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  dayNum: { fontSize: 24, fontWeight: '700', color: '#111827', marginVertical: 4 },
  dayMon: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: '#d1d5db' },
  windowRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  windowChip: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  windowChipActive: { backgroundColor: '#000000' },
  windowChipText: { fontSize: 14, color: '#374151', fontWeight: '600', textAlign: 'center' },
  windowChipTextActive: { color: '#ffffff' },

  // Save address toggle
  saveAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 0,
    marginBottom: 12,
  },
  saveAddrCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 0,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAddrCheckActive: { backgroundColor: '#111827', borderColor: '#111827' },
  saveAddrLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  saveAddrSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },

  // Summary card
  summaryCard: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  addressValue: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '600', lineHeight: 22 },
  detailRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },

  uberInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  uberInputWrapFocus: {
    borderColor: '#000',
  },
  uberInputIcon: {
    marginRight: 12,
  },
  uberInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: '#111827',
  },
  uberInputMulti: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },

  // ── Truck type selector ──────────────────────────────────────
  truckTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  truckTypeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  },
  truckTypeCardSel: { backgroundColor: '#111827' },
  truckIllZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
  },
  truckIllZoneSel: { backgroundColor: '#1f2937' },
  truckTypeName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 6,
    paddingTop: 6,
    textAlign: 'center',
  },
  truckTypeNameSel: { color: '#ffffff' },
  truckTypeCap: {
    fontSize: 10,
    color: '#9ca3af',
    paddingHorizontal: 6,
    paddingBottom: 8,
    textAlign: 'center',
  },
  truckTypeCapSel: { color: '#9ca3af' },

  // ── Count stepper ────────────────────────────────────────────
  countCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderWidth: 0,
    overflow: 'hidden',
    marginBottom: 24,
  },
  heroIllZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDim: { opacity: 0.3 },
  stepperBtnText: {
    fontSize: 26,
    fontWeight: '300',
    color: '#ffffff',
    lineHeight: 30,
    includeFontPadding: false,
  },
  stepperCountBox: { alignItems: 'center' },
  stepperNum: {
    fontSize: 42,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 46,
    letterSpacing: -1,
    includeFontPadding: false,
  },
  stepperUnit: { fontSize: 13, color: '#6b7280', fontWeight: '500' },

  // ── Live stats ───────────────────────────────────────────────
  liveStats: {
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  liveStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  liveStatLabel: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  liveStatValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    paddingLeft: 12,
  },
});
