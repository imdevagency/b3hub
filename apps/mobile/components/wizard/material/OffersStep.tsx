/**
 * OffersStep — "Piedāvājumi" step of the material order wizard.
 *
 * Handles: loading/error states, supplier offer cards, sort & filter pills,
 * RFQ fallback, and success screens after order or RFQ submission.
 *
 * Owns sort/filter UI state internally; all data and submit callbacks
 * come from the wizard root.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MapPin, Truck, Calendar, Send, CheckCircle2, Check } from 'lucide-react-native';
import { OfferCard } from './OfferCard';
import { UNIT_SHORT } from '@/lib/materials';
import type { MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { s } from './_styles';
import { WizardAuthGate } from '@/components/wizard/WizardAuthGate';

export type OffersStepProps = {
  offers: SupplierOffer[];
  offersLoading: boolean;
  offersError: string;
  submitted: 'order' | 'rfq' | null;
  submitting: boolean;
  submitError: string;
  orderNumber: string;
  rfqNumber: string;
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
  onSelectOffer: (offer: SupplierOffer) => void;
  onSendRFQ: () => void;
  onNavigateToOrder: () => void;
  onNavigateToRFQ: () => void;
};

export function OffersStep({
  offers,
  offersLoading,
  offersError,
  submitted,
  submitting,
  submitError,
  orderNumber,
  rfqNumber,
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
  onSelectOffer,
  onSendRFQ,
  onNavigateToOrder,
  onNavigateToRFQ,
}: OffersStepProps) {
  // ── Internal filter/sort state ──
  const [offersSort, setOffersSort] = useState<'price' | 'distance' | 'eta' | 'rating'>('price');

  // ── Auth gate state ──
  const [authGateVisible, setAuthGateVisible] = useState(false);
  // Pending action to replay after successful auth
  const pendingActionRef = useRef<(() => void) | null>(null);

  /** Wrap any action that requires auth — shows gate if unauthenticated. */
  const requireAuth = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      pendingActionRef.current = action;
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
            Piegādātājs saņēma jūsu pasūtījumu. Lai to apstiprinātu, veiciet apmaksu.
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
          onPress={onNavigateToOrder}
          activeOpacity={0.85}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#fff',
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            Apmaksāt pasūtījumu
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
          onPress={onNavigateToOrder}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, color: colors.textMuted, fontFamily: 'Inter_500Medium' }}>
            Skatīt pasūtījumu
          </Text>
        </TouchableOpacity>

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

  // ── Success: RFQ sent ──
  if (submitted === 'rfq') {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={s.successWrap}>
          <View style={[s.successIconBg, { backgroundColor: colors.primary }]}>
            <Send size={36} color="#fff" />
          </View>
          <Text style={s.successTitle}>Pieprasījums nosūtīts!</Text>
          <Text style={s.successNum}>Nr. {rfqNumber}</Text>
          <Text style={s.successSub}>
            Piegādātāji jūsu rajonā saņēma paziņojumu. Kad kāds atbildēs ar cenu, jūs saņemsiet
            paziņojumu.
          </Text>
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
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => requireAuth(onSendRFQ)}
          disabled={submitting}
          style={s.rfqBox}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={s.rfqIconBg}>
              <Send size={20} color="#111827" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rfqTitle}>Nosūtīt cenu pieprasījumu</Text>
              <Text style={s.rfqSub}>
                Jūsu pieprasījums tiks nosūtīts visiem atbilstošajiem piegādātājiem jūsu rajonā.
              </Text>
            </View>
          </View>
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
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: '#fff',
    },
    active && { borderColor: colors.textPrimary, backgroundColor: colors.bgMuted },
  ];

  const pillTextStyle = (active: boolean) => [
    { fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_500Medium' },
    active && {
      color: colors.textPrimary,
      fontWeight: '600' as const,
      fontFamily: 'Inter_600SemiBold',
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: colors.textPrimary,
            fontFamily: 'Inter_600SemiBold',
          }}
        >
          {sorted.length} piedāvājum{sorted.length === 1 ? 's' : 'i'}
        </Text>

        {/* Combined Filters Horizontal Scroller */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ overflow: 'visible' }}
        >
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginRight: 4,
                fontFamily: 'Inter_500Medium',
              }}
            >
              Sortēt:
            </Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  haptics.light();
                  setOffersSort(opt.key);
                }}
                style={pillStyle(offersSort === opt.key)}
              >
                <Text style={pillTextStyle(offersSort === opt.key)}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            <View
              style={{ width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 6 }}
            />

            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginRight: 4,
                fontFamily: 'Inter_500Medium',
              }}
            >
              Max €/t:
            </Text>
            {[null, 10, 20, 50].map((cap) => (
              <TouchableOpacity
                key={cap === null ? 'all' : cap}
                onPress={() => {
                  haptics.light();
                  setPriceMaxFilter(cap);
                }}
                style={pillStyle(priceMaxFilter === cap)}
              >
                <Text style={pillTextStyle(priceMaxFilter === cap)}>
                  {cap === null ? 'Visi' : `≤€${cap}`}
                </Text>
              </TouchableOpacity>
            ))}

            <View
              style={{ width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 6 }}
            />

            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginRight: 4,
                fontFamily: 'Inter_500Medium',
              }}
            >
              Max km:
            </Text>
            {([null, 25, 50, 100] as (number | null)[]).map((km) => (
              <TouchableOpacity
                key={km === null ? 'all-km' : km}
                onPress={() => {
                  haptics.light();
                  setDistanceMaxFilter(km);
                }}
                style={pillStyle(distanceMaxFilter === km)}
              >
                <Text style={pillTextStyle(distanceMaxFilter === km)}>
                  {km === null ? 'Visi' : `≤${km}km`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {submitError ? (
          <Text style={{ fontSize: 14, color: colors.danger, fontWeight: '500' }}>
            {submitError}
          </Text>
        ) : null}
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

        {/* BIS number + terms — shown above RFQ fallback */}
        <View style={{ gap: 12, marginTop: 4 }}>
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

        {/* RFQ fallback */}
        <View
          style={{
            marginTop: 12,
            padding: 16,
            backgroundColor: colors.bgSubtle,
            borderRadius: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#f3f4f6',
          }}
        >
          <Text
            style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12, textAlign: 'center' }}
          >
            Neesat apmierināts ar cenām?
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: '#fff',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '#d1d5db',
              borderRadius: 8,
            }}
            onPress={() => requireAuth(onSendRFQ)}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Send size={14} color="#111827" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
              Pieprasīt spec. cenas
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar for Submission */}
      {selectedOffer && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            paddingBottom: 32, // Accommodate safe area roughly
            backgroundColor: '#fff',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <TouchableOpacity
            style={{
              backgroundColor: termsAccepted ? colors.primary : '#d1d5db',
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
            }}
            disabled={submitting || !termsAccepted}
            activeOpacity={0.85}
            onPress={() => requireAuth(() => onSelectOffer(selectedOffer))}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#fff',
                  fontFamily: 'Inter_600SemiBold',
                }}
              >
                {!termsAccepted
                  ? 'Piekrītiet noteikumiem'
                  : `Cena €${selectedOffer.totalPrice.toFixed(2)} — Apstiprināt`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Auth gate — shown when a guest taps an offer or RFQ button */}
      <WizardAuthGate
        visible={authGateVisible}
        onAuthenticated={handleAuthenticated}
        onDismiss={() => {
          setAuthGateVisible(false);
          pendingActionRef.current = null;
        }}
      />
    </View>
  );
}
