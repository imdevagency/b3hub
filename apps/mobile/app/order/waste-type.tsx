import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useOrder } from '@/lib/order-context';
import { t } from '@/lib/translations';
import type { SkipWasteCategory } from '@/lib/api';

const WASTE_TYPES: Array<{ id: SkipWasteCategory }> = [
  { id: 'MIXED' },
  { id: 'GREEN_GARDEN' },
  { id: 'CONCRETE_RUBBLE' },
  { id: 'WOOD' },
  { id: 'METAL_SCRAP' },
  { id: 'ELECTRONICS_WEEE' },
];

export default function Step2WasteType() {
  const router = useRouter();
  const { state, setWasteCategory } = useOrder();
  const [selected, setSelected] = useState<SkipWasteCategory | null>(state.wasteCategory);

  const handleNext = () => {
    if (!selected) return;
    setWasteCategory(selected);
    router.push('/order/size');
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
          <View style={[s.progressFill, { width: '50%' }]} />
        </View>
        <Text style={s.progressLabel}>{t.skipHire.step} 2 / 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.stepNum}>02</Text>
        <Text style={s.stepTitle}>{t.skipHire.step2.title}</Text>
        <Text style={s.stepSubtitle}>{t.skipHire.step2.subtitle}</Text>

        <View style={s.grid}>
          {WASTE_TYPES.map((type) => {
            const info = t.skipHire.step2.types[type.id];
            const isSelected = selected === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[s.card, isSelected && s.cardSelected]}
                onPress={() => setSelected(type.id)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={s.checkBadge}>
                    <Text style={s.checkText}>✓</Text>
                  </View>
                )}
                <Text style={s.cardEmoji}>{info.emoji}</Text>
                <Text style={[s.cardLabel, isSelected && s.cardLabelSelected]}>{info.label}</Text>
                <Text style={s.cardDesc}>{info.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, !selected && s.nextBtnDisabled]}
          disabled={!selected}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[s.nextText, !selected && s.nextTextDisabled]}>
            {t.skipHire.step2.next} →
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f3f4f6',
    position: 'relative',
    minHeight: 110,
  },
  cardSelected: { borderColor: '#dc2626', backgroundColor: '#fff7f7' },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardEmoji: { fontSize: 30, marginBottom: 8 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
  cardLabelSelected: { color: '#dc2626' },
  cardDesc: { fontSize: 12, color: '#9ca3af' },
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
