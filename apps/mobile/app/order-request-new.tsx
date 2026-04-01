/**
 * order-request-new.tsx
 *
 * Buyer material order wizard — matches web CATALOGUE → SPECS → WHERE → WHEN → OFFERS/RFQ flow.
 *
 *  Catalog page selects a category, then:
 *  Step 1 – SPECS   : free-form material name (pre-filled), quantity, unit, optional notes
 *  Step 2 – WHERE   : delivery address picker
 *  Step 3 – WHEN    : preferred delivery date
 *  Step 4 – OFFERS  : instant supplier offers → buyer picks one → order placed;
 *                     OR no offers → send RFQ (quote request)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UNIT_SHORT, CATEGORY_LABELS, DEFAULT_MATERIAL_NAMES } from '@/lib/materials';
import type { MaterialCategory, MaterialUnit } from '@/lib/materials';
import type { SupplierOffer } from '@/lib/api';
import {
  MapPin,
  Check,
  Truck,
  Calendar,
  Minus,
  Plus,
  Send,
  Star,
  Clock,
  Zap as ZapIcon,
  CheckCircle2,
  Lock,
} from 'lucide-react-native';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'specs' | 'address' | 'when' | 'offers';
type SubmitResult = 'order' | 'rfq';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS: Step[] = ['specs', 'address', 'when', 'offers'];

const UNITS: MaterialUnit[] = ['TONNE', 'M3', 'PIECE', 'LOAD'];

const UNIT_LABEL: Record<MaterialUnit, string> = {
  TONNE: 'tonne',
  M3: 'm³',
  PIECE: 'gab.',
  LOAD: 'krava',
};

/** Category-specific default unit; all others default to TONNE. */
const CATEGORY_DEFAULT_UNIT: Partial<Record<string, MaterialUnit>> = {
  CONCRETE: 'M3',
};

