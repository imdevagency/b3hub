/**
 * (buyer)/framework-contract/[id].tsx
 *
 * Buyer: framework contract detail — positions with progress and call-off release.
 * A "call-off" converts an agreed position into an actual transport job on the job board.
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
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiFrameworkContract,
  type ApiFrameworkPosition,
  type FrameworkContractStatus,
  type CreateCallOffInput,
} from '@/lib/api';
import { formatDate, formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  Package,
  Truck,
  Trash2,
  Calendar,
  MapPin,
  TrendingUp,
  Send,
  ChevronRight,
  Clock,
} from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTRACT_STATUS: Record<
  FrameworkContractStatus,
  { label: string; bg: string; color: string }
> = {
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: '#15803d' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#b91c1c' },
};

const POSITION_TYPE_LABEL: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  MATERIAL_DELIVERY: { label: 'Materiālu piegāde', icon: Package },
  WASTE_DISPOSAL: { label: 'Atkritumu izvešana', icon: Trash2 },
  FREIGHT_TRANSPORT: { label: 'Kravas pārvadāšana', icon: Truck },
};

const CALLOFF_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Pieejams',
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Apstiprināts',
  EN_ROUTE_PICKUP: 'Brauc uz iekraušanu',
  AT_PICKUP: 'Pie iekraušanas',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Brauc uz piegādi',
  AT_DELIVERY: 'Pie piegādes',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FrameworkContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [contract, setContract] = useState<ApiFrameworkContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Call-off form
  const [callOffPosition, setCallOffPosition] = useState<ApiFrameworkPosition | null>(null);
  const [qty, setQty] = useState('');
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [callOffNotes, setCallOffNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(
    async (skeleton = true) => {
      if (!token || !id) return;
      if (skeleton) setLoading(true);
      try {
        const data = await api.frameworkContracts.get(String(id), token);
        setContract(data);
      } catch (e) {
        Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās ielādēt līgumu');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // ── Open call-off form ────────────────────────────────────────────────────

  const openCallOff = (position: ApiFrameworkPosition) => {
    haptics.light();
    setCallOffPosition(position);
    setQty('');
    setPickupDate(new Date().toISOString().split('T')[0]);
    const next = new Date();
    next.setDate(next.getDate() + 1);
    setDeliveryDate(next.toISOString().split('T')[0]);
    setCallOffNotes('');
  };

  const handleCallOff = async () => {
    if (!token || !contract || !callOffPosition) return;

    const qtyNum = parseFloat(qty.replace(',', '.'));
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Ievadiet pareizu daudzumu');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      Alert.alert('Datumu formāts: GGGG-MM-DD');
      return;
    }

    setSubmitting(true);
    try {
      const dto: CreateCallOffInput = {
        quantity: qtyNum,
        pickupDate,
        deliveryDate,
        notes: callOffNotes.trim() || undefined,
      };
      const result = await api.frameworkContracts.createCallOff(
        contract.id,
        callOffPosition.id,
        dto,
        token,
      );
      haptics.success();
      setCallOffPosition(null);
      Alert.alert(
        '✓ Darba uzdevums izveidots',
        `${result.jobNumber} ir pievienots darbu sludinājumu dēlim.`,
        [{ text: 'Labi' }],
      );
      load(false);
    } catch (e) {
      Alert.alert('Kļūda', e instanceof Error ? e.message : 'Neizdevās izveidot darba uzdevumu');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenContainer standalone>
        <View style={s.center}>
          <ActivityIndicator color="#111827" size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!contract) {
    return (
      <ScreenContainer standalone>
        <View style={s.center}>
          <Text style={s.emptyText}>Līgums nav atrasts</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={s.link}>← Atpakaļ</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const st = CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.ACTIVE;
  const overallPct = Math.min(100, contract.totalProgressPct);
  const canRelease = contract.status === 'ACTIVE';

  return (
    <ScreenContainer standalone>
      <ScreenHeader
        title={`${contract.contractNumber} · ${contract.title}`}
        rightSlot={<StatusPill label={st.label} bg={st.bg} color={st.color} size="sm" />}
      />

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
        {/* ── Overview card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Kopējā izpilde</Text>

          {/* Overall progress bar */}
          <View>
            <View style={s.progRow}>
              <Text style={s.progLabel}>
                {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)} vien.
              </Text>
              <Text style={s.progPct}>{overallPct.toFixed(0)}%</Text>
            </View>
            <View style={s.progTrack}>
              <View style={[s.progFill, { width: `${overallPct}%` as any }]} />
            </View>
          </View>

          {/* Date range */}
          <View style={s.infoRow}>
            <Calendar size={13} color="#6b7280" />
            <Text style={s.infoText}>
              {formatDate(contract.startDate)}
              {contract.endDate ? ` – ${formatDate(contract.endDate)}` : ''}
            </Text>
          </View>

          {contract.notes && (
            <View style={s.infoRow}>
              <Text style={s.notesText}>{contract.notes}</Text>
            </View>
          )}
        </View>

        {/* ── Positions ── */}
        <Text style={s.sectionTitle}>Pozīcijas ({contract.positions.length})</Text>

        {contract.positions.length === 0 && (
          <View style={s.emptyCard}>
            <TrendingUp size={28} color="#d1d5db" />
            <Text style={s.emptyCardText}>Nav pievienotu pozīciju</Text>
          </View>
        )}

        {contract.positions.map((pos) => {
          const typeMeta = POSITION_TYPE_LABEL[pos.positionType] ?? {
            label: pos.positionType,
            icon: Package,
          };
          const PosIcon = typeMeta.icon;
          const posPct = Math.min(100, pos.progressPct);
          const callOffCount = pos.callOffs?.length ?? 0;

          return (
            <View key={pos.id} style={s.posCard}>
              {/* Position header */}
              <View style={s.posHeader}>
                <View style={s.posIconWrap}>
                  <PosIcon size={16} color="#374151" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.posTypeLabel}>{typeMeta.label}</Text>
                  <Text style={s.posDesc} numberOfLines={2}>
                    {pos.description}
                  </Text>
                </View>
              </View>

              {/* Position progress */}
              <View>
                <View style={s.progRow}>
                  <Text style={s.progLabel}>
                    {pos.consumedQty.toFixed(1)} / {pos.agreedQty.toFixed(1)} {pos.unit}
                  </Text>
                  <Text style={s.progPct}>{posPct.toFixed(0)}%</Text>
                </View>
                <View style={s.progTrack}>
                  <View
                    style={[
                      s.progFill,
                      { width: `${posPct}%` as any },
                      posPct >= 100 && s.progFillDone,
                    ]}
                  />
                </View>
                <Text style={s.progRemaining}>
                  Atlikušie: {pos.remainingQty.toFixed(1)} {pos.unit}
                  {pos.unitPrice != null && ` · €${pos.unitPrice.toFixed(2)}/${pos.unit}`}
                </Text>
              </View>

              {/* Pickup/Delivery hint */}
              {(pos.pickupCity || pos.deliveryCity) && (
                <View style={s.posRoute}>
                  {pos.pickupCity && (
                    <View style={s.posRouteChip}>
                      <View style={[s.routeDot, { backgroundColor: '#111827' }]} />
                      <Text style={s.posRouteText} numberOfLines={1}>
                        {pos.pickupCity}
                      </Text>
                    </View>
                  )}
                  {pos.pickupCity && pos.deliveryCity && <Text style={s.routeArrow}>→</Text>}
                  {pos.deliveryCity && (
                    <View style={s.posRouteChip}>
                      <View style={[s.routeDot, { backgroundColor: '#dc2626' }]} />
                      <Text style={s.posRouteText} numberOfLines={1}>
                        {pos.deliveryCity}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Call-offs for this position */}
              {callOffCount > 0 && (
                <View style={s.callOffList}>
                  {(pos.callOffs ?? []).slice(0, 3).map((co) => (
                    <View key={co.id} style={s.callOffRow}>
                      <Text style={s.callOffNum}>{co.jobNumber}</Text>
                      <Text style={s.callOffStatus}>
                        {CALLOFF_STATUS_LABEL[co.status] ?? co.status}
                      </Text>
                      {co.cargoWeight != null && (
                        <Text style={s.callOffWeight}>{(co.cargoWeight / 1000).toFixed(1)} t</Text>
                      )}
                    </View>
                  ))}
                  {callOffCount > 3 && (
                    <Text style={s.callOffMore}>+{callOffCount - 3} vairāk</Text>
                  )}
                </View>
              )}

              {/* Release call-off button */}
              {canRelease && pos.remainingQty > 0 && (
                <TouchableOpacity
                  style={s.releaseBtn}
                  onPress={() => openCallOff(pos)}
                  activeOpacity={0.85}
                >
                  <Send size={14} color="#111827" />
                  <Text style={s.releaseBtnText}>Izlaist darba uzdevumu</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* ── Recent call-offs (contract level) ── */}
        {contract.recentCallOffs.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Nesenie darba uzdevumi</Text>
            <View style={s.card}>
              {contract.recentCallOffs.map((co, i) => (
                <View
                  key={co.id}
                  style={[s.recentRow, i < contract.recentCallOffs.length - 1 && s.recentRowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentNum}>{co.jobNumber}</Text>
                    <View style={s.recentMeta}>
                      <Clock size={11} color="#9ca3af" />
                      <Text style={s.recentMetaText}>{formatDateShort(co.pickupDate)}</Text>
                      {co.deliveryCity && (
                        <>
                          <Text style={s.recentMetaDot}>·</Text>
                          <Text style={s.recentMetaText}>{co.deliveryCity}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Text style={s.recentStatus}>{CALLOFF_STATUS_LABEL[co.status] ?? co.status}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Call-off bottom sheet ── */}
      <BottomSheet
        visible={callOffPosition !== null}
        onClose={() => setCallOffPosition(null)}
        title="Izlaist darba uzdevumu"
        subtitle={callOffPosition?.description}
        scrollable
      >
        <View style={s.formWrap}>
          {/* Quantity */}
          <Text style={s.fieldLabel}>Daudzums ({callOffPosition?.unit ?? 't'}) *</Text>
          <TextInput
            style={s.input}
            value={qty}
            onChangeText={setQty}
            placeholder={`Piem. ${callOffPosition?.remainingQty?.toFixed(1) ?? '10'}`}
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />

          {/* Pickup date */}
          <Text style={s.fieldLabel}>Iekraušanas datums *</Text>
          <TextInput
            style={s.input}
            value={pickupDate}
            onChangeText={setPickupDate}
            placeholder="GGGG-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          {/* Delivery date */}
          <Text style={s.fieldLabel}>Piegādes datums *</Text>
          <TextInput
            style={s.input}
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="GGGG-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          {/* Notes */}
          <Text style={s.fieldLabel}>Piezīmes</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={callOffNotes}
            onChangeText={setCallOffNotes}
            placeholder="Papildinformācija šoferiim..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleCallOff}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Izveidot darba uzdevumu</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#6b7280' },
  link: { fontSize: 15, color: '#111827', fontWeight: '600' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractNum: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginBottom: 1 },
  contractTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  // Section title
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },

  // Generic card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Overview
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: '#374151', flex: 1 },
  notesText: { fontSize: 13, color: '#6b7280', fontStyle: 'italic', lineHeight: 18 },

  // Progress
  progRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progLabel: { fontSize: 12, color: '#6b7280' },
  progPct: { fontSize: 12, color: '#111827', fontWeight: '700' },
  progTrack: { height: 7, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: 7, backgroundColor: '#111827', borderRadius: 4 },
  progFillDone: { backgroundColor: '#059669' },
  progRemaining: { fontSize: 11, color: '#9ca3af', marginTop: 5 },

  // Position card
  posCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  posHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  posIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posTypeLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 2 },
  posDesc: { fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 19 },

  // Position route
  posRoute: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  posRouteChip: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  routeDot: { width: 7, height: 7, borderRadius: 3.5 },
  posRouteText: { fontSize: 12, color: '#6b7280', flex: 1 },
  routeArrow: { fontSize: 12, color: '#9ca3af' },

  // Call-offs inside position
  callOffList: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    overflow: 'hidden',
  },
  callOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  callOffNum: { fontSize: 12, fontWeight: '700', color: '#374151', width: 90 },
  callOffStatus: { flex: 1, fontSize: 11, color: '#6b7280' },
  callOffWeight: { fontSize: 11, color: '#9ca3af' },
  callOffMore: { fontSize: 11, color: '#9ca3af', paddingHorizontal: 12, paddingVertical: 6 },

  // Release button
  releaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  releaseBtnText: { fontSize: 14, fontWeight: '700', color: '#111827' },

  // Recent call-offs
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  recentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  recentNum: { fontSize: 13, fontWeight: '700', color: '#111827' },
  recentMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  recentMetaText: { fontSize: 11, color: '#9ca3af' },
  recentMetaDot: { fontSize: 11, color: '#d1d5db' },
  recentStatus: { fontSize: 11, color: '#6b7280', textAlign: 'right' },

  // Empty position card
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyCardText: { fontSize: 14, color: '#9ca3af' },

  // Call-off form
  formWrap: { paddingHorizontal: 20, paddingBottom: 32, gap: 6 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
