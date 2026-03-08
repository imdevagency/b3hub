import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { t } from '@/lib/translations';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';

type UserType = 'BUYER' | 'SUPPLIER' | 'CARRIER';

const USER_TYPES: { value: UserType; label: string; emoji: string }[] = [
  { value: 'BUYER', label: t.register.userTypes.BUYER, emoji: '🛎️' },
  { value: 'SUPPLIER', label: t.register.userTypes.SUPPLIER, emoji: '📦' },
  { value: 'CARRIER', label: t.register.userTypes.CARRIER, emoji: '🚛' },
];

const ACCOUNT_KINDS = [
  {
    value: true,
    label: t.register.accountKindCompany,
    desc: t.register.accountKindCompanyDesc,
    emoji: '🏢',
  },
  {
    value: false,
    label: t.register.accountKindPrivate,
    desc: t.register.accountKindPrivateDesc,
    emoji: '👤',
  },
];

const schema = z
  .object({
    firstName: z.string().min(2, t.register.validation.firstNameShort),
    lastName: z.string().min(2, t.register.validation.lastNameShort),
    email: z.string().email(t.register.validation.invalidEmail),
    phone: z.string().optional(),
    userType: z.enum(['BUYER', 'SUPPLIER', 'CARRIER'] as const),
    isCompany: z.boolean().optional(),
    password: z.string().min(8, t.register.validation.passwordMin),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: t.register.validation.passwordsMismatch,
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      userType: 'BUYER',
      isCompany: true,
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      const { confirmPassword: _c, ...payload } = data;
      const res = await api.register(payload);
      await setAuth(res.user, res.token);
      router.replace('/');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t.register.failed);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={22} color="#374151" />
          </TouchableOpacity>

          <Text style={s.title}>{t.register.title}</Text>
          <Text style={s.subtitle}>
            {t.register.alreadyHaveOne}{' '}
            <Text style={s.link} onPress={() => router.replace('/(auth)/login')}>
              {t.register.signIn}
            </Text>
          </Text>

          {apiError && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{apiError}</Text>
            </View>
          )}

          {/* Name row */}
          <View style={s.row}>
            <View style={[s.fieldWrap, { flex: 1 }]}>
              <Text style={s.label}>{t.register.firstName}</Text>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={[s.input, errors.firstName ? s.inputError : null]}
                    placeholder={t.register.firstNamePlaceholder}
                    placeholderTextColor="#9ca3af"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              {errors.firstName && <Text style={s.fieldError}>{errors.firstName.message}</Text>}
            </View>
            <View style={[s.fieldWrap, { flex: 1 }]}>
              <Text style={s.label}>{t.register.lastName}</Text>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={[s.input, errors.lastName ? s.inputError : null]}
                    placeholder={t.register.lastNamePlaceholder}
                    placeholderTextColor="#9ca3af"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              {errors.lastName && <Text style={s.fieldError}>{errors.lastName.message}</Text>}
            </View>
          </View>

          {/* Email */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.register.email}</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  style={[s.input, errors.email ? s.inputError : null]}
                  placeholder={t.register.emailPlaceholder}
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.email && <Text style={s.fieldError}>{errors.email.message}</Text>}
          </View>

          {/* Phone */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.register.phone}</Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  style={s.input}
                  placeholder={t.register.phonePlaceholder}
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
          </View>

          {/* Account type */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.register.accountType}</Text>
            <Controller
              control={control}
              name="userType"
              render={({ field: { onChange, value } }) => (
                <View style={s.typeGrid}>
                  {USER_TYPES.map((ut) => (
                    <TouchableOpacity
                      key={ut.value}
                      style={[s.typeBtn, value === ut.value ? s.typeBtnActive : null]}
                      onPress={() => onChange(ut.value)}
                    >
                      <Text style={s.typeEmoji}>{ut.emoji}</Text>
                      <Text style={[s.typeLabel, value === ut.value ? s.typeLabelActive : null]}>
                        {ut.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>

          {/* isCompany toggle — shown only for BUYER */}
          {watch('userType') === 'BUYER' && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>{t.register.accountKind}</Text>
              <Controller
                control={control}
                name="isCompany"
                render={({ field: { onChange, value } }) => (
                  <View style={s.typeGrid}>
                    {ACCOUNT_KINDS.map((k) => (
                      <TouchableOpacity
                        key={String(k.value)}
                        style={[s.typeBtn, value === k.value ? s.typeBtnActive : null]}
                        onPress={() => onChange(k.value)}
                      >
                        <Text style={s.typeEmoji}>{k.emoji}</Text>
                        <Text style={[s.typeLabel, value === k.value ? s.typeLabelActive : null]}>
                          {k.label}
                        </Text>
                        <Text style={s.typeDesc}>{k.desc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
            </View>
          )}

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.register.password}</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <View style={[s.inputRow, errors.password ? s.inputRowError : null]}>
                  <TextInput
                    style={s.inputFlex}
                    placeholder={t.register.passwordPlaceholder}
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPw}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                    {showPw ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && <Text style={s.fieldError}>{errors.password.message}</Text>}
          </View>

          {/* Confirm password */}
          <View style={[s.fieldWrap, { marginBottom: 24 }]}>
            <Text style={s.label}>{t.register.confirmPassword}</Text>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, value, onBlur } }) => (
                <View style={[s.inputRow, errors.confirmPassword ? s.inputRowError : null]}>
                  <TextInput
                    style={s.inputFlex}
                    placeholder={t.register.confirmPasswordPlaceholder}
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showConfirmPw}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirmPw((v) => !v)} hitSlop={8}>
                    {showConfirmPw ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.confirmPassword && (
              <Text style={s.fieldError}>{errors.confirmPassword.message}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, isSubmitting ? s.primaryBtnDisabled : null]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>{t.register.createAccount}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  link: { color: '#dc2626', fontWeight: '600' },
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
  row: { flexDirection: 'row', gap: 12 },
  fieldWrap: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    minWidth: '45%',
    flex: 1,
  },
  typeBtnActive: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  typeLabelActive: { color: '#b91c1c' },
  typeDesc: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 2 },
  primaryBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#f87171' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
