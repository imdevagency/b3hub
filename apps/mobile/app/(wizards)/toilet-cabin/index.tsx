/**
 * Toilet Cabin Hire wizard
 *
 *   Step 1 – Cabin count & hire period
 *   Step 2 – Delivery address
 *   Step 3 – Date & contact details + confirm
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Building2,
  Calendar,
  Check,
  MapPin,
  Phone,
  User,
  AlignLeft,
} from 'lucide-react-native';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { WizardCalendar } from '@/components/wizard/WizardCalendar';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TextInputField } from '@/components/ui/TextInputField';
import { DetailRow } from '@/components/ui/DetailRow';
import { InfoSection } from '@/components/ui/InfoSection';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

const today = new Date();
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function formatDate(d: Date): string {
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Hire period options ─────────────────────────────────────────────
const HIRE_PERIOD_OPTIONS: Array<{ days: number; label: string }> = [
  { days: 3, label: '3 dienas' },
  { days: 7, label: '1 nedēļa' },
  { days: 14, label: '2 nedēļas' },
  { days: 30, label: '1 mēnesis' },
  { days: 60, label: '2 mēneši' },
  { days: 90, label: '3 mēneši' },
];

const BASE_PRICE_PER_CABIN_PER_DAY = 12;

// ── Component ───────────────────────────────────────────────────────
export default function ToiletCabinWizard() {
  const router = useRouter();
  const { user, token } = useAuth();
  const toast = useToast();

  // ── Step state ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [cabinCount, setCabinCount] = useState(1);
  const [hireDays, setHireDays] = useState(7);
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<Date>(addDays(today, 2));
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [contactName, setContactName] = useState(
    () => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(() => user?.email ?? '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);

  // Sync contact from auth on login mid-wizard
  useEffect(() => {
    if (!user) return;
    if (!contactName.trim())
      setContactName(`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
    if (!contactPhone.trim()) setContactPhone(user.phone ?? '');
    if (!contactEmail.trim()) setContactEmail(user.email ?? '');
  }, [user?.id]);

  const estimatedPrice = cabinCount * hireDays * BASE_PRICE_PER_CABIN_PER_DAY;

  // ── Step CTA config ────────────────────────────────────────────
  let ctaLabel = 'Tālāk';
  let ctaDisabled = false;

  if (step === 1) {
    ctaDisabled = cabinCount < 1 || hireDays < 1;
  } else if (step === 2) {
    ctaDisabled = !picked;
  } else if (step === 3) {
    ctaLabel = 'Apstiprināt pasūtījumu';
    ctaDisabled = !contactPhone.trim() || !contactName.trim();
  }

  const onCTA = useCallback(async () => {
    haptics.light();
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      return;
    }

    // Step 3 — submit
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const result = await api.createToiletCabinOrder(
        {
          address: picked!.address,
          city: picked!.city ?? '',
          lat: picked!.lat,
          lng: picked!.lng,
          cabinCount,
          hireDays,
          deliveryDate: deliveryDate.toISOString().split('T')[0],
          deliveryWindow,
          contactName,
          contactPhone,
          contactEmail,
          notes,
        },
        token ?? undefined,
      );
      haptics.success();
      setConfirmedOrderNumber(result.orderNumber);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kļūda';
      Alert.alert('Kļūda', msg);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [step, picked, cabinCount, hireDays, deliveryDate, deliveryWindow, contactName, contactPhone, contactEmail, notes, token]);

  // ── Success screen ─────────────────────────────────────────────
  if (confirmedOrderNumber) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={s.successWrap}>
        <View style={s.successIcon}>
          <Check size={40} color="#fff" strokeWidth={2.5} />
        </View>
        <Text style={s.successTitle}>Pasūtījums saņemts!</Text>
        <Text style={s.successSub}>Tualetes kabīņu noma apstiprināta.</Text>
        <Text style={s.orderNumber}>{confirmedOrderNumber}</Text>
        <TouchableOpacity
          style={s.successBtn}
          onPress={() => router.replace('/(buyer)/home' as never)}
        >
          <Text style={s.successBtnText}>Uz sākumu</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <WizardLayout
      title="Tualetes kabīnes"
      totalSteps={3}
      currentStep={step}
      onBack={() => {
        if (step === 1) {
          if (router.canGoBack()) router.back();
          else router.replace('/(buyer)/home' as never);
        } else {
          setStep((s) => (s - 1) as Step);
        }
      }}
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
      {/* ── Step 1: Count & period ── */}
      {step === 1 && (
        <ScrollView
          style={s.content}
          contentContainerStyle={s.pad}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.stepSub}>Cik tualetes kabīnes nepieciešamas?</Text>

          {/* Cabin count selector */}
          <SectionLabel label="Kabīņu skaits" style={{ marginTop: 16 }} />
          <View style={s.counterRow}>
            <TouchableOpacity
              style={s.counterBtn}
              onPress={() => setCabinCount((n) => Math.max(1, n - 1))}
            >
              <Text style={s.counterBtnText}>−</Text>
            </TouchableOpacity>
            <View style={s.counterValue}>
              <Building2 size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={s.counterValueText}>{cabinCount}</Text>
            </View>
            <TouchableOpacity
              style={s.counterBtn}
              onPress={() => setCabinCount((n) => Math.min(20, n + 1))}
            >
              <Text style={s.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Hire period */}
          <SectionLabel label="Nomas periods" style={{ marginTop: 24 }} />
          <View style={s.periodGrid}>
            {HIRE_PERIOD_OPTIONS.map((opt) => {
              const isSel = hireDays === opt.days;
              return (
                <TouchableOpacity
                  key={opt.days}
                  style={[s.periodChip, isSel && s.periodChipSel]}
                  onPress={() => setHireDays(opt.days)}
                >
                  <Text style={[s.periodChipText, isSel && s.periodChipTextSel]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price estimate */}
          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Aptuvena cena</Text>
            <Text style={s.priceValue}>€{estimatedPrice} + PVN</Text>
            <Text style={s.priceNote}>
              {cabinCount} kab. × {hireDays} d. × €{BASE_PRICE_PER_CABIN_PER_DAY}/d.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ── Step 2: Address ── */}
      {step === 2 && (
        <ScrollView
          style={s.content}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={s.stepSub}>Kur piegādāt kabīnes?</Text>
            <AddressField
              label="Piegādes adrese"
              placeholder="Iela, pilsēta"
              value={picked?.address ?? ''}
              onPick={(addr) => setPicked(addr)}
              style={{ marginTop: 8 }}
            />
          </View>
        </ScrollView>
      )}

      {/* ── Step 3: Date + contact + confirm ── */}
      {step === 3 && (
        <ScrollView
          style={s.content}
          contentContainerStyle={s.pad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date picker */}
          <SectionLabel label="Piegādes datums *" />
          <WizardCalendar
            selected={deliveryDate}
            minDate={addDays(today, 1)}
            onSelect={(d) => setDeliveryDate(d)}
          />

          {/* Time window */}
          <SectionLabel label="Piegādes laiks" style={{ marginTop: 16 }} />
          <View style={s.windowRow}>
            {(['ANY', 'AM', 'PM'] as const).map((w) => (
              <TouchableOpacity
                key={w}
                style={[s.windowChip, deliveryWindow === w && s.windowChipSel]}
                onPress={() => setDeliveryWindow(w)}
              >
                <Text style={[s.windowChipText, deliveryWindow === w && s.windowChipTextSel]}>
                  {w === 'ANY' ? 'Jebkurā laikā' : w === 'AM' ? '8:00–13:00' : '13:00–18:00'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Contact */}
          <SectionLabel label="Kontaktinformācija *" style={{ marginTop: 20 }} />
          <TextInputField
            placeholder="Vārds, uzvārds"
            value={contactName}
            onChangeText={setContactName}
            style={{ marginBottom: 12 }}
          />
          <TextInputField
            placeholder="Tālrunis"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            style={{ marginBottom: 12 }}
          />
          <TextInputField
            placeholder="E-pasts (neobligāti)"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ marginBottom: 12 }}
          />
          <TextInputField
            placeholder="Piezīmes (neobligāti)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {/* Summary */}
          <InfoSection title="Pasūtījuma kopsavilkums" style={{ marginTop: 20 }}>
            <DetailRow label="Kabīnes" value={`${cabinCount} gab.`} />
            <DetailRow label="Nomas periods" value={`${hireDays} dienas`} />
            <DetailRow label="Adrese" value={picked?.address ?? '—'} />
            <DetailRow label="Piegāde" value={formatDate(deliveryDate)} />
            <DetailRow label="Aptuvena cena" value={`€${estimatedPrice} + PVN`} />
          </InfoSection>
        </ScrollView>
      )}
    </WizardLayout>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  content: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  stepSub: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 22,
  },

  // Counter
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  counterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: 24,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  counterValue: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'center',
  },
  counterValueText: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Period chips
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  periodChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.bgMuted,
  },
  periodChipSel: {
    backgroundColor: colors.primary,
  },
  periodChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  periodChipTextSel: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },

  // Price box
  priceBox: {
    marginTop: 28,
    padding: 20,
    backgroundColor: colors.bgMuted,
    borderRadius: 16,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  priceNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Window chips
  windowRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  windowChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgMuted,
  },
  windowChipSel: { backgroundColor: colors.primary },
  windowChipText: { fontSize: 13, color: colors.textSecondary },
  windowChipTextSel: { color: '#fff' },

  // Success
  successWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success ?? '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  orderNumber: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 32,
  },
  successBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  successBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
