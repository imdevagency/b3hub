/**
 * apply-role.tsx — Post-registration role application
 *
 * Reached from profile when a user wants to add Supplier or Carrier capabilities.
 * Submits POST /provider-applications.
 */
import React, { useState } from 'react';
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
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, CheckCircle, Info } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';

type RoleType = 'supplier' | 'carrier';

const ROLE_META: Record<RoleType, { emoji: string; title: string; color: string; bg: string }> = {
  supplier: { emoji: '📦', title: 'Piegādātājs', color: colors.success, bg: '#d1fae5' },
  carrier: { emoji: '🚛', title: 'Pārvadātājs', color: '#1d4ed8', bg: '#eff6ff' },
};

export default function ApplyRoleScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { type } = useLocalSearchParams<{ type?: string }>();

  const roleType = (type as RoleType) ?? 'supplier';
  const meta = ROLE_META[roleType] ?? ROLE_META.supplier;

  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [regNumber, setRegNumber] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (companyName.trim().length < 2) e.companyName = 'Ievadiet uzņēmuma nosaukumu vai vārdu';
    if (phone.trim().length < 6) e.phone = 'Ievadiet tālruņa numuru';
    if (roleType === 'carrier' && !termsAccepted) e.terms = 'Jums jāpiekrīt nosacījumiem';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      haptics.warning();
      return;
    }
    if (!user || !token) return;

    setSubmitting(true);
    try {
      await api.providerApplications.apply(
        {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: phone.trim(),
          companyName: companyName.trim(),
          regNumber: regNumber.trim() || undefined,
          description: description.trim() || undefined,
          appliesForSell: roleType === 'supplier',
          appliesForTransport: roleType === 'carrier',
          userId: user.id,
        },
        token,
      );
      haptics.success();
      setSubmitted(true);
    } catch (err) {
      haptics.error();
      const msg = err instanceof Error ? err.message : 'Neizdevās iesniegt pieteikumu';
      setErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ScreenContainer standalone bg="#fff">
        <StatusBar style="dark" />
        <View style={s.successScreen}>
          <View style={[s.successCircle, { backgroundColor: meta.bg }]}>
            <CheckCircle size={48} color={meta.color} />
          </View>
          <Text style={s.successTitle}>Pieteikums nosūtīts!</Text>
          <Text style={s.successDesc}>
            Mūsu komanda pārskatīs jūsu {meta.title.toLowerCase()} pieteikumu un sazināsies ar Jums
            tuvākajā laikā.
          </Text>
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: meta.color }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={s.doneBtnText}>Atpakaļ uz profilu</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer standalone bg="#fff">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={22} color="#374151" />
          </TouchableOpacity>
          <View style={[s.roleBadge, { backgroundColor: meta.bg }]}>
            <Text style={s.roleEmoji}>{meta.emoji}</Text>
            <Text style={[s.roleBadgeText, { color: meta.color }]}>{meta.title}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.title}>Kļūt par {meta.title.toLowerCase()}u</Text>
          <Text style={s.subtitle}>
            Aizpildiet veidlapu un mūsu komanda apstiprināa jūsu kontu 1–2 darba dienu laikā.
          </Text>

          {/* Company / personal name */}
          <View style={s.field}>
            <Text style={s.label}>Uzņēmuma vai vārds</Text>
            <TextInput
              style={[s.input, errors.companyName && s.inputErr]}
              placeholder={
                roleType === 'carrier' ? 'SIA Transports vai Jānis Bērziņš' : 'SIA Jūsu Uzņēmums'
              }
              placeholderTextColor="#9ca3af"
              value={companyName}
              onChangeText={setCompanyName}
              autoCapitalize="words"
            />
            {errors.companyName && <Text style={s.err}>{errors.companyName}</Text>}
          </View>

          {/* Phone */}
          <View style={s.field}>
            <Text style={s.label}>Kontakttālrunis</Text>
            <TextInput
              style={[s.input, errors.phone && s.inputErr]}
              placeholder="+371 20 000 000"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {errors.phone && <Text style={s.err}>{errors.phone}</Text>}
          </View>

          {/* Reg number */}
          <View style={s.field}>
            <Text style={s.label}>
              Reģ. numurs <Text style={s.optional}>(neobligāts)</Text>
            </Text>
            <TextInput
              style={s.input}
              placeholder="40001234567"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              value={regNumber}
              onChangeText={setRegNumber}
            />
          </View>

          {/* Description */}
          <View style={s.field}>
            <Text style={s.label}>
              Aprakstiet savu darbību <Text style={s.optional}>(neobligāts)</Text>
            </Text>
            <TextInput
              style={[s.input, s.textarea]}
              placeholder={
                roleType === 'supplier'
                  ? 'Ko jūs pārdodat? Kādos apjomos? Kādos reģionos?'
                  : 'Kādi transportlīdzekļi, kādos reģionos strādājat?'
              }
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Carrier terms — shown only for carrier applications */}
          {roleType === 'carrier' && (
            <View style={s.termsBox}>
              <View style={s.termsHeader}>
                <Info size={15} color="#1d4ed8" />
                <Text style={s.termsTitle}>Nosacījumi pārvadātājiem</Text>
              </View>
              <View style={s.termsList}>
                <Text style={s.termsItem}>
                  • B3 APP darībojas kā logistics starpnieks — jūsu līgums ir ar platformu, ne
                  pasūtītāju.
                </Text>
                <Text style={s.termsItem}>
                  • Izmaksa notiek pēc piegādes apstiprināšanas un dokumentu iesniegšanas.
                </Text>
                <Text style={s.termsItem}>
                  • Darba samaksa redzama pirms jebkura darba piemēšanas — nav slēpto atskaiījumu.
                </Text>
                <Text style={s.termsItem}>
                  • Platforma patur logīstikas maržu; jūsu sam. likme tiek nodrošināta līgumiskā
                  pakalpojuma ietvarošana.
                </Text>
              </View>
              <TouchableOpacity
                style={s.termsCheckRow}
                onPress={() => {
                  haptics.light();
                  setTermsAccepted((v) => !v);
                }}
                activeOpacity={0.8}
              >
                <View style={[s.checkbox, termsAccepted && s.checkboxActive]}>
                  {termsAccepted && <CheckCircle size={14} color="#fff" />}
                </View>
                <Text style={s.termsCheckLabel}>
                  Es esmu izlasījis un piekrītu B3 APP pārvadātāja noteikumiem
                </Text>
              </TouchableOpacity>
              {errors.terms && <Text style={s.err}>{errors.terms}</Text>}
            </View>
          )}

          {errors.submit && (
            <View style={s.apiErrBox}>
              <Text style={s.apiErrText}>{errors.submit}</Text>
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: meta.color }, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Iesniegt pieteikumu</Text>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  roleEmoji: { fontSize: 16 },
  roleBadgeText: { fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
  optional: { fontWeight: '400', color: colors.textDisabled },
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
  textarea: { height: 100, textAlignVertical: 'top' },
  inputErr: { borderColor: '#f87171' },
  err: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  apiErrBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  apiErrText: { color: colors.dangerText, fontSize: 14 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  // Carrier terms box
  termsBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  termsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  termsList: {
    gap: 6,
    marginBottom: 14,
  },
  termsItem: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 19,
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  termsCheckLabel: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 19,
    fontWeight: '500',
  },

  submitBtn: {
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  // Success
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  successDesc: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
