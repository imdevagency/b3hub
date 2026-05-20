/**
 * SpecsStep — "Ko pasūtīt?" step of the material order wizard.
 *
 * Owns all picker/calc UI state internally; exposes only the spec values
 * to the wizard root via callbacks.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Check, ChevronDown, Truck, Minus, Plus, Camera, X } from 'lucide-react-native';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CATEGORY_LABELS } from '@/lib/materials';
import type { MaterialCategory } from '@/lib/materials';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { s } from './_styles';
import {
  CATEGORY_FRACTIONS,
  ORDER_TYPE_LABELS,
  ORDER_TYPE_UNIT_LABEL,
  MATERIAL_DENSITY,
  TRUCK_OPTIONS,
  type OrderType,
} from './_constants';

export type SpecsStepProps = {
  category: MaterialCategory;
  onCategoryChange: (c: MaterialCategory) => void;
  selectedFraction: string;
  onFractionChange: (f: string) => void;
  orderType: OrderType;
  onOrderTypeChange: (ot: OrderType) => void;
  quantity: number;
  onQuantityChange: (q: number) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  sitePhotoUri: string | null;
  setSitePhotoUri: (uri: string | null) => void;
  setSitePhotoUrl: (url: string | null) => void;
  uploadingPhoto: boolean;
  handlePickSitePhoto: () => void;
  /** Live category labels from DB; falls back to static @b3hub/shared values. */
  categoryLabels?: Record<string, string>;
  /** Live fractions per category from DB; falls back to static @b3hub/shared values. */
  categoryFractions?: Record<string, string[]>;
};

