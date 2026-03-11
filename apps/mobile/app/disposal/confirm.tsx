import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useDisposal } from '@/lib/disposal-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { MapPin, Truck, Trash2, Calendar, Weight } from 'lucide-react-native';

// ── Helpers ───────────────────────────────────────────────────────────────────
const TRUCK_CONFIG: Record<string, { label: string; capacity: number; volume: number }> = {
  TIPPER_SMALL: { label: 'Pašizgāzējs (10 t)', capacity: 10, volume: 8 },
  TIPPER_LARGE: { label: 'Pašizgāzējs lielais (18 t)', capacity: 18, volume: 12 },
  ARTICULATED_TIPPER: { label: 'Sattelkipper (26 t)', capacity: 26, volume: 18 },
};

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
export default function DisposalStep4Confirm() {
  const router = useRouter();
  const { state, setRequestedDate, reset } = useDisposal();
  const { token } = useAuth();

  const minDate = tomorrow();
  const [date, setDate] = useState<Date>(minDate);
  const [loading, setLoading] = useState(false);

  const truck = TRUCK_CONFIG[state.truckType] ?? TRUCK_CONFIG.TIPPER_LARGE;
  const totalTonnes = truck.capacity * state.truckCount;
  const totalVolume = truck.volume * state.truckCount;

  // ── Simple date stepper (no native picker needed) ─────────────────────────
  const addDays = (n: number) => {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + n);
      return next < minDate ? minDate : next;
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!state.wasteType) {
      Alert.alert('Kļūda', 'Lūdzu, izvēlieties atkritumu veidu.');
      return;
    }
    setRequestedDate(toIso(date));
    setLoading(true);
    try {
      const result = await api.disposal.create(
        {
          pickupAddress: state.location,
          pickupCity: state.locationCity,
          pickupLat: state.locationLat ?? undefined,
          pickupLng: state.locationLng ?? undefined,
          wasteType: state.wasteType,
          truckType: state.truckType,
          truckCount: state.truckCount,
          estimatedWeight: totalTonnes,
          description: state.description || undefined,
          requestedDate: toIso(date),
        },
        token!,
      );
      reset();
      Alert.alert(
        'Pieprasījums nosūtīts! ✓',
        `Jūsu atkritumu savākšanas pieprasījums ir reģistrēts.\nNumurs: ${result?.jobNumber ?? '—'}`,
        [{ text: 'Labi', onPress: () => router.replace('/(buyer)/orders') }],
      );
    } catch (err: any) {
      Alert.alert('Kļūda', err?.message ?? 'Neizdevās nosūtīt pieprasījumu. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
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
          Izvēlieties vēlamo savākšanas datumu un pārbaudiet kopsavilkumu.
        </Text>

        {/* ── Date picker card ── */}
        <Text style={s.sectionTitle}>Vēlamais datums</Text>
        <View style={s.card}>
          <View style={s.dateRow}>
            <TouchableOpacity
              style={[s.dateStepBtn, date <= minDate && s.dateStepDisabled]}
              onPress={() => addDays(-1)}
              disabled={date <= minDate}
            >
              <Text style={[s.dateStepIcon, date <= minDate && { color: '#d1d5db' }]}>‹</Text>
            </TouchableOpacity>
            <View style={s.dateCenter}>
              <Calendar size={16} color="#6b7280" />
              <Text style={s.dateText}>{formatDate(date)}</Text>
            </View>
            <TouchableOpacity style={s.dateStepBtn} onPress={() => addDays(1)}>
              <Text style={s.dateStepIcon}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Summary card ── */}
        <Text style={s.sectionTitle}>Kopsavilkums</Text>
        <View style={s.summaryCard}>
          {/* Location */}
          <View style={s.row}>
            <MapPin size={16} color="#6b7280" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Adrese</Text>
              <Text style={s.rowValue}>{state.location || '—'}</Text>
            </View>
          </View>
          <View style={s.divider} />

          {/* Waste type */}
          <View style={s.row}>
            <Trash2 size={16} color="#6b7280" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Atkritumu veids</Text>
              <Text style={s.rowValue}>
                {state.wasteType ? WASTE_LABELS[state.wasteType] : '—'}
              </Text>
            </View>
          </View>
          <View style={s.divider} />

          {/* Truck */}
          <View style={s.row}>
            <Truck size={16} color="#6b7280" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Transports</Text>
              <Text style={s.rowValue}>
                {state.truckCount} × {truck.label}
              </Text>
            </View>
          </View>
          <View style={s.divider} />

          {/* Weight */}
          <View style={s.row}>
            <Weight size={16} color="#6b7280" />
            <View style={s.rowContent}>
              <Text style={s.rowLabel}>Apjoms</Text>
              <Text style={s.rowValue}>
                {totalTonnes} t ≈ {totalVolume} m³
              </Text>
            </View>
          </View>

          {/* Description */}
          {!!state.description && (
            <>
              <View style={s.divider} />
              <View style={s.row}>
                <View style={{ width: 16 }} />
                <View style={s.rowContent}>
                  <Text style={s.rowLabel}>Apraksts</Text>
                  <Text style={s.rowValue}>{state.description}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Info note ── */}
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Pēc pieprasījuma iesniegšanas, piemērots pārvadātājs tiks automātiski meklēts jūsu
            rajonā. Jūs saņemsiet paziņojumu, kad tiks apstiprināts maršruts.
          </Text>
        </View>
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
            <Text style={s.submitText}>Iesniegt pieprasījumu</Text>
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
  dateRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  dateStepBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateStepDisabled: { opacity: 0.3 },
  dateStepIcon: { fontSize: 28, color: '#111827', lineHeight: 36 },
  dateCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  dateText: { fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'center' },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '500', color: '#111827' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },

  infoBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
    marginBottom: 20,
  },
  infoText: { fontSize: 13, color: '#6b7280', lineHeight: 19 },

  footer: { padding: 20 },
  submitBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
