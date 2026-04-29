/**
 * Phone OTP Authentication Screen
 *
 * Three-step flow:
 *   1. `phone`   — enter phone number → request OTP
 *   2. `otp`     — enter 6-digit code → verify
 *   3. `profile` — new users only: enter name → complete registration
 */
import { useState, useRef, useCallback } from 'react';
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
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { ChevronLeft, Phone } from 'lucide-react-native';

type Step = 'phone' | 'otp' | 'profile';

// Baltic country codes
const COUNTRY_CODES = [
  { code: '+371', flag: '🇱🇻', label: 'LV' },
  { code: '+370', flag: '🇱🇹', label: 'LT' },
  { code: '+372', flag: '🇪🇪', label: 'EE' },
];

export default function PhoneOtpScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('phone');

  // Step 1 — phone
  const [countryIdx, setCountryIdx] = useState(0);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  // Step 2 — otp
  const [otpCode, setOtpCode] = useState('');
  const [otpErr, setOtpErr] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 — profile (new users)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const country = COUNTRY_CODES[countryIdx];
  const fullPhone = `${country.code}${phoneDigits.replace(/\s/g, '')}`;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const startCooldown = useCallback(() => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const rotateCountry = () => {
    setCountryIdx((i) => (i + 1) % COUNTRY_CODES.length);
  };

  // ── Step 1: send OTP ─────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    setPhoneErr(null);
    const digits = phoneDigits.replace(/\s/g, '');
    if (digits.length < 7) {
      setPhoneErr('Ievadiet derīgu tālruņa numuru.');
      return;
    }

    setLoading(true);
    try {
      await api.sendPhoneOtp(fullPhone);
      haptics.success();
      startCooldown();
      setOtpCode('');
      setStep('otp');
    } catch (err) {
      haptics.error();
      setPhoneErr(err instanceof Error ? err.message : 'Neizdevās nosūtīt kodu.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ───────────────────────────────────────────────────

  const handleVerify = async (code: string = otpCode) => {
    if (code.length < 6) return;
    setOtpErr(null);
    setLoading(true);

    try {
      const res = await api.verifyPhoneOtp(fullPhone, code);

      if ('needsProfile' in res && res.needsProfile) {
        haptics.success();
        setStep('profile');
      } else {
        const auth = res as { user: object; token: string; refreshToken: string };
        await setAuth(auth.user as Parameters<typeof setAuth>[0], auth.token, auth.refreshToken);
        haptics.success();
        router.replace('/');
      }
    } catch (err) {
      haptics.error();
      setOtpErr(err instanceof Error ? err.message : 'Nepareizs kods.');
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setOtpErr(null);
    try {
      await api.sendPhoneOtp(fullPhone);
      haptics.medium();
      startCooldown();
      setOtpCode('');
    } catch (err) {
      setOtpErr(err instanceof Error ? err.message : 'Neizdevās nosūtīt kodu.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: complete profile ─────────────────────────────────────────────

  const handleCompleteProfile = async () => {
    setProfileErr(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setProfileErr('Lūdzu ievadiet vārdu un uzvārdu.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyPhoneOtp(fullPhone, otpCode, fn, ln);
      if ('needsProfile' in res) {
        // shouldn't happen — but guard
        setProfileErr('Neizdevās izveidot profilu. Mēģiniet vēlreiz.');
        return;
      }
      const auth = res as { user: object; token: string; refreshToken: string };
      await setAuth(auth.user as Parameters<typeof setAuth>[0], auth.token, auth.refreshToken);
      haptics.success();
      router.replace('/');
    } catch (err) {
      haptics.error();
      setProfileErr(err instanceof Error ? err.message : 'Neizdevās reģistrēties.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ScreenContainer standalone bg="#fff" topInset={0}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => {
              if (step === 'phone') {
                router.back();
              } else if (step === 'otp') {
                setStep('phone');
                setOtpErr(null);
              } else {
                setStep('otp');
                setProfileErr(null);
              }
            }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 1: Phone ── */}
          {step === 'phone' && (
            <>
              <View style={s.iconCircle}>
                <Phone size={28} color="#fff" />
              </View>

              <Text style={s.heroTitle}>Jūsu tālrunis</Text>
              <Text style={s.heroSubtitle}>
                Nosūtīsim verifikācijas kodu uz jūsu tālruņa numuru.
              </Text>

              {phoneErr && (
                <View style={s.errBox}>
                  <Text style={s.errText}>{phoneErr}</Text>
                </View>
              )}

              <View style={s.phoneRow}>
                <TouchableOpacity style={s.countryBtn} onPress={rotateCountry} activeOpacity={0.7}>
                  <Text style={s.countryFlag}>{country.flag}</Text>
                  <Text style={s.countryCode}>{country.code}</Text>
                </TouchableOpacity>

                <TextInput
                  style={s.phoneInput}
                  placeholder="20 000 000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={15}
                  value={phoneDigits}
                  onChangeText={(v) => {
                    setPhoneDigits(v.replace(/[^\d\s]/g, ''));
                    setPhoneErr(null);
                  }}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </View>

              <Text style={s.hint}>Standarta SMS tarifi var tikt piemēroti.</Text>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <>
              <Text style={s.heroTitle}>Ievadiet kodu</Text>
              <Text style={s.heroSubtitle}>
                Nosūtījām 6 ciparu kodu uz{'\n'}
                <Text style={s.phoneHighlight}>{fullPhone}</Text>
              </Text>

              {otpErr && (
                <View style={s.errBox}>
                  <Text style={s.errText}>{otpErr}</Text>
                </View>
              )}

              <TextInput
                style={s.otpInput}
                placeholder="000000"
                placeholderTextColor="#d1d5db"
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={(v) => {
                  const clean = v.replace(/[^\d]/g, '');
                  setOtpCode(clean);
                  setOtpErr(null);
                  if (clean.length === 6) {
                    handleVerify(clean);
                  }
                }}
                autoFocus
                textAlign="center"
              />

              <TouchableOpacity
                style={[s.resendWrap, resendCooldown > 0 && { opacity: 0.5 }]}
                onPress={handleResend}
                disabled={resendCooldown > 0 || loading}
                activeOpacity={0.7}
              >
                <Text style={s.resendText}>
                  {resendCooldown > 0
                    ? `Nosūtīt vēlreiz (${resendCooldown}s)`
                    : 'Nosūtīt kodu vēlreiz'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 3: Profile ── */}
          {step === 'profile' && (
            <>
              <Text style={s.heroTitle}>Jūsu vārds</Text>
              <Text style={s.heroSubtitle}>Pabeidziet reģistrāciju ievadot savu vārdu.</Text>

              {profileErr && (
                <View style={s.errBox}>
                  <Text style={s.errText}>{profileErr}</Text>
                </View>
              )}

              <View style={s.fieldWrap}>
                <TextInput
                  style={s.softInput}
                  placeholder="Vārds"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  autoFocus
                  maxLength={50}
                  value={firstName}
                  onChangeText={(v) => {
                    setFirstName(v);
                    setProfileErr(null);
                  }}
                  returnKeyType="next"
                />
              </View>

              <View style={s.fieldWrap}>
                <TextInput
                  style={s.softInput}
                  placeholder="Uzvārds"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  maxLength={50}
                  value={lastName}
                  onChangeText={(v) => {
                    setLastName(v);
                    setProfileErr(null);
                  }}
                  returnKeyType="done"
                  onSubmitEditing={handleCompleteProfile}
                />
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer CTA */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {step === 'phone' && (
            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Saņemt kodu</Text>
              )}
            </TouchableOpacity>
          )}

          {step === 'otp' && (
            <TouchableOpacity
              style={[s.primaryBtn, (loading || otpCode.length < 6) && s.primaryBtnDisabled]}
              onPress={() => handleVerify()}
              disabled={loading || otpCode.length < 6}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Apstiprināt</Text>
              )}
            </TouchableOpacity>
          )}

          {step === 'profile' && (
            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={handleCompleteProfile}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Sākt</Text>
              )}
            </TouchableOpacity>
          )}
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
    paddingTop: 8,
    paddingBottom: 24,
  },

  // Icon accent circle
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    marginBottom: 32,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
  },
  phoneHighlight: {
    color: '#000',
    fontFamily: 'Inter_600SemiBold',
  },

  // Phone row
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 56,
    fontSize: 18,
    color: '#000',
    fontFamily: 'Inter_400Regular',
    letterSpacing: 2,
  },

  hint: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },

  // OTP input
  otpInput: {
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    height: 72,
    fontSize: 32,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    letterSpacing: 8,
    marginBottom: 24,
  },

  resendWrap: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 15,
    color: '#000',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },

  // Standard inputs (Step 3)
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

  // Error
  errBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  errText: {
    color: colors.dangerText,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: '#166534',
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
