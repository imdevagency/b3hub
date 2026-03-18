/**
 * Container / Skip-Hire wizard — full-screen step pages.
 *
 *   Step 1 – Location   (AddressPickerModal)
 *   Step 2 – Waste type (Step2WasteType, auto-advance)
 *   Step 3 – Skip size  (Step3Size, auto-advance)
 *   Step 4 – Date + confirm
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
import { MapPin, CheckCircle } from 'lucide-react-native';
import { useOrder } from '@/lib/order-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import type { SkipSize, SkipWasteCategory } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { SKIP_PRICES, toISO, addDays } from '@/components/order/skip-hire-types';
import { Step2WasteType } from '@/components/order/Step2WasteType';
import { Step3Size } from '@/components/order/Step3Size';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressPickerModal } from '@/components/wizard/AddressPickerModal';
import type { PickedAddress } from '@/components/wizard/AddressPickerModal';

// ── Types ─────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

const today = new Date();

// ── Component ─────────────────────────────────────────────────────
export default function OrderWizard() {
  const router = useRouter();
  const {
    state,
    setLocationWithCoords,
    setWasteCategory,
    setSkipSize,
    setDeliveryDate,
    setConfirmedOrder,
  } = useOrder();
  const { user, token } = useAuth();

  // ── Wizard state ──────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [showPicker, setShowPicker] = useState(false);
  const [picked, setPicked] = useState<PickedAddress | null>(
    state.locationLat != null && state.locationLng != null && state.location
      ? { address: state.location, lat: state.locationLat, lng: state.locationLng, city: '' }
      : null,
  );
  const [selectedWaste, setSelectedWasteState] = useState<SkipWasteCategory | null>(
    state.wasteCategory,
  );
  const [selectedSize, setSelectedSizeState] = useState<SkipSize | null>(state.skipSize);
  const [selectedDay, setSelectedDay] = useState<string>(toISO(addDays(today, 1)));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [jobNumber, setJobNumber] = useState('');
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [notes, setNotes] = useState('');

  // ── Handlers ──────────────────────────────────────────────────
  const handlePickConfirm = useCallback(
    (p: PickedAddress) => {
      setPicked(p);
      setLocationWithCoords(p.address, p.lat, p.lng);
      setShowPicker(false);
      setStep(2);
    },
    [setLocationWithCoords],
  );

  const handleWasteSelect = useCallback(
    (waste: SkipWasteCategory) => {
      setSelectedWasteState(waste);
      setWasteCategory(waste);
      setTimeout(() => setStep(3), 180);
    },
    [setWasteCategory],
  );

  const handleSizeSelect = useCallback(
    (size: SkipSize) => {
      setSelectedSizeState(size);
      setSkipSize(size);
      setTimeout(() => setStep(4), 180);
    },
    [setSkipSize],
  );

  const goBack = useCallback(() => {
    if (step === 1) router.back();
    else setStep((s) => (s - 1) as Step);
  }, [step, router]);

  const price = SKIP_PRICES[state.skipSize ?? selectedSize ?? 'MIDI'] ?? 129;

  const ctaLabel = step === 4 ? `Pasūtīt — €${price}` : 'Turpināt';

  const ctaDisabled =
    (step === 1 && !picked) ||
    (step === 2 && !selectedWaste) ||
    (step === 3 && !selectedSize) ||
    submitting;

  const onCTA = useCallback(async () => {
    if (step < 4) {
      if (step === 1 && !picked) {
        setShowPicker(true);
        return;
      }
      setStep((s) => (s + 1) as Step);
      return;
    }
    // Submit
    if (!token) {
      Alert.alert('Pieteikties nepīciešams', 'Lai veiktu pasūtījumu, lūdzu vispirms piesakieties.');
      return;
    }
    if (!state.location || !state.wasteCategory || !state.skipSize) return;
    setSubmitting(true);
    setDeliveryDate(selectedDay);
    try {
      const order = await api.skipHire.create(
        {
          location: state.location,
          wasteCategory: state.wasteCategory,
          skipSize: state.skipSize,
          deliveryDate: selectedDay,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          notes: notes || undefined,
        },
        token ?? undefined,
      );
      haptics.success();
      setConfirmedOrder(order);
      router.push('/order/confirmation');
    } catch (err) {
      Alert.alert(t.skipHire.errorTitle, err instanceof Error ? err.message : t.skipHire.error);
    } finally {
      setSubmitting(false);
    }
  }, [
    step,
    picked,
    token,
    state,
    selectedDay,
    contactName,
    contactPhone,
    notes,
    setDeliveryDate,
    setConfirmedOrder,
    router,
  ]);

  const STEP_TITLES: Record<Step, string> = {
    1: t.skipHire.step1.title,
    2: t.skipHire.step2.title,
    3: t.skipHire.step3.title,
    4: t.skipHire.step4.title,
  };

  // ── Success screen ────────────────────────────────────────────
  if (success) {
    return (
      <View style={s.successRoot}>
        <CheckCircle size={72} color="#22c55e" />
        <Text style={s.successTitle}>Pasūtījums pieņemts!</Text>
        <Text style={s.successSub}>Mēs sazināsimies drīzumā</Text>
        {jobNumber ? (
          <View style={s.jobBadge}>
            <Text style={s.jobBadgeText}>#{jobNumber}</Text>
          </View>
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
        visible={showPicker}
        title="Kur piegādāt konteinerus?"
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
        ctaLoading={submitting}
      >
        {/* ── Step 1: Location ── */}
        {step === 1 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.contentPad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.hint}>Norādiet adresi, kur piegādāt skipus.</Text>

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
              <Text style={[s.addressText, !picked && s.addressPlaceholder]} numberOfLines={2}>
                {picked?.address ?? 'Pieskarieties, lai izvēlētos adresi'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step 2: Waste type ── */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            <Step2WasteType selected={selectedWaste} onSelect={handleWasteSelect} />
          </View>
        )}

        {/* ── Step 3: Skip size ── */}
        {step === 3 && (
          <View style={{ flex: 1 }}>
            <Step3Size selected={selectedSize} onSelect={handleSizeSelect} />
          </View>
        )}

        {/* ── Step 4: Date + Contact ── */}
        {step === 4 && (
          <ScrollView
            style={s.content}
            contentContainerStyle={s.contentPad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.sectionLabel}>Piegādes datums</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayStrip}>
              {Array.from({ length: 14 }, (_, i) => {
                const d = addDays(today, i + 1);
                const iso = toISO(d);
                const active = selectedDay === iso;
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[s.dayChip, active && s.dayChipActive]}
                    onPress={() => setSelectedDay(iso)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.dayDow, active && s.dayActive]}>
                      {d.toLocaleDateString('lv-LV', { weekday: 'short' })}
                    </Text>
                    <Text style={[s.dayNum, active && s.dayActive]}>{d.getDate()}</Text>
                    <Text style={[s.dayMon, active && s.dayActiveSub]}>
                      {d.toLocaleDateString('lv-LV', { month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Summary */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Kopsavilkums</Text>
            <View style={s.summaryCard}>
              <SumRow icon="📍" label="Adrese" value={picked?.address ?? state.location ?? '—'} />
              <SumRow
                icon="♻️"
                label="Atkritumu veids"
                value={
                  selectedWaste
                    ? (t.skipHire.step2.types[selectedWaste]?.label ?? selectedWaste)
                    : '—'
                }
              />
              <SumRow
                icon="📦"
                label="Konteinera izmērs"
                value={
                  selectedSize ? (t.skipHire.step3.sizes[selectedSize]?.label ?? selectedSize) : '—'
                }
              />
              <SumRow icon="💰" label="Cena" value={`€${price} + PVN`} />
            </View>

            {/* Contact */}
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
                placeholder="Piezīmes (neobligāti)"
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
  contentPad: { padding: 20, paddingBottom: 32 },
  hint: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  addressText: { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500', lineHeight: 20 },
  addressPlaceholder: { color: '#9ca3af', fontWeight: '400' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  dayStrip: { flexGrow: 0 },
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
  dayActiveSub: { color: '#9ca3af' },
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
  successSub: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
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
