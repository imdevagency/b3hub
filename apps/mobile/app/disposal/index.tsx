import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useDisposal } from '@/lib/disposal-context';
import type { WasteType } from '@/lib/api';
import {
  Hammer,
  Trees,
  Wrench,
  Package,
  Layers,
  Trash2,
  AlertTriangle,
  Check,
  X,
  type LucideIcon,
} from 'lucide-react-native';

interface WasteOption {
  id: WasteType;
  label: string;
  desc: string;
  Icon: LucideIcon;
}

const WASTE_OPTIONS: WasteOption[] = [
  { id: 'CONCRETE', label: 'Betons / Bruģis', desc: 'Betona gabali, plātnes', Icon: Hammer },
  { id: 'SOIL', label: 'Augsne / Grunts', desc: 'Z0/Z1 grunts, smilts, māls', Icon: Layers },
  { id: 'BRICK', label: 'Ķieģeļi / Mūris', desc: 'Nojaukšanas atkritumi', Icon: Hammer },
  { id: 'WOOD', label: 'Koks', desc: 'Dēļi, sijas, finiera atgriezumi', Icon: Trees },
  { id: 'METAL', label: 'Metāls', desc: 'Profili, stiegrojums, lūžņi', Icon: Wrench },
  { id: 'PLASTIC', label: 'Plastmasa', desc: 'Caurules, pārsegi, maisi', Icon: Package },
  { id: 'MIXED', label: 'Jaukti celtniec.', desc: 'Dažādi celtniecības atkritumi', Icon: Trash2 },
  {
    id: 'HAZARDOUS',
    label: 'Bīstami atkritumi',
    desc: 'Azbests, krāsas, šķīdinātāji',
    Icon: AlertTriangle,
  },
];

export default function DisposalStep1WasteType() {
  const router = useRouter();
  const { state, setWasteType } = useDisposal();
  const [selected, setSelected] = useState<WasteType | null>(state.wasteType);

  const handleNext = () => {
    if (!selected) return;
    setWasteType(selected);
    router.push('/disposal/location');
  };

  return (
    <ScreenContainer standalone bg="#fff">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <X size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nodot atkritumus</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '25%' }]} />
        </View>
        <Text style={s.progressLabel}>Solis 1 / 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.stepNum}>01</Text>
        <Text style={s.stepTitle}>Ko nodot?</Text>
        <Text style={s.stepSubtitle}>Izvēlieties galveno atkritumu veidu.</Text>

        <View style={s.grid}>
          {WASTE_OPTIONS.map((opt) => {
            const isSelected = selected === opt.id;
            const WasteIcon = opt.Icon;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[s.card, isSelected && s.cardSelected]}
                onPress={() => setSelected(opt.id)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={s.checkBadge}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
                <WasteIcon
                  size={28}
                  color={isSelected ? '#fff' : '#6b7280'}
                  style={{ marginBottom: 8 }}
                />
                <Text style={[s.cardLabel, isSelected && s.cardLabelSelected]}>{opt.label}</Text>
                <Text style={[s.cardDesc, isSelected && s.cardDescSelected]}>{opt.desc}</Text>
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
          <Text style={[s.nextText, !selected && s.nextTextDisabled]}>Turpināt →</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  progressWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  progressTrack: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#111827', borderRadius: 2 },
  progressLabel: { marginTop: 6, fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  stepNum: { fontSize: 64, fontWeight: '800', color: '#f3f4f6', lineHeight: 68, marginBottom: 8 },
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
  cardSelected: { borderColor: '#111827', backgroundColor: '#111827' },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
  cardLabelSelected: { color: '#fff' },
  cardDesc: { fontSize: 12, color: '#9ca3af' },
  cardDescSelected: { color: 'rgba(255,255,255,0.6)' },
  footer: { padding: 24 },
  nextBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#f3f4f6' },
  nextText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  nextTextDisabled: { color: '#9ca3af' },
});
