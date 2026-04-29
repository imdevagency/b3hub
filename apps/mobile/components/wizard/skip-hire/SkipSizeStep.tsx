import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { SkipSize, SkipSizeDefinition } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { t } from '@/lib/translations';
import { SIZES } from './_types';
import { colors } from '@/lib/theme';

export function SkipSizeStep({
  selected,
  onSelect,
  prices,
  sizeDefs,
  flat,
}: {
  selected: SkipSize | null;
  onSelect: (v: SkipSize) => void;
  /** Live market prices per size — overrides hardcoded SIZES prices when provided */
  prices?: Partial<Record<string, number>>;
  /** Dynamic size catalogue from the API — when provided, renders these instead of hardcoded SIZES */
  sizeDefs?: SkipSizeDefinition[];
  flat?: boolean;
}) {
  const handleSelect = (id: SkipSize) => {
    haptics.selection();
    onSelect(id);
  };

  // Build display items — dynamic API sizes take priority over hardcoded SIZES
  const items: Array<{
    id: string;
    price: number;
    heightPct: number;
    label: string;
    volume: string;
    desc: string;
  }> =
    sizeDefs && sizeDefs.length > 0
      ? sizeDefs.map((def) => {
          // Try translation entry for known legacy codes
          const tr = (
            t.skipHire.step3.sizes as Record<
              string,
              { label: string; volume: string; desc: string }
            >
          )[def.code];
          return {
            id: def.code,
            price: prices?.[def.code] ?? def.basePrice ?? 0,
            heightPct: def.heightPct,
            label: tr?.label ?? def.labelLv ?? def.label,
            volume: tr?.volume ?? `${def.volumeM3} m³`,
            desc: tr?.desc ?? def.descriptionLv ?? def.description ?? '',
          };
        })
      : SIZES.map((size) => {
          const info = t.skipHire.step3.sizes[size.id as keyof typeof t.skipHire.step3.sizes];
          return {
            id: size.id,
            price: prices?.[size.id] ?? size.price,
            heightPct: size.heightPct,
            label: info?.label ?? size.id,
            volume: info?.volume ?? '',
            desc: info?.desc ?? '',
          };
        });

  const content = items.map((item) => {
    const isSel = selected === item.id;
    const boxH = Math.round(16 + item.heightPct * 26);
    const boxW = Math.round(32 + item.heightPct * 16);
    return (
      <TouchableOpacity
        key={item.id}
        style={[s3.card, isSel && s3.cardSel]}
        onPress={() => handleSelect(item.id)}
        activeOpacity={0.75}
      >
        <View style={s3.row}>
          {/* Visual skip container */}
          <View style={s3.skipWrap}>
            <View
              style={[
                s3.skipBox,
                {
                  height: boxH,
                  width: boxW,
                  backgroundColor: isSel ? '#000' : '#e5e7eb',
                },
              ]}
            />
            <View style={s3.wheels}>
              <View style={[s3.wheel, isSel && { backgroundColor: '#F9423A' }]} />
              <View style={[s3.wheel, isSel && { backgroundColor: '#F9423A' }]} />
            </View>
          </View>

          <View style={{ flex: 1, paddingLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={[s3.label, isSel && { color: '#000' }]}>{item.label}</Text>
              {item.id === 'MIDI' && (
                <View style={s3.popular}>
                  <Text style={s3.popularTxt}>{t.skipHire.step3.popular}</Text>
                </View>
              )}
            </View>
            <Text style={[s3.vol, isSel && { color: '#4b5563' }]}>{item.volume}</Text>
            <Text style={s3.desc}>{item.desc}</Text>
          </View>

          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={[s3.price, isSel && { color: '#000' }]}>
              {item.price > 0 ? `€${item.price}` : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  if (flat) {
    return <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>{content}</View>;
  }
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
    >
      {content}
    </ScrollView>
  );
}

const s3 = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  cardSel: {
    borderColor: '#F9423A',
    backgroundColor: '#f8fafc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  popular: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  popularTxt: { color: '#4b5563', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  skipWrap: { alignItems: 'center', width: 60, justifyContent: 'center' },
  skipBox: { borderRadius: 3 },
  wheels: { flexDirection: 'row', gap: 7, marginTop: 3 },
  wheel: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#d1d5db' },
  label: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  vol: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  desc: { fontSize: 11, color: colors.textDisabled, marginTop: 1 },
  price: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  minHire: { fontSize: 10, color: colors.textDisabled, fontWeight: '500' },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
