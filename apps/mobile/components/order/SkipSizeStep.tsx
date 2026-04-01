import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import type { SkipSize } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';
import { SIZES } from './skip-hire-types';

export function SkipSizeStep({
  selected,
  onSelect,
}: {
  selected: SkipSize | null;
  onSelect: (v: SkipSize) => void;
}) {
  const scales = useRef(SIZES.map(() => new Animated.Value(1))).current;
  const stagger = useRef(SIZES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    stagger.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        delay: i * 70,
        useNativeDriver: true,
        tension: 75,
        friction: 10,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: SkipSize, idx: number) => {
    haptics.selection();
    Animated.sequence([
      Animated.spring(scales[idx], {
        toValue: 0.96,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(scales[idx], {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }),
    ]).start();
    onSelect(id);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
    >
      {SIZES.map((size, idx) => {
        const info = t.skipHire.step3.sizes[size.id];
        const isSel = selected === size.id;
        const boxH = Math.round(16 + size.heightPct * 26);
        const boxW = Math.round(32 + size.heightPct * 16);
        const translateY = stagger[idx].interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
        return (
          <Animated.View
            key={size.id}
            style={{ opacity: stagger[idx], transform: [{ scale: scales[idx] }, { translateY }] }}
          >
            <TouchableOpacity
              style={[s3.card, isSel && s3.cardSel]}
              onPress={() => handleSelect(size.id, idx)}
              activeOpacity={0.75}
            >
              {size.id === 'MIDI' && (
                <View style={s3.popular}>
                  <Text style={s3.popularTxt}>{t.skipHire.step3.popular}</Text>
                </View>
              )}
              <View style={s3.row}>
                {/* Visual skip container */}
                <View style={s3.skipWrap}>
                  <View
                    style={[
                      s3.skipBox,
                      {
                        height: boxH,
                        width: boxW,
                        backgroundColor: isSel ? size.color : '#e5e7eb',
                      },
                    ]}
                  />
                  <View style={s3.wheels}>
                    <View style={[s3.wheel, isSel && { backgroundColor: size.color }]} />
                    <View style={[s3.wheel, isSel && { backgroundColor: size.color }]} />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[s3.label, isSel && { color: size.color }]}>{info.label}</Text>
                  <Text style={s3.vol}>{info.volume}</Text>
                  <Text style={s3.desc}>{info.desc}</Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[s3.price, isSel && { color: size.color }]}>€{size.price}</Text>
                  {isSel && (
                    <View style={[s3.checkCircle, { backgroundColor: size.color }]}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const s3 = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    position: 'relative',
    overflow: 'hidden',
  },
  cardSel: { borderColor: '#111827', backgroundColor: '#fff' },
  popular: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularTxt: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skipWrap: { alignItems: 'center', width: 56, justifyContent: 'flex-end' },
  skipBox: { borderRadius: 3 },
  wheels: { flexDirection: 'row', gap: 7, marginTop: 3 },
  wheel: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#d1d5db' },
  label: { fontSize: 15, fontWeight: '700', color: '#111827' },
  vol: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  desc: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  price: { fontSize: 18, fontWeight: '700', color: '#374151' },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
