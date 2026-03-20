/**
 * project/[id].tsx — Buyer: Framework Contract detail
 * Shows positions, per-position progress, call-off history & release flow.
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
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiFrameworkContract,
  type ApiFrameworkPosition,
  type ApiFrameworkCallOff,
  type FrameworkContractStatus,
  type CreateCallOffInput,
} from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';

// ── helpers ────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
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

const POS_TYPE_LABEL: Record<string, string> = {
  MATERIAL_DELIVERY: 'Materiālu piegāde',
  WASTE_DISPOSAL: 'Atkritumu izvešana',
  FREIGHT_TRANSPORT: 'Kravas transports',
};

// ── Sub-components ─────────────────────────────────────────────

function ProgressBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 90 ? '#ef4444' : clamped >= 60 ? '#f59e0b' : '#22c55e';
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${clamped}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function CallOffRow({ item }: { item: ApiFrameworkCallOff }) {
  const isDone = ['DELIVERED', 'COMPLETED'].includes(item.status.toUpperCase());
  return (
    <View style={styles.callOffRow}>
      {isDone ? <CheckCircle2 size={14} color="#22c55e" /> : <Clock size={14} color="#f59e0b" />}
      <View style={{ flex: 1 }}>
        <Text style={styles.callOffJob}>{item.jobNumber}</Text>
        {item.deliveryCity ? <Text style={styles.callOffSub}>{item.deliveryCity}</Text> : null}
      </View>
      <Text style={styles.callOffDate}>{fmtDate(item.pickupDate)}</Text>
    </View>
  );
}

// ── Call-off modal ─────────────────────────────────────────────

function CallOffModal({
  visible,
  position,
  contractId,
  token,
  onClose,
  onCreated,
}: {
  visible: boolean;
  position: ApiFrameworkPosition | null;
  contractId: string;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [qty, setQty] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setQty('');
    setPickupDate('');
    setDeliveryDate('');
    setPickupCity('');
    setDeliveryCity('');
    setNotes('');
  }

  async function handleSubmit() {
    if (!position) return;
    const quantity = parseFloat(qty);
    if (!qty || isNaN(quantity) || quantity <= 0) {
      showToast('Ievadiet derīgu daudzumu', 'error');
      return;
    }
    if (!pickupDate.trim()) {
      showToast('Ievadiet izbraukšanas datumu (YYYY-MM-DD)', 'error');
      return;
    }
    setSaving(true);
    try {
      const body: CreateCallOffInput = {
        quantity,
        pickupDate,
        deliveryDate: deliveryDate || undefined,
        pickupCity: pickupCity || position.pickupCity || undefined,
        deliveryCity: deliveryCity || position.deliveryCity || undefined,
        notes: notes || undefined,
      };
      await api.frameworkContracts.createCallOff(contractId, position.id, body, token);
      showToast('Pasūtījums izveidots', 'success');
      reset();
      onCreated();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Kļūda', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!position) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Izsaukt pasūtījumu"
      subtitle={position.description}
      scrollable
    >
      <View style={{ gap: 2 }}>
        <View style={styles.positionChip}>
          <Truck size={13} color="#6b7280" />
          <Text style={styles.positionChipText} numberOfLines={1}>
            {position.description}
          </Text>
        </View>

        <Text style={styles.fieldLabel}>Daudzums * ({position.unit})</Text>
        <TextInput
          style={styles.input}
          placeholder={`Atlikums: ${position.remainingQty.toFixed(1)} ${position.unit}`}
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.fieldLabel}>Izbraukšanas datums * (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2025-01-15"
          value={pickupDate}
          onChangeText={setPickupDate}
          keyboardType="numbers-and-punctuation"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.fieldLabel}>Piegādes datums (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2025-01-15"
          value={deliveryDate}
          onChangeText={setDeliveryDate}
          keyboardType="numbers-and-punctuation"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.fieldLabel}>Iekraušanas pilsēta</Text>
        <TextInput
          style={styles.input}
          placeholder={position.pickupCity ?? 'piem. Rīga'}
          value={pickupCity}
          onChangeText={setPickupCity}
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.fieldLabel}>Izkraušanas pilsēta</Text>
        <TextInput
          style={styles.input}
          placeholder={position.deliveryCity ?? 'piem. Jūrmala'}
          value={deliveryCity}
          onChangeText={setDeliveryCity}
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.fieldLabel}>Piezīmes</Text>
        <TextInput
          style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
          placeholder="Papildu instrukcijas…"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholderTextColor="#9ca3af"
        />

        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Izveidot pasūtījumu</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// ── Position card ──────────────────────────────────────────────

function PositionCard({
  pos,
  onCallOff,
}: {
  pos: ApiFrameworkPosition;
  onCallOff: (p: ApiFrameworkPosition) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = pos.progressPct ?? 0;

  return (
    <View style={styles.posCard}>
      <View style={styles.posHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.posType}>{POS_TYPE_LABEL[pos.positionType] ?? pos.positionType}</Text>
          <Text style={styles.posDesc} numberOfLines={2}>
            {pos.description}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.callOffBtn}
          onPress={() => {
            haptics.light();
            onCallOff(pos);
          }}
        >
          <Plus size={13} color="#111827" />
          <Text style={styles.callOffBtnText}>Izsaukt</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.posProgress}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {pos.consumedQty.toFixed(1)} / {pos.agreedQty.toFixed(1)} {pos.unit}
          </Text>
          <Text style={styles.progressPct}>{pct.toFixed(0)}%</Text>
        </View>
        <ProgressBar pct={pct} />
      </View>

      {pos.unitPrice != null && (
        <Text style={styles.posPrice}>
          €{pos.unitPrice.toFixed(2)} / {pos.unit}
          &nbsp;&nbsp;·&nbsp;&nbsp; Kopā: €{(pos.unitPrice * pos.agreedQty).toFixed(2)}
        </Text>
      )}

      {pos.callOffs.length > 0 && (
        <TouchableOpacity
          style={styles.expandToggle}
          onPress={() => {
            haptics.light();
            setExpanded((v) => !v);
          }}
        >
          <Text style={styles.expandLabel}>{pos.callOffs.length} pasūtījumi</Text>
          {expanded ? (
            <ChevronUp size={14} color="#6b7280" />
          ) : (
            <ChevronDown size={14} color="#6b7280" />
          )}
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.callOffList}>
          {pos.callOffs.map((co) => (
            <CallOffRow key={co.id} item={co} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [contract, setContract] = useState<ApiFrameworkContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [callOffPos, setCallOffPos] = useState<ApiFrameworkPosition | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!token || !id) return;
      if (!quiet) setLoading(true);
      try {
        const data = await api.frameworkContracts.get(id, token);
        setContract(data);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : 'Kļūda', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id],
  );

  useEffect(() => {
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load(true);
  }

  if (loading) {
    return (
      <ScreenContainer standalone bg="#ffffff">
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </ScreenContainer>
    );
  }

  if (!contract) {
    return (
      <ScreenContainer standalone bg="#ffffff">
        <View style={styles.center}>
          <Text style={{ color: '#6b7280' }}>Projekts nav atrasts</Text>
        </View>
      </ScreenContainer>
    );
  }

  const meta = STATUS_META[contract.status];
  const pct = contract.totalProgressPct ?? 0;
  const fillColor = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e';

  return (
    <ScreenContainer standalone bg="#ffffff">
      {/* back header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {contract.title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
          <Text style={[styles.statusLabel, { color: meta.dot }]}>{meta.label}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* contract summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.contractNumber}>{contract.contractNumber}</Text>

          <View style={styles.summaryGrid}>
            <View>
              <Text style={styles.summaryKey}>Sākums</Text>
              <Text style={styles.summaryVal}>{fmtDate(contract.startDate)}</Text>
            </View>
            <View>
              <Text style={styles.summaryKey}>Beigas</Text>
              <Text style={styles.summaryVal}>{fmtDate(contract.endDate)}</Text>
            </View>
            <View>
              <Text style={styles.summaryKey}>Pasūtījumi</Text>
              <Text style={styles.summaryVal}>{contract.totalCallOffs}</Text>
            </View>
          </View>

          <View style={styles.overallProgress}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Kopējā izpilde</Text>
              <Text style={[styles.progressPct, { color: fillColor }]}>{pct.toFixed(0)}%</Text>
            </View>
            <ProgressBar pct={pct} height={10} />
            <Text style={styles.progressSub}>
              {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)} vienības
            </Text>
          </View>

          {contract.notes ? <Text style={styles.notes}>{contract.notes}</Text> : null}
        </View>

        {/* positions */}
        <Text style={styles.sectionTitle}>Pozīcijas ({contract.positions.length})</Text>
        {contract.positions.length === 0 ? (
          <View style={styles.noPosCard}>
            <Text style={styles.noPosText}>
              Nav pozīciju. Pievienojiet pozīciju, lai izsauktu pasūtījumus.
            </Text>
          </View>
        ) : (
          contract.positions.map((pos) => (
            <PositionCard key={pos.id} pos={pos} onCallOff={(p) => setCallOffPos(p)} />
          ))
        )}
      </ScrollView>

      <CallOffModal
        visible={callOffPos != null}
        position={callOffPos}
        contractId={contract.id}
        token={token ?? ''}
        onClose={() => setCallOffPos(null)}
        onCreated={() => load(true)}
      />
    </ScreenContainer>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
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
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  // summary card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contractNumber: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  summaryGrid: { flexDirection: 'row', gap: 20 },
  summaryKey: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  summaryVal: { fontSize: 14, fontWeight: '600', color: '#111827' },
  overallProgress: { gap: 6 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13, color: '#6b7280' },
  progressPct: { fontSize: 13, fontWeight: '700', color: '#111827' },
  track: { backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  progressSub: { fontSize: 12, color: '#9ca3af' },
  notes: { fontSize: 13, color: '#6b7280', lineHeight: 19, fontStyle: 'italic' },
  // section
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 4 },
  noPosCard: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  noPosText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  // position card
  posCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  posHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  posType: { fontSize: 11, color: '#6b7280', fontWeight: '500', marginBottom: 1 },
  posDesc: { fontSize: 14, fontWeight: '600', color: '#111827' },
  callOffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  callOffBtnText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  posProgress: { gap: 4 },
  progressSub2: { fontSize: 11, color: '#9ca3af' },
  posPrice: { fontSize: 12, color: '#6b7280' },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  expandLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  callOffList: { gap: 6 },
  callOffRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callOffJob: { fontSize: 13, fontWeight: '500', color: '#374151' },
  callOffSub: { fontSize: 11, color: '#9ca3af' },
  callOffDate: { fontSize: 12, color: '#9ca3af' },
  // modal
  positionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  positionChipText: { fontSize: 13, color: '#374151', flex: 1 },
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
  submitBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
