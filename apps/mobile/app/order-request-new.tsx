/**
 * order-request-new.tsx
 *
 * Buyer material order wizard — mirrors the web WHAT → WHERE → WHEN → CONFIRM pattern.
 *
 *  Step 1 – WHAT (material)   : category chips + scrollable material cards
 *  Step 2 – WHAT (configure)  : fraction chips, quantity stepper, price preview
 *  Step 3 – WHERE (address)   : delivery address picker
 *  Step 4 – WHEN (date)       : preferred delivery date
 *  Step 5 – CONFIRM           : contact info + order summary + VAT breakdown (matches web step 4 "Apstiprināt")
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UNIT_SHORT, CATEGORY_ICON } from '@/lib/materials';
import type { MaterialCategory, MaterialUnit, ApiMaterial } from '@/lib/api';
import {
  MapPin,
  Check,
  Truck,
  CreditCard,
  Calendar,
  Layers,
  Mountain,
  Leaf,
  Box,
  Hexagon,
} from 'lucide-react-native';
import { Calendar as RNCalendar } from 'react-native-calendars';

const MaterialIcon = ({
  category,
  color,
  size,
}: {
  category: string;
  color: string;
  size: number;
}) => {
  switch (category) {
    case 'GRAVEL':
      return <Mountain size={size} color={color} />;
    case 'SAND':
      return <Layers size={size} color={color} />;
    case 'SOIL':
      return <Leaf size={size} color={color} />;
    case 'STONE':
      return <Hexagon size={size} color={color} />;
    case 'CONCRETE':
      return <Box size={size} color={color} />;
    case 'ASPHALT':
      return <Layers size={size} color={color} />;
    default:
      return <Box size={size} color={color} />;
  }
};
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';

import type { GlobalMaterial } from '@/components/order/order-request-types';

import { GLOBAL_MATERIALS } from '@/components/order/order-request-types';

// ── Types ────────────────────────────────────────────────────────────────────────────────────

type Step = 'material' | 'configure' | 'address' | 'when' | 'confirm';

// ── Constants ────────────────────────────────────────────────────────────────────────────────

const MATERIAL_CATEGORIES: { id: string; label: string }[] = [
  { id: 'ALL', label: 'Visi' },
  { id: 'GRAVEL', label: 'Grants' },
  { id: 'SAND', label: 'Smiltis' },
  { id: 'SOIL', label: 'Augsne' },
  { id: 'CONCRETE', label: 'Betons' },
  { id: 'STONE', label: 'Akmens' },
  { id: 'ASPHALT', label: 'Asfalts' },
];

const FRACTIONS = ['0/2', '0/4', '4/8', '8/16', '16/32', '0/32', '0/45'];
const STEPS: Step[] = ['material', 'configure', 'address', 'when', 'confirm'];

// ── Component ────────────────────────────────────────────────────────────────────────────────

export default function OrderRequestWizard() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [step, setStep] = useState<Step>('material');
  const stepIndex = STEPS.indexOf(step);

  // Address step
  const [pickedAddress, setPickedAddress] = useState<PickedAddress | null>(null);

  // Material step — using generic global catalog to mirror web flow
  const materials = GLOBAL_MATERIALS;
  const materialsLoading = false;
  const [selectedMaterial, setSelectedMaterial] = useState<GlobalMaterial | null>(null);
  const [matCategory, setMatCategory] = useState('ALL');

  // Configure step
  const [fraction, setFraction] = useState('0/4');
  const [quantity, setQuantity] = useState(10);

  // Contact step — pre-populated from user profile (matches web pattern)
  const [contactName, setContactName] = useState(() =>
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
  );
  const [contactPhone, setContactPhone] = useState(() => user?.phone ?? '');

  // When step
  const [deliveryDate, setDeliveryDate] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);

  const filteredMaterials =
    matCategory === 'ALL' ? materials : materials.filter((m) => m.category === matCategory);

  // ── Navigation ──────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (stepIndex === 0) {
      if (router.canGoBack()) router.back();
      else router.replace('/(buyer)/home' as never);
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  }, [stepIndex, router]);

  const goNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }, [stepIndex]);

  const canProceed =
    (step === 'material' && !!selectedMaterial) ||
    (step === 'configure' && quantity > 0) ||
    (step === 'address' && !!pickedAddress) ||
    step === 'when' || // delivery date is optional
    (step === 'confirm' && contactName.length > 2 && contactPhone.length > 5);

  const ctaLabel = step === 'confirm' ? 'Apstiprināt pasūtījumu' : 'Turpināt';

  const STEP_TITLES: Record<Step, string> = {
    material: 'Ko pasūtīt?',
    configure: 'Norādi daudzumu',
    address: 'Kur piegādāt?',
    when: 'Kad piegādāt?',
    confirm: 'Apstiprini pasūtījumu', // matches web step 4 "Apstiprināt"
  };

  // ── Address handler ──────────────────────────────────────────────────
  const handlePickConfirm = useCallback((picked: PickedAddress) => {
    setPickedAddress(picked);
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!token || !selectedMaterial || !pickedAddress) return;
    setSubmitting(true);
    try {
      const offers = await api.materials.getOffers(
        {
          category: selectedMaterial.category as MaterialCategory,
          quantity,
          lat: pickedAddress.lat,
          lng: pickedAddress.lng,
        },
        token,
      );
      if (offers.length > 0) {
        const best = offers.sort((a, b) => a.totalPrice - b.totalPrice)[0];
        const etaDate = new Date();
        etaDate.setDate(etaDate.getDate() + (best.etaDays || 1));
        const order = await api.materials.createOrder(
          {
            buyerId: user!.id,
            materialId: best.id,
            quantity,
            unit: selectedMaterial.unit,
            unitPrice: best.basePrice,
            deliveryAddress: pickedAddress.address,
            deliveryCity: pickedAddress.city,
            deliveryDate: deliveryDate || etaDate.toISOString().split('T')[0],
            siteContactName: contactName || undefined,
            siteContactPhone: contactPhone || undefined,
          },
          token,
        );
        Alert.alert('Pasūtījums izveidots!', 'Nr: ' + order.orderNumber, [
          { text: 'Labi', onPress: () => router.replace('/(buyer)/orders') },
        ]);
      } else {
        await api.quoteRequests.create(
          {
            materialCategory: selectedMaterial.category as MaterialCategory,
            materialName: selectedMaterial.name,
            quantity,
            unit: selectedMaterial.unit,
            deliveryAddress: pickedAddress.address,
            deliveryCity: pickedAddress.city,
            deliveryLat: pickedAddress.lat,
            deliveryLng: pickedAddress.lng,
            notes: `Kontakti: ${contactName}, ${contactPhone}`, // store contact in notes for quotes
          },
          token,
        );
        Alert.alert('Pieprasījums nosūtīts!', 'Piegādātāji sazināsies ar jums drīzumā.', [
          { text: 'Labi', onPress: () => router.replace('/(buyer)/orders') },
        ]);
      }
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Mēģinājiet vēlreiz');
    } finally {
      setSubmitting(false);
    }
  };

  // \u2500\u2500 Step renders \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const renderAddress = () => (
    <InlineAddressStep picked={pickedAddress} onPick={handlePickConfirm} />
  );

  const renderMaterial = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 12, paddingBottom: 4 }}
        >
          {MATERIAL_CATEGORIES.filter(
            (cat) => cat.id === 'ALL' || materials.some((m) => m.category === cat.id),
          ).map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[s.chip, matCategory === cat.id && s.chipActive]}
              onPress={() => setMatCategory(cat.id)}
            >
              <Text style={[s.chipText, matCategory === cat.id && s.chipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {materialsLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#111827" />
          <Text style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>Ielādē...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}>
          {filteredMaterials.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 32, fontSize: 14, color: '#6b7280' }}>
              Nav pieejamu materiālu
            </Text>
          ) : (
            filteredMaterials.map((mat) => {
              const active = selectedMaterial?.id === mat.id;
              return (
                <TouchableOpacity
                  key={mat.id}
                  style={[s.uberMatCard, active && s.uberMatCardActive]}
                  onPress={() => setSelectedMaterial(mat)}
                  activeOpacity={0.8}
                >
                  <View style={[s.uberMatIconBg, active && s.uberMatIconBgActive]}>
                    {mat.imageUrl ? (
                      <Image source={{ uri: mat.imageUrl }} style={s.matImage} />
                    ) : (
                      <MaterialIcon
                        category={mat.category}
                        color={active ? '#111827' : '#6b7280'}
                        size={24}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.uberMatName, active && s.uberMatNameActive]}>{mat.name}</Text>
                    {mat.description ? (
                      <Text style={s.uberMatDesc} numberOfLines={1}>
                        {mat.description}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );

  const renderConfigure = () => {
    const unit = selectedMaterial?.unit ?? 'TONNE';
    const stepAmt = unit === 'M3' ? 1 : 5;
    const quickValues = unit === 'M3' ? [1, 5, 10, 20] : [5, 10, 20, 50];
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[s.stepSub, { marginBottom: 16 }]}>Norādiet daudzumu un frakciju</Text>

        <View style={s.uberCard}>
          {/* Selected material summary */}
          <View style={s.uberRow}>
            <View style={[s.uberIconBg, { backgroundColor: '#fef3c7' }]}>
              <MaterialIcon category={selectedMaterial?.category || ''} color="#d97706" size={24} />
            </View>
            <View style={s.uberRowContent}>
              <Text style={s.uberRowLabel}>Izvēlētais materiāls</Text>
              <Text style={s.uberRowValue}>{selectedMaterial?.name}</Text>
              <Text style={[s.matDesc, { marginTop: 2 }]} numberOfLines={2}>
                {selectedMaterial?.description}
              </Text>
            </View>
          </View>

          <View style={[s.uberDivider, { marginLeft: 0 }]} />

          {/* Fraction */}
          <View style={{ paddingVertical: 8 }}>
            <Text style={[s.uberRowLabel, { marginBottom: 12 }]}>Frakcija</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {FRACTIONS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[s.uberChip, fraction === f && s.uberChipActive]}
                  onPress={() => setFraction(f)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.uberChipText, fraction === f && s.uberChipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[s.uberDivider, { marginLeft: 0 }]} />

          {/* Quantity stepper */}
          <View style={{ paddingVertical: 8 }}>
            <Text style={[s.uberRowLabel, { marginBottom: 12 }]}>Daudzums</Text>
            <View style={s.uberStepper}>
              <TouchableOpacity
                style={s.uberStepperBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - stepAmt))}
                activeOpacity={0.8}
              >
                <Text style={s.uberStepperIcon}>{'\u2212'}</Text>
              </TouchableOpacity>
              <View style={s.uberStepperValueWrap}>
                <Text style={s.uberStepperValue}>{quantity}</Text>
                <Text style={s.uberStepperUnit}>{UNIT_SHORT[unit]}</Text>
              </View>
              <TouchableOpacity
                style={s.uberStepperBtn}
                onPress={() => setQuantity((q) => q + stepAmt)}
                activeOpacity={0.8}
              >
                <Text style={s.uberStepperIcon}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={s.quickRow}>
              {quickValues.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.quickBtn, quantity === n && s.quickBtnActive]}
                  onPress={() => setQuantity(n)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.quickBtnText, quantity === n && s.quickBtnTextActive]}>
                    {n} {UNIT_SHORT[unit]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  // ── WHEN: delivery date picker ───────────────────────────────────────
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
          style={[
            s.uberMatCard,
            isAsap && s.uberMatCardActive,
            { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
          ]}
          onPress={() => setDeliveryDate('')}
          activeOpacity={0.8}
        >
          <View style={[s.uberMatIconBg, isAsap && s.uberMatIconBgActive]}>
            <Truck size={20} color={isAsap ? '#111827' : '#6b7280'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.uberMatName, isAsap && s.uberMatNameActive]}>Cik drīz iespējams</Text>
            <Text style={s.uberMatDesc}>Piegādātājs sazināsies par laiku</Text>
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
            borderColor: '#e5e7eb',
            marginBottom: 8,
          }}
          enableSwipeMonths
        />

        {/* Hint */}
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: '#fef3c7',
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 18 }}>
            Datums ir orientējošs — piegādātājs apstiprinās precīzu laiku.
          </Text>
        </View>
      </ScrollView>
    );
  };

  // ── CONFIRM: combined contact form + order summary (matches web step 4 "Apstiprināt") ────
  const renderConfirm = () => {
    const unit = selectedMaterial?.unit ?? 'TONNE';

    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* ── Contact form (top, like web step 4) ── */}
        <Text style={s.sectionLabel}>Kontaktinformācija</Text>
        <View style={{ gap: 10, marginBottom: 20 }}>
          <TextInput
            style={s.configureCard}
            placeholder="Vārds, uzvārds"
            placeholderTextColor="#9ca3af"
            value={contactName}
            onChangeText={setContactName}
            autoComplete="name"
          />
          <TextInput
            style={s.configureCard}
            placeholder="+371 2X XXX XXX"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={setContactPhone}
          />
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              backgroundColor: '#fef3c7',
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 18 }}>
              Šī informācija būs pieejama šoferim, lai tas varētu sazināties uz vietas.
            </Text>
          </View>
        </View>

        {/* ── Order summary card (matches web "Pasūtījuma kopsavilkums") ── */}
        <Text style={[s.sectionLabel, { marginBottom: 10 }]}>Pasūtījuma kopsavilkums</Text>
        <View style={s.uberCard}>
          {/* Address */}
          <View style={s.uberRow}>
            <View style={s.uberIconBg}>
              <MapPin size={22} color="#111827" />
            </View>
            <View style={s.uberRowContent}>
              <Text style={s.uberRowLabel}>Piegādes adrese</Text>
              <Text style={s.uberRowValue}>{pickedAddress?.address}</Text>
            </View>
          </View>

          <View style={s.uberDivider} />

          {/* Material + qty */}
          <View style={s.uberRow}>
            <View style={[s.uberIconBg, { backgroundColor: '#fef3c7' }]}>
              <Truck size={22} color="#d97706" />
            </View>
            <View style={s.uberRowContent}>
              <Text style={s.uberRowLabel}>Materiāls & Daudzums</Text>
              <Text style={s.uberRowValue}>
                {quantity} {UNIT_SHORT[unit]} • {selectedMaterial?.name} ({fraction})
              </Text>
            </View>
          </View>

          <View style={s.uberDivider} />

          {/* Delivery Date */}
          <View style={s.uberRow}>
            <View style={s.uberIconBg}>
              <Calendar size={22} color="#111827" />
            </View>
            <View style={s.uberRowContent}>
              <Text style={s.uberRowLabel}>Piegādes datums</Text>
              <Text style={s.uberRowValue}>
                {deliveryDate
                  ? new Date(deliveryDate).toLocaleDateString('lv-LV', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })
                  : 'Cik drīz iespējams'}
              </Text>
            </View>
          </View>

          <View style={s.uberDivider} />

          {/* Payment */}
          <View style={s.uberRow}>
            <View style={s.uberIconBg}>
              <CreditCard size={22} color="#111827" />
            </View>
            <View style={s.uberRowContent}>
              <Text style={s.uberRowLabel}>Maksājuma veids</Text>
              <Text style={s.uberRowValue}>Pēcapmaksa (Rēķins)</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  // \u2500\u2500 Layout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  return (
    <WizardLayout
      title={STEP_TITLES[step]}
      step={stepIndex + 1}
      totalSteps={STEPS.length}
      onBack={goBack}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(buyer)/home' as never);
      }}
      ctaLabel={ctaLabel}
      onCTA={step === 'confirm' ? handleSubmit : goNext}
      ctaDisabled={!canProceed || submitting}
      ctaLoading={submitting}
    >
      {step === 'material' && renderMaterial()}
      {step === 'configure' && renderConfigure()}
      {step === 'address' && renderAddress()}
      {step === 'when' && renderWhen()}
      {step === 'confirm' && renderConfirm()}
    </WizardLayout>
  );
}

