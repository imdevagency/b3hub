import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useOrder } from '@/lib/order-context';
import { t } from '@/lib/translations';
import { X, MapPin, ChevronRight } from 'lucide-react-native';
import { AddressPicker } from '@/components/ui/AddressPicker';

export default function Step1Location() {
  const router = useRouter();
  const { state, setLocationWithCoords } = useOrder();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isValid = state.location.trim().length >= 3;

  const handleNext = () => {
    if (!isValid) return;
    router.push('/order/waste-type');
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <X size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t.skipHire.title}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress */}
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: '25%' }]} />
          </View>
          <Text style={s.progressLabel}>{t.skipHire.step} 1 / 4</Text>
        </View>

        <View style={s.body}>
          <Text style={s.stepNum}>01</Text>
          <Text style={s.stepTitle}>{t.skipHire.step1.title}</Text>
          <Text style={s.stepSubtitle}>{t.skipHire.step1.subtitle}</Text>

          {/* Tap-to-open address picker */}
          <TouchableOpacity
            style={[s.locationRow, isValid && s.locationRowValid]}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}
          >
            <MapPin size={18} color={isValid ? '#dc2626' : '#9ca3af'} />
            <Text style={[s.locationText, !isValid && s.locationPlaceholder]} numberOfLines={2}>
              {isValid ? state.location : t.skipHire.step1.placeholder}
            </Text>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>

          {isValid && state.locationLat != null && (
            <Text style={s.coordsHint}>
              {state.locationLat.toFixed(5)}, {state.locationLng?.toFixed(5)}
            </Text>
          )}
        </View>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.nextBtn, !isValid && s.nextBtnDisabled]}
            disabled={!isValid}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={[s.nextText, !isValid && s.nextTextDisabled]}>
              {t.skipHire.step1.next} →
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Full-screen address picker modal */}
      <AddressPicker
        visible={pickerOpen}
        title={t.skipHire.step1.title}
        initialAddress={state.location}
        initialLat={state.locationLat ?? undefined}
        initialLng={state.locationLng ?? undefined}
        pinColor="#dc2626"
        onConfirm={({ address, lat, lng }) => {
          setLocationWithCoords(address, lat, lng);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
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
  progressTrack: {
    height: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#dc2626', borderRadius: 2 },
  progressLabel: { marginTop: 6, fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  stepNum: {
    fontSize: 64,
    fontWeight: '800',
    color: '#fef2f2',
    lineHeight: 68,
    marginBottom: 8,
  },
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
  locationRowValid: {
    borderColor: '#dc2626',
    backgroundColor: '#fff',
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  locationPlaceholder: {
    color: '#9ca3af',
  },
  coordsHint: {
    marginTop: 6,
    fontSize: 11,
    color: '#9ca3af',
    paddingLeft: 4,
  },
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
