import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useDisposal } from '@/lib/disposal-context';
import type { DisposalTruckType } from '@/lib/api';
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react-native';

// Volume presets — buyer chooses a human size; truck type is mapped automatically.
// Buyers have no idea how many trucks they need, so we handle that for them.
const VOLUME_PRESETS: Array<{
  key: string;
  label: string;
  sublabel: string;
  emoji: string;
  truckType: DisposalTruckType;
  truckCount: number;
}> = [
  {
    key: 'xs',
    label: 'Neliela',
    sublabel: '~5 m³ / ~4 t',
    emoji: '🧺',
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
  },
  {
    key: 'sm',
    label: 'Vidēja',
    sublabel: '~10 m³ / ~8 t',
    emoji: '🏗️',
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
  },
  {
    key: 'md',
    label: 'Liela',
    sublabel: '~18 m³ / ~14 t',
    emoji: '🚛',
    truckType: 'TIPPER_LARGE',
    truckCount: 1,
  },
  {
    key: 'lg',
    label: 'Ļoti liela',
    sublabel: '~36 m³ / ~26 t',
    emoji: '🏭',
    truckType: 'ARTICULATED_TIPPER',
    truckCount: 2,
  },
];

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koks',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti celtniecības',
  HAZARDOUS: 'Bīstami atkritumi',
};

export default function DisposalStep3Volume() {
  const router = useRouter();
  const { state, setTruckType, setTruckCount, setDescription } = useDisposal();

  // Best-effort: map current context state back to a preset key on re-visit
  const defaultKey =
    state.truckCount > 1
      ? 'lg'
      : state.truckType === 'TIPPER_SMALL'
        ? 'xs'
        : state.truckType === 'ARTICULATED_TIPPER'
          ? 'md'
          : 'xs';

  const [selectedKey, setSelectedKey] = useState<string>(defaultKey);
  const [desc, setDesc] = useState(state.description);

  const isHazardous = state.wasteType === 'HAZARDOUS';
  const preset = VOLUME_PRESETS.find((p) => p.key === selectedKey) ?? VOLUME_PRESETS[0];

  const handleNext = () => {
    if (isHazardous) {
      Alert.alert(
        'Bīstami atkritumi',
        'Bīstamu atkritumu nodošana jāsaskaņo atsevišķi. Lūdzu, sazinieties ar mums tieši.',
        [{ text: 'Sapratu' }],
      );
      return;
    }
    setTruckType(preset.truckType);
    setTruckCount(preset.truckCount);
    setDescription(desc);
    router.push('/disposal/confirm');
  };

  return (
    <ScreenContainer standalone bg="#fff">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nodot atkritumus</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '75%' }]} />
        </View>
        <Text style={s.progressLabel}>Solis 3 / 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.stepNum}>03</Text>
        <Text style={s.stepTitle}>Cik materiāla{`\n`}ir jāizved?</Text>
        <Text style={s.stepSubtitle}>
          Izvēlieties aptuvenu apjomu — mēs izvēlēsimies piemērotu transportu.
        </Text>

        {/* ── Volume preset 2×2 grid ── */}
        <View style={s.presetGrid}>
          {VOLUME_PRESETS.map((p) => {
            const isSelected = selectedKey === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.presetCard, isSelected && s.presetCardSelected]}
                onPress={() => setSelectedKey(p.key)}
                activeOpacity={0.7}
              >
                <Text style={s.presetEmoji}>{p.emoji}</Text>
                <Text style={[s.presetLabel, isSelected && s.presetLabelSelected]}>
                  {p.label}
                </Text>
                <Text style={s.presetSublabel}>{p.sublabel}</Text>
                {isSelected && (
                  <View style={s.presetCheck}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Waste type (read-only confirmation) ── */}
        <Text style={s.sectionTitle}>Atkritumu veids</Text>
        <View style={s.infoRow}>
          <Text style={s.infoValue}>
            {state.wasteType ? WASTE_LABELS[state.wasteType] : '—'}
          </Text>
        </View>

        {/* ── Optional description ── */}
        <Text style={s.sectionTitle}>Papildu informācija (neobligāti)</Text>
        {isHazardous && (
          <View style={s.warningRow}>
            <AlertTriangle size={14} color="#b91c1c" />
            <Text style={s.warningText}>
              Bīstamu atkritumu transportēšana nav atļauta bez speciālas atļaujas!
            </Text>
          </View>
        )}
        <View style={s.card}>
          <TextInput
            style={s.input}
            placeholder="piem., Z0 Grunts, asfalta segums, demolācijas atkritumi..."
            placeholderTextColor="#9ca3af"
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, isHazardous && s.nextBtnHazardous]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[s.nextText, isHazardous && s.nextTextHazardous]}>
            {isHazardous ? 'Sazināties →' : 'Turpināt →'}
          </Text>
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
  backBtn: {
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
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  stepNum: { fontSize: 64, fontWeight: '800', color: '#f3f4f6', lineHeight: 68, marginBottom: 8 },
  stepTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#6b7280', marginBottom: 24 },

  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  presetCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  presetCardSelected: { borderColor: '#111827', backgroundColor: '#fff' },
  presetEmoji: { fontSize: 30, marginBottom: 8 },
  presetLabel: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 4 },
  presetLabelSelected: { color: '#111827' },
  presetSublabel: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  presetCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  infoValue: { fontSize: 15, color: '#111827', fontWeight: '500' },

  // keep countBtn stub so old StyleSheet keys don't crash if referenced elsewhere
  countBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBtnDisabled: { backgroundColor: '#f9fafb' },
  countNum: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    minWidth: 40,
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    marginTop: 4,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cargoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cargoLabel: { fontSize: 15, fontWeight: '500', color: '#111827', flex: 1 },

  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  warningText: { fontSize: 13, color: '#b91c1c', flex: 1, lineHeight: 18 },

  input: {
    padding: 16,
    fontSize: 15,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
  },

  footer: { padding: 20 },
  nextBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnHazardous: { backgroundColor: '#b91c1c' },
  nextText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  nextTextHazardous: { color: '#fff' },
});
