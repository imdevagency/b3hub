/**
 * OffersStep — "Piedāvājumi" step of the material order wizard.
 *
 * Handles: loading/error states, supplier offer cards, sort & filter pills,
 * and success screens after order submission.
 *
 * Owns sort/filter UI state internally; all data and submit callbacks
 * come from the wizard root.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  MapPin,
  Truck,
  Calendar,
  Send,
  CheckCircle2,
  Check,
  SlidersHorizontal,
  X,
  ChevronDown,
} from 'lucide-react-native';
import { OfferCard } from './OfferCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { UNIT_SHORT } from '@/lib/materials';
import type { MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { s } from './_styles';
import { WizardAuthGate, type GuestContactInfo } from '@/components/wizard/WizardAuthGate';
import { addGuestOrder } from '@/lib/guest-token-storage';

export type OffersStepProps = {
  offers: SupplierOffer[];
  offersLoading: boolean;
  offersError: string;
  submitted: 'order' | null;
  submitting: boolean;
  submitError: string;
  orderNumber: string;
  orderId: string;
  pickedAddress: PickedAddress | null;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  truckCount: number;
  truckIntervalMinutes: number;
  deliveryDate: string;
  /** Whether the current user has a valid auth token. */
  isAuthenticated: boolean;
  bisNumber: string;
  onBisNumberChange: (v: string) => void;
  termsAccepted: boolean;
  onTermsAcceptedChange: (v: boolean) => void;
  paymentMethod: 'CARD' | 'INVOICE';
  onPaymentMethodChange: (v: 'CARD' | 'INVOICE') => void;
  onSelectOffer: (offer: SupplierOffer) => void;
  /**
   * Called when an unauthenticated user picks "Continue as guest" and
   * submits contact info. Parent should submit the order via the public
   * guest-orders endpoint and navigate to the success screen.
   * If omitted, the guest path is hidden in the auth gate.
   */
  onGuestContact?: (offer: SupplierOffer, contact: GuestContactInfo) => void;
  /** Pre-filled contact info from earlier wizard steps (when available). */
  prefilledContactName?: string;
  prefilledContactPhone?: string;
  prefilledContactEmail?: string;
  onContactNameChange?: (v: string) => void;
  onContactPhoneChange?: (v: string) => void;
  /** True if the success screen is for a guest order (no instant-pay path). */
  isGuestSuccess?: boolean;
  /** Public tracking token for the guest order — used to persist it in AsyncStorage. */
  guestToken?: string;
  onNavigateToOrder: () => void;
  /**
   * When provided, the offers step works in "compare-only" mode:
   * - Contact/payment/terms UI is hidden (moved to a separate confirm step)
   * - Tapping the sticky CTA calls this callback instead of submitting
   */
  onOfferChosen?: (offer: SupplierOffer) => void;
};

