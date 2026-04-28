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
  type LucideIcon,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useDisposal } from '@/lib/disposal-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { FlatAddressPicker } from '@/components/wizard/FlatAddressPicker';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { useToast } from '@/components/ui/Toast';
import { DetailRow } from '@/components/ui/DetailRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';
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

  // Recycling centre picker (populated after availability check when >1 center exists)
  const [availableCenters, setAvailableCenters] = useState<
    { id: string; name: string; city: string; address: string }[]
  >([]);
  const [preferredRecyclingCenterId, setPreferredRecyclingCenterId] = useState<string | undefined>(
    undefined,
  );

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
          quotedRate: derived.fromPrice,
          projectId: projectId || undefined,
          preferredRecyclingCenterId: preferredRecyclingCenterId || undefined,
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

  const ctaLabel = step === 4 ? 'Nosūtīt pieprasījumu' : 'Turpināt';

  const onCTA = useCallback(async () => {
    if (step === 4) {
      if (!user) {
        setShowAuthGate(true);
        return;
      }
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
    if (step === 2 && state.wasteType && token) {
      setLoading(true);
      try {
        const result = await api.recyclingCenters.listByWasteType(state.wasteType, token);
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
        // If multiple centers, expose them for picker (user can override in step 3)
        if (result.data.length > 1) {
          setAvailableCenters(result.data);
        } else {
          setAvailableCenters([]);
          setPreferredRecyclingCenterId(undefined);
        }
      } catch {
        // Fail-open: network error should not block the order flow
      } finally {
        setLoading(false);
      }
    }
    haptics.medium();
    setStep((s) => (s + 1) as Step);
  }, [step, selectedWastes, handleSubmit, state.wasteType, token]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'Kas jāizved?',
    2: 'Kur paņemt atkritumus?',
    3: 'Kad?',
    4: 'Apstiprini izvešanu',
  };

  // ── Guest success screen ──────────────────────────────────────────────────
  if (guestResult) {
    return (
      <GuestOrderSuccess
        orderNumber={guestResult.orderNumber}
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

            <SectionLabel label="Aptuvenais svars *" style={{ marginTop: 20 }} />
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
            <FlatAddressPicker picked={picked} onPick={handlePickConfirm} />
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

        {/* ── Step 3: Date + time window ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <SectionLabel label="Savākšanas datums" />
            <WizardCalendar
              selectedDate={date ? date.toISOString().split('T')[0] : ''}
              onDateChange={(d) => setDate(new Date(d))}
              minDate={new Date().toISOString().split('T')[0]}
            />

            <SectionLabel label="Vēlamais savākšanas laiks" />
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

            {availableCenters.length > 1 && (
              <>
                <SectionLabel label="Šķirošanas centrs (neobligāti)" style={{ marginTop: 20 }} />
                <View style={{ gap: 8 }}>
                  {[
                    { id: '', name: 'Tuvākais pieejamais', city: '', address: '' },
                    ...availableCenters,
                  ].map((center) => (
                    <TouchableOpacity
                      key={center.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 14,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor:
                          (preferredRecyclingCenterId ?? '') === center.id ? '#111827' : '#e5e7eb',
                        backgroundColor:
                          (preferredRecyclingCenterId ?? '') === center.id ? '#f9fafb' : '#fff',
                        gap: 10,
                      }}
                      onPress={() => setPreferredRecyclingCenterId(center.id || undefined)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor:
                            (preferredRecyclingCenterId ?? '') === center.id
                              ? '#111827'
                              : '#d1d5db',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {(preferredRecyclingCenterId ?? '') === center.id && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#F9423A',
                            }}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: '#111827',
                          }}
                        >
                          {center.name}
                        </Text>
                        {!!center.city && (
                          <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            {center.city}
                            {center.address ? ` • ${center.address}` : ''}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* ── Step 4: Review + contact + confirm ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <SectionLabel label="Kopsavilkums" />
            <View style={s.summaryCard}>
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
                last
              />
            </View>

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
            </View>

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
        prefilledName={contactName}
        prefilledPhone={contactPhone}
        onDismiss={() => setShowAuthGate(false)}
      />
    </>
  );
}

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
});
