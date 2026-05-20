/**
 * ProductStep — Step 2 of the material order wizard.
 *
 * Buyer selects the material category (visual 2-column grid) and fraction
 * (bottom sheet). Both must be selected before CTA enables.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import {
  Mountain,
  Waves,
  Layers,
  Box,
  Recycle,
  Zap,
  MoreHorizontal,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { haptics } from '@/lib/haptics';
import type { MaterialCategory } from '@/lib/materials';
import { CATEGORY_FRACTIONS, type OrderType } from './_constants';
import { s } from './_styles';

// ── Category metadata ─────────────────────────────────────────────────────

type CatMeta = { bg: string; accent: string; Icon: React.ElementType; label: string };

const CATEGORY_META: Record<string, CatMeta> = {
  GRAVEL: { bg: '#e2e8f0', accent: '#334155', Icon: Mountain, label: 'Grants' },
  SAND: { bg: '#fef3c7', accent: '#b45309', Icon: Waves, label: 'Smiltis' },
  STONE: { bg: '#dde1e8', accent: '#374151', Icon: Mountain, label: 'Šķembas' },
  CONCRETE: { bg: '#f0f0f0', accent: '#6b7280', Icon: Box, label: 'Betons' },
  SOIL: { bg: '#fefce8', accent: '#854d0e', Icon: Layers, label: 'Zeme' },
  RECYCLED_CONCRETE: {
    bg: '#dcfce7',
    accent: '#166534',
    Icon: Recycle,
    label: 'RC betona šķembas',
  },
  RECYCLED_SOIL: { bg: '#d1fae5', accent: '#065f46', Icon: Recycle, label: 'RC grunts' },
  ASPHALT: { bg: '#e5e5e5', accent: '#44403c', Icon: Zap, label: 'Asfaltbetons' },
  CLAY: { bg: '#ffedd5', accent: '#9a3412', Icon: Layers, label: 'Māls' },
  OTHER: { bg: '#f3f4f6', accent: '#6b7280', Icon: MoreHorizontal, label: 'Cits' },
};

const CATEGORY_ORDER: MaterialCategory[] = [
  'GRAVEL',
  'SAND',
  'STONE',
  'CONCRETE',
  'ASPHALT',
  'SOIL',
  'CLAY',
  'RECYCLED_CONCRETE',
  'RECYCLED_SOIL',
  'OTHER',
];

// ── Props ─────────────────────────────────────────────────────────────────

export type ProductStepProps = {
  category: MaterialCategory;
  onCategoryChange: (c: MaterialCategory) => void;
  selectedFraction: string;
  onFractionChange: (f: string) => void;
  /** Live category labels from DB (optional). */
  categoryLabels?: Record<string, string>;
  /** Live fractions per category from DB (optional). */
  categoryFractions?: Record<string, string[]>;
};

// ── Component ─────────────────────────────────────────────────────────────

export function ProductStep({
  category,
  onCategoryChange,
  selectedFraction,
  onFractionChange,
  categoryLabels,
  categoryFractions: categoryFractionsProp,
}: ProductStepProps) {
  const activeFractions = categoryFractionsProp ?? CATEGORY_FRACTIONS;
  const [fractionPickerOpen, setFractionPickerOpen] = useState(false);

  const fractions = activeFractions[category] ?? CATEGORY_FRACTIONS[category] ?? [];

  function handleCategorySelect(cat: MaterialCategory) {
    haptics.medium();
    onCategoryChange(cat);
    // Auto-select first fraction for new category
    const fracs = activeFractions[cat] ?? CATEGORY_FRACTIONS[cat] ?? [];
    if (fracs.length > 0) onFractionChange(fracs[0]);
    // Open fraction picker if more than one fraction available
    if (fracs.length > 1) {
      setTimeout(() => setFractionPickerOpen(true), 120);
    }
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat] ?? CATEGORY_META.OTHER;
            const Icon = meta.Icon;
            const active = category === cat;
            const label = categoryLabels?.[cat] ?? meta.label;

            return (
              <TouchableOpacity
                key={cat}
                onPress={() => handleCategorySelect(cat)}
                activeOpacity={0.85}
                style={{
                  width: '47%',
                  borderRadius: 18,
                  padding: 18,
                  backgroundColor: active ? '#111827' : meta.bg,
                  borderWidth: 1.5,
                  borderColor: active ? '#111827' : 'transparent',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: active ? 4 : 1 },
                  shadowOpacity: active ? 0.12 : 0.04,
                  shadowRadius: active ? 10 : 3,
                  elevation: active ? 5 : 1,
                  position: 'relative',
                }}
              >
                {/* Selected checkmark */}
                {active && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={13} color="#111827" strokeWidth={3} />
                  </View>
                )}

                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Icon size={22} color={active ? '#fff' : meta.accent} />
                </View>

                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter_700Bold',
                    color: active ? '#fff' : '#111827',
                    letterSpacing: -0.2,
                    lineHeight: 19,
                  }}
                  numberOfLines={2}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fraction picker row */}
        {fractions.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Inter_700Bold',
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 10,
                marginLeft: 4,
              }}
            >
              Frakcija
            </Text>
            <TouchableOpacity
              onPress={() => setFractionPickerOpen(true)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#fff',
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: selectedFraction ? '#111827' : '#e5e7eb',
                paddingHorizontal: 18,
                paddingVertical: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: selectedFraction ? 'Inter_700Bold' : 'Inter_400Regular',
                  color: selectedFraction ? '#111827' : '#9ca3af',
                  flex: 1,
                }}
              >
                {selectedFraction || 'Izvēlieties frakciju…'}
              </Text>
              <ChevronDown size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Fraction bottom sheet */}
      <BottomSheet
        visible={fractionPickerOpen}
        onClose={() => setFractionPickerOpen(false)}
        title="Frakcija"
        scrollable
        maxHeightPct={0.5}
      >
        {fractions.map((item) => (
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
    </>
  );
}
