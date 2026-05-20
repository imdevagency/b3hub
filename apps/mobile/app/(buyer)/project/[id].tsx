/**
 * (buyer)/project/[id].tsx
 *
 * Project detail screen.
 * Shows project metadata (address, notes) and the list of framework contracts
 * linked to this project. Users with the right permissions can add new
 * framework contracts directly under this project.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiProject,
  type ApiFrameworkContract,
  type FrameworkContractStatus,
} from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { getFrameworkContractStatus } from '@/lib/status';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/Toast';
import { colors } from '@/lib/theme';
import { MapPin, FileText, Plus, Handshake } from 'lucide-react-native';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getProgressColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', startDate: '', endDate: '', notes: '' });

  const canCreate =
    user?.companyRole === 'OWNER' ||
    user?.companyRole === 'MANAGER' ||
    user?.permCreateContracts === true;

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoadError(null);
      const data = await api.projects.get(id, token);
      setProject(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Kļūda ielādējot projektu');
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openCreate = () => {
    haptics.light();
    setForm({ title: '', startDate: '', endDate: '', notes: '' });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!form.title.trim()) {
      Alert.alert('Kļūda', 'Ievadiet līguma nosaukumu');
      return;
    }
    if (!form.startDate.trim()) {
      Alert.alert('Kļūda', 'Ievadiet sākuma datumu (GGGG-MM-DD)');
      return;
    }
    setSaving(true);
    try {
      const created = await api.frameworkContracts.create(
        {
          title: form.title.trim(),
          startDate: new Date(form.startDate.trim()).toISOString(),
          endDate: form.endDate.trim() ? new Date(form.endDate.trim()).toISOString() : undefined,
          notes: form.notes.trim() || undefined,
          projectId: id,
        },
        token,
      );
      haptics.success();
      setCreateOpen(false);
      router.push({
        pathname: '/(buyer)/framework-contract/[id]',
        params: { id: created.id },
      } as any);
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Neizdevās izveidot līgumu');
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading / error ───────────────────────────────────────────────────────

  if (!project && !loadError) {
    return (
      <ScreenContainer bg="white">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Projekts" showBack />
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.textPrimary} />
        </View>
      </ScreenContainer>
    );
  }

  if (loadError) {
    return (
      <ScreenContainer bg="white">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Projekts" showBack />
        <View style={s.center}>
          <Text style={s.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={load} style={s.retryBtn}>
            <Text style={s.retryBtnText}>Mēģināt vēlreiz</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const p = project!;
  const contracts = (p.contracts ?? []) as unknown as ApiFrameworkContract[];
  const pct = Math.min(100, p.totalProgressPct);
  const progColor = getProgressColor(pct);

  return (
    <ScreenContainer bg="white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={p.title}
        showBack
        rightAction={
          canCreate ? (
            <TouchableOpacity onPress={openCreate} hitSlop={12} activeOpacity={0.7}>
              <Plus size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Project meta card */}
        <View style={s.metaCard}>
          {p.address ? (
            <View style={s.metaRow}>
              <MapPin size={16} color={colors.textMuted} />
              <Text style={s.metaText}>{p.address}</Text>
            </View>
          ) : null}

          {p.notes ? (
            <View style={s.metaRow}>
              <FileText size={16} color={colors.textMuted} />
              <Text style={s.metaText}>{p.notes}</Text>
            </View>
          ) : null}

          {p.contractCount > 0 ? (
            <View style={s.progressBlock}>
              <View style={s.progressHeader}>
                <Text style={s.progressTitle}>
                  {p.contractCount} rāmjlīgum{p.contractCount === 1 ? 's' : 'i'}
                </Text>
                <Text style={[s.progressPct, { color: progColor }]}>{Math.round(pct)}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View
                  style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: progColor }]}
                />
              </View>
              <Text style={s.qtyLabel}>
                {p.totalConsumedQty.toLocaleString('lv')} / {p.totalAgreedQty.toLocaleString('lv')}{' '}
                t
              </Text>
            </View>
          ) : null}
        </View>

        {/* Contracts list */}
        <Text style={s.sectionTitle}>Rāmjlīgumi</Text>

        {contracts.length === 0 ? (
          <View style={s.emptyState}>
            <Handshake size={36} color="#9ca3af" />
            <Text style={s.emptyTitle}>Nav rāmjlīgumu</Text>
            {canCreate ? (
              <Text style={s.emptySubtitle}>Spied + lai pievienotu pirmo rāmjlīgumu.</Text>
            ) : null}
          </View>
        ) : (
          contracts.map((contract) => {
            const status = getFrameworkContractStatus(contract.status);
            const cPct = Math.min(100, contract.totalProgressPct);
            const cColor = getProgressColor(cPct);
            return (
              <TouchableOpacity
                key={contract.id}
                style={s.contractCard}
                onPress={() => {
                  haptics.light();
                  router.push({
                    pathname: '/(buyer)/framework-contract/[id]',
                    params: { id: contract.id },
                  } as any);
                }}
                activeOpacity={0.7}
              >
                <View style={s.contractTopRow}>
                  <Text style={s.contractTitle} numberOfLines={1}>
                    {contract.title}
                  </Text>
                  <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={s.contractMeta}>{contract.contractNumber}</Text>
                <Text style={s.contractDates}>
                  {formatDateShort(contract.startDate)}
                  {contract.endDate ? ` – ${formatDateShort(contract.endDate)}` : ' – Neierobežots'}
                </Text>
                <View style={s.contractProgressRow}>
                  <View style={s.progressTrack}>
                    <View
                      style={[
                        s.progressFill,
                        { width: `${cPct}%` as any, backgroundColor: cColor },
                      ]}
                    />
                  </View>
                  <Text style={[s.contractProgressLabel, { color: cColor }]}>
                    {Math.round(cPct)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Create contract sheet */}
      <BottomSheet
        visible={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        title="Jauns rāmjlīgums"
        scrollable
        maxHeightPct={0.92}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 20 }}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>NOSAUKUMS *</Text>
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder={`Piem. Grants — ${p.title}`}
                placeholderTextColor="#9ca3af"
                maxLength={120}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>SĀKUMA DATUMS * (GGGG-MM-DD)</Text>
              <TextInput
                style={s.input}
                value={form.startDate}
                onChangeText={(v) => setForm((f) => ({ ...f, startDate: v }))}
                placeholder="2026-06-01"
                placeholderTextColor="#9ca3af"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>BEIGU DATUMS (GGGG-MM-DD)</Text>
              <TextInput
                style={s.input}
                value={form.endDate}
                onChangeText={(v) => setForm((f) => ({ ...f, endDate: v }))}
                placeholder="2026-12-31"
                placeholderTextColor="#9ca3af"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>PIEZĪMES</Text>
              <TextInput
                style={[s.input, { minHeight: 80, paddingTop: 14 }]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Papildu informācija..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={500}
              />
            </View>
          </View>
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={s.submitBtnText}>{saving ? 'Saglabā...' : 'Izveidot'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: '#f3f4f6',
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metaCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 24,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  progressBlock: {
    gap: 6,
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  qtyLabel: {
    fontSize: 12,
    color: colors.textDisabled,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  contractCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    gap: 6,
  },
  contractTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  contractTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contractMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  contractDates: {
    fontSize: 13,
    color: colors.textDisabled,
  },
  contractProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  contractProgressLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  // Create form
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  sheetFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  submitBtn: {
    backgroundColor: '#166534',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