export function SpecsStep({
  category,
  onCategoryChange,
  selectedFraction,
  onFractionChange,
  orderType,
  onOrderTypeChange,
  quantity,
  onQuantityChange,
  notes,
  onNotesChange,
  sitePhotoUri,
  setSitePhotoUri,
  setSitePhotoUrl,
  uploadingPhoto,
  handlePickSitePhoto,
  categoryLabels: categoryLabelsProp,
  categoryFractions: categoryFractionsProp,
}: SpecsStepProps) {
  const activeCategoryLabels = categoryLabelsProp ?? CATEGORY_LABELS;
  const activeCategoryFractions = categoryFractionsProp ?? CATEGORY_FRACTIONS;
  // ── Internal UI state ──
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [fractionPickerOpen, setFractionPickerOpen] = useState(false);
  const [orderTypePickerOpen, setOrderTypePickerOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcLength, setCalcLength] = useState('');
  const [calcWidth, setCalcWidth] = useState('');
  const [calcDepth, setCalcDepth] = useState('');

  // ── Truck counts (BY_LOAD mode) ──
  const [truckCounts, setTruckCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(TRUCK_OPTIONS.map((o) => [o.id, 0])),
  );

  function changeTruckCount(id: string, delta: number) {
    setTruckCounts((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) };
      const totalTonnes = TRUCK_OPTIONS.reduce((sum, o) => sum + (next[o.id] ?? 0) * o.capacity, 0);
      if (totalTonnes > 0) onQuantityChange(totalTonnes);
      return next;
    });
    haptics.light();
  }

  const totalTruckTonnes = TRUCK_OPTIONS.reduce(
    (sum, o) => sum + (truckCounts[o.id] ?? 0) * o.capacity,
    0,
  );
  const totalTruckLoads = TRUCK_OPTIONS.reduce((sum, o) => sum + (truckCounts[o.id] ?? 0), 0);

  // ── Volume calculator ──
  const calcM3 = (() => {
    const l = parseFloat(calcLength);
    const w = parseFloat(calcWidth);
    const d = parseFloat(calcDepth);
    if (isNaN(l) || isNaN(w) || isNaN(d) || l <= 0 || w <= 0 || d <= 0) return null;
    return parseFloat((l * w * (d / 100)).toFixed(2));
  })();

  const calcTonnes =
    calcM3 != null ? parseFloat((calcM3 * (MATERIAL_DENSITY[category] ?? 1.7)).toFixed(1)) : null;

  function applyCalc() {
    if (calcM3 == null) return;
    onQuantityChange(orderType === 'BY_VOLUME' ? calcM3 : (calcTonnes ?? calcM3));
    setCalcOpen(false);
  }

  const stepAmt = 1;

  // ── Quantity direct-edit ──
  const [quantityEditing, setQuantityEditing] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState('');

  const QUANTITY_PRESETS: Record<OrderType, number[]> = {
    BY_WEIGHT: [5, 10, 20, 40, 80],
    BY_VOLUME: [5, 10, 20, 50, 100],
    BY_LOAD: [1, 2, 5, 10, 20],
  };

  return (
    <>
      {/* ── ScrollView content (rendered inside WizardLayout) ── */}
      <ScrollView
        className="px-6 pt-5 pb-12"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Material + Fraction pickers */}
        <View className="flex-row gap-4 mb-6">
          <TouchableOpacity
            className="flex-1 bg-gray-100 rounded-2xl p-4"
            onPress={() => setCatPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Text className="text-gray-400 text-sm font-semibold mb-1">Materiāls</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-900 font-bold text-lg line-clamp-1" numberOfLines={1}>
                {activeCategoryLabels[category]}
              </Text>
              <ChevronDown size={18} color="#9ca3af" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-gray-100 rounded-2xl p-4"
            onPress={() => setFractionPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Text className="text-gray-400 text-sm font-semibold mb-1">Frakcija</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-gray-900 font-bold text-lg line-clamp-1" numberOfLines={1}>
                {selectedFraction}
              </Text>
              <ChevronDown size={18} color="#9ca3af" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Order type */}
        <TouchableOpacity
          className="w-full bg-gray-100 rounded-2xl p-4 mb-6"
          onPress={() => setOrderTypePickerOpen(true)}
          activeOpacity={0.8}
        >
          <Text className="text-gray-400 text-sm font-semibold mb-1">Pasūtījuma veids</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 font-bold text-lg">{ORDER_TYPE_LABELS[orderType]}</Text>
            <ChevronDown size={18} color="#9ca3af" />
          </View>
        </TouchableOpacity>

        {/* Vehicle grid — only for BY_LOAD */}
        {orderType === 'BY_LOAD' && (
          <View className="mb-6 mt-2">
            {/* Running total header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: totalTruckLoads > 0 ? '#f0fdf4' : '#f9fafb',
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 20,
                marginBottom: 20,
                borderWidth: 1.5,
                borderColor: totalTruckLoads > 0 ? '#86efac' : '#f0f0f0',
              }}
            >
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontFamily: 'Inter_800ExtraBold',
                    color: totalTruckLoads > 0 ? '#16a34a' : '#9ca3af',
                    letterSpacing: -1,
                  }}
                >
                  {totalTruckTonnes > 0 ? `${totalTruckTonnes.toFixed(1)} t` : '0 t'}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Inter_500Medium',
                    color: '#9ca3af',
                    marginTop: 2,
                  }}
                >
                  {totalTruckLoads > 0
                    ? `${totalTruckLoads} ${totalTruckLoads === 1 ? 'kravas auto' : 'kravas auto'}`
                    : 'Izvēlieties automašīnas'}
                </Text>
              </View>
            </View>

            {/* Truck rows */}
            {TRUCK_OPTIONS.map((opt) => {
              const count = truckCounts[opt.id] ?? 0;
              return (
                <View
                  key={opt.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: count > 0 ? '#f9fafb' : '#fff',
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: count > 0 ? '#e5e7eb' : '#f0f0f0',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    marginBottom: 10,
                  }}
                >
                  {/* Truck illustration */}
                  <View style={{ width: 64, alignItems: 'center', marginRight: 12 }}>
                    <TruckIllustration type={opt.truckType} height={32} />
                  </View>

                  {/* Label */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: 'Inter_700Bold',
                        color: '#111827',
                        letterSpacing: -0.2,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium',
                        color: '#9ca3af',
                        marginTop: 1,
                      }}
                    >
                      {opt.subtitle}
                    </Text>
                  </View>

                  {/* Counter */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => changeTruckCount(opt.id, -1)}
                      activeOpacity={0.7}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: count > 0 ? '#111827' : '#f3f4f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Minus size={16} color={count > 0 ? '#fff' : '#9ca3af'} />
                    </TouchableOpacity>

                    <Text
                      style={{
                        width: 28,
                        textAlign: 'center',
                        fontSize: 18,
                        fontFamily: 'Inter_800ExtraBold',
                        color: count > 0 ? '#111827' : '#d1d5db',
                        letterSpacing: -0.5,
                      }}
                    >
                      {count}
                    </Text>

                    <TouchableOpacity
                      onPress={() => changeTruckCount(opt.id, 1)}
                      activeOpacity={0.7}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#111827',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Plus size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Quantity stepper — hidden in BY_LOAD (vehicle grid handles quantity) */}
        <View
          className="mb-6 mt-2"
          style={orderType === 'BY_LOAD' ? { display: 'none' } : undefined}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_700Bold',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            Kopējais apjoms
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
            }}
          >
            <TouchableOpacity
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 1.5,
                borderColor: '#e5e7eb',
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
              onPress={() => {
                haptics.light();
                onQuantityChange(Math.max(1, Math.round(quantity - stepAmt)));
              }}
              activeOpacity={0.7}
            >
              <Minus size={24} color="#111827" />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', minWidth: 160 }}>
              {quantityEditing ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' }}
                >
                  <TextInput
                    autoFocus
                    keyboardType="decimal-pad"
                    value={quantityDraft}
                    onChangeText={setQuantityDraft}
                    onBlur={() => {
                      const parsed = parseFloat(quantityDraft);
                      if (!isNaN(parsed) && parsed > 0) onQuantityChange(parsed);
                      setQuantityEditing(false);
                    }}
                    onSubmitEditing={() => {
                      const parsed = parseFloat(quantityDraft);
                      if (!isNaN(parsed) && parsed > 0) onQuantityChange(parsed);
                      setQuantityEditing(false);
                    }}
                    returnKeyType="done"
                    style={{
                      fontSize: 56,
                      fontFamily: 'Inter_800ExtraBold',
                      color: '#111827',
                      textAlign: 'center',
                      minWidth: 100,
                      borderBottomWidth: 2,
                      borderBottomColor: '#111827',
                      letterSpacing: -2,
                      includeFontPadding: false,
                      padding: 0,
                      margin: 0,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: 'Inter_600SemiBold',
                      color: '#9ca3af',
                      marginLeft: 4,
                      marginBottom: 8,
                    }}
                  >
                    {ORDER_TYPE_UNIT_LABEL[orderType]}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setQuantityDraft(String(quantity));
                    setQuantityEditing(true);
                  }}
                  activeOpacity={0.6}
                  style={{ alignItems: 'center' }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 56,
                        fontFamily: 'Inter_800ExtraBold',
                        color: '#111827',
                        letterSpacing: -2,
                        includeFontPadding: false,
                      }}
                      numberOfLines={1}
                    >
                      {quantity.toString()}
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontFamily: 'Inter_600SemiBold',
                        color: '#9ca3af',
                        marginLeft: 4,
                        marginBottom: 6,
                      }}
                    >
                      {ORDER_TYPE_UNIT_LABEL[orderType]}
                    </Text>
                  </View>
                  <View
                    style={{
                      marginTop: 2,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      backgroundColor: '#f3f4f6',
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Inter_700Bold',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Rediģēt
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 1.5,
                borderColor: '#e5e7eb',
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
              onPress={() => {
                haptics.light();
                onQuantityChange(Math.round(quantity + stepAmt));
              }}
              activeOpacity={0.7}
            >
              <Plus size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Quick presets */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginTop: 20,
            }}
          >
            {QUANTITY_PRESETS[orderType].map((p) => {
              const active = quantity === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => {
                    haptics.light();
                    onQuantityChange(p);
                  }}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: active ? '#111827' : '#f0f0f0',
                    backgroundColor: active ? '#f8fafc' : '#fff',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: active ? 0.05 : 0,
                    shadowRadius: 6,
                    elevation: active ? 2 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold',
                      color: active ? '#111827' : '#6b7280',
                      letterSpacing: -0.2,
                    }}
                  >
                    {p} {ORDER_TYPE_UNIT_LABEL[orderType]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Truck load info — hidden in BY_LOAD (vehicle grid already shows the total) */}
        {orderType !== 'BY_LOAD' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: '#f0f0f0',
              padding: 16,
              marginBottom: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#f8fafc',
                borderWidth: 1.5,
                borderColor: '#f0f0f0',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}
            >
              <Truck size={20} color="#111827" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  color: '#111827',
                  fontFamily: 'Inter_700Bold',
                  letterSpacing: -0.2,
                  marginBottom: 2,
                }}
              >
                Tehniska informācija
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: '#6b7280',
                  fontFamily: 'Inter_500Medium',
                  lineHeight: 18,
                }}
              >
                Nepieciešami {Math.ceil(quantity / 26)} reisi (26 {ORDER_TYPE_UNIT_LABEL[orderType]}{' '}
                ietilpība automašīnai)
              </Text>
            </View>
          </View>
        )}

        {/* Notes */}
        <View className="mt-8">
          <Text
            style={{
              fontSize: 18,
              color: '#111827',
              fontFamily: 'Inter_700Bold',
              letterSpacing: -0.3,
              marginBottom: 12,
              marginLeft: 4,
            }}
          >
            Piezīmes (neobligāti)
          </Text>
          <TextInput
            placeholder="Ievadiet papildu informāciju piegādātājam..."
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={onNotesChange}
            multiline
            style={{
              borderWidth: 1.5,
              borderColor: '#f0f0f0',
              borderRadius: 16,
              paddingHorizontal: 20,
              paddingVertical: 18,
              fontSize: 16,
              color: '#111827',
              fontFamily: 'Inter_500Medium',
              backgroundColor: '#fff',
              minHeight: 120,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Site photo */}
        <View className="mt-8 mb-2">
          <Text
            style={{
              fontSize: 18,
              color: '#111827',
              fontFamily: 'Inter_700Bold',
              letterSpacing: -0.3,
              marginBottom: 12,
              marginLeft: 4,
            }}
          >
            Izkraušanas vietas foto (neobligāti)
          </Text>
          {sitePhotoUri ? (
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: sitePhotoUri }}
                style={{
                  width: '100%',
                  height: 180,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: '#f0f0f0',
                }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => {
                  setSitePhotoUri(null);
                  setSitePhotoUrl(null);
                }}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  backgroundColor: 'rgba(17, 24, 39, 0.8)',
                  borderRadius: 20,
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.8}
              >
                <X size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePickSitePhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.8}
              style={{
                borderWidth: 1.5,
                borderColor: '#e5e7eb',
                borderStyle: 'dashed',
                borderRadius: 16,
                backgroundColor: '#f9fafb',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 110,
                paddingVertical: 20,
              }}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <>
                  <Camera size={26} color="#6b7280" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Inter_600SemiBold',
                      color: '#4b5563',
                      marginTop: 10,
                    }}
                  >
                    Pievienot foto
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Inter_400Regular',
                      color: '#9ca3af',
                      marginTop: 4,
                    }}
                  >
                    Palīdzēs šoferim precīzi atrast vietu
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Picker modals (use React Native Modal, render above all views) ── */}

      <BottomSheet
        visible={catPickerOpen}
        onClose={() => setCatPickerOpen(false)}
        title="Materiāla veids"
        scrollable
        maxHeightPct={0.6}
      >
        {(Object.keys(activeCategoryFractions) as MaterialCategory[]).map((item) => (
          <TouchableOpacity
            key={item}
            style={s.sheetItem}
            onPress={() => {
              onCategoryChange(item);
              onFractionChange(activeCategoryFractions[item][0]);
              setCatPickerOpen(false);
              haptics.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.sheetItemText, category === item && s.sheetItemTextActive]}>
              {activeCategoryLabels[item]}
            </Text>
            {category === item && <Check size={16} color="#111827" />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <BottomSheet
        visible={fractionPickerOpen}
        onClose={() => setFractionPickerOpen(false)}
        title="Frakcija"
        scrollable
        maxHeightPct={0.5}
      >
        {(activeCategoryFractions[category] ?? CATEGORY_FRACTIONS[category]).map((item) => (
          <TouchableOpacity
            key={item}
            style={s.sheetItem}
            onPress={() => {
              onFractionChange(item);
              setFractionPickerOpen(false);
              haptics.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.sheetItemText, selectedFraction === item && s.sheetItemTextActive]}>
              {item}
            </Text>
            {selectedFraction === item && <Check size={16} color="#111827" />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      <BottomSheet
        visible={orderTypePickerOpen}
        onClose={() => setOrderTypePickerOpen(false)}
        title="Pasūtījuma veids"
        maxHeightPct={0.4}
      >
        {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((ot) => (
          <TouchableOpacity
            key={ot}
            style={s.sheetItem}
            onPress={() => {
              onOrderTypeChange(ot);
              setOrderTypePickerOpen(false);
              haptics.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.sheetItemText, orderType === ot && s.sheetItemTextActive]}>
              {ORDER_TYPE_LABELS[ot]}
            </Text>
            {orderType === ot && <Check size={16} color="#111827" />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* Volume / Weight Calculator */}
      <BottomSheet
        visible={calcOpen}
        onClose={() => setCalcOpen(false)}
        title="Daudzuma kalkulators"
        subtitle="Ievadiet platības izmērus, lai aprēķinātu nepieciešamo daudzumu"
        scrollable={false}
      >
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: 'Inter_500Medium',
                  marginBottom: 4,
                }}
              >
                Garums (m)
              </Text>
              <TextInput
                style={[s.textInput, { marginTop: 0 }]}
                value={calcLength}
                onChangeText={setCalcLength}
                placeholder="piem. 10"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: 'Inter_500Medium',
                  marginBottom: 4,
                }}
              >
                Platums (m)
              </Text>
              <TextInput
                style={[s.textInput, { marginTop: 0 }]}
                value={calcWidth}
                onChangeText={setCalcWidth}
                placeholder="piem. 5"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  fontFamily: 'Inter_500Medium',
                  marginBottom: 4,
                }}
              >
                Dziļums (cm)
              </Text>
              <TextInput
                style={[s.textInput, { marginTop: 0 }]}
                value={calcDepth}
                onChangeText={setCalcDepth}
                placeholder="piem. 20"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {calcM3 != null && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#eff6ff',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontFamily: 'Inter_600SemiBold', color: '#1d4ed8' }}>
                  {calcM3}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#3b82f6',
                    fontFamily: 'Inter_500Medium',
                    marginTop: 2,
                  }}
                >
                  m³
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#f0fdf4',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontFamily: 'Inter_600SemiBold', color: '#16a34a' }}>
                  {calcTonnes}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#22c55e',
                    fontFamily: 'Inter_500Medium',
                    marginTop: 2,
                  }}
                >
                  tonnas ({MATERIAL_DENSITY[category] ?? 1.7} t/m³)
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.nextBtn, calcM3 == null && { backgroundColor: '#e5e7eb' }]}
            onPress={applyCalc}
            disabled={calcM3 == null}
            activeOpacity={0.85}
          >
            <Text style={[s.nextBtnTxt, calcM3 == null && { color: colors.textDisabled }]}>
              Izmantot{' '}
              {orderType === 'BY_VOLUME' ? `${calcM3 ?? '—'} m³` : `${calcTonnes ?? '—'} t`}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </>
  );
}
