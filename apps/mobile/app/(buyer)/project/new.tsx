/**
 * (buyer)/project/new.tsx
 *
 * Create a new construction project.
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  clientName: string;
  siteAddress: string;
  contractValue: string;
  budgetAmount: string;
  startDate: string;
  endDate: string;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  clientName: '',
  siteAddress: '',
  contractValue: '',
  budgetAmount: '',
  startDate: '',
  endDate: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Validate a simple DD.MM.YYYY date string */
function parseDate(s: string): string | null {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return iso;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewProjectScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!token) return;

    if (!form.name.trim()) {
      toast.error('Projekta nosaukums ir obligāts.')
      return;
    }
    const cv = parseFloat(form.contractValue.replace(',', '.'));
    if (!form.contractValue.trim() || isNaN(cv) || cv <= 0) {
      toast.error('Ievadiet derīgu līguma vērtību.')
      return;
    }

    let startDate: string | undefined;
    let endDate: string | undefined;

    if (form.startDate.trim()) {
      const parsed = parseDate(form.startDate);
      if (!parsed) {
        toast.error('Sākuma datums jāievada formātā DD.MM.GGGG')
        return;
      }
      startDate = parsed;
    }
    if (form.endDate.trim()) {
      const parsed = parseDate(form.endDate);
      if (!parsed) {
        toast.error('Beigu datums jāievada formātā DD.MM.GGGG')
        return;
      }
      endDate = parsed;
    }

    const ba = form.budgetAmount.trim()
      ? parseFloat(form.budgetAmount.replace(',', '.'))
      : undefined;

    setSaving(true);
    try {
      const project = await api.projects.create(
        {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          clientName: form.clientName.trim() || undefined,
          siteAddress: form.siteAddress.trim() || undefined,
          contractValue: cv,
          budgetAmount: ba && !isNaN(ba) ? ba : undefined,
          startDate,
          endDate,
        },
        token,
      );
      haptics.success();
      toast.success('Projekts izveidots!');
      router.replace(`/(buyer)/project/${project.id}` as any);
    } catch (e: unknown) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Neizdevās izveidot projektu.')
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader title="Jauns projekts" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Required ─────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Pamatinformācija</Text>
          <View style={s.card}>
            <Field
              label="Projekta nosaukums *"
              value={form.name}
              onChangeText={set('name')}
              placeholder="Piem. Biroju ēka Rīga"
              autoFocus
            />
            <Divider />
            <Field
              label="Pasūtītājs / klients"
              value={form.clientName}
              onChangeText={set('clientName')}
              placeholder="Uzņēmuma vai personas vārds"
            />
            <Divider />
            <Field
              label="Objekta adrese"
              value={form.siteAddress}
              onChangeText={set('siteAddress')}
              placeholder="Iela, pilsēta"
            />
            <Divider />
            <Field
              label="Apraksts"
              value={form.description}
              onChangeText={set('description')}
              placeholder="Īss projekta apraksts"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* ── Budget ───────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Finanses</Text>
          <View style={s.card}>
            <Field
              label="Līguma vērtība (€) *"
              value={form.contractValue}
              onChangeText={set('contractValue')}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Divider />
            <Field
              label="Budžets (€)"
              value={form.budgetAmount}
              onChangeText={set('budgetAmount')}
              placeholder="0.00 — neobligāts"
              keyboardType="decimal-pad"
            />
          </View>

          {/* ── Dates ────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Termiņi</Text>
          <View style={s.card}>
            <Field
              label="Sākuma datums"
              value={form.startDate}
              onChangeText={set('startDate')}
              placeholder="DD.MM.GGGG"
              keyboardType="numbers-and-punctuation"
            />
            <Divider />
            <Field
              label="Beigu datums"
              value={form.endDate}
              onChangeText={set('endDate')}
              placeholder="DD.MM.GGGG"
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* ── Submit ───────────────────────────────────────── */}
          <TouchableOpacity
            style={[s.btn, saving && s.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Izveidot projektu</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'decimal-pad' | 'numbers-and-punctuation';
  autoFocus?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { height: 72, textAlignVertical: 'top', paddingTop: 8 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType ?? 'default'}
        autoFocus={autoFocus}
        returnKeyType="next"
      />
    </View>
  );
}

function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: -spacing.md }} />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 48,
    gap: 4,
  },
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '600' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden' as const,
  },
  field: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 4,
  },
  fieldLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    fontWeight: '500' as const,
  },
  input: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 22,
  },
  btn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center' as const,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: fontSizes.sm,
    fontWeight: '600' as const,
  },
});
