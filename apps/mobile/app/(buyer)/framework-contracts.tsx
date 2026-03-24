/**
 * (buyer)/framework-contracts.tsx
 *
 * Buyer: list of framework contracts (rāmjlīgumi).
 * A framework contract is a long-running agreement with agreed quantities and
 * unit prices that the buyer releases as individual call-off transport jobs.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiFrameworkContract, type FrameworkContractStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { Calendar, ChevronRight, FileText, Package, Plus, X } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { Text } from '@/components/ui/text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors } from '@/lib/theme';

const STATUS: Record<FrameworkContractStatus, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Melnraksts', bg: '#fffbeb', color: '#b45309' }, // amber-50 / amber-700
  ACTIVE: { label: 'Aktīvs', bg: '#ecfdf5', color: '#047857' }, // emerald-50 / emerald-700
  COMPLETED: { label: 'Pabeigts', bg: '#f1f5f9', color: '#475569' }, // slate-100 / slate-600
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#b91c1c' },
};

function getProgressColor(pct: number) {
  if (pct >= 90) return '#ef4444'; // red-500
  if (pct >= 60) return '#f59e0b'; // amber-500
  return '#10b981'; // emerald-500
}

export default function FrameworkContractsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(
    async (skeleton = true) => {
      if (!token) return;
      if (skeleton) setLoading(true);
      try {
        const data = await api.frameworkContracts.list(token);
        setContracts(data);
      } catch (e) {
        Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās ielādēt līgumus');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const resetForm = () => {
    setTitle('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setNotes('');
  };

  const closeCreate = () => {
    setCreateVisible(false);
    resetForm();
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!title.trim()) {
      Alert.alert('Aizpildiet nosaukumu');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      Alert.alert('Datuma formāts: GGGG-MM-DD');
      return;
    }

    setCreating(true);
    try {
      await api.frameworkContracts.create(
        {
          title: title.trim(),
          startDate,
          endDate: endDate.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        token,
      );
      haptics.success();
      closeCreate();
      load(false);
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās izveidot līgumu');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenContainer standalone>
      <ScreenHeader
        title="Projekti"
        rightSlot={
          <TouchableOpacity
            hitSlop={15}
            onPress={() => {
              haptics.light();
              setCreateVisible(true);
            }}
          >
            <Plus size={24} color="#111827" />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <SkeletonCard count={4} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={contracts.length === 0 ? s.emptyScroll : s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(false);
              }}
              tintColor="#111827"
            />
          }
        >
          {contracts.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} color={colors.textDisabled} />}
              title="Nav projektu"
              subtitle="Izveidojiet pirmo projektu, lai varētu pasūtīt materiālus un tehniku norādītajam objektam."
              action={
                <Button
                  onPress={() => {
                    haptics.light();
                    setCreateVisible(true);
                  }}
                  style={{ backgroundColor: '#111827' }}
                >
                  Izveidot projektu
                </Button>
              }
            />
          ) : (
            <>
              {contracts.map((contract) => {
                const status = STATUS[contract.status] ?? STATUS.ACTIVE;
                const pct = Math.min(100, contract.totalProgressPct);
                const isDraft = contract.status === 'DRAFT';
                const progColor = getProgressColor(pct);

                return (
                  <TouchableOpacity
                    key={contract.id}
                    style={[s.card, isDraft && s.cardDraft]}
                    onPress={() => {
                      haptics.light();
                      router.push({
                        pathname: '/(buyer)/framework-contract/[id]',
                        params: { id: contract.id },
                      } as any);
                    }}
                    activeOpacity={0.88}
                  >
                    <View style={s.cardTop}>
                      <View style={s.cardTopCopy}>
                        <Text variant="muted" size="sm" style={s.contractNum}>
                          {contract.contractNumber}
                        </Text>
                        <Text style={s.contractTitle}>{contract.title}</Text>
                      </View>
                      <StatusPill
                        label={status.label}
                        bg={status.bg}
                        color={status.color}
                        size="sm"
                      />
                    </View>

                    <View>
                      <View style={s.progRow}>
                        <Text variant="muted" size="sm">
                          Izpilde
                        </Text>
                        <Text size="sm" style={s.progPct}>
                          {pct.toFixed(0)}%
                        </Text>
                      </View>
                      <View style={s.progTrack}>
                        <View
                          style={[
                            s.progFill,
                            { width: `${pct}%` as const, backgroundColor: progColor },
                          ]}
                        />
                      </View>
                      <Text variant="muted" size="sm" style={s.progQty}>
                        {contract.totalConsumedQty.toFixed(1)} /{' '}
                        {contract.totalAgreedQty.toFixed(1)} vien.
                      </Text>
                    </View>

                    <View style={s.metaRow}>
                      <View style={[s.metaChip, isDraft && { backgroundColor: '#fffbeb' }]}>
                        <Calendar size={12} color={isDraft ? '#b45309' : '#6b7280'} />
                        <Text
                          variant="muted"
                          size="sm"
                          style={[s.metaText, isDraft && { color: '#b45309' }]}
                        >
                          {formatDateShort(contract.startDate)}
                          {contract.endDate ? ` – ${formatDateShort(contract.endDate)}` : ''}
                        </Text>
                      </View>
                      <View style={[s.metaChip, isDraft && { backgroundColor: '#fffbeb' }]}>
                        <Package size={12} color={isDraft ? '#b45309' : '#6b7280'} />
                        <Text
                          variant="muted"
                          size="sm"
                          style={[s.metaText, isDraft && { color: '#b45309' }]}
                        >
                          {contract.totalCallOffs} darba uzd.
                        </Text>
                      </View>
                      <ChevronRight size={16} color={isDraft ? '#fcd34d' : '#9ca3af'} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={createVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCreate}
      >
        <ScreenContainer standalone>
          <View style={s.modalHeader}>
            <Text size="xl" style={s.modalTitle}>
              Jauns projekts
            </Text>
            <TouchableOpacity onPress={closeCreate} style={s.modalCloseBtn} activeOpacity={0.7}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={s.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.fieldLabel}>Nosaukums *</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Piem. Grantsšķembas Q1 2026"
              placeholderTextColor="#9ca3af"
              returnKeyType="next"
            />

            <Text style={s.fieldLabel}>Sākuma datums *</Text>
            <TextInput
              style={s.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="GGGG-MM-DD"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={s.fieldLabel}>Beigu datums</Text>
            <TextInput
              style={s.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="GGGG-MM-DD (nav obligāts)"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={s.fieldLabel}>Piezīmes</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Papildinformācija par projektu..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />

            <Button onPress={handleCreate} isLoading={creating} style={s.submitBtnSpacing}>
              Izveidot projektu
            </Button>
          </ScrollView>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  addBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 100, gap: 10 },
  emptyScroll: { flexGrow: 1, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardDraft: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTopCopy: { flex: 1, gap: 2 },
  contractNum: { letterSpacing: 0.3 },
  contractTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  progRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progPct: { fontWeight: '700', color: '#111827' },
  progTrack: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progFill: {
    height: 6,
    backgroundColor: '#111827',
    borderRadius: 999,
  },
  progQty: { marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  modalTitle: { fontWeight: '800', color: '#111827' },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { paddingHorizontal: 16, paddingBottom: 32 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputMulti: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitBtnSpacing: { marginTop: 20 },
});
