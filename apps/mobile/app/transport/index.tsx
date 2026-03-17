/**
 * Transport wizard — full-screen step pages.
 *
 *   Step 1 – Pickup address  (AddressPickerModal)
 *   Step 2 – Dropoff address (AddressPickerModal)
 *   Step 3 – Vehicle + cargo + weight
 *   Step 4 – Date + route summary + contact/notes
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
import { MapPin, Check, CheckCircle, ArrowRight, Truck, Weight } from 'lucide-react-native';
import { useTransport } from '@/lib/transport-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { TransportVehicleType } from '@/lib/api';
import { useRoute } from '@/components/map';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressPickerModal } from '@/components/wizard/AddressPickerModal';
import type { PickedAddress } from '@/components/wizard/AddressPickerModal';

// ── Types ─────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;
type Stop = { lat: number; lng: number };

// ── Constants ─────────────────────────────────────────────────────
const VEHICLE_OPTIONS: { type: TransportVehicleType; label: string; sub: string; fromPrice: number }[] = [
  { type: 'TIPPER_SMALL', label: 'Mazā pašizgāzēja', sub: 'līdz 5 t · 6 m³', fromPrice: 89 },
  { type: 'TIPPER_LARGE', label: 'Lielā pašizgāzēja', sub: 'līdz 15 t · 18 m³', fromPrice: 149 },
  { type: 'ARTICULATED_TIPPER', label: 'Puspiekabe', sub: 'līdz 25 t · 90 m³', fromPrice: 219 },
];

const CARGO_PRESETS = ['Smiltis', 'Šķembas/grants', 'Betons', 'Koks', 'Metāls', 'Būvgruži', 'Cits'];

function buildDays(count = 14) {
  const days: { iso: string; dow: string; day: string; mon: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().split('T')[0],
      dow: d.toLocaleDateString('lv-LV', { weekday: 'short' }),
      day: String(d.getDate()),
      mon: d.toLocaleDateString('lv-LV', { month: 'short' }),
    });
  }
  return days;
}

const DAY_OPTIONS = buildDays();

// ── Component ─────────────────────────────────────────────────────
export default function TransportWizard() {
  const router = useRouter();
  const { state, setPickup, setDropoff, setVehicleType, setLoadDescription, setEstimatedWeight, setRequestedDate, reset } = useTransport();
  const { user, token } = useAuth();

  // ── Wizard state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showDropoffPicker, setShowDropoffPicker] = useState(false);
  const [pickupPicked, setPickupPicked] = useState<PickedAddress | null>(null);
  const [dropoffPicked, setDropoffPicked] = useState<PickedAddress | null>(null);
  const [pickupStop, setPickupStop] = useState<Stop | null>(null);
  const [dropoffStop, setDropoffStop] = useState<Stop | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState<TransportVehicleType | null>(null);
  const [activeDesc, setActiveDesc] = useState('');
  const [weightText, setWeightText] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>(DAY_OPTIONS[0].iso);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [jobNumber, setJobNumber] = useState('');
  const [siteContactName, setSiteContactName] = useState(() => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [siteContactPhone, setSiteContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');

  // ── Route (for step 4 summary) ────────────────────────────────
  const { route } = useRoute(
    step >= 3 && pickupStop ? pickupStop : null,
    step >= 3 && dropoffStop ? dropoffStop : null,
  );

  const currentVehiclePrice = VEHICLE_OPTIONS.find((v) => v.type === selectedVehicle)?.fromPrice;

  // ── Handlers ──────────────────────────────────────────────────
  const handlePickupConfirm = useCallback((p: PickedAddress) => {
    setPickupPicked(p);
    setPickupStop({ lat: p.lat, lng: p.lng });
    setPickup(p.address, p.city, p.lat, p.lng);
    setShowPickupPicker(false);
    setStep(2);
  }, [setPickup]);

  const handleDropoffConfirm = useCallback((p: PickedAddress) => {
    setDropoffPicked(p);
    setDropoffStop({ lat: p.lat, lng: p.lng });
    setDropoff(p.address, p.city, p.lat, p.lng);
    setShowDropoffPicker(false);
    setStep(3);
  }, [setDropoff]);

  const goBack = useCallback(() => {
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as Step);
  }, [step, router]);

  const handleSubmit = useCallback(async () => {
    if (!user || !token || !pickupStop || !dropoffStop || !selectedVehicle) return;
    setSubmitting(true);
    try {
      const job = await api.transport.create(
        {
          pickupAddress: pickupPicked?.address ?? '',
          pickupCity: state.pickupCity,
          pickupLat: pickupStop.lat,
          pickupLng: pickupStop.lng,
          dropoffAddress: dropoffPicked?.address ?? '',
          dropoffCity: state.dropoffCity,
          dropoffLat: dropoffStop.lat,
          dropoffLng: dropoffStop.lng,
          vehicleType: selectedVehicle,
          loadDescription: activeDesc,
          estimatedWeight: weightText ? parseFloat(weightText) : undefined,
          requestedDate: selectedDay,
          siteContactName: siteContactName || undefined,
          siteContactPhone: siteContactPhone || undefined,
          notes: notes || undefined,
        },
        token,
      );
      setJobNumber(job.jobNumber ?? job.id.slice(0, 8).toUpperCase());
      reset();
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('Kļūda', e?.message ?? 'Neizdevās izveidot pasūtījumu');
    } finally {
      setSubmitting(false);
    }
  }, [user, token, pickupStop, dropoffStop, selectedVehicle, activeDesc, weightText, selectedDay, pickupPicked, dropoffPicked, state, siteContactName, siteContactPhone, notes, reset]);

  const step3Valid = selectedVehicle !== null;
  const step4Valid = selectedDay !== null;

  const ctaDisabled =
    (step === 1 && !pickupPicked) ||
    (step === 2 && !dropoffPicked) ||
    (step === 3 && !step3Valid) ||
    submitting;

  const ctaLabel = step === 4
    ? (currentVehiclePrice ? `Pasūtīt — no €${currentVehiclePrice}` : 'Pasūtīt')
    : 'Turpināt';

  const onCTA = useCallback(() => {
    if (step === 1) { setShowPickupPicker(true); return; }
    if (step === 2) { setShowDropoffPicker(true); return; }
    if (step === 4) { handleSubmit(); return; }
    setStep((s) => (s + 1) as Step);
  }, [step, handleSubmit]);

  const STEP_TITLES: Record<Step, string> = {
    1: 'No kurienes ielādēt?',
    2: 'Kur izkraut?',
    3: 'Kāds transportlīdzeklis?',
    4: 'Kad pārvadāt?',
  };

  // ── Success screen ────────────────────────────────────────────
  if (success) {
    return (
      <View style={s.successRoot}>
        <CheckCircle size={72} color="#22c55e" />
        <Text style={s.successTitle}>Pasūtījums pieņemts!</Text>
        <Text style={s.successSub}>Mēs sazināsimies drīzumā</Text>
        {jobNumber ? (
          <View style={s.jobBadge}><Text style={s.jobBadgeText}>#{jobNumber}</Text></View>
        ) : null}
        <TouchableOpacity style={s.successBtn} onPress={() => router.replace('/(buyer)/orders')}>
          <Text style={s.successBtnText}>Skatīt pasūtījumus</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <AddressPickerModal
        visible={showPickupPicker}
        title="No kurienes ielādēt?"
        onClose={() => { if (step === 1) router.back(); else setShowPickupPicker(false); }}
        onConfirm={handlePickupConfirm}
        initial={pickupPicked ?? undefined}
      />
      <AddressPickerModal
        visible={showDropoffPicker}
        title="Kur izkraut?"
        onClose={() => setShowDropoffPicker(false)}
        onConfirm={handleDropoffConfirm}
        initial={dropoffPicked ?? undefined}
      />

      <WizardLayout
        title={STEP_TITLES[step]}
        step={step}
        totalSteps={4}
        onBack={goBack}
        onClose={() => router.back()}
        ctaLabel={ctaLabel}
        onCTA={step === 1 ? () => setShowPickupPicker(true) : step === 2 ? () => setShowDropoffPicker(true) : onCTA}
        ctaDisabled={ctaDisabled}
        ctaLoading={submitting}
      >
        {/* ── Step 1: Pickup ── */}
        {step === 1 && (
          <ScrollView style={s.content} contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>
            <Text style={s.hint}>Norādiet adresi, no kuras jāielādē krava.</Text>
            <TouchableOpacity style={s.addressCard} onPress={() => setShowPickupPicker(true)} activeOpacity={0.75}>
              <MapPin size={20} color={pickupPicked ? '#111827' : '#9ca3af'} style={{ marginRight: 10 }} />
              <Text style={[s.addressText, !pickupPicked && s.placeholder]} numberOfLines={2}>
                {pickupPicked?.address ?? 'Pieskarieties, lai izvēlētos ielādes vietu'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step 2: Dropoff ── */}
        {step === 2 && (
          <ScrollView style={s.content} contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>
            <Text style={s.hint}>Norādiet galamērķa adresi.</Text>
            {/* Show pickup as reference */}
            <View style={s.refRow}>
              <View style={s.refDot} />
              <Text style={s.refLabel} numberOfLines={1}>{pickupPicked?.address}</Text>
            </View>
            <View style={s.refLine} />
            <TouchableOpacity style={s.addressCard} onPress={() => setShowDropoffPicker(true)} activeOpacity={0.75}>
              <MapPin size={20} color={dropoffPicked ? '#111827' : '#9ca3af'} style={{ marginRight: 10 }} />
              <Text style={[s.addressText, !dropoffPicked && s.placeholder]} numberOfLines={2}>
                {dropoffPicked?.address ?? 'Pieskarieties, lai izvēlētos izkraušanas vietu'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step 3: Vehicle + Cargo ── */}
        {step === 3 && (
          <ScrollView style={s.content} contentContainerStyle={s.pad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.sectionLabel}>Transportlīdzekļa veids</Text>
            <View style={{ gap: 10, marginBottom: 20 }}>
              {VEHICLE_OPTIONS.map((v) => {
                const isSel = selectedVehicle === v.type;
                return (
                  <TouchableOpacity
                    key={v.type}
                    style={[s.vehicleCard, isSel && s.vehicleCardSel]}
                    onPress={() => {
                      setSelectedVehicle(v.type);
                      setVehicleType(v.type);
                    }}
                    activeOpacity={0.75}
                  >
                    <Truck size={22} color={isSel ? '#fff' : '#6b7280'} style={{ marginRight: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.vehicleLabel, isSel && s.vehicleLabelSel]}>{v.label}</Text>
                      <Text style={[s.vehicleSub, isSel && s.vehicleSubSel]}>{v.sub}</Text>
                    </View>
                    <Text style={[s.vehiclePrice, isSel && s.vehiclePriceSel]}>no €{v.fromPrice}</Text>
                    {isSel && <Check size={16} color="#fff" style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>Kravas veids</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {CARGO_PRESETS.map((c) => {
                const isSel = activeDesc === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[s.cargoChip, isSel && s.cargoChipSel]}
                    onPress={() => {
                      setActiveDesc(c);
                      setLoadDescription(c);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.cargoText, isSel && s.cargoTextSel]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.sectionLabel}>Svars (neobligāti)</Text>
            <View style={s.weightRow}>
              <Weight size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput
                style={s.weightInput}
                placeholder="piem., 8.5"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
                value={weightText}
                onChangeText={(t) => {
                  setWeightText(t);
                  const w = parseFloat(t);
                  if (!isNaN(w)) setEstimatedWeight(w);
                }}
              />
              <Text style={s.weightUnit}>tonnas</Text>
            </View>
          </ScrollView>
        )}

        {/* ── Step 4: Date + summary ── */}
        {step === 4 && (
          <ScrollView style={s.content} contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>Pārvadāšanas datums</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {DAY_OPTIONS.map((d) => {
                const active = selectedDay === d.iso;
                return (
                  <TouchableOpacity
                    key={d.iso}
                    style={[s.dayChip, active && s.dayChipActive]}
                    onPress={() => {
                      setSelectedDay(d.iso);
                      setRequestedDate(d.iso);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.dayDow, active && s.dayActive]}>{d.dow}</Text>
                    <Text style={[s.dayNum, active && s.dayActive]}>{d.day}</Text>
                    <Text style={[s.dayMon, active && s.dayActiveSub]}>{d.mon}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.sectionLabel}>Maršruts</Text>
            <View style={s.summaryCard}>
              <SumRow icon="📍" label="Ielāde" value={pickupPicked?.address ?? '—'} />
              <SumRow icon="🏁" label="Izkraušana" value={dropoffPicked?.address ?? '—'} />
              {route && (
                <SumRow icon="🛣" label="Distance" value={`${route.distanceKm.toFixed(1)} km · ${route.durationLabel}`} />
              )}
              <SumRow icon="🚛" label="Auto" value={VEHICLE_OPTIONS.find((v) => v.type === selectedVehicle)?.label ?? '—'} />
              <SumRow icon="📦" label="Krava" value={activeDesc || '—'} />
              {currentVehiclePrice && (
                <SumRow icon="💰" label="Orientējošā cena" value={`no €${currentVehiclePrice}`} />
              )}
            </View>

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Kontaktinformācija</Text>
            <View style={{ gap: 10, marginBottom: 8 }}>
              <TextInput style={s.input} placeholder="Kontaktpersona" placeholderTextColor="#9ca3af" value={siteContactName} onChangeText={setSiteContactName} />
              <TextInput style={s.input} placeholder="Tālrunis" placeholderTextColor="#9ca3af" keyboardType="phone-pad" value={siteContactPhone} onChangeText={setSiteContactPhone} />
              <TextInput style={[s.input, s.inputMulti]} placeholder="Piezīmes un norādījumi (neobligāti)" placeholderTextColor="#9ca3af" multiline value={notes} onChangeText={setNotes} />
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
        <Text style={s.sumValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  content: { flex: 1 },
  pad: { padding: 20, paddingBottom: 32 },
  hint: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },

  // Address cards
  addressCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 16,
  },
  addressText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500', lineHeight: 20 },
  placeholder: { color: '#9ca3af', fontWeight: '400' },

  // Pickup reference row (step 2)
  refRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 4 },
  refDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', marginRight: 8 },
  refLabel: { flex: 1, fontSize: 13, color: '#6b7280' },
  refLine: { width: 2, height: 20, backgroundColor: '#e5e7eb', marginLeft: 7, marginBottom: 4 },

  // Vehicle cards
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 14,
  },
  vehicleCardSel: { backgroundColor: '#111827', borderColor: '#111827' },
  vehicleLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  vehicleLabelSel: { color: '#fff' },
  vehicleSub: { fontSize: 12, color: '#9ca3af' },
  vehicleSubSel: { color: '#d1d5db' },
  vehiclePrice: { fontSize: 13, fontWeight: '700', color: '#111827' },
  vehiclePriceSel: { color: '#fff' },

  // Cargo chips
  cargoChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb',
    marginRight: 8, backgroundColor: '#fff',
  },
  cargoChipSel: { backgroundColor: '#111827', borderColor: '#111827' },
  cargoText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  cargoTextSel: { color: '#fff' },

  // Weight input
  weightRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  weightInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 0 },
  weightUnit: { fontSize: 13, color: '#6b7280', marginLeft: 8 },

  // Day chips
  dayChip: {
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb',
    marginRight: 8, backgroundColor: '#fff', minWidth: 54,
  },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayDow: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  dayNum: { fontSize: 20, fontWeight: '700', color: '#111827', marginVertical: 2 },
  dayMon: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  dayActive: { color: '#fff' },
  dayActiveSub: { color: '#d1d5db' },

  // Summary card
  summaryCard: { backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' },
  sumRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  sumIcon: { fontSize: 18, marginTop: 1 },
  sumLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 2 },
  sumValue: { fontSize: 14, color: '#111827', fontWeight: '600' },

  // Inputs
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },

  // Success
  successRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 8 },
  successSub: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  jobBadge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20, marginBottom: 32 },
  jobBadgeText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  successBtn: { backgroundColor: '#111827', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  successBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
