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

type UserType = 'BUYER' | 'SUPPLIER' | 'CARRIER' | 'RECYCLER';

const USER_TYPES: { value: UserType; label: string }[] = [
  { value: 'BUYER', label: t.register.userTypes.BUYER },
  { value: 'SUPPLIER', label: t.register.userTypes.SUPPLIER },
  { value: 'CARRIER', label: t.register.userTypes.CARRIER },
  { value: 'RECYCLER', label: t.register.userTypes.RECYCLER },
];

const schema = z
  .object({
    firstName: z.string().min(2, t.register.validation.firstNameShort),
    lastName: z.string().min(2, t.register.validation.lastNameShort),
    email: z.string().email(t.register.validation.invalidEmail),
    phone: z.string().optional(),
    userType: z.enum(['BUYER', 'SUPPLIER', 'CARRIER', 'DRIVER', 'RECYCLER', 'ADMIN'] as const),
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

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      userType: 'BUYER',
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
      router.replace('/(tabs)/home');
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
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>{t.register.back}</Text>
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
                  {USER_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[s.typeBtn, value === t.value ? s.typeBtnActive : null]}
                      onPress={() => onChange(t.value)}
                    >
                      <Text style={[s.typeLabel, value === t.value ? s.typeLabelActive : null]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>{t.register.password}</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  style={[s.input, errors.password ? s.inputError : null]}
                  placeholder={t.register.passwordPlaceholder}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
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
                <TextInput
                  style={[s.input, errors.confirmPassword ? s.inputError : null]}
                  placeholder={t.register.confirmPasswordPlaceholder}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
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
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 16, color: '#374151' },
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  typeBtnActive: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  typeLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  typeLabelActive: { color: '#b91c1c' },
  primaryBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#f87171' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
