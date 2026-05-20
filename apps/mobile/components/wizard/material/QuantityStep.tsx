/**
 * QuantityStep — Step 3 of the material order wizard.
 *
 * Two tabs (Schüttflix-style):
 *   Tab "Veselas automašīnas" — BY_LOAD: per-truck-type counter grid
 *   Tab "Ievadīt daudzumu"   — BY_WEIGHT / BY_VOLUME: manual stepper + presets
 *
 * Exposes onQuantityChange (total tonnes/m³) and onTotalLoadsChange (vehicle count).
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { TruckIllustration } from '@/components/ui/TruckIllustration';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import {
  TRUCK_OPTIONS,
  ORDER_TYPE_UNIT_LABEL,
  MATERIAL_DENSITY,
  type OrderType,
} from './_constants';
import type { MaterialCategory } from '@/lib/materials';

// ── Props ─────────────────────────────────────────────────────────────────

export type QuantityStepProps = {
  orderType: OrderType;
  onOrderTypeChange: (ot: OrderType) => void;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onTotalLoadsChange: (loads: number) => void;
  category: MaterialCategory;
};

// ── Constants ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'BY_LOAD' as const, label: 'Veselas automašīnas' },
  { id: 'MANUAL' as const, label: 'Ievadīt daudzumu' },
];

const MANUAL_UNITS: { id: 'BY_WEIGHT' | 'BY_VOLUME'; label: string }[] = [
  { id: 'BY_WEIGHT', label: 'Tonnas (t)' },
  { id: 'BY_VOLUME', label: 'Kubikmetri (m³)' },
];

const PRESETS: Record<'BY_WEIGHT' | 'BY_VOLUME', number[]> = {
  BY_WEIGHT: [5, 10, 20, 40, 80],
  BY_VOLUME: [5, 10, 20, 50, 100],
};

// ── Component ─────────────────────────────────────────────────────────────

export function QuantityStep({
  orderType,
  onOrderTypeChange,
  quantity,
  onQuantityChange,
  onTotalLoadsChange,
  category,
}: QuantityStepProps) {
  const isVehicleTab = orderType === 'BY_LOAD';
  const activeTabId = isVehicleTab ? 'BY_LOAD' : 'MANUAL';
  const manualUnit = orderType === 'BY_VOLUME' ? 'BY_VOLUME' : 'BY_WEIGHT';

  // Truck counts (vehicle tab) — internal state, lifted via callbacks
  const [truckCounts, setTruckCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(TRUCK_OPTIONS.map((o) => [o.id, 0])),
  );

  const totalTruckTonnes = TRUCK_OPTIONS.reduce(
    (sum, o) => sum + (truckCounts[o.id] ?? 0) * o.capacity,
    0,
  );
  const totalTruckLoads = TRUCK_OPTIONS.reduce((sum, o) => sum + (truckCounts[o.id] ?? 0), 0);

  function changeTruckCount(id: string, delta: number) {
    setTruckCounts((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) };
      const tonnes = TRUCK_OPTIONS.reduce((sum, o) => sum + (next[o.id] ?? 0) * o.capacity, 0);
      const loads = TRUCK_OPTIONS.reduce((sum, o) => sum + (next[o.id] ?? 0), 0);
      if (tonnes > 0) onQuantityChange(tonnes);
      onTotalLoadsChange(loads);
      return next;
    });
    haptics.light();
  }

  // Manual stepper state
  const [quantityEditing, setQuantityEditing] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState('');

  // Derived: convert quantity ↔ unit for display
  const density = MATERIAL_DENSITY[category] ?? 1.7;
  const displayM3 =
    manualUnit === 'BY_WEIGHT' ? parseFloat((quantity / density).toFixed(1)) : quantity;
  const displayT =
    manualUnit === 'BY_WEIGHT' ? quantity : parseFloat((quantity * density).toFixed(1));

  // Running total bar shown at top
  const totalTonnes = isVehicleTab ? totalTruckTonnes : displayT;
  const totalM3 = isVehicleTab ? parseFloat((totalTruckTonnes / density).toFixed(1)) : displayM3;
  const hasQty = isVehicleTab ? totalTruckLoads > 0 : quantity > 0;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Running total ─────────────────────────────────────────────── */}
      <View
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hasQty ? '#f0fdf4' : '#f9fafb',
          borderRadius: 16,
          paddingVertical: 18,
          paddingHorizontal: 20,
          borderWidth: 1.5,
          borderColor: hasQty ? '#86efac' : '#f0f0f0',
          gap: 12,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 32,
              fontFamily: 'Inter_800ExtraBold',
              color: hasQty ? '#16a34a' : '#d1d5db',
              letterSpacing: -1.5,
            }}
          >
            {hasQty ? totalTonnes.toFixed(1) : '0'} t
          </Text>
          {hasQty && (
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_500Medium',
                color: '#6b7280',
                marginTop: 2,
              }}
            >
              ≈ {totalM3} m³
            </Text>
          )}
          {!hasQty && (
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Inter_500Medium',
                color: '#9ca3af',
                marginTop: 2,
              }}
            >
              Izvēlieties daudzumu
            </Text>
          )}
        </View>
        {isVehicleTab && totalTruckLoads > 0 && (
          <View
            style={{
              height: 36,
              width: 1,
              backgroundColor: '#d1fae5',
            }}
          />
        )}
        {isVehicleTab && totalTruckLoads > 0 && (
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 24,
                fontFamily: 'Inter_700Bold',
                color: '#059669',
                letterSpacing: -0.5,
              }}
            >
              {totalTruckLoads}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Inter_500Medium',
                color: '#6b7280',
                marginTop: 2,
              }}
            >
              {totalTruckLoads === 1 ? 'auto' : 'auto'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Tab switcher ──────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          backgroundColor: '#f3f4f6',
          borderRadius: 999,
          padding: 3,
          marginBottom: 24,
        }}
      >
        {TABS.map((tab) => {
          const active = activeTabId === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                haptics.light();
                if (tab.id === 'BY_LOAD') {
                  onOrderTypeChange('BY_LOAD');
                } else {
                  onOrderTypeChange(manualUnit);
                }
              }}
              activeOpacity={0.8}
              style={{
                flex: 1,
                paddingVertical: 11,
                borderRadius: 999,
                alignItems: 'center',
                backgroundColor: active ? '#fff' : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: active ? 2 : 0 },
                shadowOpacity: active ? 0.06 : 0,
                shadowRadius: active ? 4 : 0,
                elevation: active ? 2 : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                  color: active ? '#111827' : '#6b7280',
                  letterSpacing: -0.1,
                }}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Vehicle grid (BY_LOAD tab) ────────────────────────────────── */}
      {isVehicleTab && (
        <View style={{ paddingHorizontal: 20 }}>
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
                <View style={{ width: 64, alignItems: 'center', marginRight: 14 }}>
                  <TruckIllustration type={opt.truckType} height={30} />
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

      {/* ── Manual input tab ──────────────────────────────────────────── */}
      {!isVehicleTab && (
        <View style={{ paddingHorizontal: 20 }}>
          {/* Unit toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#f3f4f6',
              borderRadius: 999,
              padding: 3,
              marginBottom: 28,
            }}
          >
            {MANUAL_UNITS.map((u) => {
              const active = manualUnit === u.id;
              return (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => {
                    haptics.light();
                    onOrderTypeChange(u.id);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 999,
                    alignItems: 'center',
                    backgroundColor: active ? '#fff' : 'transparent',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: active ? 2 : 0 },
                    shadowOpacity: active ? 0.06 : 0,
                    shadowRadius: active ? 4 : 0,
                    elevation: active ? 2 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: active ? 'Inter_700Bold' : 'Inter_500Medium',
                      color: active ? '#111827' : '#6b7280',
                    }}
                  >
                    {u.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Large stepper */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 24,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  onQuantityChange(Math.max(1, Math.round(quantity - 1)));
                }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  borderWidth: 1.5,
                  borderColor: '#e5e7eb',
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <Minus size={24} color="#111827" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setQuantityDraft(String(quantity));
                  setQuantityEditing(true);
                }}
                activeOpacity={0.6}
                style={{ alignItems: 'center', minWidth: 140 }}
              >
                {quantityEditing ? (
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
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          fontSize: 56,
                          fontFamily: 'Inter_800ExtraBold',
                          color: '#111827',
                          letterSpacing: -2,
                          includeFontPadding: false,
                        }}
                      >
                        {quantity}
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
                        {ORDER_TYPE_UNIT_LABEL[manualUnit]}
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
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  onQuantityChange(Math.round(quantity + 1));
                }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  borderWidth: 1.5,
                  borderColor: '#e5e7eb',
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
              >
                <Plus size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick presets */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 24,
            }}
          >
            {PRESETS[manualUnit].map((p) => {
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
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold',
                      color: active ? '#111827' : '#6b7280',
                    }}
                  >
                    {p} {ORDER_TYPE_UNIT_LABEL[manualUnit]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
