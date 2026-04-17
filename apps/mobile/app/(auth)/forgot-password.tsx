import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Mail, CheckCircle } from 'lucide-react-native';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.forgotPassword(email.trim());
      haptics.success();
      setDone(true);
      if (res._devResetUrl) setDevUrl(res._devResetUrl);
    } catch (err) {
      haptics.error();
      setError(err instanceof Error ? err.message : 'Kļūda. Mēģiniet vēlreiz.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer standalone bg="#fff" topInset={0}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={22} color="#374151" />
          </TouchableOpacity>

          {!done ? (
            <>
              {/* Header */}
              <View style={s.headerWrap}>
                <View style={s.iconBox}>
                  <Mail size={28} color="#dc2626" />
                </View>
                <Text style={s.title}>Atjaunot paroli</Text>
                <Text style={s.subtitle}>
                  Ievadiet e-pastu, uz kuru nosūtīsim paroles atjaunošanas saiti
                </Text>
              </View>

              {error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              {/* Email field */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>E-pasts</Text>
                <TextInput
                  style={[s.input, !!error && s.inputError]}
                  placeholder="janis@uznemums.lv"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  maxLength={100}
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="send"
                />
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, (!email.trim() || submitting) && s.primaryBtnDisabled]}
                onPress={handleSubmit}
                disabled={!email.trim() || submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryBtnText}>Nosūtīt atjaunošanas saiti</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Success state */}
              <View style={s.successWrap}>
                <View style={s.successIcon}>
                  <CheckCircle size={40} color="#16a34a" />
                </View>
                <Text style={s.successTitle}>Pārbaudiet e-pastu</Text>
                <Text style={s.successSubtitle}>
                  Ja konts ar e-pastu <Text style={{ fontWeight: '700' }}>{email}</Text> eksistē,
                  mēs esam nosūtījuši paroles atjaunošanas saiti.
                </Text>

                {/* Dev helper — direct reset link (dev builds only) */}
                {__DEV__ && devUrl && (
                  <View style={s.devBox}>
                    <Text style={s.devLabel}>Dev mode · Reset link</Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL('http://localhost:3001' + devUrl)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.devLink}>{'http://localhost:3001' + devUrl}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.8}
              >
                <Text style={s.primaryBtnText}>Atpakaļ uz pieteikšanos</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  headerWrap: { alignItems: 'center', marginBottom: 32 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  errorText: { color: colors.dangerText, fontSize: 14 },
  fieldWrap: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#f87171' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: { backgroundColor: '#9ca3af' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  successWrap: { alignItems: 'center', marginBottom: 32 },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  successSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  devBox: {
    marginTop: 24,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    width: '100%',
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  devLink: { fontSize: 13, color: '#2563eb', textDecorationLine: 'underline' },
});
