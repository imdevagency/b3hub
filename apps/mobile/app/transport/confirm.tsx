import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTransport } from '@/lib/transport-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { MapPin, Truck, Weight, ArrowRight, CheckCircle } from 'lucide-react-native';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VEHICLE_CONFIG: Record<string, { label: string; capacity: number }> = {
  TIPPER_SMALL: { label: 'Pašizgāzējs (10 t)', capacity: 10 },
  TIPPER_LARGE: { label: 'Pašizgāzējs lielais (18 t)', capacity: 18 },
  ARTICULATED_TIPPER: { label: 'Sattelkipper (26 t)', capacity: 26 },
};

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('lv-LV', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function toIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TransportStep4Confirm() {
  const router = useRouter();
  const { state, setRequestedDate, reset } = useTransport();
  const { token } = useAuth();

  const minDate = tomorrow();
  const [date, setDate] = useState<Date>(minDate);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [jobNumber, setJobNumber] = useState<string>('');

  const vehicle = state.vehicleType
    ? (VEHICLE_CONFIG[state.vehicleType] ?? VEHICLE_CONFIG.TIPPER_LARGE)
    : VEHICLE_CONFIG.TIPPER_LARGE;

  const handleSubmit = async () => {
    if (!state.vehicleType) {
      Alert.alert('Kļūda', 'Lūdzu, izvēlieties transportlīdzekli.');
      return;
    }
    if (!state.loadDescription) {
      Alert.alert('Kļūda', 'Lūdzu, aprakstiet kravu.');
      return;
    }
    setRequestedDate(toIso(date));
    setLoading(true);
    try {
      const result = await api.transport.create(
        {
          pickupAddress: state.pickupAddress,
          pickupCity: state.pickupCity,
          pickupLat: state.pickupLat ?? undefined,
          pickupLng: state.pickupLng ?? undefined,
          dropoffAddress: state.dropoffAddress,
          dropoffCity: state.dropoffCity,
          dropoffLat: state.dropoffLat ?? undefined,
          dropoffLng: state.dropoffLng ?? undefined,
          vehicleType: state.vehicleType,
          loadDescription: state.loadDescription,
          estimatedWeight: state.estimatedWeight ?? undefined,
          requestedDate: toIso(date),
        },
        token!,
      );
      reset();
      setJobNumber(result?.jobNumber ?? '—');
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Kļūda', err?.message ?? 'Neizdevās nosūtīt pieprasījumu. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <ScreenContainer standalone bg="#111827">
        <View style={s.successScreen}>
          <View style={s.successCircle}>
            <CheckCircle size={56} color="#fff" strokeWidth={1.5} />
          </View>
          <Text style={s.successTitle}>Pieprasījums nosūtīts!</Text>
          <Text style={s.successDesc}>
            Jūsu transporta pieprasījums{`\n`}ir reģistrēts.
          </Text>
          {!!jobNumber && (
            <View style={s.jobNumBadge}>
              <Text style={s.jobNumLabel}>Numurs</Text>
              <Text style={s.jobNumValue}>{jobNumber}</Text>
            </View>
          )}
          <Text style={s.successHint}>
            Piemērots vadītājs tiks piešķirts{`\n`}un Jūs saņemsiet paziņojumu.
          </Text>
          <TouchableOpacity
            style={s.successBtn}
            onPress={() => router.replace('/(buyer)/orders')}
            activeOpacity={0.85}
          >
            <Text style={s.successBtnText}>Skatīt pasūtījumus →</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer standalone bg="#fff">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Apstiprināt pieprasījumu</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '100%' }]} />
        </View>
        <Text style={s.progressLabel}>Solis 4 / 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.stepNum}>04</Text>
        <Text style={s.stepTitle}>Kad braukt?</Text>
        <Text style={s.stepSubtitle}>
          Izvēlieties vēlamo transporta datumu un pārbaudiet kopsavilkumu.
        </Text>

        {/* ── Date picker strip ── */}
        <Text style={s.sectionTitle}>Vēlamais datums</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.datePicker}
          style={{ marginBottom: 20 }}
        >
          {Array.from({ length: 14 }, (_, i) => {
            const d = new Date(minDate);
            d.setDate(minDate.getDate() + i);
            const isSelected = toIso(d) === toIso(date);
            const dayName = d.toLocaleDateString('lv-LV', { weekday: 'short' });
            const dayNum = d.getDate();
            const mon = d.toLocaleDateString('lv-LV', { month: 'short' });
            return (
              <TouchableOpacity
                key={i}
                style={[s.dayChip, isSelected && s.dayChipActive]}
                onPress={() => setDate(d)}
                activeOpacity={0.75}
              >
                <Text style={[s.dayChipName, isSelected && s.dayChipNameActive]}>{dayName}</Text>
                <Text style={[s.dayChipNum, isSelected && s.dayChipNumActive]}>{dayNum}</Text>
                <Text style={[s.dayChipMon, isSelected && s.dayChipMonActive]}>{mon}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Summary card ── */}
        <Text style={s.sectionTitle}>Kopsavilkums</Text>
        <View style={s.summaryCard}>
          {/* Pickup */}
          <View style={s.row}>
            <MapPin size={16} color="#22c55e" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Iekraušana</Text>
              <Text style={s.rowValue}>{state.pickupAddress || '—'}</Text>
            </View>
          </View>
          <View style={s.divider} />

          {/* Route arrow */}
          <View style={s.routeArrow}>
            <ArrowRight size={14} color="#9ca3af" />
          </View>

          {/* Dropoff */}
          <View style={s.row}>
            <MapPin size={16} color="#ef4444" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Izkraušana</Text>
              <Text style={s.rowValue}>{state.dropoffAddress || '—'}</Text>
            </View>
          </View>
          <View style={s.divider} />

          {/* Vehicle */}
          <View style={s.row}>
            <Truck size={16} color="#6b7280" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Transportlīdzeklis</Text>
              <Text style={s.rowValue}>{vehicle.label}</Text>
            </View>
          </View>
          <View style={s.divider} />

          {/* Load */}
          <View style={s.row}>
            <Weight size={16} color="#6b7280" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Krava</Text>
              <Text style={s.rowValue}>
                {state.loadDescription || '—'}
                {state.estimatedWeight ? ` · ${state.estimatedWeight} t` : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, loading && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Nosūtīt pieprasījumu</Text>
          )}
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
  backIcon: { fontSize: 20, color: '#374151', lineHeight: 22 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  progressWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  progressTrack: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#111827', borderRadius: 2 },
  progressLabel: { marginTop: 6, fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  stepNum: { fontSize: 64, fontWeight: '800', color: '#f3f4f6', lineHeight: 68, marginBottom: 8 },
  stepTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#6b7280', marginBottom: 28 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  datePicker: { paddingRight: 8, gap: 8, flexDirection: 'row', paddingBottom: 4 },
  dayChip: {
    width: 58,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  dayChipName: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginBottom: 4 },
  dayChipNameActive: { color: 'rgba(255,255,255,0.7)' },
  dayChipNum: { fontSize: 20, fontWeight: '800', color: '#111827', lineHeight: 24 },
  dayChipNumActive: { color: '#fff' },
  dayChipMon: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  dayChipMonActive: { color: 'rgba(255,255,255,0.6)' },
  // Summary card
  summaryCard: {
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    marginBottom: 20,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: '500', color: '#111827', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },
  routeArrow: { alignItems: 'center', paddingVertical: 2 },
  footer: { padding: 24 },
  submitBtn: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#9ca3af' },
  submitText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Success screen
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  successDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  jobNumBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  jobNumLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4, letterSpacing: 0.8 },
  jobNumValue: { fontSize: 20, fontWeight: '700', color: '#fff' },
  successHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  successBtn: {
    backgroundColor: '#fff',
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  successBtnText: { fontSize: 16, fontWeight: '700', color: '#111827' },
});
