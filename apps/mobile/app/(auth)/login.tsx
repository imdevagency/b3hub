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
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { t } from '@/lib/translations';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

const schema = z.object({
  email: z.string().email(t.login.validation.invalidEmail),
  password: z.string().min(1, t.login.validation.passwordRequired),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const insets = useSafeAreaInsets();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      const res = await api.login(data);
      await setAuth(res.user, res.token, res.refreshToken);
      haptics.success();
      router.replace('/');
    } catch (err) {
      haptics.error();
      setApiError(err instanceof Error ? err.message : t.login.failed);
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

          {/* Logo */}
          <View style={s.logoWrap}>
            <View style={s.logoBox}>
              <Text style={s.logoText}>B3</Text>
            </View>
            <Text style={s.title}>{t.login.title}</Text>
            <Text style={s.subtitle}>
              {t.login.noAccount}{' '}
              <Text style={s.link} onPress={() => router.replace('/(auth)/register')}>
                {t.login.signUp}
              </Text>
            </Text>
          </View>

          {apiError && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{apiError}</Text>
            </View>
          )}

          {/* Email */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.login.email}</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  style={[s.input, errors.email && s.inputError]}
                  placeholder={t.login.emailPlaceholder}
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.email && <Text style={s.fieldError}>{errors.email.message}</Text>}
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <View style={s.labelRow}>
              <Text style={s.label}>{t.login.password}</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
                <Text style={[s.link, { color: '#dc2626' }]}>{t.login.forgotPassword}</Text>
              </TouchableOpacity>
            </View>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <View style={[s.inputRow, errors.password && s.inputRowError]}>
                  <TextInput
                    style={s.inputFlex}
                    placeholder={t.login.passwordPlaceholder}
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPw}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  <TouchableOpacity
                    style={s.eyeBtn}
                    onPress={() => setShowPw((v) => !v)}
                    hitSlop={8}
                  >
                    {showPw ? (
                      <EyeOff size={18} color="#9ca3af" />
                    ) : (
                      <Eye size={18} color="#9ca3af" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && <Text style={s.fieldError}>{errors.password.message}</Text>}
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, isSubmitting && s.primaryBtnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>{t.login.signIn}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 0, paddingBottom: 40 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  inputRowError: { borderColor: '#f87171' },
  inputFlex: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 64,
    height: 64,
    backgroundColor: '#111827',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6 },
  link: { color: '#111827', fontWeight: '600' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  errorText: { color: '#b91c1c', fontSize: 14 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#f87171' },
  fieldError: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: { backgroundColor: '#f87171' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
