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
import { Minus, Plus, Truck, AlertTriangle } from 'lucide-react-native';

// ── Truck configs (mirrors backend TRUCK_LABELS) ──────────────────────────────
const TRUCKS: Array<{
  id: DisposalTruckType;
  label: string;
  sublabel: string;
  capacity: number; // tonnes
  volume: number; // m³
}> = [
  { id: 'TIPPER_SMALL', label: 'Pašizgāzējs', sublabel: 'Slodze 10 t', capacity: 10, volume: 8 },
  {
    id: 'TIPPER_LARGE',
    label: 'Pašizgāzējs lielais',
    sublabel: 'Slodze 18 t',
    capacity: 18,
    volume: 12,
  },
  {
    id: 'ARTICULATED_TIPPER',
    label: 'Sattelkipper',
    sublabel: 'Slodze 26 t',
    capacity: 26,
    volume: 18,
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

export default function DisposalStep2Quantity() {
  const router = useRouter();
  const { state, setTruckType, setTruckCount, setDescription } = useDisposal();

  const [selectedTruck, setSelectedTruck] = useState<DisposalTruckType>(state.truckType);
  const [count, setCount] = useState(state.truckCount);
  const [desc, setDesc] = useState(state.description);

  const truck = TRUCKS.find((t) => t.id === selectedTruck) ?? TRUCKS[1];
  const totalTonnes = truck.capacity * count;
  const totalVolume = truck.volume * count;

  const isHazardous = state.wasteType === 'HAZARDOUS';

  const handleNext = () => {
    if (isHazardous) {
      Alert.alert(
        'Bīstami atkritumi',
        'Bīstamu atkritumu nodošana jāsaskaņo atsevišķi. Lūdzu, sazinieties ar mums tieši.',
        [{ text: 'Sapratu' }],
      );
      return;
    }
    setTruckType(selectedTruck);
    setTruckCount(count);
    setDescription(desc);
    router.push('/disposal/confirm');
  };

  return (
    <ScreenContainer standalone bg="#fff">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
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
        <Text style={s.stepTitle}>Cik kravas auto nepieciešams?</Text>
        <Text style={s.stepSubtitle}>Izvēlieties pašizgāzēja veidu un skaitu.</Text>

        {/* ── Tonnage summary card (like Schüttflix top display) ── */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryNum}>{totalTonnes}</Text>
            <Text style={s.summaryUnit}> t</Text>
            <Text style={s.summaryApprox}> ≈</Text>
            <Text style={s.summaryNum}> {totalVolume}</Text>
            <Text style={s.summaryUnit}> m³</Text>
          </View>
          <View style={s.summaryDivider} />

          {/* Truck type selector */}
          {TRUCKS.map((t) => {
            const isSelected = selectedTruck === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.truckRow, isSelected && s.truckRowSelected]}
                onPress={() => setSelectedTruck(t.id)}
                activeOpacity={0.7}
              >
                <Truck size={22} color={isSelected ? '#111827' : '#6b7280'} />
                <View style={s.truckInfo}>
                  <Text style={[s.truckLabel, isSelected && s.truckLabelSelected]}>{t.label}</Text>
                  <Text style={s.truckSublabel}>{t.sublabel}</Text>
                </View>
                {/* Radio button */}
                <View style={[s.radio, isSelected && s.radioSelected]}>
                  {isSelected && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={s.summaryDivider} />

          {/* Count +/- */}
          <View style={s.countRow}>
            <TouchableOpacity
              style={[s.countBtn, count <= 1 && s.countBtnDisabled]}
              onPress={() => setCount((c) => Math.max(1, c - 1))}
              disabled={count <= 1}
            >
              <Minus size={18} color={count <= 1 ? '#d1d5db' : '#111827'} />
            </TouchableOpacity>
            <Text style={s.countNum}>{count}</Text>
            <TouchableOpacity
              style={[s.countBtn, count >= 10 && s.countBtnDisabled]}
              onPress={() => setCount((c) => Math.min(10, c + 1))}
              disabled={count >= 10}
            >
              <Plus size={18} color={count >= 10 ? '#d1d5db' : '#111827'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Cargo section ── */}
        <Text style={s.sectionTitle}>Krava</Text>
        <View style={s.card}>
          <View style={s.cargoRow}>
            <View style={[s.radio, s.radioSelected]}>
              <View style={s.radioDot} />
            </View>
            <Text style={s.cargoLabel}>
              {state.wasteType ? WASTE_LABELS[state.wasteType] : '—'}
            </Text>
          </View>
        </View>

        {/* ── Description (Frachtbeschreibung) ── */}
        <Text style={s.sectionTitle}>Kravas apraksts</Text>
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
  backIcon: { fontSize: 18, color: '#374151' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  progressWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  progressTrack: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#111827', borderRadius: 2 },
  progressLabel: { marginTop: 6, fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  stepNum: { fontSize: 64, fontWeight: '800', color: '#f3f4f6', lineHeight: 68, marginBottom: 8 },
  stepTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#6b7280', marginBottom: 24 },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryNum: { fontSize: 36, fontWeight: '800', color: '#111827' },
  summaryUnit: { fontSize: 18, fontWeight: '500', color: '#6b7280' },
  summaryApprox: { fontSize: 24, color: '#d1d5db', marginHorizontal: 4 },
  summaryDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },

  truckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  truckRowSelected: { backgroundColor: '#f9fafb' },
  truckInfo: { flex: 1 },
  truckLabel: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  truckLabelSelected: { color: '#111827' },
  truckSublabel: { fontSize: 13, color: '#9ca3af', marginTop: 1 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#111827' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 4,
  },
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
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnHazardous: { backgroundColor: '#b91c1c' },
  nextText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  nextTextHazardous: { color: '#fff' },
});
