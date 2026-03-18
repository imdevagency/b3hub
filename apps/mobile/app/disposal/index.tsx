/**
 * Disposal wizard — full-screen step pages.
 *
 *   Step 1 – Location        (AddressPickerModal)
 *   Step 2 – Waste type      (2-column grid, tap to select)
 *   Step 3 – Volume          (preset cards)
 *   Step 4 – Date + confirm  (day chips + summary + contact)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  CheckCircle,
  type LucideIcon,
} from 'lucide-react-native';
import { useDisposal } from '@/lib/disposal-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressPickerModal } from '@/components/wizard/AddressPickerModal';
import type { PickedAddress } from '@/components/wizard/AddressPickerModal';

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

const VOLUME_PRESETS: Array<{
  key: string;
  label: string;
  sublabel: string;
  emoji: string;
  truckType: DisposalTruckType;
  truckCount: number;
  fromPrice: number;
}> = [
  {
    key: 'xs',
    label: 'Neliela',
    sublabel: '~5 m³ / ~4 t',
    emoji: '🧺',
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
    fromPrice: 89,
  },
  {
    key: 'sm',
    label: 'Vidēja',
    sublabel: '~10 m³ / ~8 t',
    emoji: '🏗️',
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
    fromPrice: 89,
  },
  {
    key: 'md',
    label: 'Liela',
    sublabel: '~18 m³ / ~14 t',
    emoji: '🚛',
    truckType: 'TIPPER_LARGE',
    truckCount: 1,
    fromPrice: 149,
  },
  {
    key: 'lg',
    label: 'Ļoti liela',
    sublabel: '~36 m³ / ~26 t',
    emoji: '🏭',
    truckType: 'ARTICULATED_TIPPER',
    truckCount: 2,
    fromPrice: 219,
  },
];

const TRUCK_CONFIG: Record<string, { label: string; capacity: number; volume: number }> = {
  TIPPER_SMALL: { label: 'Pašizgāzējs (10 t)', capacity: 10, volume: 8 },
  TIPPER_LARGE: { label: 'Pašizgāzējs lielais (18 t)', capacity: 18, volume: 12 },
  ARTICULATED_TIPPER: { label: 'Sattelkipper (26 t)', capacity: 26, volume: 18 },
};

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
  const {
    state,
    setLocation,
    setWasteType,
    setTruckType,
    setTruckCount,
    setDescription,
    setRequestedDate,
    reset,
  } = useDisposal();
  const { user, token } = useAuth();

  // ── Wizard state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [showPicker, setShowPicker] = useState(false);
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
  const [selectedWaste, setSelectedWaste] = useState<WasteType | null>(state.wasteType);
  const [volumeKey, setVolumeKey] = useState<string>('sm');
  const [desc, setDesc] = useState('');
  const today = new Date();
  const [date, setDate] = useState<Date>(addDays(today, 1));
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [jobNumber, setJobNumber] = useState('');
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');

  const preset = VOLUME_PRESETS.find((p) => p.key === volumeKey) ?? VOLUME_PRESETS[1];
  const truck = TRUCK_CONFIG[preset.truckType];

  // ── Handlers ──────────────────────────────────────────────────
  const handlePickConfirm = useCallback(
    (p: PickedAddress) => {
      setPicked(p);
      setLocation(p.address, p.city, p.lat, p.lng);
      setShowPicker(false);
      setStep(2);
    },
    [setLocation],
  );

  const goBack = useCallback(() => {
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as Step);
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    if (!token) {
      Alert.alert('Kļūda', 'Jūs neesat pieteicies. Lūdzu, piesakieties vēlreiz.');
      return;
    }
    if (!state.wasteType) {
      Alert.alert('Kļūda', 'Lūdzu, izvēlieties atkritumu veidu.');
      return;
    }
    setTruckType(preset.truckType);
    setTruckCount(preset.truckCount);
    setDescription(desc);
    setRequestedDate(toISO(date));
    setLoading(true);
    try {
      const result = await api.disposal.create(
        {
          pickupAddress: state.location,
          pickupCity: state.locationCity,
          pickupLat: state.locationLat ?? undefined,
          pickupLng: state.locationLng ?? undefined,
          wasteType: state.wasteType,
          truckType: preset.truckType,
          truckCount: preset.truckCount,
          estimatedWeight: truck.capacity * preset.truckCount,
          description: desc || undefined,
          requestedDate: toISO(date),
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
        },
        token,
      );
      reset();
      setJobNumber(result?.jobNumber ?? '—');
      setSubmitted(true);
    } catch (err: unknown) {
      Alert.alert('Kļūda', err instanceof Error ? err.message : 'Neizdevās nosūtīt pieprasījumu. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  }, [
    state,
    preset,
    truck,
    desc,
    date,
    token,
    contactName,
    contactPhone,
    notes,
    setTruckType,
    setTruckCount,
    setDescription,
    setRequestedDate,
    reset,
  ]);

  const ctaDisabled =
    (step === 1 && !picked) ||
    (step === 2 && !selectedWaste) ||
    (step === 3 && !volumeKey) ||
    loading;

  const ctaLabel =
    step === 4 ? `Pasūtīt — no €${preset.fromPrice * preset.truckCount}` : 'Turpināt';

  const onCTA = useCallback(() => {
    if (step === 1) {
      setShowPicker(true);
      return;
    }
    if (step === 4) {
      handleSubmit();
      return;
    }
    if (step === 2) {
      if (selectedWaste === 'HAZARDOUS') {
        Alert.alert('Bīstami atkritumi', 'Sazinieties ar mums tieši.', [{ text: 'Sapratu' }]);
        return;
      }
    }
    setStep((s) => (s + 1) as Step);
  }, [step, selectedWaste, handleSubmit]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'Kur atrodas atkritumi?',
    2: 'Ko nodot?',
    3: 'Cik materiāla ir jāizved?',
    4: 'Kad braukt?',
  };

  // ── Success screen ────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={s.successRoot}>
        <CheckCircle size={72} color="#22c55e" />
        <Text style={s.successTitle}>Pieprasījums nosūtīts!</Text>
        <Text style={s.successSub}>Jūsu atkritumu savākšanas pieprasījums ir reģistrēts.</Text>
        {jobNumber && jobNumber !== '—' && (
          <View style={s.jobBadge}>
            <Text style={s.jobBadgeText}>#{jobNumber}</Text>
          </View>
        )}
        <TouchableOpacity style={s.successBtn} onPress={() => router.replace('/(buyer)/orders')}>
          <Text style={s.successBtnText}>Skatīt pasūtījumus</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <AddressPickerModal
        visible={showPicker}
        title="Kur atrodas atkritumi?"
        onClose={() => {
          if (step === 1) router.back();
          else setShowPicker(false);
        }}
        onConfirm={handlePickConfirm}
        initial={picked ?? undefined}
      />

      <WizardLayout
        title={STEP_TITLES[step]}
        step={step}
        totalSteps={4}
        onBack={goBack}
        onClose={() => router.back()}
        ctaLabel={ctaLabel}
        onCTA={step === 1 ? () => setShowPicker(true) : onCTA}
        ctaDisabled={ctaDisabled}
        ctaLoading={loading}
      >
        {/* ── Step 1: Location ── */}
        {step === 1 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.hint}>Norādiet adresi, no kuras jāsavāc atkritumi.</Text>
            <TouchableOpacity
              style={s.addressCard}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.75}
            >
              <MapPin
                size={20}
                color={picked ? '#111827' : '#9ca3af'}
                style={{ marginRight: 10 }}
              />
              <Text style={[s.addressText, !picked && s.placeholder]} numberOfLines={2}>
                {picked?.address ?? 'Pieskarieties, lai izvēlētos adresi'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step 2: Waste type ── */}
        {step === 2 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.stepSub}>Izvēlieties galveno atkritumu veidu.</Text>
            <View style={s.wasteGrid}>
              {WASTE_OPTIONS.map((opt) => {
                const isSel = selectedWaste === opt.id;
                const WasteIcon = opt.Icon;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.wasteCard, isSel && s.wasteCardSel]}
                    onPress={() => {
                      setSelectedWaste(opt.id);
                      setWasteType(opt.id);
                      setTimeout(() => setStep(3), 180);
                    }}
                    activeOpacity={0.7}
                  >
                    {isSel && (
                      <View style={s.checkBadge}>
                        <Check size={11} color="#fff" />
                      </View>
                    )}
                    <WasteIcon
                      size={26}
                      color={isSel ? '#fff' : '#6b7280'}
                      style={{ marginBottom: 6 }}
                    />
                    <Text style={[s.wasteLabel, isSel && s.wasteLabelSel]}>{opt.label}</Text>
                    <Text style={[s.wasteDesc, isSel && s.wasteDescSel]} numberOfLines={2}>
                      {opt.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Volume ── */}
        {step === 3 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.pad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.stepSub}>Izvēlieties aptuvenu apjomu.</Text>
            {selectedWaste === 'HAZARDOUS' && (
              <View style={s.hazardRow}>
                <AlertTriangle size={14} color="#b91c1c" />
                <Text style={s.hazardText}>Bīstamu atkritumu nodošana jāsaskaņo atsevišķi!</Text>
              </View>
            )}
            <View style={s.volGrid}>
              {VOLUME_PRESETS.map((p) => {
                const isSel = volumeKey === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[s.volCard, isSel && s.volCardSel]}
                    onPress={() => setVolumeKey(p.key)}
                    activeOpacity={0.7}
                  >
                    {isSel && (
                      <View style={s.checkBadge}>
                        <Check size={11} color="#fff" />
                      </View>
                    )}
                    <Text style={s.volEmoji}>{p.emoji}</Text>
                    <Text style={[s.volLabel, isSel && s.volLabelSel]}>{p.label}</Text>
                    <Text style={s.volSub}>{p.sublabel}</Text>
                    <Text style={[s.volPrice, isSel && s.volPriceSel]}>
                      no €{p.fromPrice * p.truckCount}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.sectionLabel}>Papildu informācija (neobligāti)</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              {Array.from({ length: 14 }, (_, i) => {
                const d = addDays(today, i + 1);
                const isSel = toISO(d) === toISO(date);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayChip, isSel && s.dayChipActive]}
                    onPress={() => setDate(d)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.dayDow, isSel && s.dayActive]}>
                      {d.toLocaleDateString('lv-LV', { weekday: 'short' })}
                    </Text>
                    <Text style={[s.dayNum, isSel && s.dayActive]}>{d.getDate()}</Text>
                    <Text style={[s.dayMon, isSel && s.dayActiveSub]}>
                      {d.toLocaleDateString('lv-LV', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.sectionLabel}>Kopsavilkums</Text>
            <View style={s.summaryCard}>
              <SumRow icon="📍" label="Adrese" value={picked?.address ?? state.location ?? '—'} />
              <SumRow
                icon="♻️"
                label="Atkritumu veids"
                value={selectedWaste ? WASTE_LABELS[selectedWaste] : '—'}
              />
              <SumRow
                icon="🚛"
                label="Transports"
                value={`${preset.truckCount} × ${truck.label}`}
              />
              <SumRow
                icon="📦"
                label="Apjoms"
                value={`${truck.capacity * preset.truckCount} t ≈ ${truck.volume * preset.truckCount} m³`}
              />
              <SumRow
                icon="💰"
                label="Orientējošā cena"
                value={`no €${preset.fromPrice * preset.truckCount} + PVN 21%`}
              />
            </View>

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Kontaktinformācija</Text>
            <View style={{ gap: 10, marginBottom: 8 }}>
              <TextInput
                style={s.input}
                placeholder="Kontaktpersona"
                placeholderTextColor="#9ca3af"
                value={contactName}
                onChangeText={setContactName}
              />
              <TextInput
                style={s.input}
                placeholder="Tālrunis"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Piezīmes un norādījumi (neobligāti)"
                placeholderTextColor="#9ca3af"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>
            <View style={{ height: 16 }} />
          </ScrollView>
        )}
      </WizardLayout>
    </>
  );
}

