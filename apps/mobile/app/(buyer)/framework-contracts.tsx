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
    <ScreenContainer>
      {/* Header with Big Title */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Projekti</Text>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => {
            haptics.light();
            setCreateVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
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
            <View style={s.listGap}>
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
                    activeOpacity={0.7}
                  >
                    <View style={s.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.contractTitle} numberOfLines={1}>
                          {contract.title}
                        </Text>
                        <Text style={s.contractNum}>{contract.contractNumber}</Text>
                      </View>
                      <StatusPill
                        label={status.label}
                        bg={status.bg}
                        color={status.color}
                        size="sm"
                      />
                    </View>

                    {/* Minimal Progress Bar */}
                    <View style={s.progWrapper}>
                      <View style={s.progHeader}>
                        <Text style={s.progLabel}>Izpilde</Text>
                        <Text style={s.progValue}>{pct.toFixed(0)}%</Text>
                      </View>
                      <View style={s.progTrack}>
                        <View
                          style={[s.progFill, { width: `${pct}%`, backgroundColor: progColor }]}
                        />
                      </View>
                    </View>

                    <View style={s.cardFooter}>
                      <View style={s.metaItem}>
                        <Calendar size={14} color="#6b7280" />
                        <Text style={s.metaText}>{formatDateShort(contract.startDate)}</Text>
                      </View>
                      <View style={s.metaItem}>
                        <Package size={14} color="#6b7280" />
                        <Text style={s.metaText}>{contract.totalCallOffs} pasūtījumi</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
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
              <X size={24} color="#111827" />
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

            <Button onPress={handleCreate} isLoading={creating} style={s.submitActionBtn}>
              <Text style={s.submitActionBtnText}>Izveidot projektu</Text>
            </Button>
          </ScrollView>
        </ScreenContainer>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyScroll: { flexGrow: 1, paddingBottom: 40 },
  listGap: { gap: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)', // Subtle border for definition
  },
  cardDraft: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  contractTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  contractNum: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  progWrapper: {
    marginBottom: 16,
  },
  progHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  progTrack: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progFill: {
    height: '100%',
    borderRadius: 999,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },

  // Modal styles (unchanged mostly, just tweaking)
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { padding: 24, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputMulti: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  submitActionBtn: {
    marginTop: 32,
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitActionBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
