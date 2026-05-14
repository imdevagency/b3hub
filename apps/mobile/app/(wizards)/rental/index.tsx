/**
 * Generic Rental Wizard — /(wizards)/rental?serviceType=MINI_EXCAVATOR
 *
 * Handles all rental service types from RENTAL_SERVICES registry.
 * Flow: quantity → address → hire period → contact + confirm
 *
 * Wizard steps:
 *   1 – Quantity / model selection
 *   2 – Delivery address
 *   3 – Hire period (date range + time window)
 *   4 – Contact details + submit
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddressField } from '@/components/ui/AddressField';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { RentalHirePeriodStep } from '@/components/wizard/RentalHirePeriodStep';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';
import { WizardContactFields } from '@/components/wizard/WizardContactFields';
import { WizardPaymentMethodPicker } from '@/components/wizard/WizardPaymentMethodPicker';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { rentalsApi } from '@/lib/api/rentals';
import { RENTAL_SERVICES, type RentalServiceType } from '@/lib/rental-services';
import { addDays, toISO } from '@/components/wizard/skip-hire/_types';

// ── Types ─────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

const tomorrow = toISO(addDays(new Date(), 1));

// ── Helpers ───────────────────────────────────────────────────────

function calcCollectionDay(deliveryDay: string | null, hireDays: number): string | null {
  if (!deliveryDay) return null;
  const d = new Date(deliveryDay + 'T00:00:00');
  d.setDate(d.getDate() + hireDays);
  return toISO(d);
}

// ── Wizard ────────────────────────────────────────────────────────

export default function RentalWizardScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ serviceType?: string }>();

  const serviceType = (params.serviceType ?? 'MINI_EXCAVATOR') as RentalServiceType;
  const service = RENTAL_SERVICES[serviceType];

  // Guard — unknown service type
  if (!service) {
    router.back();
    return null;
  }

  const [step, setStep] = useState<Step>(1);
  const [quantity, setQuantity] = useState(1);
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hireDays, setHireDays] = useState<number>(service.hirePeriodOptions[0]?.days ?? 1);
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'INVOICE'>('CARD');

  // Contact
  const [contactName, setContactName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : '',
  );
  const [contactPhone, setContactPhone] = useState(user?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [notes, setNotes] = useState('');

  // Auth gate
  const [authGateOpen, setAuthGateOpen] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);

  // Derived
  const collectionDay = calcCollectionDay(selectedDay, hireDays);

  const handleDayPress = useCallback((iso: string) => {
    haptics.light();
    setSelectedDay(iso);
  }, []);

  const handleHireDaysChange = useCallback((days: number) => {
    haptics.light();
    setHireDays(days);
  }, []);

  const STEP_TITLES: Record<Step, string> = {
    1: `${service.label} — daudzums`,
    2: 'Piegādes adrese',
    3: 'Nomas periods',
    4: 'Apstiprināt pasūtījumu',
  };

  const canProceed = (() => {
    if (step === 1) return quantity >= 1;
    if (step === 2) return !!picked;
    if (step === 3) return !!selectedDay;
    if (step === 4) return contactPhone.trim().length >= 7;
    return false;
  })();

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => (s - 1) as Step);
    }
  };

  const handleCTA = () => {
    if (step < 4) {
      haptics.light();
      setStep((s) => (s + 1) as Step);
      return;
    }
    // Step 4 — submit
    if (!token) {
      setAuthGateOpen(true);
      return;
    }
    doSubmit(token);
  };

  const doSubmit = async (authToken: string) => {
    if (!picked || !selectedDay) return;
    setSubmitting(true);
    try {
      // Estimate price: use placeholder until provider pricing is live
      const estimatedPrice = hireDays * 100 * quantity;
      await rentalsApi.create(
        {
          serviceType,
          address: picked.address,
          city: picked.city ?? picked.address,
          lat: picked.lat,
          lng: picked.lng,
          hireDays,
          deliveryDate: selectedDay,
          deliveryWindow,
          quantity,
          price: estimatedPrice,
          paymentMethod,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim(),
          notes: notes.trim() || undefined,
        },
        authToken,
      );
      haptics.success();
      router.replace('/(buyer)/orders');
    } catch (err) {
      haptics.error();
      Alert.alert('Kļūda', 'Neizdevās nosūtīt pieteikumu. Lūdzu, mēģiniet vēlreiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = service.Icon;

  return (
    <>
      <WizardLayout
        title={STEP_TITLES[step]}
        step={step}
        totalSteps={4}
        onBack={handleBack}
        ctaLabel={step < 4 ? 'Turpināt' : 'Apstiprināt'}
        onCTA={handleCTA}
        ctaDisabled={!canProceed}
        ctaLoading={submitting}
      >
        {/* ── Step 1: Quantity ─────────────────────────── */}
        {step === 1 && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Service summary card */}
            <View style={styles.serviceCard}>
              <View style={styles.serviceIconWrap}>
                <Icon size={28} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.serviceCardText}>
                <Text style={styles.serviceTitle}>{service.label}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
              </View>
            </View>

            <SectionLabel label={`Daudzums (${service.unitLabel})`} />
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                onPress={() => {
                  if (quantity > 1) {
                    haptics.light();
                    setQuantity((q) => q - 1);
                  }
                }}
                disabled={quantity <= 1}
              >
                <Minus size={20} color={quantity <= 1 ? '#d1d5db' : '#111827'} />
              </TouchableOpacity>

              <View style={styles.qtyDisplay}>
                <Text style={styles.qtyNumber}>{quantity}</Text>
                <Text style={styles.qtyLabel}>{service.unitLabel}</Text>
              </View>

              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => {
                  haptics.light();
                  setQuantity((q) => q + 1);
                }}
              >
                <Plus size={20} color="#111827" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Step 2: Address ──────────────────────────── */}
        {step === 2 && (
          <View style={styles.content}>
            <SectionLabel label="Piegādes adrese" />
            <AddressField
              value={picked?.address ?? ''}
              onPick={(p) => setPicked(p)}
              placeholder="Meklēt adresi…"
            />
          </View>
        )}

        {/* ── Step 3: Hire period ──────────────────────── */}
        {step === 3 && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <RentalHirePeriodStep
              selectedDay={selectedDay}
              collectionDay={collectionDay}
              hireDays={hireDays}
              deliveryWindow={deliveryWindow}
              onDayPress={handleDayPress}
              onHireDaysChange={handleHireDaysChange}
              onWindowChange={setDeliveryWindow}
              periodOptions={service.hirePeriodOptions}
              minDate={tomorrow}
            />
          </ScrollView>
        )}

        {/* ── Step 4: Contact + confirm ────────────────── */}
        {step === 4 && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Order summary */}
            <View style={styles.summaryCard}>
              <SummaryRow label="Pakalpojums" value={service.label} />
              <SummaryRow label="Daudzums" value={`${quantity} ${service.unitLabel}`} />
              <SummaryRow label="Adrese" value={picked?.address ?? '—'} />
              {selectedDay && (
                <SummaryRow
                  label="Piegāde"
                  value={new Date(selectedDay + 'T00:00:00').toLocaleDateString('lv-LV', {
                    day: 'numeric',
                    month: 'long',
                  })}
                />
              )}
              {collectionDay && (
                <SummaryRow
                  label="Savākšana"
                  value={new Date(collectionDay + 'T00:00:00').toLocaleDateString('lv-LV', {
                    day: 'numeric',
                    month: 'long',
                  })}
                />
              )}
              <SummaryRow label="Nomas periods" value={`${hireDays} dienas`} />
            </View>

            <SectionLabel label="Kontaktinformācija" style={{ marginTop: 24 }} />
            <WizardContactFields
              name={contactName}
              onChangeName={setContactName}
              phone={contactPhone}
              onChangePhone={setContactPhone}
              email={contactEmail}
              onChangeEmail={setContactEmail}
              notes={notes}
              onChangeNotes={setNotes}
            />

            {user && (
              <>
                <SectionLabel label="Maksājuma veids" style={{ marginTop: 24 }} />
                <WizardPaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
              </>
            )}
          </ScrollView>
        )}
      </WizardLayout>

      <WizardAuthGate
        visible={authGateOpen}
        onAuthenticated={() => {
          setAuthGateOpen(false);
          if (token) doSubmit(token);
        }}
        onGuestContact={(info) => {
          setAuthGateOpen(false);
          setContactName(info.name);
          setContactPhone(info.phone);
          if (info.email) setContactEmail(info.email);
          // Re-trigger submit as guest
          doSubmit('');
        }}
        onDismiss={() => setAuthGateOpen(false)}
        prefilledName={contactName}
        prefilledPhone={contactPhone}
        prefilledEmail={contactEmail}
      />
    </>
  );
}

// ── Summary row helper ────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  serviceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#e6f7f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCardText: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    lineHeight: 18,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
    marginBottom: 24,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  qtyNumber: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    lineHeight: 48,
  },
  qtyLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
  },
});
