import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

type RoleKey = 'BUYER' | 'SUPPLIER' | 'CARRIER';

const TOTAL_STEPS = 3;

const ROLES: {
  value: RoleKey;
  title: string;
  desc: string;
}[] = [
  {
    value: 'BUYER',
    title: 'Pircējs',
    desc: 'Pasūti materiālus, konteinerus un transportu',
  },
  {
    value: 'SUPPLIER',
    title: 'Piegādātājs',
    desc: 'Pārdod materiālus un saņem pasūtījumus',
  },
  {
    value: 'CARRIER',
    title: 'Pārvadātājs',
    desc: 'Pieņem un izpildi transporta pasūtījumus',
  },
];

const ACCOUNT_KINDS = [
  { value: true, label: 'Uzņēmums', desc: 'SIA, AS vai IK' },
  { value: false, label: 'Privātpersona', desc: 'Fiziska persona' },
];

function pwStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length === 0) return { label: '', color: '#e5e7eb', pct: 0 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Vāja', color: '#ef4444', pct: 0.25 };
  if (score === 2) return { label: 'Vidēja', color: '#9ca3af', pct: 0.5 };
  if (score === 3) return { label: 'Laba', color: '#111827', pct: 0.75 };
  return { label: 'Stipra', color: '#111827', pct: 1 };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { partner } = useLocalSearchParams<{ partner?: string }>();
  const insets = useSafeAreaInsets();
  const isPartnerFlow = partner === '1';

  const visibleRoles = isPartnerFlow ? ROLES.filter((r) => r.value !== 'BUYER') : ROLES;

  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [roles, setRoles] = useState<Set<RoleKey>>(new Set<RoleKey>());
  const [isCompany, setIsCompany] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  const needsCompanyInfo = roles.has('SUPPLIER') || roles.has('CARRIER');
  const isBuyerOnly = roles.has('BUYER') && !roles.has('SUPPLIER') && !roles.has('CARRIER');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const strength = pwStrength(password);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (roles.size === 0) e.roles = 'Izvēlieties vismaz vienu lomu';
    }
    if (step === 2) {
      if (firstName.trim().length < 2) e.firstName = 'Nepieciešams vārds';
      if (lastName.trim().length < 2) e.lastName = 'Nepieciešams uzvārds';
      if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Nederīga e-pasta adrese';
      if (needsCompanyInfo && companyName.trim().length < 2)
        e.companyName = 'Nepieciešams uzņēmuma nosaukums';
    }
    if (step === 3) {
      if (password.length < 8) e.password = 'Parolei jābūt vismaz 8 rakstzīmēm';
      if (password !== confirmPw) e.confirmPw = 'Paroles nesakrīt';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (!validate()) {
      haptics.warning();
      return;
    }
    if (step < TOTAL_STEPS) {
      haptics.selection();
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
        roles: Array.from(roles),
        isCompany: needsCompanyInfo ? true : isBuyerOnly ? isCompany : true,
        companyName: companyName.trim() || undefined,
        regNumber: regNumber.trim() || undefined,
        password,
      });
      await setAuth(res.user, res.token, res.refreshToken);
      haptics.success();
      router.replace('/');
    } catch (err) {
      haptics.error();
      setApiError(err instanceof Error ? err.message : t.register.failed);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={s.stepContent}>
      <Text
        className="text-3xl text-black mb-2"
        style={{ fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}
      >
        Kā jūs izmantosiet B3Hub?
      </Text>
      <Text className="text-base text-gray-500 mb-8" style={{ fontFamily: 'Inter_400Regular' }}>
        Izvēlieties vienu vai vairākas lomas.
      </Text>

      <View style={s.grid}>
        {visibleRoles.map((r) => {
          const active = roles.has(r.value);
          return (
            <TouchableOpacity
              key={r.value}
              style={[s.blockOption, active && s.blockOptionActive]}
              onPress={() => {
                haptics.light();
                setRoles((prev) => {
                  const n = new Set(prev);
                  if (n.has(r.value)) n.delete(r.value);
                  else n.add(r.value);
                  return n;
                });
              }}
              activeOpacity={0.9}
            >
              <Text style={[s.blockTitle, active && s.textWhite]}>{r.title}</Text>
              <Text style={[s.blockDesc, active && s.textGray300]}>{r.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {errors.roles && <Text style={s.err}>{errors.roles}</Text>}

      {isBuyerOnly && (
        <View style={{ marginTop: 32 }}>
          <Text style={s.sectionLabel}>Konta veids</Text>
          <View style={[s.grid, { flexDirection: 'row' }]}>
            {ACCOUNT_KINDS.map((k) => {
              const active = isCompany === k.value;
              return (
                <TouchableOpacity
                  key={String(k.value)}
                  style={[s.blockOption, s.flex1, active && s.blockOptionActive]}
                  onPress={() => setIsCompany(k.value)}
                  activeOpacity={0.9}
                >
                  <Text style={[s.blockTitle, active && s.textWhite]}>{k.label}</Text>
                  <Text style={[s.blockDesc, active && s.textGray300]}>{k.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={s.stepContent}>
      <Text
        className="text-3xl text-black mb-2"
        style={{ fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}
      >
        Tavi dati
      </Text>
      <Text className="text-base text-gray-500 mb-8" style={{ fontFamily: 'Inter_400Regular' }}>
        Informācija līgumiem un piegādēm.
      </Text>

      <View style={[s.grid, { flexDirection: 'row' }]}>
        <View style={s.flex1}>
          <TextInput
            style={[s.softInput, errors.firstName && s.inputErr]}
            placeholder="Vārds"
            placeholderTextColor="#9ca3af"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          {errors.firstName && <Text style={s.err}>{errors.firstName}</Text>}
        </View>
        <View style={s.flex1}>
          <TextInput
            style={[s.softInput, errors.lastName && s.inputErr]}
            placeholder="Uzvārds"
            placeholderTextColor="#9ca3af"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
          {errors.lastName && <Text style={s.err}>{errors.lastName}</Text>}
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <TextInput
          style={[s.softInput, errors.email && s.inputErr]}
          placeholder="E-pasta adrese"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        {errors.email && <Text style={s.err}>{errors.email}</Text>}
      </View>

      <View style={{ marginTop: 12 }}>
        <TextInput
          style={s.softInput}
          placeholder="Tālruņa numurs (neobligāts)"
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </View>

      {needsCompanyInfo && (
        <View style={{ marginTop: 24 }}>
          <Text style={s.sectionLabel}>Uzņēmums</Text>
          <View style={s.grid}>
            <TextInput
              style={[s.softInput, errors.companyName && s.inputErr]}
              placeholder="Uzņēmuma nosaukums"
              placeholderTextColor="#9ca3af"
              value={companyName}
              onChangeText={setCompanyName}
              autoCapitalize="words"
            />
            {errors.companyName && <Text style={s.err}>{errors.companyName}</Text>}
            <TextInput
              style={s.softInput}
              placeholder="Reģistrācijas numurs (neobligāts)"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              value={regNumber}
              onChangeText={setRegNumber}
            />
          </View>
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={s.stepContent}>
      <Text
        className="text-3xl text-black mb-2"
        style={{ fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}
      >
        Izveido paroli
      </Text>
      <Text className="text-base text-gray-500 mb-8" style={{ fontFamily: 'Inter_400Regular' }}>
        Drošībai virs visa.
      </Text>

      <View style={s.grid}>
        <View style={[s.softInputRow, errors.password && s.inputErr]}>
          <TextInput
            style={s.flex1}
            placeholder="Parole (vismaz 8 simboli)"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={12}>
            {showPw ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={s.err}>{errors.password}</Text>}

        {password.length > 0 && (
          <View style={s.strengthRow}>
            <View style={s.strengthTrack}>
              <View
                style={[
                  s.strengthFill,
                  { width: `${strength.pct * 100}%`, backgroundColor: strength.color },
                ]}
              />
            </View>
          </View>
        )}

        <View style={[s.softInputRow, errors.confirmPw && s.inputErr]}>
          <TextInput
            style={s.flex1}
            placeholder="Atkārto paroli"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showCpw}
            value={confirmPw}
            onChangeText={setConfirmPw}
          />
          <TouchableOpacity onPress={() => setShowCpw(!showCpw)} hitSlop={12}>
            {showCpw ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
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
        Turpinot, jūs piekrītat mūsu{' '}
        <Text style={s.legalLink} onPress={() => Linking.openURL('https://b3hub.lv/terms')}>
          Noteikumiem
        </Text>{' '}
        un{' '}
        <Text style={s.legalLink} onPress={() => Linking.openURL('https://b3hub.lv/privacy')}>
          Privātuma politikai
        </Text>
        .
      </Text>
    </View>
  );

  return (
    <ScreenContainer standalone bg="#fff" topInset={0}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Minimal Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={s.stepCounter}>
            {step} / {TOTAL_STEPS}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>

        {/* Anchored Bottom Action */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <TouchableOpacity
            style={[s.primaryBtn, submitting && s.primaryBtnDisabled]}
            onPress={goNext}
            disabled={submitting}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>{step === TOTAL_STEPS ? 'Pabeigt' : 'Turpināt'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  stepCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingRight: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  scroll: {
    flexGrow: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },

  grid: { gap: 12 },
  flex1: { flex: 1 },

  // Block Opts
  blockOption: {
    backgroundColor: '#f3f4f6', // bg-muted
    borderRadius: 16,
    padding: 20,
  },
  blockOptionActive: {
    backgroundColor: '#000',
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  blockDesc: {
    fontSize: 14,
    color: '#6b7280', // text-muted
    fontFamily: 'Inter_400Regular',
  },
  textWhite: { color: '#fff' },
  textGray300: { color: '#d1d5db' },

  // Soft Inputs
  softInput: {
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 56,
  },
  inputErr: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  err: { color: '#ef4444', fontSize: 13, marginTop: 4, marginLeft: 4 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },

  // Strength
  strengthRow: { paddingHorizontal: 4, marginVertical: 4 },
  strengthTrack: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 },
  strengthFill: { height: 4, borderRadius: 2 },

  // API Err
  apiErrBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  apiErrText: { color: '#b91c1c', fontSize: 14, fontWeight: '500' },

  // Legal
  legalText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 24,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  legalLink: { color: '#000', fontWeight: '600', fontFamily: 'Inter_600SemiBold' },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#000',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
