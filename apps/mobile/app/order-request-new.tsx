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
import { MapPin, Check, Truck, CreditCard, Calendar, Layers, Mountain, Leaf, Box, Hexagon } from 'lucide-react-native';

const MaterialIcon = ({ category, color, size }: { category: string, color: string, size: number }) => {
  switch (category) {
    case 'GRAVEL': return <Mountain size={size} color={color} />;
    case 'SAND': return <Layers size={size} color={color} />;
    case 'SOIL': return <Leaf size={size} color={color} />;
    case 'STONE': return <Hexagon size={size} color={color} />;
    case 'CONCRETE': return <Box size={size} color={color} />;
    case 'ASPHALT': return <Layers size={size} color={color} />;
    default: return <Box size={size} color={color} />;
  }
};
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
    (step === 'address' && !!pickedAddress) ||
    (step === 'material' && !!selectedMaterial) ||
    (step === 'configure' && quantity > 0) ||
    step === 'review';

  const ctaLabel = step === 'review' ? 'Apstiprināt pasūtījumu' : 'Turpināt';

  const STEP_TITLES: Record<Step, string> = {
    address: 'Kur piegādāt materiālu?',
    material: 'Izvēlies materiālu',
    configure: 'Norādi daudzumu',
    review: 'Apstiprini pasūtījumu',
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
    <InlineAddressStep
      picked={pickedAddress}
      onPick={handlePickConfirm}
    />
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
                    <MaterialIcon category={mat.category} color={active ? '#111827' : '#6b7280'} size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.uberMatName, active && s.uberMatNameActive]}>{mat.name}</Text>
                    {mat.description ? <Text style={s.uberMatDesc} numberOfLines={1}>{mat.description}</Text> : null}
                    {mat.supplier?.city ? (
                      <Text style={[s.uberMatDesc, { marginTop: 2 }]}>
                        {mat.supplier.name} • {mat.supplier.city}
                      </Text>
                    ) : null}
                  </View>
                  <View style={s.uberMatRight}>
                    <Text style={[s.uberMatPrice, active && s.uberMatPriceActive]}>
                      {'\u20AC'}{mat.basePrice.toFixed(2)}
                    </Text>
                    <Text style={s.uberMatUnit}>/ {UNIT_SHORT[mat.unit]}</Text>
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

        {/* Price preview */}
        <View style={s.priceCard}>
          <View>
            <Text style={s.priceLabel}>Orientējošā summa</Text>
            <Text style={s.priceSub}>
              {quantity} {UNIT_SHORT[unit]} x {'\u20AC'}
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
    const vat = total * 0.21;
    const finalTotal = total + vat;
    const unit = selectedMaterial?.unit ?? 'TONNE';

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
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

          {/* Material */}
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
            <View style={s.uberRowRight}>
              <Text style={s.uberRowPrice}>
                {'\u20AC'}{total.toFixed(2)}
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

          <View style={s.uberDivider} />

          {/* Delivery Date */}
          <View style={s.uberRow}>
            <View style={s.uberIconBg}>
              <Calendar size={22} color="#111827" />
            </View>
            <View style={s.uberRowContent}>
              <Text style={s.uberRowLabel}>Piegādes laiks</Text>
              <Text style={s.uberRowValue}>Sazināsimies</Text>
            </View>
          </View>
        </View>

        {/* Totals */}
        <View style={s.uberTotals}>
          <View style={s.uberTotalRow}>
            <Text style={s.uberTotalLabel}>Starpsumma</Text>
            <Text style={s.uberTotalValue}>{'\u20AC'}{total.toFixed(2)}</Text>
          </View>
          <View style={s.uberTotalRow}>
            <Text style={s.uberTotalLabel}>PVN (21%)</Text>
            <Text style={s.uberTotalValue}>{'\u20AC'}{vat.toFixed(2)}</Text>
          </View>
          <View style={[s.uberTotalRow, s.uberFinalRow]}>
            <Text style={s.uberFinalLabel}>Kopā</Text>
            <Text style={s.uberFinalValue}>{'\u20AC'}{finalTotal.toFixed(2)}</Text>
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
    borderRadius: 23,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberMatIconBgActive: {
    backgroundColor: '#111827',
  },
  uberMatName: { fontSize: 16, fontWeight: '700', color: '#374151' },
  uberMatNameActive: { color: '#111827' },
  uberMatDesc: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  uberMatRight: { alignItems: 'flex-end' },
  uberMatPrice: { fontSize: 16, fontWeight: '800', color: '#374151' },
  uberMatPriceActive: { color: '#111827' },
  uberMatUnit: { fontSize: 12, color: '#9ca3af', fontWeight: '500', marginTop: 1 },

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

  // Price card (configure + review)
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  priceLabel: { fontSize: 14, color: '#d1d5db', fontWeight: '700' },
  priceSub: { fontSize: 12, color: '#9ca3af', marginTop: 4, fontWeight: '500' },
  priceValue: { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },

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
  uberRowRight: {
    alignItems: 'flex-end',
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
  uberRowPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  uberDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 14,
    marginLeft: 58,
  },
  uberTotals: {
    paddingHorizontal: 8,
    gap: 12,
  },
  uberTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uberTotalLabel: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  uberTotalValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  uberFinalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  uberFinalLabel: {
    fontSize: 20,
    color: '#111827',
    fontWeight: '800',
  },
  uberFinalValue: {
    fontSize: 24,
    color: '#111827',
    fontWeight: '800',
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
