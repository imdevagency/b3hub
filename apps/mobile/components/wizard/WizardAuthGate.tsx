/**
 * WizardAuthGate
 *
 * Bottom-sheet modal shown when a guest (unauthenticated) user taps "Select offer"
 * or "Send RFQ" in an order wizard. Lets them:
 *   1. Register a quick BUYER account (name + email + phone + password)
 *   2. Log in to an existing account
 *
 * On success it calls onAuthenticated() so the wizard can continue the action
 * that triggered the gate.
 *
 * Design goal: Airbnb-style — show full value first, gate only at commitment.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { X, Eye, EyeOff, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = 'choice' | 'register' | 'login';

interface WizardAuthGateProps {
  visible: boolean;
  /** Called after successful auth — wizard continues the pending action. */
  onAuthenticated: () => void;
  onDismiss: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WizardAuthGate({ visible, onAuthenticated, onDismiss }: WizardAuthGateProps) {
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuth();

  const [mode, setMode] = useState<Mode>('choice');

  // Register fields
  const [isCompany, setIsCompany] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state whenever the sheet opens
  React.useEffect(() => {
    if (visible) {
      setMode('choice');
      setError('');
      setIsCompany(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCompanyName('');
      setRegNumber('');
      setPassword('');
      setLoginEmail('');
      setLoginPassword('');
    }
  }, [visible]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Ievadiet vārdu un uzvārdu');
      haptics.warning();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Nepareiza e-pasta adrese');
      haptics.warning();
      return;
    }
    if (password.length < 8) {
      setError('Parolei jābūt vismaz 8 rakstzīmēm');
      haptics.warning();
      return;
    }
    if (isCompany && !companyName.trim()) {
      setError('Ievadiet uzņēmuma nosaukumu');
      haptics.warning();
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        roles: ['BUYER'],
        isCompany,
        companyName: isCompany ? companyName.trim() : undefined,
        regNumber: isCompany && regNumber.trim() ? regNumber.trim() : undefined,
        password,
        termsAccepted: true,
      });
      await setAuth(res.user, res.token, res.refreshToken);
      haptics.success();
      onAuthenticated();
    } catch (err) {
      haptics.error();
      setError(err instanceof Error ? err.message : 'Reģistrācija neizdevās. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!loginEmail.trim() || !loginPassword) {
      setError('Ievadiet e-pastu un paroli');
      haptics.warning();
      return;
    }
    setLoading(true);
    try {
      const res = await api.login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      await setAuth(res.user, res.token, res.refreshToken);
      haptics.success();
      onAuthenticated();
    } catch (err) {
      haptics.error();
      setError(err instanceof Error ? err.message : 'Nepareizs e-pasts vai parole.');
    } finally {
      setLoading(false);
    }
  };

  // ── Input style ──────────────────────────────────────────────────────────

  const inputStyle = {
    height: 52,
    backgroundColor: colors.bgMuted,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: colors.border,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* Backdrop */}
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onDismiss} />

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: insets.bottom + 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 12,
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: colors.textPrimary,
              }}
            >
              {mode === 'choice'
                ? 'Apstiprināt pasūtījumu'
                : mode === 'register'
                  ? 'Izveidot kontu'
                  : 'Ieiet'}
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              style={{ padding: 4 }}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          >
            {/* ── CHOICE ── */}
            {mode === 'choice' && (
              <View style={{ gap: 12 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: colors.textMuted,
                    fontFamily: 'Inter_400Regular',
                    marginBottom: 4,
                  }}
                >
                  Lai pabeigtu pasūtījumu, piesakieties vai izveidojiet kontu — tas aizņems 30
                  sekundes.
                </Text>

                {/* Quick register */}
                <TouchableOpacity
                  onPress={() => setMode('register')}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 14,
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: 'Inter_700Bold',
                        fontWeight: '700',
                        color: '#fff',
                      }}
                    >
                      Turpināt ar e-pastu
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: 'Inter_400Regular',
                        color: 'rgba(255,255,255,0.8)',
                        marginTop: 2,
                      }}
                    >
                      Izveidojiet bezmaksas kontu
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#fff" />
                </TouchableOpacity>

                {/* Divider */}
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      fontFamily: 'Inter_400Regular',
                    }}
                  >
                    vai
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>

                {/* Login */}
                <TouchableOpacity
                  onPress={() => setMode('login')}
                  activeOpacity={0.85}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                      color: colors.textPrimary,
                    }}
                  >
                    Jau ir konts? Ieiet
                  </Text>
                  <ChevronRight size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textDisabled,
                    fontFamily: 'Inter_400Regular',
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  Reģistrējoties jūs piekrītat lietošanas noteikumiem un privātuma politikai.
                </Text>
              </View>
            )}

            {/* ── REGISTER ── */}
            {mode === 'register' && (
              <View style={{ gap: 12 }}>
                {/* Back */}
                <TouchableOpacity
                  onPress={() => {
                    setMode('choice');
                    setError('');
                  }}
                  style={{ marginBottom: 4 }}
                >
                  <Text
                    style={{ fontSize: 14, color: colors.textMuted, fontFamily: 'Inter_500Medium' }}
                  >
                    ← Atpakaļ
                  </Text>
                </TouchableOpacity>

                {/* B2C / B2B toggle */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { value: false, label: 'Privātpersona' },
                    { value: true, label: 'Uzņēmums' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      onPress={() => setIsCompany(opt.value)}
                      activeOpacity={0.85}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderColor: isCompany === opt.value ? colors.textPrimary : colors.border,
                        backgroundColor: isCompany === opt.value ? '#111827' : colors.bgMuted,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: 'Inter_600SemiBold',
                          fontWeight: '600',
                          color: isCompany === opt.value ? '#fff' : colors.textSecondary,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    placeholder="Vārds"
                    placeholderTextColor={colors.textDisabled}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    placeholder="Uzvārds"
                    placeholderTextColor={colors.textDisabled}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <TextInput
                  style={inputStyle}
                  placeholder="E-pasts"
                  placeholderTextColor={colors.textDisabled}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />

                <TextInput
                  style={inputStyle}
                  placeholder="Tālrunis (neobligāts)"
                  placeholderTextColor={colors.textDisabled}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />

                {/* Company fields — shown only when Uzņēmums is selected */}
                {isCompany && (
                  <>
                    <TextInput
                      style={inputStyle}
                      placeholder="Uzņēmuma nosaukums"
                      placeholderTextColor={colors.textDisabled}
                      value={companyName}
                      onChangeText={setCompanyName}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                    <TextInput
                      style={inputStyle}
                      placeholder="Reģistrācijas numurs (piem. 40003009497)"
                      placeholderTextColor={colors.textDisabled}
                      value={regNumber}
                      onChangeText={setRegNumber}
                      keyboardType="number-pad"
                      maxLength={12}
                      returnKeyType="next"
                    />
                  </>
                )}

                {/* Password with toggle */}
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[inputStyle, { paddingRight: 48 }]}
                    placeholder="Parole (min. 8 rakstzīmes)"
                    placeholderTextColor={colors.textDisabled}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPw}
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPw((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                    }}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    {showPw ? (
                      <EyeOff size={18} color={colors.textMuted} />
                    ) : (
                      <Eye size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>

                {error ? (
                  <Text
                    style={{ fontSize: 13, color: colors.danger, fontFamily: 'Inter_400Regular' }}
                  >
                    {error}
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: 'Inter_700Bold',
                        fontWeight: '700',
                        color: '#fff',
                      }}
                    >
                      Izveidot kontu un pasūtīt
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <View style={{ gap: 12 }}>
                {/* Back */}
                <TouchableOpacity
                  onPress={() => {
                    setMode('choice');
                    setError('');
                  }}
                  style={{ marginBottom: 4 }}
                >
                  <Text
                    style={{ fontSize: 14, color: colors.textMuted, fontFamily: 'Inter_500Medium' }}
                  >
                    ← Atpakaļ
                  </Text>
                </TouchableOpacity>

                <TextInput
                  style={inputStyle}
                  placeholder="E-pasts"
                  placeholderTextColor={colors.textDisabled}
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />

                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[inputStyle, { paddingRight: 48 }]}
                    placeholder="Parole"
                    placeholderTextColor={colors.textDisabled}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry={!showLoginPw}
                    autoComplete="current-password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowLoginPw((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                    }}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    {showLoginPw ? (
                      <EyeOff size={18} color={colors.textMuted} />
                    ) : (
                      <Eye size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>

                {error ? (
                  <Text
                    style={{ fontSize: 13, color: colors.danger, fontFamily: 'Inter_400Regular' }}
                  >
                    {error}
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: 'Inter_700Bold',
                        fontWeight: '700',
                        color: '#fff',
                      }}
                    >
                      Ieiet un pasūtīt
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
