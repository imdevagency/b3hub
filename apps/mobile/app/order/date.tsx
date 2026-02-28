import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useOrder } from '@/lib/order-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';

const SKIP_PRICES: Record<string, number> = {
  MINI: 89,
  MIDI: 129,
  BUILDERS: 169,
  LARGE: 199,
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Step4Date() {
  const router = useRouter();
  const { state, setDeliveryDate, setConfirmedOrder } = useOrder();
  const { token } = useAuth();

  const today = new Date();
  const QUICK_DATES = [
    { label: t.skipHire.step4.quick.tomorrow, iso: toISO(addDays(today, 1)) },
    { label: t.skipHire.step4.quick.in2days, iso: toISO(addDays(today, 2)) },
    { label: t.skipHire.step4.quick.in3days, iso: toISO(addDays(today, 3)) },
    { label: t.skipHire.step4.quick.nextWeek, iso: toISO(addDays(today, 7)) },
  ];

  const [selectedDate, setSelectedDate] = useState<string>(
    state.deliveryDate || QUICK_DATES[0].iso,
  );
  const [submitting, setSubmitting] = useState(false);

  const price = SKIP_PRICES[state.skipSize ?? 'MIDI'] ?? 129;

  const handleSubmit = async () => {
    if (!state.location || !state.wasteCategory || !state.skipSize || !selectedDate) return;
    setSubmitting(true);
    setDeliveryDate(selectedDate);
    try {
      const order = await api.skipHire.create(
        {
          location: state.location,
          wasteCategory: state.wasteCategory,
          skipSize: state.skipSize,
          deliveryDate: selectedDate,
        },
        token ?? undefined,
      );
      setConfirmedOrder(order);
      router.push('/order/confirmation');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.skipHire.error;
      Alert.alert(t.skipHire.errorTitle, msg);
    } finally {
      setSubmitting(false);
    }
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

      {/* Progress — 100% on final step */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: '100%' }]} />
        </View>
        <Text style={s.progressLabel}>{t.skipHire.step} 4 / 4</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.stepNum}>04</Text>
        <Text style={s.stepTitle}>{t.skipHire.step4.title}</Text>
        <Text style={s.stepSubtitle}>{t.skipHire.step4.subtitle}</Text>

        {/* Quick date selection */}
        <View style={s.quickGrid}>
          {QUICK_DATES.map((d) => (
            <TouchableOpacity
              key={d.iso}
              style={[s.quickBtn, selectedDate === d.iso && s.quickBtnSelected]}
              onPress={() => setSelectedDate(d.iso)}
              activeOpacity={0.7}
            >
              <Text style={[s.quickText, selectedDate === d.iso && s.quickTextSelected]}>
                {d.label}
              </Text>
              <Text style={[s.quickDate, selectedDate === d.iso && s.quickDateSelected]}>
                {formatDisplay(d.iso)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Order summary */}
        <Text style={s.summaryTitle}>{t.skipHire.step4.summary}</Text>
        <View style={s.summaryCard}>
          {[
            {
              label: '📍 ' + t.skipHire.confirmation.location,
              value: state.location,
            },
            {
              label: '🗂️ ' + t.skipHire.confirmation.wasteType,
              value: state.wasteCategory ? t.skipHire.step2.types[state.wasteCategory]?.label : '—',
            },
            {
              label: '📦 ' + t.skipHire.confirmation.size,
              value: state.skipSize
                ? `${t.skipHire.step3.sizes[state.skipSize]?.label} (${t.skipHire.step3.sizes[state.skipSize]?.volume})`
                : '—',
            },
            {
              label: '📅 ' + t.skipHire.confirmation.deliveryDate,
              value: formatDisplay(selectedDate),
            },
            {
              label: '💰 ' + t.skipHire.confirmation.price,
              value: `€${price}`,
            },
          ].map((row, i) => (
            <View key={i} style={[s.summaryRow, i < 4 && s.summaryRowBorder]}>
              <Text style={s.summaryLabel}>{row.label}</Text>
              <Text style={s.summaryValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, submitting && s.submitBtnDisabled]}
          disabled={submitting}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>{t.skipHire.step4.placeOrder} →</Text>
          )}
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
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  quickBtn: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  quickBtnSelected: { borderColor: '#dc2626', backgroundColor: '#fff7f7' },
  quickText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  quickTextSelected: { color: '#dc2626' },
  quickDate: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  quickDateSelected: { color: '#dc2626' },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    maxWidth: '55%',
    textAlign: 'right',
  },
  footer: { padding: 24 },
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
