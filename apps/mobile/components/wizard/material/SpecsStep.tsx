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
  fulfillmentType?: 'DELIVERY' | 'PICKUP';
  onFulfillmentTypeChange?: (v: 'DELIVERY' | 'PICKUP') => void;
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
  fulfillmentType,
  onFulfillmentTypeChange,
}: SpecsStepProps) {
  // ── Internal UI state ──
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [fractionPickerOpen, setFractionPickerOpen] = useState(false);
  const [orderTypePickerOpen, setOrderTypePickerOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcLength, setCalcLength] = useState('');
  const [calcWidth, setCalcWidth] = useState('');
  const [calcDepth, setCalcDepth] = useState('');

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
        {/* Fulfillment type toggle */}
        {onFulfillmentTypeChange && (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.bgMuted || '#f3f4f6',
              borderRadius: 999,
              padding: 4,
              marginBottom: 24,
            }}
          >
            {(['DELIVERY', 'PICKUP'] as const).map((opt) => {
              const active = fulfillmentType === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    haptics.light();
                    onFulfillmentTypeChange(opt);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 999,
                    alignItems: 'center',
                    backgroundColor: active ? colors.bgCard || '#fff' : 'transparent',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: active ? 0.05 : 0,
                    shadowRadius: active ? 4 : 0,
                    elevation: active ? 2 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold',
                      color: active
                        ? colors.textPrimary || '#111827'
                        : colors.textMuted || '#9ca3af',
                    }}
                  >
                    {opt === 'DELIVERY' ? '🚛 Piegāde' : '📍 Paņemšana'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

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
                {CATEGORY_LABELS[category]}
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

        {/* Quantity stepper */}
        <View className="mb-6 mt-2">
          <Text className="text-gray-400 text-sm font-semibold tracking-widest uppercase mb-6 text-center">
            Kopējais apjoms
          </Text>
          <View className="flex-row items-center justify-center gap-6">
            <TouchableOpacity
              className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center"
              onPress={() => {
                haptics.light();
                onQuantityChange(Math.max(1, Math.round(quantity - stepAmt)));
              }}
              activeOpacity={0.8}
            >
              <Minus size={24} color="#111827" />
            </TouchableOpacity>

            <View className="items-center px-4 w-[160px]">
              {quantityEditing ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
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
                      fontSize: 48,
                      fontFamily: 'Inter_900Black',
                      color: '#111827',
                      textAlign: 'center',
                      minWidth: 100,
                      borderBottomWidth: 2,
                      borderBottomColor: '#111827',
                    }}
                  />
                  <Text
                    className="text-xl font-semibold text-gray-400 ml-1"
                    style={{ marginBottom: 8 }}
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
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    <Text
                      className="text-5xl font-black text-gray-900 tracking-tighter"
                      numberOfLines={1}
                    >
                      {quantity.toString()}
                    </Text>
                    <Text
                      className="text-xl font-semibold text-gray-400 ml-1"
                      style={{ marginBottom: 6 }}
                    >
                      {ORDER_TYPE_UNIT_LABEL[orderType]}
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 3 }}
                  >
                    pieskarties lai rediģētu
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center"
              onPress={() => {
                haptics.light();
                onQuantityChange(Math.round(quantity + stepAmt));
              }}
              activeOpacity={0.8}
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
              marginTop: 16,
            }}
          >
            {QUANTITY_PRESETS[orderType].map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  haptics.light();
                  onQuantityChange(p);
                }}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor:
                    quantity === p ? colors.primary || '#111827' : colors.bgMuted || '#f3f4f6',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: quantity === p ? 'Inter_700Bold' : 'Inter_600SemiBold',
                    color: quantity === p ? '#fff' : colors.textPrimary || '#111827',
                  }}
                >
                  {p} {ORDER_TYPE_UNIT_LABEL[orderType]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Truck load info */}
        <View className="bg-gray-100 rounded-2xl p-4 mb-6 flex-row items-center">
          <View className="bg-white w-10 h-10 rounded-full items-center justify-center mr-4 shadow-sm">
            <Truck size={18} color="#111827" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-semibold text-sm mb-0.5">Tehniska informācija</Text>
            <Text className="text-gray-500 font-medium text-xs leading-tight">
              Nepieciešami {Math.ceil(quantity / 26)} reisi (26 {ORDER_TYPE_UNIT_LABEL[orderType]}{' '}
              ietilpība automašīnai)
            </Text>
          </View>
        </View>

        {/* Notes */}
        <View className="mt-8">
          <Text className="text-gray-400 text-sm font-semibold mb-2 ml-1">
            Piezīmes (neobligāti)
          </Text>
          <TextInput
            className="w-full bg-gray-100 rounded-2xl p-4 pt-4 text-gray-900 font-medium text-sm"
            placeholder="Ievadiet papildu informāciju piegādātājam..."
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={onNotesChange}
            multiline
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
        </View>

        {/* Site photo */}
        <View className="mt-6 mb-2">
          <Text className="text-gray-400 text-sm font-semibold mb-2 ml-1">
            Izkraušanas vietas foto (neobligāti)
          </Text>
          {sitePhotoUri ? (
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: sitePhotoUri }}
                style={{ width: '100%', height: 180, borderRadius: 16 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => {
                  setSitePhotoUri(null);
                  setSitePhotoUrl(null);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 16,
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.8}
              >
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePickSitePhoto}
              disabled={uploadingPhoto}
              className="bg-gray-100 rounded-2xl p-4 flex-row items-center justify-center"
              activeOpacity={0.8}
              style={{ minHeight: 72 }}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <>
                  <Camera size={20} color="#6b7280" />
                  <Text className="text-gray-500 font-semibold text-sm ml-2">Pievienot foto</Text>
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
        {(Object.keys(CATEGORY_FRACTIONS) as MaterialCategory[]).map((item) => (
          <TouchableOpacity
            key={item}
            style={s.sheetItem}
            onPress={() => {
              onCategoryChange(item);
              onFractionChange(CATEGORY_FRACTIONS[item][0]);
              setCatPickerOpen(false);
              haptics.light();
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.sheetItemText, category === item && s.sheetItemTextActive]}>
              {CATEGORY_LABELS[item]}
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
        {CATEGORY_FRACTIONS[category].map((item) => (
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
