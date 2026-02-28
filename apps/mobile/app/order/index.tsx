import {
  View,
  Text,
  TextInput,
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

export default function Step1Location() {
  const router = useRouter();
  const { state, setLocation } = useOrder();
  const [value, setValue] = useState(state.location);
  const isValid = value.trim().length >= 3;

  const handleNext = () => {
    if (!isValid) return;
    setLocation(value.trim());
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
            <Text style={s.closeText}>✕</Text>
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

          <View style={[s.inputRow, isValid && s.inputRowValid]}>
            <Text style={s.inputIcon}>📍</Text>
            <TextInput
              style={s.input}
              placeholder={t.skipHire.step1.placeholder}
              placeholderTextColor="#9ca3af"
              value={value}
              onChangeText={setValue}
              returnKeyType="next"
              onSubmitEditing={handleNext}
              autoFocus
            />
          </View>

          {value.length > 0 && !isValid && (
            <Text style={s.errorText}>{t.skipHire.step1.error}</Text>
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
  closeText: { fontSize: 14, color: '#6b7280' },
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
  inputRow: {
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
  inputRowValid: { borderColor: '#dc2626', backgroundColor: '#fff' },
  inputIcon: { fontSize: 20 },
  input: { flex: 1, fontSize: 16, color: '#111827', padding: 0 },
  errorText: { marginTop: 8, fontSize: 13, color: '#dc2626' },
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
