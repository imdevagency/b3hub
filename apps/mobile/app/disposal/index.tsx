/**
 * Disposal wizard — full-screen step pages.
 *
 *   Step 1 – Location        (inline map)
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
  User,
  Phone,
  AlignLeft,
  CreditCard,
  Weight,
  Box,
  Truck,
  Building2,
  type LucideIcon,
} from 'lucide-react-native';
import { useDisposal } from '@/lib/disposal-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { WasteType, DisposalTruckType } from '@/lib/api';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';

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
  icon: LucideIcon;
  truckType: DisposalTruckType;
  truckCount: number;
  fromPrice: number;
}> = [
  {
    key: 'xs',
    label: 'Neliela',
    sublabel: '~5 m³ / ~4 t',
    icon: Package,
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
    fromPrice: 89,
  },
  {
    key: 'sm',
    label: 'Vidēja',
    sublabel: '~10 m³ / ~8 t',
    icon: Box,
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
    fromPrice: 89,
  },
  {
    key: 'md',
    label: 'Liela',
    sublabel: '~18 m³ / ~14 t',
    icon: Truck,
    truckType: 'TIPPER_LARGE',
    truckCount: 1,
    fromPrice: 149,
  },
  {
    key: 'lg',
    label: 'Ļoti liela',
    sublabel: '~36 m³ / ~26 t',
    icon: Building2,
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
    setConfirmedDisposal,
    reset,
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
    state.wasteType ? [state.wasteType] : []
  );

  const toggleWaste = (id: WasteType) => {
    setSelectedWastes((prev) => {
      let next;
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else {
        next = [...prev, id];
      }
      const resolvedType = next.length > 1 ? 'MIXED' : (next[0] || null);
      if (resolvedType) setWasteType(resolvedType);
      return next;
    });
  };
  const [volumeKey, setVolumeKey] = useState<string>('sm');
  const [desc, setDesc] = useState('');
  const today = new Date();
  const [date, setDate] = useState<Date>(addDays(today, 1));
  const [loading, setLoading] = useState(false);
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
    },
    [setLocation],
  );

  const goBack = useCallback(() => {
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
    }
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
      const jn = result?.jobNumber ?? '';
      // Store confirmed disposal in context for access in confirmation screen
      setConfirmedDisposal({
        jobNumber: jn,
        pickupAddress: state.location ?? '',
        wasteType: state.wasteType,
        truckType: preset.truckType,
        truckCount: preset.truckCount,
        requestedDate: toISO(date),
        estimatedWeight: truck.capacity * preset.truckCount,
      });
      reset();
      router.replace({
        pathname: '/disposal/confirmation' as never,
        params: {
          jobNumber: jn,
          pickupAddress: state.location ?? '',
          wasteType: state.wasteType ?? '',
          truckType: preset.truckType,
          truckCount: String(preset.truckCount),
          requestedDate: toISO(date),
        },
      } as never);
    } catch (err: unknown) {
      Alert.alert(
        'Kļūda',
        err instanceof Error ? err.message : 'Neizdevās nosūtīt pieprasījumu. Mēģiniet vēlreiz.',
      );
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
    setRequestedDate,    setConfirmedDisposal,    reset,
  ]);

  const ctaDisabled =
    (step === 1 && !picked) ||
    (step === 2 && selectedWastes.length === 0) ||
    (step === 3 && !volumeKey) ||
    loading;

  const ctaLabel =
    step === 4 ? `Pasūtīt — no €${preset.fromPrice * preset.truckCount}` : 'Turpināt';

  const onCTA = useCallback(() => {
    if (step === 4) {
      handleSubmit();
      return;
    }
    if (step === 2) {
      if (selectedWastes.includes('HAZARDOUS')) {
        Alert.alert('Bīstami atkritumi', 'Sazinieties ar mums tieši.', [{ text: 'Sapratu' }]);
        return;
      }
    }
    setStep((s) => (s + 1) as Step);
  }, [step, selectedWastes, handleSubmit]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'Kur paņemt atkritumus?',
    2: 'Kas jāizved?',
    3: 'Kāds ir apjoms?',
    4: 'Apstiprini izvešanu',
  };

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
        {/* ── Step 1: Location ── */}
        {step === 1 && (
          <InlineAddressStep 
            picked={picked} 
            onPick={handlePickConfirm}
          />
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
                      <WasteIcon size={24} color={isSel ? '#111827' : '#6b7280'} strokeWidth={1.5} />
                    </View>
                    
                    <View style={s.wasteInfo}>
                      <Text style={[s.wasteLabel, isSel && { color: '#000' }]}>{opt.label}</Text>
                      <Text style={[s.wasteDesc, isSel && { color: '#4b5563' }]}>{opt.desc}</Text>
                    </View>

                    <View style={[s.checkboxOuter, isSel && s.checkboxOuterSel]}>
                      {isSel && <Check size={14} color="#fff" strokeWidth={3} />}
                    </View>
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
            {selectedWastes.includes('HAZARDOUS') && (
              <View style={s.hazardRow}>
                <AlertTriangle size={14} color="#b91c1c" />
                <Text style={s.hazardText}>Bīstamu atkritumu nodošana jāsaskaņo atsevišķi!</Text>
              </View>
            )}
            <View style={s.volList}>
              {VOLUME_PRESETS.map((p) => {
                const isSel = volumeKey === p.key;
                const Icon = p.icon;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[s.volRow, isSel && s.volRowSel]}
                    onPress={() => setVolumeKey(p.key)}
                    activeOpacity={0.7}
                  >
                    <View style={s.volRowIconBadge}>
                      <Icon size={24} color={isSel ? "#111827" : "#6b7280"} strokeWidth={1.5} />
                    </View>
                    
                    <View style={s.volRowInfo}>
                      <Text style={[s.volRowLabel, isSel && s.volRowLabelSel]}>{p.label}</Text>
                      <Text style={[s.volRowSub, isSel && s.volRowSubSel]}>{p.sublabel}</Text>
                    </View>

                    <Text style={[s.volRowPrice, isSel && s.volRowPriceSel]}>
                      no €{p.fromPrice * p.truckCount}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[s.sectionLabel, { textTransform: 'none', color: '#6b7280', fontSize: 13, marginLeft: 4, marginTop: 12 }]}>Papildu informācija (neobligāti)</Text>
            <TextInput
              style={[s.uberInput, s.uberInputMulti, { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#f3f4f6', paddingHorizontal: 16 }]}
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
              <View style={s.addressRow}>
                <MapPin size={18} color="#111827" />
                <Text style={s.addressValue} numberOfLines={2}>
                  {picked?.address ?? state.location ?? '—'}
                </Text>
              </View>
              <DetailRow
                icon={Trash2}
                label="Atkritumu veids"
                value={selectedWastes.length ? selectedWastes.map(w => WASTE_LABELS[w]).join(', ') : '—'}
              />
              <DetailRow 
                icon={Truck}
                label="Transports" 
                value={`${preset.truckCount} × ${truck.label}`} 
              />
              <DetailRow
                icon={Weight}
                label="Apjoms"
                value={`${truck.capacity * preset.truckCount} t ≈ ${truck.volume * preset.truckCount} m³`}
              />
              <DetailRow
                icon={CreditCard}
                label="Orientējošā cena"
                value={`no €${preset.fromPrice * preset.truckCount} + PVN 21%`}
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
                  placeholder="Piezīmes un norādījumi (neobligāti)"
                  placeholderTextColor="#9ca3af"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </View>
            <View style={{ height: 16 }} />
          </ScrollView>
        )}
      </WizardLayout>
    </>
  );
}

// ── Summary helper ────────────────────────────────────────────────
function DetailRow({ label, value, icon: Icon, isLast }: { label: string; value: string; icon?: React.ElementType; isLast?: boolean }) {
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
  // Waste list styles
  wasteList: {
    gap: 12,
    marginBottom: 24,
  },
  wasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
    padding: 16,
  },
  wasteRowSel: {
    borderColor: '#000',
    backgroundColor: '#fafafa',
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
    backgroundColor: '#fff',
  },
  checkboxOuterSel: {
    backgroundColor: '#000',
    borderColor: '#000',
  },

  // Volume list styles
  volList: {
    gap: 12,
    marginBottom: 24,
  },
  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f3f4f6', 
  },
  volRowSel: {
    borderColor: '#111827',
    backgroundColor: '#f8fafc',
  },
  volRowIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
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
    color: '#111827',
  },
  volRowSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  volRowSubSel: {
    color: '#4b5563',
  },
  volRowPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  volRowPriceSel: {
    color: '#111827',
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
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
    marginRight: 10,
    backgroundColor: '#fff',
    minWidth: 70,
  },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayDow: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  dayNum: { fontSize: 24, fontWeight: '700', color: '#111827', marginVertical: 4 },
  dayMon: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: '#d1d5db' },

  // Summary card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    padding: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#f3f4f6',
  },
  addressValue: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '600', lineHeight: 22 },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#f3f4f6',
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
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f3f4f6',
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
});
