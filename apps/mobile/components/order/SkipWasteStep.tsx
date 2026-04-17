import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import type { SkipWasteCategory } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';
import { WASTE_TYPES, WASTE_ICONS } from './skip-hire-types';

export function SkipWasteStep({
  selected,
  onSelect,
}: {
  selected: SkipWasteCategory | null;
  onSelect: (v: SkipWasteCategory) => void;
}) {
  const handleSelect = (id: SkipWasteCategory) => {
    haptics.selection();
    onSelect(id);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s2.grid}
      style={{ paddingHorizontal: 20 }}
    >
      {WASTE_TYPES.map((id, idx) => {
        const info = t.skipHire.step2.types[id];
        const isSelected = selected === id;
        const Icon = WASTE_ICONS[id];
        return (
          <View key={id} style={{ width: '48%' }}>
            <TouchableOpacity
              style={[s2.card, isSelected && s2.cardSelected]}
              onPress={() => handleSelect(id)}
              activeOpacity={0.75}
            >
              {isSelected && (
                <View style={s2.check}>
                  <Check size={10} color="#fff" />
                </View>
              )}
              <Icon
                size={28}
                color={isSelected ? '#000' : '#4b5563'}
                strokeWidth={selected === id ? 2.5 : 1.5}
              />
              <Text style={[s2.label, isSelected && s2.labelSelected]}>{info.label}</Text>
              <Text style={[s2.desc, isSelected && s2.descSelected]}>{info.desc}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s2 = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 40,
    rowGap: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 120,
    justifyContent: 'flex-start',
  },
  cardSelected: {
    borderColor: '#000',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 12, marginBottom: 2 },
  labelSelected: { color: '#000' },
  desc: { fontSize: 13, color: '#6b7280' },
  descSelected: { color: '#4b5563' },
});
