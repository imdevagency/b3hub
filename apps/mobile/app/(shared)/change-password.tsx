/**
 * change-password.tsx — Change password screen (all roles)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

const ACCENT = '#111827';

function strengthScore(pw: string): number {
  return (
    (pw.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0)
  );
}

const STRENGTH_META = [
  { label: '', color: colors.border }, // 0
  { label: 'Vāja', color: '#ef4444' }, // 1
  { label: 'Vidēja', color: '#f59e0b' }, // 2
  { label: 'Laba', color: '#84cc16' }, // 3
  { label: 'Stipra', color: '#22c55e' }, // 4
];

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const score = newPw.length > 0 ? strengthScore(newPw) : 0;
  const meta = STRENGTH_META[score];

  const handleSubmit = async () => {
    setFeedback(null);
    if (!currentPw || !newPw || !confirmPw) {
      setFeedback({ ok: false, msg: 'Lūdzu, aizpildiet visus laukus.' });
      haptics.warning();
      return;
    }
    if (newPw !== confirmPw) {
      setFeedback({ ok: false, msg: 'Jaunās paroles nesakrīt.' });
      haptics.warning();
      return;
    }
    if (newPw.length < 8) {
      setFeedback({ ok: false, msg: 'Jaunajai parolei jābūt vismaz 8 rakstzīmēm.' });
      haptics.warning();
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      await api.changePassword(currentPw, newPw, token);
      haptics.success();
      setFeedback({ ok: true, msg: 'Parole veiksmīgi nomainīta!' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      Alert.alert('Veiksmīgi', 'Parole ir nomainīta.', [
        { text: 'Labi', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      haptics.error();
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'Neizdevās nomainīt paroli.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer standalone>
      <ScreenHeader title="Nomainiēt paroli" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Current password */}
          <Text style={s.label}>Esošā parole</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry={!showCurrent}
              placeholder="Jūsu pašreizējā parole"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              maxLength={100}
            />
            <TouchableOpacity
              onPress={() => setShowCurrent((v) => !v)}
              hitSlop={8}
              style={s.eyeBtn}
            >
              {showCurrent ? (
                <EyeOff size={18} color="#6b7280" />
              ) : (
                <Eye size={18} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>

          {/* New password */}
          <Text style={[s.label, { marginTop: 16 }]}>Jaunā parole</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry={!showNew}
              placeholder="Vismaz 8 rakstzīmes"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              maxLength={100}
            />
            <TouchableOpacity onPress={() => setShowNew((v) => !v)} hitSlop={8} style={s.eyeBtn}>
              {showNew ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
            </TouchableOpacity>
          </View>

          {/* Strength bars */}
          {newPw.length > 0 && (
            <View style={s.strengthWrap}>
              <View style={s.strengthBars}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      s.strengthBar,
                      { backgroundColor: i <= score ? meta.color : colors.border },
                    ]}
                  />
                ))}
              </View>
              {meta.label ? (
                <Text style={[s.strengthLabel, { color: meta.color }]}>{meta.label}</Text>
              ) : null}
            </View>
          )}

          {/* Confirm password */}
          <Text style={[s.label, { marginTop: 16 }]}>Atkārtot jauno paroli</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              placeholder="Atkārtojiet jauno paroli"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              maxLength={100}
            />
          </View>

          {/* Feedback banner */}
          {feedback && (
            <View style={[s.banner, feedback.ok ? s.bannerSuccess : s.bannerError]}>
              {feedback.ok ? (
                <CheckCircle2 size={16} color="#15803d" />
              ) : (
                <AlertCircle size={16} color="#b91c1c" />
              )}
              <Text style={[s.bannerText, { color: feedback.ok ? '#15803d' : '#b91c1c' }]}>
                {feedback.msg}
              </Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[s.btn, (loading || !currentPw || !newPw || !confirmPw) && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !currentPw || !newPw || !confirmPw}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Nomainīt paroli</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: ACCENT },
  scroll: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary },
  eyeBtn: { padding: 4 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 4 },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 50 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  bannerSuccess: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  bannerError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '500' },
  btn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
