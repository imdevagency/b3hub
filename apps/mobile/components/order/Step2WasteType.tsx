import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { Check } from 'lucide-react-native';
import type { SkipWasteCategory } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';
import { WASTE_TYPES, WASTE_ICONS } from './skip-hire-types';

export function Step2WasteType({
  selected,
  onSelect,
}: {
  selected: SkipWasteCategory | null;
  onSelect: (v: SkipWasteCategory) => void;
}) {
  const scales = useRef(WASTE_TYPES.map(() => new Animated.Value(1))).current;
  const stagger = useRef(WASTE_TYPES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    stagger.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        delay: i * 55,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: SkipWasteCategory, idx: number) => {
    haptics.selection();
    Animated.sequence([
      Animated.spring(scales[idx], {
        toValue: 0.92,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(scales[idx], {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 6,
      }),
    ]).start();
    onSelect(id);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s2.grid}>
      {WASTE_TYPES.map((id, idx) => {
        const info = t.skipHire.step2.types[id];
        const isSelected = selected === id;
        const Icon = WASTE_ICONS[id];
        const translateY = stagger[idx].interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
        return (
          <Animated.View
            key={id}
            style={{
              width: '47%',
              opacity: stagger[idx],
              transform: [{ scale: scales[idx] }, { translateY }],
            }}
          >
            <TouchableOpacity
              style={[s2.card, isSelected && s2.cardSelected]}
              onPress={() => handleSelect(id, idx)}
              activeOpacity={0.75}
            >
              {isSelected && (
                <View style={s2.check}>
                  <Check size={10} color="#fff" />
                </View>
              )}
              <Icon size={24} color={isSelected ? '#fff' : '#6b7280'} style={{ marginBottom: 6 }} />
              <Text style={[s2.label, isSelected && s2.labelSelected]}>{info.label}</Text>
              <Text style={[s2.desc, isSelected && s2.descSelected]}>{info.desc}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const s2 = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  card: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#f3f4f6',
    position: 'relative',
    minHeight: 100,
  },
  cardSelected: { borderColor: '#111827', backgroundColor: '#111827' },
  check: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  labelSelected: { color: '#fff' },
  desc: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  descSelected: { color: 'rgba(255,255,255,0.6)' },
});
