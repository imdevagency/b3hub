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
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
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
  Bookmark,
  Zap,
  FlameKindling,
  CircleDot,
  Leaf,
  type LucideIcon,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useDisposal } from '@/lib/disposal-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import type { DisposalQuoteCenterResult } from '@/lib/api/containers';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { useToast } from '@/components/ui/Toast';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';
import { WizardSummaryCard } from '@/components/wizard/WizardSummaryCard';
import { WizardPaymentMethodPicker } from '@/components/wizard/WizardPaymentMethodPicker';
import { WizardTimeWindowPicker } from '@/components/wizard/WizardTimeWindowPicker';
import { colors } from '@/lib/theme';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';
import { GuestOrderSuccess } from '@/components/wizard/GuestOrderSuccess';

// ── Draft persistence ────────────────────────────────────────────
const DISPOSAL_DRAFT_KEY = '@b3hub_disposal_draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface DisposalDraft {
  step: Step;
  selectedWastes: WasteType[];
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
// Step 3 (compare) is only entered when multiple recycling centers match;
// otherwise navigation jumps 2→4 and 4→back-to-2.
type Step = 1 | 2 | 3 | 4 | 5;

interface WasteOption {
  id: WasteType;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

// ── Constants ─────────────────────────────────────────────────────
interface WasteGroup {
  label: string;
  hint?: string;
  items: WasteOption[];
}

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
    hint: 'Var tikt atpirkt vai pārstrādāts',
    items: [
      { id: 'METAL', label: 'Metāls / Lūžņi', desc: 'Profili, stiegrojums, lūžņi', Icon: Wrench },
      {
        id: 'GREEN_WASTE',
        label: 'Zaļie atkritumi',
        desc: 'Zari, lapas, žogs, dārzs',
        Icon: Leaf,
      },
    ],
  },
];

