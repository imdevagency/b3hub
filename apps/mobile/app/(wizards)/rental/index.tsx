/**
 * Generic Rental Wizard — /(wizards)/rental?serviceType=MINI_EXCAVATOR
 *
 * Handles all rental service types from RENTAL_SERVICES registry.
 * Flow: quantity → address → pick provider → hire period → contact + confirm
 *
 * Wizard steps:
 *   1 – Quantity / model selection
 *   2 – Delivery address
 *   3 – Pick a provider (fetches live listings by city)
 *   4 – Hire period (date range + time window)
 *   5 – Contact details + submit
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Minus, Plus, Star, MapPin, CheckCircle2 } from 'lucide-react-native';
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
import { rentalsApi, type RentalListing } from '@/lib/api/rentals';
import { RENTAL_SERVICES, type RentalServiceType } from '@/lib/rental-services';
import { addDays, toISO } from '@/components/wizard/skip-hire/_types';

// ── Types ─────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

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

  // Provider picker state
  const [listings, setListings] = useState<RentalListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<RentalListing | null>(null);

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

  // Fetch listings when buyer reaches step 3 (after address is set)
  useEffect(() => {
    if (step !== 3 || !picked) return;
    setListings([]);
    setSelectedListing(null);
    setListingsLoading(true);
    rentalsApi
      .findListings(
        serviceType,
        picked.city ?? undefined,
        picked.lat ?? undefined,
        picked.lng ?? undefined,
      )
      .then((data) => {
        setListings(data);
        // Auto-select if only one provider
        if (data.length === 1) setSelectedListing(data[0]);
      })
      .catch(() => setListings([]))
      .finally(() => setListingsLoading(false));
  }, [step, picked, serviceType]);

  // Hire period options — prefer listing's options, fall back to service defaults
  const hirePeriodOptions = selectedListing?.hirePeriodOptions?.length
    ? selectedListing.hirePeriodOptions
    : service.hirePeriodOptions;

  // Price per day from selected listing (or 0 if none selected yet)
  const pricePerDay = selectedListing?.pricePerDay ?? 0;
  const totalPrice = pricePerDay * hireDays * quantity;

  const STEP_TITLES: Record<Step, string> = {
    1: `${service.label} — daudzums`,
    2: 'Piegādes adrese',
    3: 'Izvēlies piegādātāju',
    4: 'Nomas periods',
    5: 'Apstiprināt pasūtījumu',
  };

  const canProceed = (() => {
    if (step === 1) return quantity >= 1;
    if (step === 2) return !!picked;
    if (step === 3) return !!selectedListing;
    if (step === 4) return !!selectedDay;
    if (step === 5) return contactPhone.trim().length >= 7;
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
    if (step < 5) {
      haptics.light();
      setStep((s) => (s + 1) as Step);
      return;
    }
    // Step 5 — submit
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
      await rentalsApi.create(
        {
          serviceType,
          listingId: selectedListing?.id,
          address: picked.address,
          city: picked.city ?? picked.address,
          lat: picked.lat,
          lng: picked.lng,
          hireDays,
          deliveryDate: selectedDay,
          deliveryWindow,
          quantity,
          price: totalPrice > 0 ? totalPrice : hireDays * 100 * quantity,
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
        totalSteps={5}
        onBack={handleBack}
        ctaLabel={step < 5 ? 'Turpināt' : 'Apstiprināt'}
        onCTA={handleCTA}
        ctaDisabled={!canProceed || (step === 3 && listingsLoading)}
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

        {/* ── Step 3: Provider picker ──────────────────── */}
        {step === 3 && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {listingsLoading ? (
              <View style={{ alignItems: 'center', paddingTop: 48 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Meklējam pieejamos piegādātājus…</Text>
              </View>
            ) : listings.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Nav pieejamu piegādātāju</Text>
                <Text style={styles.emptyBody}>
                  Šobrīd nav neviena piegādātāja, kas apkalpo jūsu adresi. Mēģiniet citu pilsētu vai
                  sazinieties ar mums.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.providerHint}>
                  {listings.length} piegādātājs{listings.length !== 1 ? 'i' : ''} pieejams jūsu
                  rajonā
                </Text>
                {listings.map((listing) => {
                  const isSelected = selectedListing?.id === listing.id;
                  return (
                    <TouchableOpacity
                      key={listing.id}
                      style={[styles.providerCard, isSelected && styles.providerCardSelected]}
                      onPress={() => {
                        haptics.light();
                        setSelectedListing(listing);
                        // Reset hire days to listing's first option if available
                        if (listing.hirePeriodOptions?.length) {
                          setHireDays(listing.hirePeriodOptions[0].days);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      {/* Header row */}
                      <View style={styles.providerCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.providerName}>
                            {listing.provider?.name ?? 'Piegādātājs'}
                          </Text>
                          <Text style={styles.providerListingName} numberOfLines={1}>
                            {listing.name}
                          </Text>
                        </View>
                        {isSelected && (
                          <CheckCircle2 size={22} color={colors.primary} strokeWidth={2} />
                        )}
                      </View>

                      {/* Meta row */}
                      <View style={styles.providerMeta}>
                        {listing.provider?.rating != null && (
                          <View style={styles.metaChip}>
                            <Star size={12} color="#f59e0b" fill="#f59e0b" />
                            <Text style={styles.metaChipText}>
                              {listing.provider.rating.toFixed(1)}
                            </Text>
                          </View>
                        )}
                        {listing.coverageCities.length > 0 && (
                          <View style={styles.metaChip}>
                            <MapPin size={12} color="#6b7280" />
                            <Text style={styles.metaChipText}>
                              {listing.coverageCities.slice(0, 2).join(', ')}
                            </Text>
                          </View>
                        )}
                        {listing.provider?.verified && (
                          <View style={[styles.metaChip, { backgroundColor: '#e6f7f2' }]}>
                            <Text style={[styles.metaChipText, { color: colors.primary }]}>
                              ✓ Verificēts
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Price */}
                      <View style={styles.providerPriceRow}>
                        <Text style={styles.providerPrice}>€{listing.pricePerDay.toFixed(2)}</Text>
                        <Text style={styles.providerPriceUnit}>/ {listing.unitLabel} / dienā</Text>
                        {listing.minHireDays > 1 && (
                          <Text style={styles.providerPriceMin}>
                            · min. {listing.minHireDays} dienas
                          </Text>
                        )}
                      </View>

                      {listing.description ? (
                        <Text style={styles.providerDescription} numberOfLines={2}>
                          {listing.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}

        {/* ── Step 4: Hire period ──────────────────────── */}
        {step === 4 && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <RentalHirePeriodStep
              selectedDay={selectedDay}
              collectionDay={collectionDay}
              hireDays={hireDays}
              deliveryWindow={deliveryWindow}
              onDayPress={handleDayPress}
              onHireDaysChange={handleHireDaysChange}
              onWindowChange={setDeliveryWindow}
              periodOptions={hirePeriodOptions}
              minDate={tomorrow}
            />
          </ScrollView>
        )}

        {/* ── Step 5: Contact + confirm ────────────────── */}
        {step === 5 && (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Order summary */}
            <View style={styles.summaryCard}>
              <SummaryRow label="Pakalpojums" value={service.label} />
              {selectedListing && (
                <SummaryRow
                  label="Piegādātājs"
                  value={selectedListing.provider?.name ?? selectedListing.name}
                />
              )}
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
              {totalPrice > 0 && (
                <SummaryRow label="Kopā (est.)" value={`€${totalPrice.toFixed(2)}`} />
              )}
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
  // Provider picker
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  providerHint: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  providerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  providerCardSelected: {
    borderColor: '#00A878',
    backgroundColor: '#f0fdf4',
  },
  providerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  providerName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 2,
  },
  providerListingName: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
  },
  providerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#374151',
  },
  providerPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: 6,
  },
  providerPrice: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  providerPriceUnit: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
  },
  providerPriceMin: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#9ca3af',
    marginLeft: 4,
  },
  providerDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#6b7280',
    lineHeight: 18,
    marginTop: 4,
  },
  //
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
