/**
 * register.tsx — Multi-step registration wizard (Schüttflix / Uber style)
 *
 * Step 1: Choose role (BUYER / SUPPLIER / CARRIER) + account kind
 * Step 2: Personal info (name, email, phone)
 * Step 3: Password + create account
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { t } from '@/lib/translations';
import { ChevronLeft, Eye, EyeOff, Check } from 'lucide-react-native';

type UserType = 'BUYER' | 'SUPPLIER' | 'CARRIER';

// ── Constants ──────────────────────────────────────────────────
const TOTAL_STEPS = 3;

const ROLES: { value: UserType; emoji: string; title: string; desc: string; color: string; bg: string }[] = [
  {
    value: 'BUYER',
    emoji: '🛎️',
    title: 'Pircējs',
    desc: 'Pasūti materiālus, konteinerus un transportu',
    color: '#b45309',
    bg: '#fef3c7',
  },
  {
    value: 'SUPPLIER',
    emoji: '📦',
    title: 'Piegādātājs',
    desc: 'Pārdod materiālus un atbildi uz pieprasījumiem',
    color: '#047857',
    bg: '#d1fae5',
  },
  {
    value: 'CARRIER',
    emoji: '🚛',
    title: 'Pārvadātājs',
    desc: 'Pieņem kravas un nopelni uz katru braucienu',
    color: '#1d4ed8',
    bg: '#dbeafe',
  },
];

const ACCOUNT_KINDS = [
  { value: true, emoji: '🏢', label: 'Uzņēmums', desc: 'SIA, AS vai IK' },
  { value: false, emoji: '👤', label: 'Privātpersona', desc: 'Fiziska persona' },
];

// ── Progress bar ───────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: step / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, { width }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 3, backgroundColor: '#f3f4f6', borderRadius: 999, marginTop: 12 },
  fill: { height: 3, backgroundColor: '#dc2626', borderRadius: 999 },
});

// ── Password strength ──────────────────────────────────────────
function pwStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length === 0) return { label: '', color: '#e5e7eb', pct: 0 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Vāja', color: '#ef4444', pct: 0.25 };
  if (score === 2) return { label: 'Vidēja', color: '#f97316', pct: 0.5 };
  if (score === 3) return { label: 'Laba', color: '#eab308', pct: 0.75 };
  return { label: 'Stipra', color: '#22c55e', pct: 1 };
}

// ── Main ───────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();

  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [userType, setUserType] = useState<UserType>('BUYER');
  const [isCompany, setIsCompany] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  // Validation errors shown after pressing Next
  const [errors, setErrors] = useState<Record<string, string>>({});

  const strength = pwStrength(password);

  // ── Validate per step ──────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 2) {
      if (firstName.trim().length < 2) e.firstName = 'Vismaz 2 rakstzīmes';
      if (lastName.trim().length < 2) e.lastName = 'Vismaz 2 rakstzīmes';
      if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Nederīga e-pasta adrese';
    }
    if (step === 3) {
      if (password.length < 8) e.password = 'Vismaz 8 rakstzīmes';
      if (password !== confirmPw) e.confirmPw = 'Paroles nesakrīt';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (!validate()) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const goBack = () => {
    setErrors({});
    setApiError(null);
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  };

  const handleSubmit = async () => {
    setApiError(null);
    setSubmitting(true);
    try {
      const res = await api.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        userType,
        isCompany: userType === 'BUYER' ? isCompany : undefined,
        password,
      });
      await setAuth(res.user, res.token);
      router.replace('/');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t.register.failed);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 1: Role selection ─────────────────────────────────
  const renderStep1 = () => (
    <>
      <Text style={s.stepTitle}>Kā jūs izmantosiet B3Hub?</Text>
      <Text style={s.stepSub}>Izvēlieties savu lomu — to var mainīt vēlāk.</Text>

      <View style={s.roleGrid}>
        {ROLES.map((r) => {
          const active = userType === r.value;
          return (
            <TouchableOpacity
              key={r.value}
              style={[s.roleCard, active && { borderColor: r.color, backgroundColor: r.bg }]}
              onPress={() => setUserType(r.value)}
              activeOpacity={0.8}
            >
              <View style={s.roleCardHeader}>
                <Text style={s.roleEmoji}>{r.emoji}</Text>
                {active && (
                  <View style={[s.checkBadge, { backgroundColor: r.color }]}>
                    <Check size={11} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[s.roleTitle, active && { color: r.color }]}>{r.title}</Text>
              <Text style={s.roleDesc}>{r.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {userType === 'BUYER' && (
        <View style={s.sectionBlock}>
          <Text style={s.sectionLabel}>Konta veids</Text>
          <View style={s.kindRow}>
            {ACCOUNT_KINDS.map((k) => {
              const active = isCompany === k.value;
              return (
                <TouchableOpacity
                  key={String(k.value)}
                  style={[s.kindCard, active && s.kindCardActive]}
                  onPress={() => setIsCompany(k.value)}
                  activeOpacity={0.8}
                >
                  <Text style={s.kindEmoji}>{k.emoji}</Text>
                  <Text style={[s.kindLabel, active && s.kindLabelActive]}>{k.label}</Text>
                  <Text style={s.kindDesc}>{k.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  // ── Step 2: Personal info ──────────────────────────────────
  const renderStep2 = () => (
    <>
      <Text style={s.stepTitle}>Personas dati</Text>
      <Text style={s.stepSub}>Kā jūs saukt? Mēs nekad nepārdosim jūsu datus.</Text>

      <View style={s.nameRow}>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>Vārds</Text>
          <TextInput
            style={[s.input, errors.firstName && s.inputErr]}
            placeholder="Jānis"
            placeholderTextColor="#9ca3af"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          {errors.firstName && <Text style={s.err}>{errors.firstName}</Text>}
        </View>
        <View style={[s.field, { flex: 1 }]}>
          <Text style={s.label}>Uzvārds</Text>
          <TextInput
            style={[s.input, errors.lastName && s.inputErr]}
            placeholder="Bērziņš"
            placeholderTextColor="#9ca3af"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
          {errors.lastName && <Text style={s.err}>{errors.lastName}</Text>}
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>E-pasts</Text>
        <TextInput
          style={[s.input, errors.email && s.inputErr]}
          placeholder="janis@uznemums.lv"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        {errors.email && <Text style={s.err}>{errors.email}</Text>}
      </View>

      <View style={s.field}>
        <Text style={s.label}>Tālrunis <Text style={s.optional}>(neobligāts)</Text></Text>
        <TextInput
          style={s.input}
          placeholder="+371 2X XXX XXX"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </View>
    </>
  );

  // ── Step 3: Password ───────────────────────────────────────
  const renderStep3 = () => (
    <>
      <Text style={s.stepTitle}>Izveidot paroli</Text>
      <Text style={s.stepSub}>Vismaz 8 rakstzīmes. Ieteicams izmantot ciparus un simbolus.</Text>

      <View style={s.field}>
        <Text style={s.label}>Parole</Text>
        <View style={[s.inputRow, errors.password && s.inputRowErr]}>
          <TextInput
            style={s.inputFlex}
            placeholder="Ievadiet paroli"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw((v) => !v)} hitSlop={8}>
            {showPw ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={s.err}>{errors.password}</Text>}
        {/* Strength bar */}
        {password.length > 0 && (
          <View style={s.strengthRow}>
            <View style={s.strengthTrack}>
              <View
                style={[
                  s.strengthFill,
                  { width: `${strength.pct * 100}%` as any, backgroundColor: strength.color },
                ]}
              />
            </View>
            <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
          </View>
        )}
      </View>

      <View style={[s.field, { marginBottom: 24 }]}>
        <Text style={s.label}>Apstiprināt paroli</Text>
        <View style={[s.inputRow, errors.confirmPw && s.inputRowErr]}>
          <TextInput
            style={s.inputFlex}
            placeholder="Atkārtojiet paroli"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showCpw}
            value={confirmPw}
            onChangeText={setConfirmPw}
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowCpw((v) => !v)} hitSlop={8}>
            {showCpw ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
          </TouchableOpacity>
        </View>
        {errors.confirmPw && <Text style={s.err}>{errors.confirmPw}</Text>}
      </View>

      {apiError && (
        <View style={s.apiErrBox}>
          <Text style={s.apiErrText}>{apiError}</Text>
        </View>
      )}

      <Text style={s.legalText}>
        Reģistrējoties, jūs piekrītat mūsu{' '}
        <Text style={s.legalLink}>Lietošanas noteikumiem</Text>
        {' '}un{' '}
        <Text style={s.legalLink}>Privātuma politikai</Text>.
      </Text>
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header bar */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.7}>
            <ChevronLeft size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={s.headerLabel}>Solis {step} no {TOTAL_STEPS}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ProgressBar step={step} />

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>

        {/* Footer CTA */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.primaryBtn, submitting && s.primaryBtnDisabled]}
            onPress={goNext}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>
                {step === TOTAL_STEPS ? 'Izveidot kontu' : 'Tālāk'}
              </Text>
            )}
          </TouchableOpacity>

          {step === 1 && (
            <TouchableOpacity
              style={s.signInRow}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.7}
            >
              <Text style={s.signInText}>Jau ir konts? <Text style={s.signInLink}>Pierakstīties</Text></Text>
            </TouchableOpacity>
          )}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280' },

  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },

  stepTitle: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6 },
  stepSub: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 24 },

  // Role grid
  roleGrid: { gap: 12 },
  roleCard: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
  },
  roleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  roleEmoji: { fontSize: 28 },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 3 },
  roleDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },

  // Account kind
  sectionBlock: { marginTop: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 },
  kindRow: { flexDirection: 'row', gap: 10 },
  kindCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  kindCardActive: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  kindEmoji: { fontSize: 22, marginBottom: 6 },
  kindLabel: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'center' },
  kindLabelActive: { color: '#b91c1c' },
  kindDesc: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 2 },

  // Personal info
  nameRow: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  optional: { fontWeight: '400', color: '#9ca3af' },
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
  inputErr: { borderColor: '#f87171' },
  err: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  inputRowErr: { borderColor: '#f87171' },
  inputFlex: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },

  // Password strength
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  strengthTrack: { flex: 1, height: 4, backgroundColor: '#f3f4f6', borderRadius: 999 },
  strengthFill: { height: 4, borderRadius: 999 },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 40 },

  // Legal
  legalText: { fontSize: 12, color: '#9ca3af', lineHeight: 18, marginBottom: 8 },
  legalLink: { color: '#dc2626', fontWeight: '600' },

  // API error
  apiErrBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  apiErrText: { color: '#b91c1c', fontSize: 14 },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#f87171' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  signInRow: { alignItems: 'center', paddingVertical: 4 },
  signInText: { fontSize: 14, color: '#6b7280' },
  signInLink: { color: '#dc2626', fontWeight: '700' },
});
