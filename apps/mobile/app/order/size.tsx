import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useOrder } from '@/lib/order-context';
import { t } from '@/lib/translations';
import type { SkipSize } from '@/lib/api';

const SIZES: Array<{ id: SkipSize; price: number; color: string; heightPct: number }> = [
  { id: 'MINI', price: 89, color: '#3b82f6', heightPct: 0.28 },
  { id: 'MIDI', price: 129, color: '#dc2626', heightPct: 0.48 },
  { id: 'BUILDERS', price: 169, color: '#f59e0b', heightPct: 0.68 },
  { id: 'LARGE', price: 199, color: '#10b981', heightPct: 0.88 },
];

export default function Step3Size() {
  const router = useRouter();
  const { state, setSkipSize } = useOrder();
  const [selected, setSelected] = useState<SkipSize | null>(state.skipSize);

  const handleNext = () => {
    if (!selected) return;
    setSkipSize(selected);
    router.push('/order/date');
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.skipHire.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '75%' }]} />
        </View>
        <Text style={s.progressLabel}>{t.skipHire.step} 3 / 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.stepNum}>03</Text>
        <Text style={s.stepTitle}>{t.skipHire.step3.title}</Text>
        <Text style={s.stepSubtitle}>{t.skipHire.step3.subtitle}</Text>

        {SIZES.map((size) => {
          const info = t.skipHire.step3.sizes[size.id];
          const isSelected = selected === size.id;
          const isMidi = size.id === 'MIDI';
          const boxHeight = Math.round(18 + size.heightPct * 30);
          const boxWidth = Math.round(38 + size.heightPct * 20);

          return (
            <TouchableOpacity
              key={size.id}
              style={[s.card, isSelected && s.cardSelected]}
              onPress={() => setSelected(size.id)}
              activeOpacity={0.7}
            >
              {isMidi && (
                <View style={s.popularBadge}>
                  <Text style={s.popularText}>{t.skipHire.step3.popular}</Text>
                </View>
              )}
              <View style={s.cardContent}>
                {/* Visual skip container */}
                <View style={s.skipVisual}>
                  <View
                    style={[
                      s.skipBox,
                      {
                        height: boxHeight,
                        width: boxWidth,
                        backgroundColor: isSelected ? size.color : '#e5e7eb',
                        borderRadius: 4,
                      },
                    ]}
                  />
                  <View style={s.skipWheelRow}>
                    <View style={[s.skipWheel, isSelected && { backgroundColor: size.color }]} />
                    <View style={[s.skipWheel, isSelected && { backgroundColor: size.color }]} />
                  </View>
                </View>

                {/* Info */}
                <View style={s.cardInfo}>
                  <Text style={[s.cardLabel, isSelected && { color: size.color }]}>
                    {info.label}
                  </Text>
                  <Text style={s.cardVolume}>{info.volume}</Text>
                  <Text style={s.cardDesc}>{info.desc}</Text>
                </View>

                {/* Price + check */}
                <View style={s.priceWrap}>
                  <Text style={[s.price, isSelected && { color: size.color }]}>€{size.price}</Text>
                  {isSelected && (
                    <View style={[s.checkCircle, { backgroundColor: size.color }]}>
                      <Text style={s.checkText}>✓</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, !selected && s.nextBtnDisabled]}
          disabled={!selected}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[s.nextText, !selected && s.nextTextDisabled]}>
            {t.skipHire.step3.next} →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: '#374151' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  progressWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  progressTrack: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#dc2626', borderRadius: 2 },
  progressLabel: { marginTop: 6, fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  stepNum: { fontSize: 64, fontWeight: '800', color: '#fef2f2', lineHeight: 68, marginBottom: 8 },
  stepTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    position: 'relative',
    overflow: 'hidden',
  },
  cardSelected: { borderColor: '#dc2626', backgroundColor: '#fff7f7' },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  skipVisual: { alignItems: 'center', width: 64, justifyContent: 'flex-end' },
  skipBox: {},
  skipWheelRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  skipWheel: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardVolume: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  cardDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  priceWrap: { alignItems: 'flex-end', gap: 8 },
  price: { fontSize: 20, fontWeight: '700', color: '#374151' },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  footer: { padding: 24 },
  nextBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#f3f4f6' },
  nextText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  nextTextDisabled: { color: '#9ca3af' },
});
