/**
 * projects.tsx — Buyer: Framework Contracts (Projekti) list
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { FolderOpen, Plus, X, ChevronRight, Layers } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiFrameworkContract, type FrameworkContractStatus } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';

// ── helpers ────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_META: Record<FrameworkContractStatus, { label: string; dot: string; bg: string }> = {
  ACTIVE: { label: 'Aktīvs', dot: '#22c55e', bg: '#dcfce7' },
  COMPLETED: { label: 'Pabeigts', dot: '#3b82f6', bg: '#dbeafe' },
  EXPIRED: { label: 'Beidzies', dot: '#f59e0b', bg: '#fef9c3' },
  CANCELLED: { label: 'Atcelts', dot: '#9ca3af', bg: '#f3f4f6' },
};

// ── Progress bar ───────────────────────────────────────────────

function ProgressBar({ pct, color = '#111827' }: { pct: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <View style={styles.progressTrack}>
      <View
        style={[styles.progressFill, { width: `${clamped}%` as any, backgroundColor: color }]}
      />
    </View>
  );
}

// ── Contract card ──────────────────────────────────────────────

function ContractCard({
  contract,
  onPress,
}: {
  contract: ApiFrameworkContract;
  onPress: () => void;
}) {
  const meta = STATUS_META[contract.status];
  const pct = contract.totalProgressPct ?? 0;
  const fillColor = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contractNumber}>{contract.contractNumber}</Text>
          <Text style={styles.contractTitle} numberOfLines={1}>
            {contract.title}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
          <Text style={[styles.statusLabel, { color: meta.dot }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Izpilde</Text>
          <Text style={styles.progressPct}>{pct.toFixed(0)}%</Text>
        </View>
        <ProgressBar pct={pct} color={fillColor} />
        <View style={styles.progressStats}>
          <Text style={styles.statText}>
            {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)}
          </Text>
          <Text style={styles.statText}>{contract.totalCallOffs} pasūtījumi</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerDate}>
          {fmtDate(contract.startDate)} – {fmtDate(contract.endDate)}
        </Text>
        <ChevronRight size={16} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );
}

// ── Create modal ───────────────────────────────────────────────

function CreateModal({
  visible,
  onClose,
  onCreated,
  token,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (c: ApiFrameworkContract) => void;
  token: string;
}) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  function reset() {
    setTitle('');
    setStartDate('');
    setEndDate('');
    setNotes('');
  }

  async function handleCreate() {
    if (!title.trim()) {
      showToast('Ievadiet projekta nosaukumu', 'error');
      return;
    }
    if (!startDate.trim()) {
      showToast('Ievadiet sākuma datumu (YYYY-MM-DD)', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await api.frameworkContracts.create(
        {
          title: title.trim(),
          startDate,
          endDate: endDate || undefined,
          notes: notes || undefined,
        },
        token,
      );
      onCreated(result);
      reset();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Kļūda', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Jauns projekts</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Nosaukums *</Text>
          <TextInput
            style={styles.input}
            placeholder="piem. Smilšu piegāde 2025"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Sākuma datums * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2025-01-01"
            value={startDate}
            onChangeText={setStartDate}
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>Beigu datums (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2025-12-31"
            value={endDate}
            onChangeText={setEndDate}
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>Piezīmes</Text>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
            placeholder="Papildu informācija…"
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor="#9ca3af"
            multiline
          />

          <TouchableOpacity
            style={[styles.createBtn, saving && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Izveidot projektu</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────

export default function ProjectsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!token) return;
      if (!quiet) setLoading(true);
      try {
        const data = await api.frameworkContracts.list(token);
        setContracts(data);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : 'Kļūda ielādējot projektus', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load(true);
  }

  return (
    <ScreenContainer standalone topInset={0}>
      {/* header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderLeft}>
          <FolderOpen size={20} color="#111827" />
          <Text style={styles.pageTitle}>Projekti</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => {
            haptics.light();
            setShowCreate(true);
          }}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.newBtnText}>Jauns</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={<Layers size={32} color="#9ca3af" />}
          title="Nav projektu"
          subtitle="Izveidojiet pirmo ietvarlīgumu, lai sāktu izsekot piegādes."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {contracts.map((c) => (
            <ContractCard
              key={c.id}
              contract={c}
              onPress={() => {
                haptics.light();
                router.push(`/(buyer)/project/${c.id}` as any);
              }}
            />
          ))}
        </ScrollView>
      )}

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(c) => {
          setContracts((prev) => [c, ...prev]);
          showToast('Projekts izveidots', 'success');
        }}
        token={token ?? ''}
      />
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  // card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  contractNumber: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 2 },
  contractTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  // progress
  progressSection: { gap: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, color: '#6b7280' },
  progressPct: { fontSize: 12, fontWeight: '600', color: '#111827' },
  progressTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { fontSize: 11, color: '#9ca3af' },
  // footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f9fafb',
    paddingTop: 8,
  },
  footerDate: { fontSize: 12, color: '#9ca3af' },
  // modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fafafa',
  },
  createBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
