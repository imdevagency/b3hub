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
import { ChevronLeft, Eye, EyeOff, Phone } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Minimal Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Typographic Hero */}
          <Text style={s.heroTitle}>Sveiki atpakaļ</Text>
          <Text style={s.heroSubtitle}>Ievadiet savus datus, lai turpinātu.</Text>

          {/* Phone OTP — primary method */}
          <TouchableOpacity
            style={s.phonePrimaryBtn}
            onPress={() => router.push('/(auth)/phone-otp')}
            activeOpacity={0.85}
          >
            <Phone size={20} color="#fff" />
            <Text style={s.phonePrimaryBtnText}>Pieslēgties ar tālruņa numuru</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>vai ar e-pastu</Text>
            <View style={s.dividerLine} />
          </View>

          {apiError && (
            <View style={s.apiErrBox}>
              <Text style={s.apiErrText}>{apiError}</Text>
              <TouchableOpacity
                onPress={() => setApiError(null)}
                hitSlop={8}
                accessibilityLabel="Aizvērt kļūdu"
                accessibilityRole="button"
              >
                <Text style={s.apiErrDismiss}>×</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Email Input */}
          <View style={s.fieldWrap}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  style={[s.softInput, errors.email && s.inputErr]}
                  placeholder="E-pasta adrese"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  maxLength={100}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.email && <Text style={s.err}>{errors.email.message}</Text>}
          </View>

          {/* Password Input */}
          <View style={s.fieldWrap}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <View style={[s.softInputRow, errors.password && s.inputErr]}>
                  <TextInput
                    style={s.inputFlex}
                    placeholder="Parole"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPw}
                    maxLength={100}
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
                      <EyeOff size={20} color="#9ca3af" />
                    ) : (
                      <Eye size={20} color="#9ca3af" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && <Text style={s.err}>{errors.password.message}</Text>}
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            activeOpacity={0.7}
            style={s.forgotWrap}
          >
            <Text style={s.forgotText}>Aizmirsāt paroli?</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Anchored Bottom Action */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <TouchableOpacity
            style={[s.primaryBtn, isSubmitting && s.primaryBtnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>Pierakstīties</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },

  // Hero
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 24,
    fontFamily: 'Inter_400Regular',
  },

  // Phone primary button
  phonePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F9423A',
    height: 56,
    borderRadius: 28,
    marginBottom: 20,
  },
  phonePrimaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },

  // Fields and Soft Inputs
  fieldWrap: {
    marginBottom: 16,
  },
  softInput: {
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 56,
    fontSize: 16,
    color: '#000',
    fontFamily: 'Inter_400Regular',
  },
  softInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    height: 56,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: 18,
    height: '100%',
    fontSize: 16,
    color: '#000',
    fontFamily: 'Inter_400Regular',
  },
  eyeBtn: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
  },
  inputErr: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  err: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },

  forgotWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  forgotText: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },

  // API Err
  apiErrBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  apiErrText: {
    color: colors.dangerText,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  apiErrDismiss: {
    color: colors.dangerText,
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    paddingLeft: 4,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#F9423A',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
