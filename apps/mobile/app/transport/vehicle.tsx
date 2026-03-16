import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTransport } from '@/lib/transport-context';
import type { TransportVehicleType } from '@/lib/api';
import { Truck, Check, ArrowLeft } from 'lucide-react-native';

interface VehicleOption {
  id: TransportVehicleType;
  label: string;
  capacity: string;
  desc: string;
}

const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    id: 'TIPPER_SMALL',
    label: 'Pašizgāzējs',
    capacity: '10 t / 8 m³',
    desc: 'Piemērots nelieliem transporta darbiem',
  },
  {
    id: 'TIPPER_LARGE',
    label: 'Pašizgāzējs lielais',
    capacity: '18 t / 12 m³',
    desc: 'Standarta kravas transportam',
  },
  {
    id: 'ARTICULATED_TIPPER',
    label: 'Sattelkipper',
    capacity: '26 t / 18 m³',
    desc: 'Lielu apjomu kravas pārvadāšanai',
  },
];

export default function TransportStep3Vehicle() {
  const router = useRouter();
  const { state, setVehicleType, setLoadDescription, setEstimatedWeight } = useTransport();

  const [selectedVehicle, setSelectedVehicle] = useState<TransportVehicleType | null>(
    state.vehicleType,
  );
  const [desc, setDesc] = useState(state.loadDescription);
  const [weight, setWeight] = useState(
    state.estimatedWeight != null ? String(state.estimatedWeight) : '',
  );

  const isValid = selectedVehicle !== null && desc.trim().length >= 3;

  const handleNext = () => {
    if (!selectedVehicle) return;
    setVehicleType(selectedVehicle);
    setLoadDescription(desc.trim());
    const w = parseFloat(weight);
    setEstimatedWeight(isNaN(w) || w <= 0 ? null : w);
    router.push('/transport/confirm');
  };

  return (
    <ScreenContainer standalone bg="#fff">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Transporta pasūtījums</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress */}
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: '75%' }]} />
          </View>
          <Text style={s.progressLabel}>Solis 3 / 4</Text>
        </View>

        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.stepNum}>03</Text>
          <Text style={s.stepTitle}>Transportlīdzeklis</Text>
          <Text style={s.stepSubtitle}>Izvēlieties piemēroto kravas auto un aprakstiet kravu.</Text>

          {/* Vehicle cards */}
          {VEHICLE_OPTIONS.map((opt) => {
            const isSelected = selectedVehicle === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[s.vehicleCard, isSelected && s.vehicleCardSelected]}
                onPress={() => setSelectedVehicle(opt.id)}
                activeOpacity={0.7}
              >
                <View style={s.vehicleCardLeft}>
                  <Truck size={24} color={isSelected ? '#111827' : '#6b7280'} />
                </View>
                <View style={s.vehicleCardBody}>
                  <Text style={[s.vehicleLabel, isSelected && s.vehicleLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={s.vehicleCapacity}>{opt.capacity}</Text>
                  <Text style={s.vehicleDesc}>{opt.desc}</Text>
                </View>
                {isSelected && (
                  <View style={s.checkBadge}>
                    <Check size={14} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Load description */}
          <Text style={s.fieldLabel}>Kravas apraksts *</Text>
          <TextInput
            style={[s.textArea, desc.trim().length >= 3 && s.textAreaFilled]}
            placeholder="Piemēram: smiltis, granti, būvmateriāli, aprīkojums..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            value={desc}
            onChangeText={setDesc}
            textAlignVertical="top"
          />

          {/* Estimated weight (optional) */}
          <Text style={s.fieldLabel}>
            Aptuvens svars, t <Text style={s.optional}>(neobligāti)</Text>
          </Text>
          <TextInput
            style={s.weightInput}
            placeholder="Piemēram: 12"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
          />

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.nextBtn, !isValid && s.nextBtnDisabled]}
            disabled={!isValid}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={[s.nextText, !isValid && s.nextTextDisabled]}>Turpināt →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  stepNum: { fontSize: 64, fontWeight: '800', color: '#f3f4f6', lineHeight: 68, marginBottom: 8 },
  stepTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  // Vehicle cards
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f3f4f6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    gap: 12,
    position: 'relative',
  },
  vehicleCardSelected: { borderColor: '#111827', backgroundColor: '#fff' },
  vehicleCardLeft: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleCardBody: { flex: 1 },
  vehicleLabel: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 2 },
  vehicleLabelSelected: { color: '#111827' },
  vehicleCapacity: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 2 },
  vehicleDesc: { fontSize: 12, color: '#9ca3af' },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fields
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 20, marginBottom: 8 },
  optional: { fontSize: 13, fontWeight: '400', color: '#9ca3af' },
  textArea: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
    minHeight: 80,
  },
  textAreaFilled: { borderColor: '#111827', backgroundColor: '#fff' },
  weightInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
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