// Flat list used by the rest of the wizard logic (order submission, labels)
const WASTE_OPTIONS: WasteOption[] = WASTE_GROUPS.flatMap((g) => g.items);

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

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Auto-derive truck type from weight ──────────────────────────
function deriveTruckType(weightT: number): {
  truckType: DisposalTruckType;
  truckCount: number;
  fromPrice: number;
} {
  if (weightT <= 7) return { truckType: 'TIPPER_SMALL', truckCount: 1, fromPrice: 89 };
  if (weightT <= 15) return { truckType: 'TIPPER_LARGE', truckCount: 1, fromPrice: 149 };
  const truckCount = Math.ceil(weightT / 20);
  return { truckType: 'ARTICULATED_TIPPER', truckCount, fromPrice: 219 * truckCount };
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
  const [desc, setDesc] = useState('');
  const [weightText, setWeightText] = useState('');
  const today = new Date();
  const [date, setDate] = useState<Date>(addDays(today, 1));
  const [pickupWindow, setPickupWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [saveAddress, setSaveAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [guestResult, setGuestResult] = useState<{ token: string; orderNumber: string } | null>(
    null,
  );
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');
  const [bisNumber, setBisNumber] = useState('');
  const [loadingBy, setLoadingBy] = useState<'BUYER_CREW' | 'DRIVER_HANDS' | 'NEEDS_MACHINERY'>(
    'BUYER_CREW',
  );
  const [contactWillBePresent, setContactWillBePresent] = useState(true);
  const [wasteReadiness, setWasteReadiness] = useState<'PILED' | 'NEEDS_PREP'>('PILED');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'INVOICE'>('CARD');

  // Recycling centre comparison (populated from disposal-quote when >1 center exists)
  const [availableCenters, setAvailableCenters] = useState<DisposalQuoteCenterResult[]>([]);
  const [preferredRecyclingCenterId, setPreferredRecyclingCenterId] = useState<string | undefined>(
    undefined,
  );

  // Derived: centers that can accept this waste type
  const acceptedCenters = availableCenters.filter((c) => c.accepted);
  const hasComparison = acceptedCenters.length > 1;

  // Auto-derive truck from weight (weight is required in step 1)
  const weightT = parseFloat(weightText);
  const derived = deriveTruckType(!isNaN(weightT) && weightT > 0 ? weightT : 1);
  const activeTruck = TIPPER_TRUCKS.find((t) => t.type === derived.truckType) ?? TIPPER_TRUCKS[0];

  // Auth gate fires at commitment, not on mount
  // (removed early redirect)

  // Sync contact fields when user authenticates mid-wizard
  useEffect(() => {
    if (!user) return;
    if (!contactName.trim())
      setContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!contactPhone.trim()) setContactPhone(user.phone ?? '');
  }, [user?.id]);

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
    } else if (step === 4 && !hasComparison) {
      setStep(2); // skip over the unused comparison step
    } else {
      setStep((s) => (s - 1) as Step);
    }
  }, [step, hasComparison, router]);

  const handleSubmit = useCallback(async () => {
    if (!token) {
      toast.error('Jūs neesat pieteicies. Lūdzu, piesakieties vēlreiz.');
      return;
    }
    if (!state.wasteType) {
      toast.error('Lūdzu, izvēlieties atkritumu veidu.');
      return;
    }
    setTruckType(derived.truckType);
    setTruckCount(derived.truckCount);
    setDescription(desc);
    setRequestedDate(toISO(date));
    if (loadingRef.current) return;
    setLoading(true);
    loadingRef.current = true;
    // Weight is required in step 1
    const parsedWeight = parseFloat(weightText);
    const estimatedWeight = !isNaN(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1;
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
          truckType: derived.truckType,
          truckCount: derived.truckCount,
          estimatedWeight,
          description: fullDescription || undefined,
          requestedDate: toISO(date),
          pickupWindow: pickupWindow !== 'ANY' ? pickupWindow : undefined,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
          bisNumber: bisNumber.trim() || undefined,
          loadingBy: loadingBy || undefined,
          contactWillBePresent,
          wasteReadiness: wasteReadiness || undefined,
          quotedRate: derived.fromPrice,
          projectId: projectId || undefined,
          preferredRecyclingCenterId: preferredRecyclingCenterId || undefined,
          paymentMethod,
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
        truckType: derived.truckType,
        truckCount: derived.truckCount,
        requestedDate: toISO(date),
        estimatedWeight,
        fromPrice: derived.fromPrice,
      });
      AsyncStorage.removeItem(DISPOSAL_DRAFT_KEY).catch(() => {});
      router.replace({
        pathname: '/disposal/confirmation' as never,
        params: {
          jobNumber: jn,
          pickupAddress: state.location ?? '',
          wasteType: state.wasteType ?? '',
          truckType: derived.truckType,
          truckCount: String(derived.truckCount),
          requestedDate: toISO(date),
        },
      } as never);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Neizdevās nosūtīt pieprasījumu. Mēģiniet vēlreiz.',
      );
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [
    state,
    derived,
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
    preferredRecyclingCenterId,
  ]);

  // ── Guest submit handler ──────────────────────────────────────────────────
  const handleGuestSubmit = useCallback(
    async (contact: { name: string; phone: string; email?: string }) => {
      if (!picked || selectedWastes.length === 0) return;
      if (loadingRef.current) return;
      setLoading(true);
      loadingRef.current = true;
      try {
        const wasteTypesJson = JSON.stringify(selectedWastes);
        const estimatedWeight = parseFloat(weightText);
        const result = await api.guestOrders.create({
          category: 'DISPOSAL',
          wasteTypes: wasteTypesJson,
          disposalVolume: !isNaN(estimatedWeight) ? estimatedWeight : undefined,
          truckType: derived.truckType,
          deliveryAddress: picked.address,
          deliveryCity: picked.city ?? '',
          deliveryLat: picked.lat,
          deliveryLng: picked.lng,
          deliveryDate: toISO(date),
          deliveryWindow: pickupWindow !== 'ANY' ? pickupWindow : undefined,
          contactName: contact.name,
          contactPhone: contact.phone,
          contactEmail: contact.email,
          notes: notes || undefined,
          bisNumber: bisNumber.trim() || undefined,
        });
        haptics.success();
        setGuestResult({ token: result.token, orderNumber: result.orderNumber });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Neizdevās nosūtīt pieprasījumu.');
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [picked, selectedWastes, weightText, derived, date, pickupWindow, notes],
  );

  const ctaDisabled =
    (step === 1 && (selectedWastes.length === 0 || !(parseFloat(weightText) > 0))) ||
    (step === 2 && !picked) ||
    loading;

  const ctaLabel = step === 5 ? 'Nosūtīt pieprasījumu' : 'Turpināt';

  const onCTA = useCallback(async () => {
    // Step 5 = confirm / submit
    if (step === 5) {
      if (!user) {
        setShowAuthGate(true);
        return;
      }
      handleSubmit();
      return;
    }

    // Step 1 hazardous gate
    if (step === 1) {
      if (selectedWastes.includes('HAZARDOUS')) {
        const nonHazardous = selectedWastes.filter((w) => w !== 'HAZARDOUS');
        const continueWithoutBtn =
          nonHazardous.length > 0
            ? [
                {
                  text: 'Turpināt bez bīstamajiem',
                  onPress: () => {
                    // Remove HAZARDOUS and proceed
                    setSelectedWastes(nonHazardous);
                    const resolved =
                      nonHazardous.length > 1 ? ('MIXED' as WasteType) : nonHazardous[0];
                    if (resolved) setWasteType(resolved);
                    haptics.medium();
                    setStep((s) => (s + 1) as Step);
                  },
                },
              ]
            : [];
        Alert.alert(
          'Bīstami atkritumi',
          'Azbesta, krāsu un šķidājinātāju utilizācijai nepieciešama īpaša atļauja.\n\nSazinieties ar mums tieši:',
          [
            { text: 'Zvanīt: +371 2000 0000', onPress: () => Linking.openURL('tel:+37120000000') },
            {
              text: 'E-pasts: info@b3hub.lv',
              onPress: () => Linking.openURL('mailto:info@b3hub.lv'),
            },
            ...continueWithoutBtn,
            { text: 'Aizvert', style: 'cancel' },
          ],
        );
        return;
      }
    }

    // Step 2 → fetch disposal quotes, then route to compare (step 3) or skip to date (step 4)
    if (step === 2) {
      haptics.medium();
      if (state.wasteType && token) {
        setLoading(true);
        try {
          const weightT2 = parseFloat(weightText);
          const weightKg = !isNaN(weightT2) && weightT2 > 0 ? weightT2 * 1000 : 1000;
          const result = await api.recyclingCenters.getDisposalQuote(
            {
              wasteType: state.wasteType,
              weightKg,
              lat: picked?.lat,
              lng: picked?.lng,
            },
            token,
          );
          const accepted = result.data.filter((c) => c.accepted);
          if (accepted.length === 0) {
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
          if (accepted.length > 1) {
            setAvailableCenters(result.data);
            setStep(3); // show comparison
          } else {
            setAvailableCenters([]);
            setPreferredRecyclingCenterId(undefined);
            setStep(4); // skip comparison, go straight to date
          }
        } catch {
          // Fail-open: network error should not block the order flow
          setStep(4);
        } finally {
          setLoading(false);
        }
      } else {
        // No token / waste type — skip comparison
        setStep(4);
      }
      return;
    }

    haptics.medium();
    setStep((s) => (s + 1) as Step);
  }, [step, selectedWastes, handleSubmit, state.wasteType, token, weightText, picked, user]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'Kas jāizved?',
    2: 'Kur paņemt atkritumus?',
    3: 'Salīdzini cenas',
    4: 'Kad?',
    5: 'Apstiprini izvešanu',
  };

  // Progress bar: when no comparison step, display step 4→3, 5→4 so it reads 1/4..4/4
  const displayStep = !hasComparison && step > 3 ? ((step - 1) as Step) : step;
  const totalDisplaySteps = hasComparison ? 5 : 4;

  // ── Guest success screen ──────────────────────────────────────────────────
  if (guestResult) {
    return (
      <GuestOrderSuccess
        orderNumber={guestResult.orderNumber}
        guestToken={guestResult.token}
        category="DISPOSAL"
        onBack={() => router.replace('/(buyer)/home' as never)}
      />
    );
  }

  return (
    <>
      <WizardLayout
        title={STEP_TITLES[step]}
        step={displayStep}
        totalSteps={totalDisplaySteps}
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
        {/* ── Step 1: Waste type ── */}
        {step === 1 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.stepSub}>Izvēlieties atkritumu veidu(-s).</Text>
            {WASTE_GROUPS.map((group) => (
              <View key={group.label} style={{ marginBottom: 4 }}>
                <View style={s.groupHeader}>
                  <Text style={s.groupLabel}>{group.label}</Text>
                  {group.hint ? <Text style={s.groupHint}>{group.hint}</Text> : null}
                </View>
                <View style={s.wasteList}>
                  {group.items.map((opt) => {
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
                          <Text style={[s.wasteLabel, isSel && { color: colors.white }]}>
                            {opt.label}
                          </Text>
                          <Text style={[s.wasteDesc, isSel && { color: colors.textDisabled }]}>
                            {opt.desc}
                          </Text>
                        </View>

                        <View style={[s.checkboxOuter, isSel && s.checkboxOuterSel]}>
                          {isSel && <Check size={14} color="#111827" strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <SectionLabel label="Aptuvenais svars *" style={{ marginTop: 20 }} />
            {selectedWastes.length === 1 && selectedWastes[0] === 'METAL' && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#fef9c3',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
                onPress={() => router.push('/scrap-buyback' as never)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 18 }}>💰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#92400e' }}>
                    Metāls var nest peļņu!
                  </Text>
                  <Text style={{ fontSize: 12, color: '#a16207', marginTop: 2 }}>
                    Izmantojiet Metāllūžņu atpirkšanu — saņemiet samaksu, nevis maksājiet par
                    izvešanu →
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {selectedWastes.includes('SOIL') && !selectedWastes.some((w) => w !== 'SOIL') && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#f0fdf4',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
                onPress={() => router.push('/(buyer)/catalog' as never)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 18 }}>🌱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#166534' }}>
                    Tīra grunts var būt pārdodama
                  </Text>
                  <Text style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>
                    Z0/Z1 grunts tiek meklēta citiem projektiem. Pārdodiet katalogā →
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <TextInputField
              placeholder="Svars tonnās (piem. 5)"
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            {weightText.length > 0 && !(parseFloat(weightText) > 0) && (
              <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 4 }}>
                Ievadiet derīgu svaru
              </Text>
            )}
          </ScrollView>
        )}

        {/* ── Step 2: Pickup address ── */}
        {step === 2 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ paddingHorizontal: 20 }}>
              <AddressField
                value={picked}
                onPick={handlePickConfirm}
                placeholder="Norādiet paņemšanas adresi"
              />
            </View>
            {picked && (
              <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
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
              </View>
            )}
          </ScrollView>
        )}

        {/* ── Step 3: Compare recycling centers ── */}
        {step === 3 && (
          <StepCompare
            centers={acceptedCenters}
            selectedId={preferredRecyclingCenterId ?? null}
            onSelect={(id) => setPreferredRecyclingCenterId(id ?? undefined)}
            weightT={parseFloat(weightText) > 0 ? parseFloat(weightText) : 1}
          />
        )}

        {/* ── Step 4: Date + time window ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <SectionLabel label="Savākšanas datums" />
            <WizardCalendar
              selectedDate={date ? date.toISOString().split('T')[0] : ''}
              onDateChange={(d) => setDate(new Date(d))}
              minDate={toISO(addDays(today, 1))}
            />

            <SectionLabel label="Vēlamais savākšanas laiks" />
            <WizardTimeWindowPicker value={pickupWindow} onChange={setPickupWindow} />
          </ScrollView>
        )}

        {/* ── Step 5: Review + contact + confirm ── */}
        {step === 5 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <SectionLabel label="Kopsavilkums" />
            <WizardSummaryCard style={{ marginBottom: 4 }}>
              <View style={s.addressRow}>
                <MapPin size={18} color="#111827" />
                <Text style={s.addressValue} numberOfLines={2}>
                  {picked?.address ?? state.location ?? '—'}
                </Text>
              </View>
              <DetailRow
                label="Atkritumu veids"
                value={
                  selectedWastes.length
                    ? selectedWastes.map((w) => WASTE_LABELS[w]).join(', ')
                    : '—'
                }
              />
              <DetailRow
                label="Transports"
                value={`${derived.truckCount} × ${activeTruck.label}`}
              />
              <DetailRow
                label="Apjoms"
                value={`${weightT > 0 ? weightT : derived.truckCount * activeTruck.capacity} t ≈ ${derived.truckCount * activeTruck.volume} m³`}
              />
              <DetailRow
                label="Datums"
                value={date.toLocaleDateString('lv-LV', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
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
              <DetailRow
                label="Orientējošā cena"
                value={`no €${derived.fromPrice} + PVN 21%`}
                last={!hasComparison}
              />
              {hasComparison && (
                <DetailRow
                  label="Šķirošanas centrs"
                  value={
                    preferredRecyclingCenterId
                      ? (acceptedCenters.find((c) => c.centerId === preferredRecyclingCenterId)
                          ?.name ?? 'Izdevīgākais pieejamais')
                      : 'Izdevīgākais pieejamais'
                  }
                  last
                />
              )}
            </WizardSummaryCard>

            <SectionLabel label="Kontaktinformācija" style={{ marginTop: 20 }} />
            <View style={{ gap: 10, marginBottom: 8 }}>
              <TextInputField
                placeholder="Kontaktpersona"
                value={contactName}
                onChangeText={setContactName}
              />
              <TextInputField
                placeholder="Tālrunis"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
              <TextInputField
                placeholder="Neobligāti: Papildu informācija autovadītājam..."
                multiline
                value={desc}
                onChangeText={setDesc}
              />
              <TextInputField
                placeholder="Piezīmes un norādījumi (piem., piekļuves kods, šaurā iebraukšana)"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
              <TextInputField
                label="BIS numurs (nav obligāts)"
                placeholder="Piem., BIS-2024-12345"
                hint="Būvniecības informācijas sistēmas lietas numurs — nepieciešams celtniecības atkritumu utilizācijai pēc LR tiesību normām."
                value={bisNumber}
                onChangeText={setBisNumber}
                autoCapitalize="characters"
              />
            </View>

            {/* ── Loading coordination ── */}
            <SectionLabel label="Kraušanas koordinācija" style={{ marginTop: 20 }} />
            <Text style={s.stepSub}>
              Palīdziet autovadītājam sagatavoties — norādiet, kas veic kraušanu un vai krava ir
              gatava.
            </Text>

            <Text
              style={[
                s.stepSub,
                { marginTop: 12, marginBottom: 6, color: '#111827', fontWeight: '600' },
              ]}
            >
              Kas veic kraušanu?
            </Text>
            <View style={{ gap: 8, marginBottom: 4 }}>
              {(
                [
                  [
                    'BUYER_CREW',
                    '🚜 Mūsu komanda / tehnika',
                    'Ekskavators vai iekrāvējs pieejams objektā',
                  ],
                  [
                    'DRIVER_HANDS',
                    '👷 Autovadītājs kravā ar rokām',
                    'Piemērots nelieliem apjomiem',
                  ],
                  [
                    'NEEDS_MACHINERY',
                    '⚠️ Nepieciešams ekskavators',
                    'Pasūtītājs nodrošinās tehnikas pieejamību',
                  ],
                ] as const
              ).map(([val, label, sub]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.payMethodRow, loadingBy === val && s.payMethodRowActive]}
                  onPress={() => setLoadingBy(val)}
                  activeOpacity={0.75}
                >
                  <View style={[s.payMethodRadio, loadingBy === val && s.payMethodRadioActive]}>
                    {loadingBy === val && <View style={s.payMethodRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.payMethodLabel, loadingBy === val && s.payMethodLabelActive]}>
                      {label}
                    </Text>
                    <Text style={s.payMethodSub}>{sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text
              style={[
                s.stepSub,
                { marginTop: 12, marginBottom: 6, color: '#111827', fontWeight: '600' },
              ]}
            >
              Kravas gatavība objektā
            </Text>
            <View style={{ gap: 8, marginBottom: 4 }}>
              {(
                [
                  [
                    'PILED',
                    '✅ Salikts kaudzē, gatavs kraušanai',
                    'Autovadītājs var sākt kraušanu nekavējoties',
                  ],
                  [
                    'NEEDS_PREP',
                    '🔄 Jāsavāc (izkliedēts pa laukumu)',
                    'Nepieciešams laiks pirms kraušanas',
                  ],
                ] as const
              ).map(([val, label, sub]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.payMethodRow, wasteReadiness === val && s.payMethodRowActive]}
                  onPress={() => setWasteReadiness(val)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[s.payMethodRadio, wasteReadiness === val && s.payMethodRadioActive]}
                  >
                    {wasteReadiness === val && <View style={s.payMethodRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.payMethodLabel, wasteReadiness === val && s.payMethodLabelActive]}
                    >
                      {label}
                    </Text>
                    <Text style={s.payMethodSub}>{sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.payMethodRow, { marginTop: 8 }]}
              onPress={() => setContactWillBePresent((v) => !v)}
              activeOpacity={0.75}
            >
              <View style={[s.payMethodRadio, contactWillBePresent && s.payMethodRadioActive]}>
                {contactWillBePresent && <View style={s.payMethodRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.payMethodLabel, contactWillBePresent && s.payMethodLabelActive]}>
                  Kontaktpersona būs klāt objektā
                </Text>
                <Text style={s.payMethodSub}>
                  Norādītā persona atradīsies objektā kraušanas laikā
                </Text>
              </View>
            </TouchableOpacity>

            <SectionLabel label="Maksājuma veids" style={{ marginTop: 20 }} />
            <WizardPaymentMethodPicker
              value={paymentMethod}
              onChange={setPaymentMethod}
              isLoggedIn={!!user}
            />

            <View style={{ height: 16 }} />
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
        prefilledName={contactName}
        prefilledPhone={contactPhone}
        onDismiss={() => setShowAuthGate(false)}
      />
    </>
  );
}

// ── Step 3: Compare recycling centers ────────────────────────────

function StepCompare({
  centers,
  selectedId,
  onSelect,
  weightT,
}: {
  centers: DisposalQuoteCenterResult[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  weightT: number;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={cmp.intro}>
        Izvēlieties, kurš šķirošanas centrs pieņems atkritumus. Cenas norāda centru utilizācijas
        maksu — pārvadājuma maksa tiek aprēķināta atsevišķi.
      </Text>

      {/* Auto option */}
      {(() => {
        const isAuto = !selectedId;
        return (
          <TouchableOpacity
            style={[cmp.card, isAuto && cmp.cardSel]}
            onPress={() => {
              haptics.light();
              onSelect(null);
            }}
            activeOpacity={0.75}
          >
            <View style={cmp.cardContent}>
              <View style={{ flex: 1 }}>
                <Text style={[cmp.cardName, isAuto && cmp.cardNameSel]}>
                  Automātiski — izdevīgākais
                </Text>
                <Text style={[cmp.cardCity, isAuto && cmp.cardCitySel]}>
                  Sistēma piešķirs piemērotāko centru
                </Text>
              </View>
            </View>
            {isAuto && <Text style={cmp.checkmark}>✓ Izvēlēts</Text>}
          </TouchableOpacity>
        );
      })()}

      {/* Center cards */}
      {centers.map((center, idx) => {
        const isSel = center.centerId === selectedId;
        const isCheapest = idx === 0 && center.disposalFeeEur != null;
        return (
          <TouchableOpacity
            key={center.centerId}
            style={[cmp.card, isSel && cmp.cardSel]}
            onPress={() => {
              haptics.light();
              onSelect(center.centerId);
            }}
            activeOpacity={0.75}
          >
            {isCheapest && (
              <View style={cmp.cheapBadge}>
                <Text style={cmp.cheapBadgeText}>💰 Zemākā utilizācijas maksa</Text>
              </View>
            )}
            <View style={cmp.cardContent}>
              <View style={{ flex: 1 }}>
                <View style={cmp.nameRow}>
                  <Text style={[cmp.cardName, isSel && cmp.cardNameSel]} numberOfLines={1}>
                    {center.name}
                  </Text>
                  {center.licensed && (
                    <View style={[cmp.vvdBadge, isSel && cmp.vvdBadgeSel]}>
                      <Text style={[cmp.vvdText, isSel && cmp.vvdTextSel]}>VVD</Text>
                    </View>
                  )}
                </View>
                <Text style={[cmp.cardCity, isSel && cmp.cardCitySel]}>
                  {center.city}
                  {center.distanceKm != null ? ` · ${center.distanceKm} km` : ''}
                </Text>
                {center.centerNotes ? (
                  <Text style={[cmp.cardNotes, isSel && cmp.cardNotesSel]} numberOfLines={2}>
                    {center.centerNotes}
                  </Text>
                ) : null}
              </View>
              <View style={cmp.priceWrap}>
                {center.disposalFeeEur != null ? (
                  <>
                    <Text style={[cmp.priceMain, isSel && cmp.priceMainSel]}>
                      €{center.disposalFeeEur.toFixed(2)}
                    </Text>
                    <Text style={[cmp.priceRate, isSel && cmp.priceRateSel]}>
                      ~{weightT} t · bez pārvadājuma
                    </Text>
                  </>
                ) : (
                  <Text style={[cmp.priceOnRequest, isSel && cmp.priceOnRequestSel]}>
                    Pēc{'\n'}pieprasījuma
                  </Text>
                )}
              </View>
            </View>
            {isSel && <Text style={cmp.checkmark}>✓ Izvēlēts</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const cmp = StyleSheet.create({
  intro: { fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
  },
  cardSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  cheapBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef9c3',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  cheapBadgeText: { fontSize: 11, color: '#713f12', fontWeight: '700' },
  cardContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  cardNameSel: { color: colors.white },
  vvdBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  vvdBadgeSel: { backgroundColor: 'rgba(255,255,255,0.25)' },
  vvdText: { fontSize: 10, color: '#166534', fontWeight: '700' },
  vvdTextSel: { color: colors.white },
  cardCity: { fontSize: 12, color: colors.textMuted },
  cardCitySel: { color: 'rgba(255,255,255,0.75)' },
  cardNotes: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  cardNotesSel: { color: 'rgba(255,255,255,0.7)' },
  priceWrap: { alignItems: 'flex-end', minWidth: 70 },
  priceMain: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  priceMainSel: { color: colors.white },
  priceRate: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  priceRateSel: { color: 'rgba(255,255,255,0.7)' },
  priceOnRequest: { fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  priceOnRequestSel: { color: 'rgba(255,255,255,0.75)' },
  checkmark: { fontSize: 12, color: colors.white, fontWeight: '600', marginTop: 8 },
});

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  content: { flex: 1 },
  pad: { padding: 20, paddingBottom: 32 },
  hint: { fontSize: 14, color: colors.textMuted, marginBottom: 16, lineHeight: 20 },
  stepSub: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderWidth: 0,
    borderRadius: 12,
    padding: 16,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  placeholder: { color: colors.textDisabled, fontFamily: 'Inter_400Regular', fontWeight: '400' },

  // Waste grid
  // Waste list styles
  wasteList: {
    gap: 12,
    marginBottom: 24,
  },
  groupHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  groupLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
  },
  groupHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  wasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: 16,
    borderWidth: 0,
    padding: 16,
  },
  wasteRowSel: {
    backgroundColor: colors.primary,
  },
  wasteInfo: {
    flex: 1,
    paddingRight: 16,
  },
  wasteLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  wasteDesc: {
    fontSize: 14,
    color: colors.textMuted,
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
    backgroundColor: colors.bgCard,
    borderColor: colors.white,
  },

  // Volume list styles
  volList: {
    gap: 12,
    marginBottom: 24,
  },
  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0,
  },
  volRowSel: {
    backgroundColor: colors.primary,
  },
  volRowIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
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
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  volRowLabelSel: {
    color: colors.white,
  },
  volRowSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  volRowSubSel: {
    color: colors.textDisabled,
  },
  volRowPrice: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textSecondary,
  },
  volRowPriceSel: {
    color: colors.white,
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
  hazardText: {
    flex: 1,
    fontSize: 12,
    color: colors.dangerText,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },

  // Day chips
  dayChip: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 0,
    marginRight: 10,
    backgroundColor: colors.bgMuted,
    minWidth: 70,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.textPrimary },
  dayChipAsap: { borderColor: '#fca5a5', backgroundColor: '#fff7f7', minWidth: 62 },
  dayDow: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  dayNum: {
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textPrimary,
    marginVertical: 4,
  },
  dayMon: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
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

  // Save address toggle
  saveAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.bgMuted,
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
    backgroundColor: colors.bgMuted,
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
    borderBottomColor: colors.border,
  },
  addressValue: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 22,
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
  payMethodRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#166534',
  },
  payMethodLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  payMethodLabelActive: { color: '#166534' },
  payMethodSub: { fontSize: 12, color: '#6b7280', marginTop: 2, fontFamily: 'Inter_400Regular' },
});