const STEP_TITLES: Record<Step, string> = {
  specs: 'Ko pasūtīt?',
  address: 'Kur piegādāt?',
  when: 'Kad piegādāt?',
  offers: 'Piedāvājumi',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrderRequestWizard() {
  const router = useRouter();
  const { user, token } = useAuth();
  const params = useLocalSearchParams<{
    initialCategory?: string;
    prefillMaterial?: string;
    prefillAddress?: string;
    prefillCity?: string;
    projectId?: string;
  }>();

  const category = (params.initialCategory ?? '') as MaterialCategory;

  // ── Step state ──
  const [step, setStep] = useState<Step>('specs');
  const stepIndex = STEPS.indexOf(step);

  // ── Specs step ──
  const [materialName, setMaterialName] = useState(
    () => params.prefillMaterial || DEFAULT_MATERIAL_NAMES[category as MaterialCategory] || '',
  );
  const [unit, setUnit] = useState<MaterialUnit>(CATEGORY_DEFAULT_UNIT[category] ?? 'TONNE');
  const [quantity, setQuantity] = useState(5);
  const [notes, setNotes] = useState('');

  // ── Address step ──
  const [pickedAddress, setPickedAddress] = useState<PickedAddress | null>(null);

  // ── When step ──
  const [deliveryDate, setDeliveryDate] = useState('');

  // ── Offers step ──
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [rfqNumber, setRfqNumber] = useState('');
  const [rfqId, setRfqId] = useState('');

  // ── Contact — pre-filled from user profile ──
  const [contactName] = useState(() => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [contactPhone] = useState(() => user?.phone ?? '');

  // ── Quantity quick-values ──
  const stepAmt = unit === 'M3' ? 1 : 5;
  const quickValues = unit === 'M3' ? [1, 5, 10, 20] : [5, 10, 20, 50];

  // ── Load offers when entering the offers step ──
  useEffect(() => {
    if (step !== 'offers' || !token || !pickedAddress) return;
    setOffersLoading(true);
    setOffersError('');
    setOffers([]);
    api.materials
      .getOffers(
        {
          category: category as MaterialCategory,
          quantity,
          lat: pickedAddress.lat,
          lng: pickedAddress.lng,
        },
        token,
      )
      .then(setOffers)
      .catch(() => {
        setOffersError('Neizdevās ielādēt piedāvājumus. Jūs joprojām varat nosūtīt pieprasījumu.');
      })
      .finally(() => setOffersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Navigation ──
  const goBack = useCallback(() => {
    if (submitted) {
      router.replace('/(buyer)/orders' as never);
      return;
    }
    if (stepIndex === 0) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/catalog' as never);
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  }, [stepIndex, router, submitted]);

  const goNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }, [stepIndex]);

  // ── Submit: buyer selects a specific supplier offer ──
  const handleSelectOffer = async (offer: SupplierOffer) => {
    if (!token || !pickedAddress) return;
    // Validate min order quantity
    if (offer.minOrder && quantity < offer.minOrder) {
      setSubmitError(
        `Minimālais pasūtījuma daudzums šim piegādātājam ir ${offer.minOrder} ${UNIT_SHORT[unit] ?? unit}`,
      );
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const order = await api.materials.createOrder(
        {
          buyerId: user!.id,
          materialId: offer.id,
          quantity,
          unit,
          unitPrice: offer.basePrice,
          deliveryAddress: pickedAddress.address,
          deliveryCity: pickedAddress.city,
          deliveryDate: deliveryDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
          projectId: params.projectId || undefined,
        },
        token,
      );
      setOrderNumber(order.orderNumber);
      setSubmitted('order');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit: send RFQ when no offers (or as alternative) ──
  const handleSendRFQ = async () => {
    if (!token || !pickedAddress) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await api.quoteRequests.create(
        {
          materialCategory: category,
          materialName,
          quantity,
          unit,
          deliveryAddress: pickedAddress.address,
          deliveryCity: pickedAddress.city,
          deliveryLat: pickedAddress.lat,
          deliveryLng: pickedAddress.lng,
          notes: notes || undefined,
        },
        token,
      );
      setRfqNumber(result.requestNumber);
      setRfqId(result.id);
      setSubmitted('rfq');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── CTA config ──
  const canProceed =
    step === 'specs'
      ? materialName.trim().length > 0 && quantity > 0
      : step === 'address'
        ? !!pickedAddress
        : step === 'when'
          ? true
          : !offersLoading && !submitting && !submitted;

  const ctaLabel = submitted
    ? submitted === 'rfq'
      ? 'Skatīt pieprasījumu'
      : 'Skatīt pasūtījumus'
    : step === 'offers'
      ? 'Nosūtīt pieprasījumu'
      : 'Turpināt';

  const handleCTA = submitted
    ? submitted === 'rfq'
      ? () => router.replace(`/(buyer)/rfq/${rfqId}` as never)
      : () => router.replace('/(buyer)/orders' as never)
    : step === 'offers'
      ? handleSendRFQ
      : goNext;

  // Whether the caller pre-selected a specific material (came from a catalog product row)
  const hasPrefill = !!params.prefillMaterial;

  // ── Step renders ──────────────────────────────────────────────────────────

  const renderSpecs = () => (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Material block */}
      {hasPrefill ? (
        /* ── Ultimate Minimal Locked State ── */
        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 48 }}>
          <View style={[s.catBadgeMin, { marginBottom: 12 }]}>
            <Text style={s.catBadgeTextMin}>
              {CATEGORY_LABELS[category as MaterialCategory] ?? category}
            </Text>
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24 }}
          >
            <Text
              style={{
                fontSize: 32,
                fontFamily: 'Inter_800ExtraBold',
                color: '#111827',
                textAlign: 'center',
                flexShrink: 1,
                lineHeight: 38,
              }}
            >
              {materialName}
            </Text>
            <Lock size={20} color="#E5E7EB" style={{ marginTop: 4 }} />
          </View>
        </View>
      ) : (
        /* ── Open: user arrived via category only — let them describe ── */
        <View style={{ marginBottom: 40, marginTop: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={s.fieldLabel}>Materiāls</Text>
            <View style={s.catBadgeMin}>
              <Text style={s.catBadgeTextMin}>
                {CATEGORY_LABELS[category as MaterialCategory] ?? category}
              </Text>
            </View>
          </View>

          <TextInput
            style={s.textInput}
            value={materialName}
            onChangeText={setMaterialName}
            placeholder="Frakcija, precizējums (piem., 16/32 mm)"
            placeholderTextColor="#9ca3af"
          />
        </View>
      )}

      {/* Hero Quantity & Unit Stepper */}
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <View style={s.stepperRow}>
          <TouchableOpacity
            style={s.stepBtn}
            onPress={() => setQuantity((q) => Math.max(1, q - stepAmt))}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Minus size={24} color="#111827" />
          </TouchableOpacity>

          <View style={s.stepperValueWrap}>
            <Text style={s.stepperValue}>{quantity}</Text>
          </View>

          <TouchableOpacity
            style={s.stepBtn}
            onPress={() => setQuantity((q) => q + stepAmt)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Units seamless toggle */}
        <View style={s.unitToggleRow}>
          {UNITS.map((u) => {
            const isActive = unit === u;
            return (
              <TouchableOpacity
                key={u}
                style={[s.unitToggleBtn, isActive && s.unitToggleBtnActive]}
                onPress={() => setUnit(u)}
                activeOpacity={0.8}
              >
                <Text style={[s.unitToggleText, isActive && s.unitToggleTextActive]}>
                  {UNIT_LABEL[u]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notes */}
      <View style={s.field}>
        <Text style={s.fieldLabel}>
          Papildu prasības <Text style={{ color: '#9ca3af', fontWeight: '400' }}>(neobligāti)</Text>
        </Text>
        <TextInput
          style={[s.textInput, s.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="piem., piegāde ar mazo auto, nesasaldēts..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />
      </View>
    </ScrollView>
  );

  const renderAddress = () => (
    <InlineAddressStep
      picked={pickedAddress}
      onPick={setPickedAddress}
      initialText={params.prefillAddress}
    />
  );

  const renderWhen = () => {
    const todayISO = new Date().toISOString().split('T')[0];
    const isAsap = deliveryDate === '';

    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.stepSub}>Izvēlieties vēlamo piegādes datumu</Text>

        <TouchableOpacity
          style={[s.asapCard, isAsap && s.asapCardActive]}
          onPress={() => setDeliveryDate('')}
          activeOpacity={0.8}
        >
          <View style={[s.asapIcon, isAsap && s.asapIconActive]}>
            <Truck size={20} color={isAsap ? '#111827' : '#6b7280'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.asapTitle, isAsap && s.asapTitleActive]}>Cik drīz iespējams</Text>
            <Text style={s.asapSub}>Piegādātājs sazināsies par laiku</Text>
          </View>
          {isAsap && <Check size={18} color="#111827" />}
        </TouchableOpacity>

        <RNCalendar
          minDate={todayISO}
          current={deliveryDate || todayISO}
          markedDates={
            deliveryDate
              ? {
                  [deliveryDate]: {
                    selected: true,
                    selectedColor: '#111827',
                    selectedTextColor: '#fff',
                  },
                }
              : {}
          }
          onDayPress={(day: { dateString: string }) => setDeliveryDate(day.dateString)}
          theme={{
            calendarBackground: '#ffffff',
            backgroundColor: '#ffffff',
            selectedDayBackgroundColor: '#111827',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#6b7280',
            dayTextColor: '#111827',
            textDisabledColor: '#d1d5db',
            arrowColor: '#111827',
            monthTextColor: '#111827',
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 15,
            textMonthFontSize: 16,
          }}
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#F9FAFB',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}
          enableSwipeMonths
        />

        <View style={s.hint}>
          <Text style={s.hintText}>
            Datums ir orientējošs — piegādātājs apstiprinās precīzu laiku.
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderOffers = () => {
    // ── Success: order placed ──
    if (submitted === 'order') {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={s.successWrap}>
            <View style={s.successIconBg}>
              <CheckCircle2 size={36} color="#fff" />
            </View>
            <Text style={s.successTitle}>Pasūtījums veikts!</Text>
            <Text style={s.successNum}>Nr. {orderNumber}</Text>
          </View>
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
            <View style={[s.successIconBg, { backgroundColor: '#2563eb' }]}>
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
          <Text style={{ fontSize: 14, color: '#6b7280', fontWeight: '500' }}>
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
            <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{offersError}</Text>
          ) : (
            <>
              <Text style={s.offersTitle}>Nav tūlītēju piedāvājumu</Text>
              <Text style={s.offersSub}>
                Nosūtiet pieprasījumu — piegādātāji atbildēs ar savām cenām.
              </Text>
            </>
          )}
          {submitError ? (
            <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{submitError}</Text>
          ) : null}
          <View style={s.rfqBox}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={s.rfqIconBg}>
                <Send size={20} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rfqTitle}>Nosūtīt cenu pieprasījumu</Text>
                <Text style={s.rfqSub}>
                  Jūsu pieprasījums tiks nosūtīts visiem atbilstošajiem piegādātājiem jūsu rajonā.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

    // ── Offers list ──
    const sorted = [...offers].sort((a, b) => a.totalPrice - b.totalPrice);
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        <Text style={s.offersTitle}>
          {offers.length} piedāvājum{offers.length === 1 ? 's' : 'i'}
        </Text>
        <Text style={s.offersSub}>Sakārtoti pēc cenas — lētākais pirmais</Text>
        {submitError ? (
          <Text style={{ fontSize: 14, color: '#dc2626', fontWeight: '500' }}>{submitError}</Text>
        ) : null}
        {sorted.map((offer, idx) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            unit={unit}
            isCheapest={idx === 0}
            submitting={submitting}
            onSelect={() => handleSelectOffer(offer)}
          />
        ))}
        {/* RFQ fallback — always visible below offers */}
        <View style={[s.rfqBox, { marginTop: 4 }]}>
          <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            Vēlaties saņemt vairāk piedāvājumu?
          </Text>
          <TouchableOpacity
            style={[s.rfqBtn, submitting && { opacity: 0.5 }]}
            onPress={handleSendRFQ}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Send size={14} color="#111827" />
            <Text style={s.rfqBtnText}>Pieprasīt vairāk piedāvājumu</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <WizardLayout
      title={
        submitted === 'order'
          ? 'Pasūtījums veikts!'
          : submitted === 'rfq'
            ? 'Pieprasījums nosūtīts!'
            : STEP_TITLES[step]
      }
      step={stepIndex + 1}
      totalSteps={STEPS.length}
      onBack={goBack}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(buyer)/catalog' as never);
      }}
      ctaLabel={ctaLabel}
      onCTA={handleCTA}
      ctaDisabled={!canProceed || submitting}
      ctaLoading={submitting && step !== 'offers'}
    >
      {step === 'specs' && renderSpecs()}
      {step === 'address' && renderAddress()}
      {step === 'when' && renderWhen()}
      {step === 'offers' && renderOffers()}
    </WizardLayout>
  );
}

// ── Offer Card ────────────────────────────────────────────────────────────────

function OfferCard({
  offer,
  unit,
  isCheapest,
  submitting,
  onSelect,
}: {
  offer: SupplierOffer;
  unit: MaterialUnit;
  isCheapest: boolean;
  submitting: boolean;
  onSelect: () => void;
}) {
  return (
    <View style={[oc.card, isCheapest && oc.cardBest]}>
      <View style={oc.top}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={oc.supplierName} numberOfLines={1}>
              {offer.supplier.name}
            </Text>
            {isCheapest && (
              <View style={oc.bestBadge}>
                <Star size={10} color="#166534" />
                <Text style={oc.bestText}>Labākais</Text>
              </View>
            )}
          </View>
          {offer.supplier.city ? <Text style={oc.supplierCity}>{offer.supplier.city}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={oc.price}>€{offer.totalPrice.toFixed(2)}</Text>
          <Text style={oc.priceUnit}>
            €{offer.basePrice.toFixed(2)} / {UNIT_SHORT[unit]}
          </Text>
        </View>
      </View>

      <View style={oc.meta}>
        {offer.distanceKm !== null && offer.distanceKm !== undefined ? (
          <View style={oc.metaItem}>
            <Truck size={13} color="#6b7280" />
            <Text style={oc.metaText}>{offer.distanceKm.toFixed(0)} km</Text>
          </View>
        ) : null}
        <View style={oc.metaItem}>
          <Clock size={13} color="#6b7280" />
          <Text style={oc.metaText}>{offer.etaDays} d.</Text>
        </View>
        {offer.isInstant ? (
          <View style={oc.metaItem}>
            <ZapIcon size={13} color="#d97706" />
            <Text style={[oc.metaText, { color: '#d97706', fontWeight: '600' }]}>Tūlītējs</Text>
          </View>
        ) : null}
        {offer.minOrder ? (
          <View style={oc.metaItem}>
            <Text style={oc.metaText}>
              Min: {offer.minOrder} {UNIT_SHORT[unit] ?? unit}
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={[oc.btn, submitting && { opacity: 0.6 }]}
        onPress={onSelect}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={oc.btnText}>Izvēlēties šo piedāvājumu</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Specs step ──
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4F5F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  catBadgeMin: {
    backgroundColor: '#F4F5F7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  catBadgeTextMin: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#6b7280' },

  field: { gap: 10 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af', // lighter label since the form is focused
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18, // taller tap target
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },

  // ── Quantity stepper ──
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 12,
  },
  stepBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  stepperValueWrap: { minWidth: 100, alignItems: 'center' },
  stepperValue: {
    fontSize: 72, // Mega large quantity size
    fontFamily: 'Inter_800ExtraBold',
    color: '#111827',
    letterSpacing: -2.5,
    includeFontPadding: false,
  },

  // ── Unit Toggle ──
  unitToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#F4F5F7',
    borderRadius: 16,
    padding: 6,
    marginTop: 16,
  },
  unitToggleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  unitToggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  unitToggleText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#9ca3af',
  },
  unitToggleTextActive: {
    color: '#111827',
  },

  // ── When step ──
  stepSub: { fontSize: 15, color: '#6b7280', fontFamily: 'Inter_500Medium', lineHeight: 22 },
  asapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  asapCardActive: {
    backgroundColor: '#ffffff',
    borderColor: '#111827',
    borderWidth: 2,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  asapIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  asapIconActive: { backgroundColor: '#F4F5F7', shadowOpacity: 0, elevation: 0 },
  asapTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  asapTitleActive: { color: '#111827' },
  asapSub: { fontSize: 13, color: '#6b7280', marginTop: 2, fontFamily: 'Inter_500Medium' },
  hint: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F4F5F7',
    borderRadius: 12,
    marginTop: 8,
  },
  hintText: { fontSize: 13, color: '#4b5563', lineHeight: 18, fontFamily: 'Inter_500Medium' },

  // ── Offers step ──
  offersTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  offersSub: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter_500Medium',
    marginTop: -8,
  },
  rfqBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
  },
  rfqIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfqTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  rfqSub: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginTop: 4,
    fontFamily: 'Inter_500Medium',
  },
  rfqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 100,
    backgroundColor: '#F4F5F7',
  },
  rfqBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#111827' },

  // ── Success state ──
  successWrap: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  successIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  successNum: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#6b7280' },
  successSub: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 16,
    fontFamily: 'Inter_500Medium',
  },
  summaryCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  summaryText: { flex: 1, fontSize: 15, color: '#111827', fontFamily: 'Inter_500Medium' },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F4F5F7',
    marginHorizontal: 16,
  },
});

// ── Offer card styles ──────────────────────────────────────────────────────────

const oc = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardBest: { borderColor: '#111827' },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  supplierName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  supplierCity: { fontSize: 14, color: '#6b7280', marginTop: 2, fontFamily: 'Inter_500Medium' },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bestText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: '#6b7280', fontFamily: 'Inter_500Medium' },
  btn: {
    margin: 12,
    marginTop: 0,
    backgroundColor: '#F4F5F7',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#111827' },
});
