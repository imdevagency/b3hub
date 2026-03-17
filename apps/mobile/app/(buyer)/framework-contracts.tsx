/**
 * (buyer)/framework-contracts.tsx
 *
 * Buyer: list of framework contracts (rāmjlīgumi).
 * A framework contract is a long-running agreement with agreed quantities and
 * unit prices that the buyer releases as individual "call-off" transport jobs.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiFrameworkContract, type FrameworkContractStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { ChevronRight, Plus, FileText, Calendar, Package, X } from 'lucide-react-native';

// ── Status map ────────────────────────────────────────────────────────────────

const STATUS: Record<FrameworkContractStatus, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: '#15803d' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#b91c1c' },
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FrameworkContractsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New contract form
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // ── Load ─────────────────────────────────────────────────────────────────────

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

  // ── Create ───────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setTitle('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setNotes('');
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
      setCreateVisible(false);
      resetForm();
      load(false);
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās izveidot līgumu');
    } finally {
      setCreating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Rāmjlīgumi</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => {
            haptics.light();
            setCreateVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#111827" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
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
            <View style={s.empty}>
              <FileText size={44} color="#d1d5db" />
              <Text style={s.emptyTitle}>Nav rāmjlīgumu</Text>
              <Text style={s.emptyDesc}>
                Izveidojiet rāmjlīgumu atkārtotiem materiālu vai kravas pārvadāšanas pasūtījumiem ar
                fiksētām cenām.
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => {
                  haptics.light();
                  setCreateVisible(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={s.emptyBtnText}>Izveidot pirmo līgumu</Text>
              </TouchableOpacity>
            </View>
          ) : (
            contracts.map((c) => {
              const st = STATUS[c.status] ?? STATUS.ACTIVE;
              const pct = Math.min(100, c.totalProgressPct);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={s.card}
                  onPress={() => {
                    haptics.light();
                    router.push({
                      pathname: '/(buyer)/framework-contract/[id]',
                      params: { id: c.id },
                    } as any);
                  }}
                  activeOpacity={0.88}
                >
                  {/* Top row: number + status */}
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.contractNum}>{c.contractNumber}</Text>
                      <Text style={s.contractTitle} numberOfLines={2}>
                        {c.title}
                      </Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {/* Progress */}
                  <View>
                    <View style={s.progRow}>
                      <Text style={s.progLabel}>Izpilde</Text>
                      <Text style={s.progPct}>{pct.toFixed(0)}%</Text>
                    </View>
                    <View style={s.progTrack}>
                      <View style={[s.progFill, { width: `${pct}%` as any }]} />
                    </View>
                    <Text style={s.progQty}>
                      {c.totalConsumedQty.toFixed(1)} / {c.totalAgreedQty.toFixed(1)} vien.
                    </Text>
                  </View>

                  {/* Meta row */}
                  <View style={s.metaRow}>
                    <View style={s.metaChip}>
                      <Calendar size={11} color="#6b7280" />
                      <Text style={s.metaText}>
                        {formatDateShort(c.startDate)}
                        {c.endDate ? ` – ${formatDateShort(c.endDate)}` : ''}
                      </Text>
                    </View>
                    <View style={s.metaChip}>
                      <Package size={11} color="#6b7280" />
                      <Text style={s.metaText}>{c.totalCallOffs} darba uzd.</Text>
                    </View>
                    <ChevronRight size={14} color="#d1d5db" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Create contract modal ── */}
      <Modal
        visible={createVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setCreateVisible(false);
          resetForm();
        }}
      >
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Jauns rāmjlīgums</Text>
            <TouchableOpacity
              onPress={() => {
                setCreateVisible(false);
                resetForm();
              }}
              style={s.modalCloseBtn}
              activeOpacity={0.7}
            >
              <X size={20} color="#6b7280" />
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
              placeholder="Papildinformācija par līgumu..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[s.submitBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>Izveidot līgumu</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f2f2f7',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  // Empty
  empty: {
    marginTop: 40,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Contract card
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  contractNum: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 2 },
  contractTitle: { fontSize: 16, fontWeight: '700', color: '#111827', lineHeight: 22 },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Progress
  progRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  progPct: { fontSize: 12, color: '#111827', fontWeight: '700' },
  progTrack: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progFill: {
    height: 6,
    backgroundColor: '#111827',
    borderRadius: 3,
  },
  progQty: { fontSize: 11, color: '#9ca3af', marginTop: 4 },

  // Meta chips
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
  },
  metaText: { fontSize: 11, color: '#6b7280', flex: 1 },

  // Modal
  modalRoot: { flex: 1, backgroundColor: '#f2f2f7' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { padding: 20, gap: 6 },

  // Form
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
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
  submitBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