export function OffersStep({
  offers,
  offersLoading,
  offersError,
  submitted,
  submitting,
  submitError,
  orderNumber,
  orderId,
  pickedAddress,
  materialName,
  quantity,
  unit,
  truckCount,
  truckIntervalMinutes,
  deliveryDate,
  isAuthenticated,
  bisNumber,
  onBisNumberChange,
  termsAccepted,
  onTermsAcceptedChange,
  paymentMethod,
  onPaymentMethodChange,
  onSelectOffer,
  onGuestContact,
  prefilledContactName,
  prefilledContactPhone,
  prefilledContactEmail,
  onContactNameChange,
  onContactPhoneChange,
  isGuestSuccess,
  guestToken,
  onNavigateToOrder,
  onOfferChosen,
}: OffersStepProps) {
  const router = useRouter();
  // ── Internal filter/sort state ──
  const [offersSort, setOffersSort] = useState<'price' | 'distance' | 'eta' | 'rating'>('price');
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Persist guest order token when the success screen is shown
  useEffect(() => {
    if (!isGuestSuccess || !guestToken) return;
    // Extract raw token from 'guest:TOKEN' format if needed
    const rawToken = guestToken.startsWith('guest:') ? guestToken.slice(6) : guestToken;
    addGuestOrder({
      token: rawToken,
      orderNumber,
      category: 'MATERIAL',
      createdAt: Date.now(),
    });
  }, [isGuestSuccess, guestToken, orderNumber]);

  // ── Auth gate state ──
  const [authGateVisible, setAuthGateVisible] = useState(false);
  // Pending action to replay after successful auth
  const pendingActionRef = useRef<(() => void) | null>(null);
  // If set, guest checkout is allowed for this offer
  const pendingGuestOfferRef = useRef<SupplierOffer | null>(null);

  /** Wrap any action that requires auth — shows gate if unauthenticated. */
  const requireAuth = (action: () => void, guestOffer?: SupplierOffer) => {
    if (isAuthenticated) {
      action();
    } else {
      pendingActionRef.current = action;
      pendingGuestOfferRef.current = guestOffer ?? null;
      setAuthGateVisible(true);
    }
  };

  const handleAuthenticated = () => {
    setAuthGateVisible(false);
    // Replay the action that triggered the gate (token is now set in context)
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      // Slight delay so auth context propagates before the API call fires
      setTimeout(action, 150);
    }
  };
  const [priceMaxFilter, setPriceMaxFilter] = useState<number | null>(null);
  const [distanceMaxFilter, setDistanceMaxFilter] = useState<number | null>(null);

  let activeFiltersCount = 0;
  if (priceMaxFilter !== null) activeFiltersCount++;
  if (distanceMaxFilter !== null) activeFiltersCount++;

  const [selectedOffer, setSelectedOffer] = useState<SupplierOffer | null>(null);

  // ── Success: order placed ──
  if (submitted === 'order') {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={s.successWrap}>
          <View style={s.successIconBg}>
            <CheckCircle2 size={36} color="#fff" />
          </View>
          <Text style={s.successTitle}>Pasūtījums izveidots</Text>
          <Text style={s.successNum}>Nr. {orderNumber}</Text>
          <Text style={[s.successSub, { marginTop: 4 }]}>
            {isGuestSuccess
              ? 'Mēs sazināsimies ar jums tuvākajā laikā, lai apstiprinātu cenu un piegādes laiku. Apstiprinājums nosūtīts uz jūsu e-pastu.'
              : 'Piegādātājs saņēma jūsu pasūtījumu. Lai to apstiprinātu, veiciet apmaksu.'}
          </Text>
        </View>

        {!isGuestSuccess && (
          <TouchableOpacity
            style={{
              backgroundColor: '#111827',
              borderRadius: 999,
              paddingVertical: 18,
              alignItems: 'center',
              marginBottom: 12,
            }}
            onPress={onNavigateToOrder}
            activeOpacity={0.85}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#fff',
                fontFamily: 'Inter_700Bold',
                letterSpacing: -0.2,
              }}
            >
              Apmaksāt pasūtījumu
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: isGuestSuccess ? '#111827' : 'transparent',
            borderRadius: 999,
            paddingVertical: isGuestSuccess ? 18 : 14,
            alignItems: 'center',
          }}
          onPress={onNavigateToOrder}
          activeOpacity={0.7}
        >
          <Text
            style={{
              fontSize: isGuestSuccess ? 16 : 14,
              color: isGuestSuccess ? '#fff' : colors.textMuted,
              fontFamily: isGuestSuccess ? 'Inter_600SemiBold' : 'Inter_500Medium',
              fontWeight: isGuestSuccess ? '600' : undefined,
            }}
          >
            {isGuestSuccess ? 'Atgriezties uz sākumu' : 'Skatīt pasūtījumu'}
          </Text>
        </TouchableOpacity>

        {/* Guest-only: upsell card */}
        {isGuestSuccess && (
          <TouchableOpacity
            style={{
              backgroundColor: colors.bgSubtle,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 16,
              marginBottom: 20,
              alignItems: 'center',
            }}
            onPress={() => router.push('/(auth)/register' as never)}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'Inter_600SemiBold',
                color: colors.textPrimary,
                marginBottom: 4,
              }}
            >
              Sekojiet pasūtījumam ar kontu
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Inter_400Regular',
                color: colors.textMuted,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              Reģistrējieties, lai sekotu statusam reāllaikā un saglabātu adreses.
            </Text>
          </TouchableOpacity>
        )}

        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <MapPin size={16} color="#111827" />
            <Text style={s.summaryText} numberOfLines={2}>
              {pickedAddress?.address}
            </Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Truck size={16} color="#111827" />
            <Text style={s.summaryText}>
              {quantity} {UNIT_SHORT[unit]} · {materialName}
              {truckCount > 1 ? ` · ${truckCount} auto (ik ${truckIntervalMinutes} min)` : ''}
            </Text>
          </View>
          {deliveryDate ? (
            <>
              <View style={s.summaryDivider} />
              <View style={s.summaryRow}>
                <Calendar size={16} color="#111827" />
                <Text style={s.summaryText}>
                  {new Date(deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  // ── Loading ──
  if (offersLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '500' }}>
          Meklējam pieejamos piegādātājus...
        </Text>
      </View>
    );
  }

  // ── Error or no offers ──
  if (offersError || offers.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        {offersError ? (
          <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '500' }}>
            {offersError}
          </Text>
        ) : (
          <>
            <Text style={s.offersTitle}>Nav tūlītēju piedāvājumu</Text>
            <Text style={s.offersSub}>
              Nosūtiet pieprasījumu — piegādātāji atbildēs ar savām cenām.
            </Text>
          </>
        )}
        {submitError ? (
          <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '500' }}>
            {submitError}
          </Text>
        ) : null}

        {/* BIS + terms before submit */}
        <TextInput
          value={bisNumber}
          onChangeText={onBisNumberChange}
          placeholder="BIS numurs (neobligāts) — piem. BL-231-2123-12"
          placeholderTextColor={colors.textDisabled}
          autoCapitalize="characters"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.textPrimary,
            fontFamily: 'Inter_400Regular',
            backgroundColor: '#fff',
          }}
        />
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
          onPress={() => onTermsAcceptedChange(!termsAccepted)}
          activeOpacity={0.7}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: termsAccepted ? '#111827' : '#d1d5db',
              backgroundColor: termsAccepted ? '#111827' : '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {termsAccepted && <Check size={12} color="#fff" strokeWidth={2.5} />}
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              color: colors.textSecondary,
              fontFamily: 'Inter_400Regular',
              lineHeight: 20,
            }}
          >
            Piekrītu{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>
              lietošanas noteikumiem
            </Text>{' '}
            un{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>
              privātuma politikai
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Offers list ──
  const sorted = [...offers]
    .filter((o) => priceMaxFilter == null || o.effectiveUnitPrice <= priceMaxFilter)
    .filter(
      (o) =>
        distanceMaxFilter == null || (o.distanceKm != null && o.distanceKm <= distanceMaxFilter),
    )
    .sort((a, b) => {
      if (offersSort === 'distance') {
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      }
      if (offersSort === 'eta') {
        return (a.etaHours ?? a.etaDays * 8) - (b.etaHours ?? b.etaDays * 8);
      }
      if (offersSort === 'rating') {
        return (b.supplier.rating ?? 0) - (a.supplier.rating ?? 0);
      }
      return a.totalPrice - b.totalPrice; // default: price
    });

  const SORT_OPTIONS: { key: typeof offersSort; label: string }[] = [
    { key: 'price', label: 'Cena' },
    { key: 'distance', label: 'Attālums' },
    { key: 'eta', label: 'Piegādes laiks' },
    { key: 'rating', label: 'Vērtējums' },
  ];

  const pillStyle = (active: boolean) => [
    {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: active ? '#111827' : '#f3f4f6',
    },
  ];

  const pillTextStyle = (active: boolean) => [
    {
      fontSize: 13,
      color: active ? '#fff' : '#4b5563',
      fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
      fontWeight: active ? ('700' as const) : ('500' as const),
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: colors.textPrimary,
            fontFamily: 'Inter_700Bold',
            letterSpacing: -0.3,
          }}
        >
          {sorted.length} piedāvājum{sorted.length === 1 ? 's' : 'i'}
        </Text>

        {/* Uber style filter triggers */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: '#f3f4f6',
            }}
            onPress={() => {
              haptics.light();
              setFiltersVisible(true);
            }}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={14} color="#111827" />
            <Text
              style={{
                fontSize: 13,
                color: '#111827',
                fontFamily: 'Inter_600SemiBold',
                fontWeight: '600',
              }}
            >
              Filtri {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
            </Text>
            <ChevronDown size={14} color="#111827" style={{ marginLeft: 2 }} />
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1, overflow: 'visible' }}
          >
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
              {SORT_OPTIONS.filter((o) => o.key === offersSort).map((opt) => (
                <TouchableOpacity
                  key="sort-active"
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: '#111827',
                  }}
                  onPress={() => {
                    haptics.light();
                    setFiltersVisible(true);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#fff',
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                    }}
                  >
                    Kārtot: {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {priceMaxFilter !== null && (
                <TouchableOpacity
                  key="price-active"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: '#111827',
                  }}
                  onPress={() => {
                    haptics.light();
                    setPriceMaxFilter(null);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#fff',
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                    }}
                  >
                    ≤€{priceMaxFilter}/t
                  </Text>
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              )}
              {distanceMaxFilter !== null && (
                <TouchableOpacity
                  key="dist-active"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: '#111827',
                  }}
                  onPress={() => {
                    haptics.light();
                    setDistanceMaxFilter(null);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: '#fff',
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                    }}
                  >
                    ≤{distanceMaxFilter}km
                  </Text>
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>

        {submitError ? (
          <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '500' }}>
            {submitError}
          </Text>
        ) : null}

        {/* Contact — always editable so site contact can differ from account */}
        {!onOfferChosen && isAuthenticated && (
          <View style={{ gap: 8 }}>
            <TextInput
              value={prefilledContactName ?? ''}
              onChangeText={onContactNameChange}
              placeholder="Kontaktpersona"
              placeholderTextColor={colors.textDisabled}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.textPrimary,
                fontFamily: 'Inter_400Regular',
                backgroundColor: '#fff',
              }}
            />
            <TextInput
              value={prefilledContactPhone ?? ''}
              onChangeText={onContactPhoneChange}
              placeholder="Tālrunis"
              placeholderTextColor={colors.textDisabled}
              keyboardType="phone-pad"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.textPrimary,
                fontFamily: 'Inter_400Regular',
                backgroundColor: '#fff',
              }}
            />
          </View>
        )}

        {/* Payment method — authenticated users only */}
        {!onOfferChosen && isAuthenticated && (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: colors.textSecondary,
                marginBottom: 2,
              }}
            >
              Apmaksas veids
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onPaymentMethodChange('CARD')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: paymentMethod === 'CARD' ? '#111827' : colors.border,
                borderRadius: 12,
                padding: 12,
                gap: 10,
                backgroundColor: paymentMethod === 'CARD' ? '#f9fafb' : '#fff',
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: paymentMethod === 'CARD' ? '#111827' : '#d1d5db',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {paymentMethod === 'CARD' && (
                  <View
                    style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' }}
                  />
                )}
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Karte (Paysera)
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Tūlītēja apmaksa ar bankas karti
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onPaymentMethodChange('INVOICE')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: paymentMethod === 'INVOICE' ? '#111827' : colors.border,
                borderRadius: 12,
                padding: 12,
                gap: 10,
                backgroundColor: paymentMethod === 'INVOICE' ? '#f9fafb' : '#fff',
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: paymentMethod === 'INVOICE' ? '#111827' : '#d1d5db',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {paymentMethod === 'INVOICE' && (
                  <View
                    style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' }}
                  />
                )}
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Rēķins (NET 30)
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Rēķins tiks izrakstīts pēc piegādes
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* BIS number + terms — hidden in compare-only mode (moved to confirm step) */}
        {!onOfferChosen && (
          <View style={{ gap: 10 }}>
            <TextInput
              value={bisNumber}
              onChangeText={onBisNumberChange}
              placeholder="BIS numurs (neobligāts) — piem. BL-231-2123-12"
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="characters"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.textPrimary,
                fontFamily: 'Inter_400Regular',
                backgroundColor: '#fff',
              }}
            />
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
              onPress={() => onTermsAcceptedChange(!termsAccepted)}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: termsAccepted ? '#111827' : '#d1d5db',
                  backgroundColor: termsAccepted ? '#111827' : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {termsAccepted && <Check size={12} color="#fff" strokeWidth={2.5} />}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: colors.textSecondary,
                  fontFamily: 'Inter_400Regular',
                  lineHeight: 20,
                }}
              >
                Piekrītu{' '}
                <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>
                  lietošanas noteikumiem
                </Text>{' '}
                un{' '}
                <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}>
                  privātuma politikai
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: selectedOffer ? 120 : 32, // make space for sticky button
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 16,
        }}
      >
        {sorted.map((offer, idx) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            unit={unit}
            isSelected={selectedOffer?.id === offer.id}
            isCheapest={offersSort === 'price' && idx === 0}
            submitting={submitting && selectedOffer?.id === offer.id}
            onSelect={() => {
              if (submitting) return;
              haptics.selection();
              setSelectedOffer(offer);
            }}
          />
        ))}
      </ScrollView>

      {/* Sticky Bottom Bar for Submission / Advancing */}
      {selectedOffer && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 36,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.08,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          {onOfferChosen ? (
            // Compare-only mode: advance to confirm step
            <TouchableOpacity
              style={{
                backgroundColor: '#111827',
                borderRadius: 999,
                paddingVertical: 18,
                alignItems: 'center',
              }}
              disabled={submitting}
              activeOpacity={0.85}
              onPress={() => onOfferChosen(selectedOffer)}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#fff',
                  fontFamily: 'Inter_700Bold',
                  letterSpacing: -0.2,
                }}
              >
                {`Turpināt — €${selectedOffer.totalPrice.toFixed(2)}`}
              </Text>
            </TouchableOpacity>
          ) : (
            // Submit mode: place order immediately
            <TouchableOpacity
              style={{
                backgroundColor: termsAccepted ? '#111827' : '#d1d5db',
                borderRadius: 999,
                paddingVertical: 18,
                alignItems: 'center',
              }}
              disabled={submitting || !termsAccepted}
              activeOpacity={0.85}
              onPress={() => requireAuth(() => onSelectOffer(selectedOffer), selectedOffer)}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#fff',
                    fontFamily: 'Inter_700Bold',
                    letterSpacing: -0.2,
                  }}
                >
                  {!termsAccepted
                    ? 'Piekrītiet noteikumiem'
                    : `Apstiprināt — €${selectedOffer.totalPrice.toFixed(2)}`}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Auth gate — shown when a guest taps an offer */}
      <WizardAuthGate
        visible={authGateVisible}
        onAuthenticated={handleAuthenticated}
        onGuestContact={
          onGuestContact && pendingGuestOfferRef.current
            ? (info) => {
                const offer = pendingGuestOfferRef.current;
                if (!offer) return;
                setAuthGateVisible(false);
                pendingActionRef.current = null;
                pendingGuestOfferRef.current = null;
                onGuestContact(offer, info);
              }
            : undefined
        }
        prefilledName={prefilledContactName}
        prefilledPhone={prefilledContactPhone}
        prefilledEmail={prefilledContactEmail}
        onDismiss={() => {
          setAuthGateVisible(false);
          pendingActionRef.current = null;
          pendingGuestOfferRef.current = null;
        }}
      />

      <BottomSheet
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        title="Kārtot un Filtrēt"
      >
        <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' }}>
              Kārtot pēc
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    haptics.light();
                    setOffersSort(opt.key);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: offersSort === opt.key ? '#111827' : '#e5e7eb',
                    backgroundColor: offersSort === opt.key ? '#111827' : '#fff',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: offersSort === opt.key ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      color: offersSort === opt.key ? '#fff' : '#4b5563',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' }}>
              Maksimālā cena
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[null, 10, 20, 50].map((cap) => (
                <TouchableOpacity
                  key={cap === null ? 'all' : cap}
                  onPress={() => {
                    haptics.light();
                    setPriceMaxFilter(cap);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: priceMaxFilter === cap ? '#111827' : '#e5e7eb',
                    backgroundColor: priceMaxFilter === cap ? '#111827' : '#fff',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: priceMaxFilter === cap ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      color: priceMaxFilter === cap ? '#fff' : '#4b5563',
                    }}
                  >
                    {cap === null ? 'Visas' : `≤€${cap}/t`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' }}>
              Maksimālais attālums
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {([null, 25, 50, 100] as (number | null)[]).map((km) => (
                <TouchableOpacity
                  key={km === null ? 'all' : km}
                  onPress={() => {
                    haptics.light();
                    setDistanceMaxFilter(km);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: distanceMaxFilter === km ? '#111827' : '#e5e7eb',
                    backgroundColor: distanceMaxFilter === km ? '#111827' : '#fff',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily:
                        distanceMaxFilter === km ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      color: distanceMaxFilter === km ? '#fff' : '#4b5563',
                    }}
                  >
                    {km === null ? 'Visi' : `≤${km}km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#111827',
              borderRadius: 999,
              paddingVertical: 18,
              alignItems: 'center',
              marginTop: 16,
            }}
            onPress={() => setFiltersVisible(false)}
          >
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' }}>
              Skatīt piedāvājumus
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}