// \u2500\u2500 Styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Address step (styles kept for layout reference)

  // Shared text
  stepSub: { fontSize: 16, color: '#4b5563', marginTop: 2, lineHeight: 22, fontWeight: '500' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Configure content
  configureContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 14 },
  configureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Category + fraction chips
  chip: {
    minWidth: 62,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 17, fontWeight: '600', color: '#6b7280' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  fractionRow: { gap: 8, paddingTop: 10, paddingBottom: 2 },

  // Material list cards
  uberMatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: 14,
  },
  uberMatCardActive: {
    borderColor: '#111827',
    borderWidth: 1.5,
    backgroundColor: '#f8fafc',
    padding: 15.5, // Match padding to offset borderWidth 1.5 vs 1
  },
  uberMatIconBg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  matImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uberMatIconBgActive: {
    backgroundColor: '#111827',
  },
  uberMatName: { fontSize: 16, fontWeight: '700', color: '#374151' },
  uberMatNameActive: { color: '#111827' },
  uberMatDesc: { fontSize: 13, color: '#6b7280', marginTop: 1 },

  // Legacy (used optionally)
  matCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  matCardActive: { borderColor: '#111827', backgroundColor: '#f8fafc', borderWidth: 2 },
  matCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  matCheckCircleActive: { backgroundColor: '#111827', borderColor: '#111827' },
  matEmoji: { fontSize: 30 },
  matName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  matDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  matPrice: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 4 },
  matUnit: { fontSize: 12, color: '#9ca3af', fontWeight: '400' },

  // Configure
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepperBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 30, color: '#111827', lineHeight: 34, fontWeight: '500' },
  stepperValueWrap: { alignItems: 'center', minWidth: 88 },
  stepperValue: { fontSize: 56, fontWeight: '800', color: '#111827', lineHeight: 58 },
  stepperUnit: { fontSize: 15, color: '#6b7280', marginTop: 2, fontWeight: '600' },
  quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  quickBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickBtnActive: { backgroundColor: '#111827', borderColor: '#111827' },
  quickBtnText: { fontSize: 16, color: '#6b7280', fontWeight: '600' },
  quickBtnTextActive: { color: '#fff', fontWeight: '700' },

  // Review
  uberCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  uberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  uberIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberRowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  uberRowLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  uberRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  uberDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 14,
    marginLeft: 58,
  },
  // Redesigned Configure Inputs
  uberChip: {
    minWidth: 62,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  uberChipActive: { backgroundColor: '#111827' },
  uberChipText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  uberChipTextActive: { color: '#ffffff' },

  uberStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  uberStepperBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  uberStepperIcon: { fontSize: 24, color: '#111827', fontWeight: '500' },
  uberStepperValueWrap: { alignItems: 'center', minWidth: 80 },
  uberStepperValue: { fontSize: 36, fontWeight: '800', color: '#111827', lineHeight: 40 },
  uberStepperUnit: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
});