// ── Summary helper ────────────────────────────────────────────────
function SumRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.sumRow}>
      <Text style={s.sumIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.sumLabel}>{label}</Text>
        <Text style={s.sumValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
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
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
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
  wasteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  wasteCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    padding: 14,
    alignItems: 'flex-start',
    position: 'relative',
  },
  wasteCardSel: { backgroundColor: '#111827', borderColor: '#111827' },
  wasteLabel: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 2 },
  wasteLabelSel: { color: '#fff' },
  wasteDesc: { fontSize: 11, color: '#9ca3af', lineHeight: 15 },
  wasteDescSel: { color: '#d1d5db' },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Volume grid
  volGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  volCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    padding: 14,
    alignItems: 'center',
    position: 'relative',
  },
  volCardSel: { backgroundColor: '#111827', borderColor: '#111827' },
  volEmoji: { fontSize: 28, marginBottom: 6 },
  volLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  volLabelSel: { color: '#fff' },
  volSub: { fontSize: 11, color: '#9ca3af', marginBottom: 4 },
  volPrice: { fontSize: 13, fontWeight: '700', color: '#111827' },
  volPriceSel: { color: '#fff' },

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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    marginRight: 8,
    backgroundColor: '#fff',
    minWidth: 54,
  },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayDow: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  dayNum: { fontSize: 20, fontWeight: '700', color: '#111827', marginVertical: 2 },
  dayMon: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: '#d1d5db' },

  // Summary card
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  sumIcon: { fontSize: 18, marginTop: 1 },
  sumLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 2 },
  sumValue: { fontSize: 14, color: '#111827', fontWeight: '600' },

  // Inputs
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },

  // Success
  successRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  jobBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  jobBadgeText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  successBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  successBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
