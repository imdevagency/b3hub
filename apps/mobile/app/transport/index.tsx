import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTransport } from '@/lib/transport-context';
import { MapPin, ChevronRight, X } from 'lucide-react-native';
import { AddressPicker } from '@/components/ui/AddressPicker';

export default function TransportStep1Pickup() {
  const router = useRouter();
  const { state, setPickup } = useTransport();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isValid = state.pickupAddress.trim().length >= 3;

  return (
    <ScreenContainer standalone bg="#fff">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <X size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Transporta pasūtījums</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress */}
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: '25%' }]} />
          </View>
          <Text style={s.progressLabel}>Solis 1 / 4</Text>
        </View>

        <View style={s.body}>
          <Text style={s.stepNum}>01</Text>
          <Text style={s.stepTitle}>Kur ielādēt?</Text>
          <Text style={s.stepSubtitle}>
            Norādiet iekraušanas adresi — no kurienes jāpārvadā krava.
          </Text>

          <TouchableOpacity
            style={[s.locationRow, isValid && s.locationRowValid]}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}
          >
            <MapPin size={18} color={isValid ? '#111827' : '#9ca3af'} />
            <Text style={[s.locationText, !isValid && s.locationPlaceholder]} numberOfLines={2}>
              {isValid ? state.pickupAddress : 'Meklēt iekraušanas adresi...'}
            </Text>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>

          {isValid && state.pickupLat != null && (
            <Text style={s.coordsHint}>
              {state.pickupLat.toFixed(5)}, {state.pickupLng?.toFixed(5)}
            </Text>
          )}
        </View>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.nextBtn, !isValid && s.nextBtnDisabled]}
            disabled={!isValid}
            onPress={() => router.push('/transport/dropoff')}
            activeOpacity={0.8}
          >
            <Text style={[s.nextText, !isValid && s.nextTextDisabled]}>Turpināt →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AddressPicker
        visible={pickerOpen}
        title="Iekraušanas adrese"
        initialAddress={state.pickupAddress}
        initialLat={state.pickupLat ?? undefined}
        initialLng={state.pickupLng ?? undefined}
        pinColor="#111827"
        onConfirm={({ address, lat, lng }) => {
          const cityPart = address.split(',').slice(-2, -1)[0]?.trim() ?? '';
          setPickup(address, cityPart, lat, lng);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
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
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  stepNum: { fontSize: 64, fontWeight: '800', color: '#f3f4f6', lineHeight: 68, marginBottom: 8 },
  stepTitle: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  locationRowValid: { borderColor: '#111827', backgroundColor: '#fff' },
  locationText: { flex: 1, fontSize: 15, color: '#111827', lineHeight: 20 },
  locationPlaceholder: { color: '#9ca3af' },
  coordsHint: { marginTop: 6, fontSize: 11, color: '#d1d5db', paddingLeft: 4 },
  footer: { padding: 24 },
  nextBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#f3f4f6' },
  nextText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  nextTextDisabled: { color: '#9ca3af' },
});
