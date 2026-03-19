/**
 * order-request-new.tsx
 *
 * 4-step wizard for material ordering.
 *
 *  Step 1 – Address   : AddressPickerModal (shared with all other wizards)
 *  Step 2 – Material  : category chips + scrollable material cards
 *  Step 3 – Configure : fraction chips, quantity stepper, price preview
 *  Step 4 – Review    : summary + confirm
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { UNIT_SHORT, CATEGORY_ICON } from '@/lib/materials';
import type { MaterialCategory, MaterialUnit, ApiMaterial } from '@/lib/api';
import { MapPin, Check } from 'lucide-react-native';
import { InlineAddressStep } from '@/components/wizard/InlineAddressStep';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import type { PickedAddress } from '@/components/wizard/InlineAddressStep';

// ── Types ────────────────────────────────────────────────────────────────────────────────────

type Step = 'address' | 'material' | 'configure' | 'review';

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
const STEPS: Step[] = ['address', 'material', 'configure', 'review'];

// ── Component ────────────────────────────────────────────────────────────────────────────────

export default function OrderRequestWizard() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [step, setStep] = useState<Step>('address');
  const stepIndex = STEPS.indexOf(step);

  // Address step
  const [pickedAddress, setPickedAddress] = useState<PickedAddress | null>(null);

  // Material step — loaded from API
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<ApiMaterial | null>(null);
  const [matCategory, setMatCategory] = useState('ALL');

  // Configure step
  const [fraction, setFraction] = useState('0/4');
  const [quantity, setQuantity] = useState(10);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Fetch real materials from the backend
  useEffect(() => {
    if (!token) return;
    setMaterialsLoading(true);
    api.materials
      .getAll(token)
      .then((data) => {
        const list = Array.isArray(data) ? data.filter((m) => m.inStock) : [];
        setMaterials(list);
      })
      .catch(() => {
        // Silent — empty list shown, user can still create a quote request
      })
      .finally(() => setMaterialsLoading(false));
  }, [token]);

  const filteredMaterials =
    matCategory === 'ALL' ? materials : materials.filter((m) => m.category === matCategory);

  // ── Navigation ──────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  }, [stepIndex, router]);

  const goNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }, [stepIndex]);

  const canProceed =
    (step === 'address' && !!pickedAddress) ||
    (step === 'material' && !!selectedMaterial) ||
    (step === 'configure' && quantity > 0) ||
    step === 'review';

  const ctaLabel = step === 'review' ? 'Apstiprināt pasūtījumu' : 'Turpināt';

  const STEP_TITLES: Record<Step, string> = {
    address: 'Kur piegādāt?',
    material: 'Kādu materiālu vajag?',
    configure: 'Cik daudz vajag?',
    review: 'Pārbaudīt pasūtījumu',
  };

  // ── Address handler ──────────────────────────────────────────────────
  const handlePickConfirm = useCallback((picked: PickedAddress) => {
    setPickedAddress(picked);
    setTimeout(() => setStep('material'), 200);
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
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + (best.etaDays || 1));
        const order = await api.materials.createOrder(
          {
            buyerId: user!.id,
            materialId: best.id,
            quantity,
            unit: selectedMaterial.unit,
            unitPrice: best.basePrice,
            deliveryAddress: pickedAddress.address,
            deliveryCity: pickedAddress.city,
            deliveryDate: deliveryDate.toISOString().split('T')[0],
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
          },
          token,
        );
        Alert.alert(
          'Pieprasījums nosūtīts!',
          'Piegādātāji sazināsies ar jums drīzumā.',
          [{ text: 'Labi', onPress: () => router.replace('/(buyer)/orders') }],
        );
      }
    } catch (e) {
      Alert.alert(
        'Kļūda',
        e instanceof Error ? e.message : 'Mēģinājiet vēlreiz',
      );
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
        <Text style={s.stepSub}>Grants, smiltis, betons un citi būvmateriāli</Text>
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
                  style={[s.matCard, active && s.matCardActive]}
                  onPress={() => setSelectedMaterial(mat)}
                  activeOpacity={0.8}
                >
                  <Text style={s.matEmoji}>{CATEGORY_ICON[mat.category] || '\uD83D\uDCE6'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.matName}>{mat.name}</Text>
                    {mat.description ? <Text style={s.matDesc}>{mat.description}</Text> : null}
                    {mat.supplier?.city ? (
                      <Text style={[s.matDesc, { color: '#9ca3af' }]}>
                        {mat.supplier.name} · {mat.supplier.city}
                      </Text>
                    ) : null}
                    <Text style={s.matPrice}>
                      {'\u20AC'}
                      {mat.basePrice.toFixed(2)}
                      <Text style={s.matUnit}> / {UNIT_SHORT[mat.unit]}</Text>
                    </Text>
                  </View>
                  <View style={[s.matCheckCircle, active && s.matCheckCircleActive]}>
                    {active && <Check size={14} color="#fff" strokeWidth={3} />}
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        <Text style={s.stepSub}>Norādiet daudzumu un frakciju</Text>
        {/* Selected material summary */}
        <View style={s.summaryCard}>
          <Text style={s.matEmoji}>
            {CATEGORY_ICON[selectedMaterial?.category || ''] || '\uD83D\uDCE6'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={s.matName}>{selectedMaterial?.name}</Text>
            <Text style={s.matDesc}>{selectedMaterial?.description}</Text>
          </View>
        </View>
        {/* Fraction */}
        <View>
          <Text style={s.sectionLabel}>Frakcija</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingTop: 8 }}
          >
            {FRACTIONS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.chip, fraction === f && s.chipActive]}
                onPress={() => setFraction(f)}
              >
                <Text style={[s.chipText, fraction === f && s.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {/* Quantity stepper */}
        <View>
          <Text style={s.sectionLabel}>Daudzums</Text>
          <View style={s.stepper}>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={() => setQuantity((q) => Math.max(1, q - stepAmt))}
            >
              <Text style={s.stepperBtnText}>{'\u2212'}</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center', minWidth: 80 }}>
              <Text style={s.stepperValue}>{quantity}</Text>
              <Text style={s.stepperUnit}>{UNIT_SHORT[unit]}</Text>
            </View>
            <TouchableOpacity style={s.stepperBtn} onPress={() => setQuantity((q) => q + stepAmt)}>
              <Text style={s.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            {quickValues.map((n) => (
              <TouchableOpacity
                key={n}
                style={[s.quickBtn, quantity === n && s.quickBtnActive]}
                onPress={() => setQuantity(n)}
              >
                <Text style={[s.quickBtnText, quantity === n && s.quickBtnTextActive]}>
                  {n} {UNIT_SHORT[unit]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {/* Price preview */}
        <View style={s.priceCard}>
          <View>
            <Text style={s.priceLabel}>Orientējoša summa</Text>
            <Text style={s.priceSub}>
              {quantity} {UNIT_SHORT[unit]} \u00d7 {'\u20AC'}
              {selectedMaterial?.basePrice.toFixed(2)}
            </Text>
          </View>
          <Text style={s.priceValue}>
            {'\u20AC'}
            {((selectedMaterial?.basePrice ?? 0) * quantity).toFixed(2)}
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderReview = () => {
    const total = (selectedMaterial?.basePrice ?? 0) * quantity;
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={s.stepSub}>Pārbaudiet visu pirms apstiprināšanas</Text>
        {/* Address */}
        <View style={s.reviewCard}>
          <Text style={s.reviewLabel}>Piegādes adrese</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
            <MapPin size={15} color="#374151" style={{ marginTop: 1 }} />
            <Text style={s.reviewValue}>{pickedAddress?.address}</Text>
          </View>
        </View>
        {/* Material */}
        <View style={s.reviewCard}>
          <Text style={s.reviewLabel}>Materiāls</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Text style={{ fontSize: 28 }}>
              {CATEGORY_ICON[selectedMaterial?.category || ''] || '\uD83D\uDCE6'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={s.reviewValue}>{selectedMaterial?.name}</Text>
              <Text style={s.matDesc}>Frakcija: {fraction}</Text>
            </View>
          </View>
          <View style={s.reviewRow}>
            <Text style={s.matDesc}>
              {quantity} {UNIT_SHORT[selectedMaterial?.unit ?? 'TONNE']} \u00d7 {'\u20AC'}
              {selectedMaterial?.basePrice.toFixed(2)}
            </Text>
            <Text style={s.reviewPrice}>
              {'\u20AC'}
              {total.toFixed(2)}
            </Text>
          </View>
        </View>
        {/* Total */}
        <View style={s.priceCard}>
          <View>
            <Text style={s.priceLabel}>Kopā (bez PVN)</Text>
            <Text style={s.priceSub}>PVN 21% tiks pievienots rēķinam</Text>
          </View>
          <Text style={s.priceValue}>
            {'\u20AC'}
            {total.toFixed(2)}
          </Text>
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
      onClose={() => router.back()}
      ctaLabel={ctaLabel}
      onCTA={step === 'review' ? handleSubmit : goNext}
      ctaDisabled={!canProceed || submitting}
      ctaLoading={submitting}
    >
      {step === 'address' && renderAddress()}
      {step === 'material' && renderMaterial()}
      {step === 'configure' && renderConfigure()}
      {step === 'review' && renderReview()}
    </WizardLayout>
  );
}

// \u2500\u2500 Styles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Address step (styles kept for layout reference)

  // Shared text
  stepSub: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  // Category + fraction chips
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // Material list cards
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
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 24, color: '#111827', lineHeight: 28 },
  stepperValue: { fontSize: 36, fontWeight: '800', color: '#111827' },
  stepperUnit: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickBtnActive: { backgroundColor: '#111827', borderColor: '#111827' },
  quickBtnText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  quickBtnTextActive: { color: '#fff', fontWeight: '700' },

  // Price card (configure + review)
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
  },
  priceLabel: { fontSize: 14, color: '#d1d5db', fontWeight: '600' },
  priceSub: { fontSize: 11, color: '#6b7280', marginTop: 3 },
  priceValue: { fontSize: 26, fontWeight: '800', color: '#fff' },

  // Review
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  reviewValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  reviewPrice: { fontSize: 16, fontWeight: '700', color: '#111827' },

});
