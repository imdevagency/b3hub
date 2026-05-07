/**
 * (buyer)/framework-contract/[id].tsx
 *
 * Buyer: framework contract detail view.
 *
 * Additions over the seller read-only view:
 * — "Aktivizēt" button for DRAFT contracts (OWNER/permCreateContracts)
 * — "Izpildīt" (release call-off) button per position when ACTIVE + permReleaseCallOffs
 * — Call-off history for each position
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
  type ApiFrameworkContract,
  type ApiFrameworkPosition,
  type ApiFrameworkCallOff,
  type FrameworkPositionType,
  type CreateCallOffInput,
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
import { Truck, Recycle, Package, ChevronDown, ChevronUp } from 'lucide-react-native';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getProgressColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

function positionTypeLabel(t: FrameworkPositionType): string {
  switch (t) {
    case 'MATERIAL_DELIVERY':
      return 'Materiāls';
    case 'WASTE_DISPOSAL':
      return 'Atkritumi';
    case 'FREIGHT_TRANSPORT':
      return 'Transports';
    default:
      return t;
  }
}

function positionTypeIcon(t: FrameworkPositionType) {
  switch (t) {
    case 'MATERIAL_DELIVERY':
      return <Package size={14} color="#6b7280" />;
    case 'WASTE_DISPOSAL':
      return <Recycle size={14} color="#6b7280" />;
    case 'FREIGHT_TRANSPORT':
      return <Truck size={14} color="#6b7280" />;
  }
}

// ─── Call-off status badge ───────────────────────────────────────────────────

function callOffStatusColor(status: string): { bg: string; color: string } {
  switch (status) {
    case 'COMPLETED':
      return { bg: '#d1fae5', color: '#065f46' };
    case 'CANCELLED':
      return { bg: '#fee2e2', color: '#991b1b' };
    case 'IN_TRANSIT':
      return { bg: '#dbeafe', color: '#1e40af' };
    default:
      return { bg: '#fef9c3', color: '#854d0e' };
  }
}

// ─── Position card with expandable call-off list ────────────────────────────

function PositionCard({
  pos,
  canRelease,
  onRelease,
}: {
  pos: ApiFrameworkPosition;
  canRelease: boolean;
  onRelease: (pos: ApiFrameworkPosition) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.min(100, pos.progressPct);
  const progColor = getProgressColor(pct);

  return (
    <View style={ps.card}>
      {/* Header row */}
      <View style={ps.topRow}>
        <View style={ps.typeBadge}>
          {positionTypeIcon(pos.positionType)}
          <Text style={ps.typeBadgeText}>{positionTypeLabel(pos.positionType)}</Text>
        </View>
        {canRelease && (
          <TouchableOpacity
            style={ps.releaseBtn}
            onPress={() => onRelease(pos)}
            activeOpacity={0.8}
          >
            <Text style={ps.releaseBtnText}>Izpildīt</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={ps.description}>{pos.description}</Text>

      {/* Route */}
      {(pos.pickupCity || pos.deliveryCity) && (
        <Text style={ps.route}>
          {pos.pickupCity ?? '—'} → {pos.deliveryCity ?? '—'}
        </Text>
      )}

      {/* Qty row */}
      <View style={ps.qtyRow}>
        <Text style={ps.qtyLabel}>
          Izpildīts: {pos.consumedQty} / {pos.agreedQty} {pos.unit}
        </Text>
        {pos.unitPrice != null && (
          <Text style={ps.price}>
            €{pos.unitPrice.toFixed(2)}/{pos.unit}
          </Text>
        )}
      </View>

      {/* Progress */}
      <View style={ps.progressRow}>
        <View style={ps.progressTrack}>
          <View
            style={[ps.progressFill, { width: `${pct}%` as any, backgroundColor: progColor }]}
          />
        </View>
        <Text style={[ps.progressLabel, { color: progColor }]}>{pct}%</Text>
      </View>

      {/* Call-off toggle */}
      {pos.callOffs.length > 0 && (
        <TouchableOpacity
          style={ps.toggleRow}
          onPress={() => setExpanded((e) => !e)}
          activeOpacity={0.7}
        >
          <Text style={ps.toggleText}>{pos.callOffs.length} pasūtījumi</Text>
          {expanded ? (
            <ChevronUp size={16} color="#6b7280" />
          ) : (
            <ChevronDown size={16} color="#6b7280" />
          )}
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={ps.callOffList}>
          {pos.callOffs.map((co) => {
            const cs = callOffStatusColor(co.status);
            return (
              <View key={co.id} style={ps.callOffRow}>
                <Text style={ps.callOffJob}>{co.jobNumber}</Text>
                <Text style={ps.callOffDate}>{formatDateShort(co.pickupDate)}</Text>
                <View style={[ps.callOffBadge, { backgroundColor: cs.bg }]}>
                  <Text style={[ps.callOffBadgeText, { color: cs.color }]}>{co.status}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function BuyerFrameworkContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [contract, setContract] = useState<ApiFrameworkContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  // Call-off sheet state
  const [activePos, setActivePos] = useState<ApiFrameworkPosition | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [callOffForm, setCallOffForm] = useState<{
    quantity: string;
    pickupDate: string;
    deliveryDate: string;
    notes: string;
  }>({ quantity: '', pickupDate: '', deliveryDate: '', notes: '' });

  const canManage =
    user?.companyRole === 'OWNER' ||
    user?.companyRole === 'MANAGER' ||
    user?.permCreateContracts === true;

  const canReleaseCallOffs =
    user?.companyRole === 'OWNER' ||
    user?.companyRole === 'MANAGER' ||
    user?.permReleaseCallOffs === true;

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await api.frameworkContracts.get(id, token);
      setContract(data);
    } catch (e) {
      toast.error('Neizdevās ielādēt līgumu');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const handleActivate = async () => {
    if (!token || !contract) return;
    Alert.alert('Aktivizēt līgumu', 'Vai apstiprināt šī rāmjlīguma aktivizēšanu?', [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Aktivizēt',
        onPress: async () => {
          setActivating(true);
          try {
            const updated = await api.frameworkContracts.activate(contract.id, token);
            haptics.success();
            setContract(updated);
          } catch (e) {
            haptics.error();
            toast.error(e instanceof Error ? e.message : 'Neizdevās aktivizēt');
          } finally {
            setActivating(false);
          }
        },
      },
    ]);
  };

  const openReleaseSheet = (pos: ApiFrameworkPosition) => {
    haptics.light();
    setActivePos(pos);
    setCallOffForm({ quantity: '', pickupDate: '', deliveryDate: '', notes: '' });
    setSheetOpen(true);
  };

  const handleReleaseCallOff = async () => {
    if (!token || !contract || !activePos) return;
    const qty = parseFloat(callOffForm.quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Kļūda', 'Ievadiet derīgu daudzumu');
      return;
    }
    if (!callOffForm.pickupDate.trim()) {
      Alert.alert('Kļūda', 'Ievadiet iekraušanas datumu (GGGG-MM-DD)');
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateCallOffInput = {
        quantity: qty,
        pickupDate: new Date(callOffForm.pickupDate.trim()).toISOString(),
        deliveryDate: callOffForm.deliveryDate.trim()
          ? new Date(callOffForm.deliveryDate.trim()).toISOString()
          : undefined,
        pickupCity: activePos.pickupCity ?? undefined,
        pickupAddress: activePos.pickupAddress ?? undefined,
        deliveryCity: activePos.deliveryCity ?? undefined,
        deliveryAddress: activePos.deliveryAddress ?? undefined,
        notes: callOffForm.notes.trim() || undefined,
      };
      const result = await api.frameworkContracts.createCallOff(
        contract.id,
        activePos.id,
        input,
        token,
      );
      haptics.success();
      toast.success(`Pasūtījums ${result.jobNumber} izveidots`);
      setSheetOpen(false);
      setActivePos(null);
      // Reload contract to reflect updated consumed qty
      const updated = await api.frameworkContracts.get(contract.id, token);
      setContract(updated);
    } catch (e) {
      haptics.error();
      toast.error(e instanceof Error ? e.message : 'Neizdevās izveidot pasūtījumu');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !contract) {
    return (
      <ScreenContainer bg="white">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Rāmjlīgums" showBack />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#000" />
        </View>
      </ScreenContainer>
    );
  }

  const status = getFrameworkContractStatus(contract.status);
  const totalPct = Math.min(100, contract.totalProgressPct);
  const overallColor = getProgressColor(totalPct);
  const isActive = contract.status === 'ACTIVE';
  const isDraft = contract.status === 'DRAFT';

  return (
    <ScreenContainer bg="white" standalone>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={contract.contractNumber} showBack />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>{contract.title}</Text>
          <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Meta grid */}
        <View style={s.metaBox}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Sākums</Text>
            <Text style={s.metaValue}>{formatDateShort(contract.startDate)}</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Beigas</Text>
            <Text style={s.metaValue}>
              {contract.endDate ? formatDateShort(contract.endDate) : '—'}
            </Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Pasūtījumi</Text>
            <Text style={s.metaValue}>{contract.totalCallOffs}</Text>
          </View>
        </View>

        {/* Supplier */}
        {contract.buyer && (
          <View style={[s.metaBox, { marginTop: 12 }]}>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Pircējs</Text>
              <Text style={s.metaValue}>{contract.buyer.name}</Text>
            </View>
          </View>
        )}

        {/* Overall progress */}
        <View style={s.sectionGap}>
          <Text style={s.sectionLabel}>KOPĒJAIS IZPILDES PROGRESS</Text>
          <View style={s.progressRow}>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  { width: `${totalPct}%` as any, backgroundColor: overallColor },
                ]}
              />
            </View>
            <Text style={[s.progressLabel, { color: overallColor }]}>{totalPct}%</Text>
          </View>
          <Text style={s.progressSub}>
            {contract.totalConsumedQty} / {contract.totalAgreedQty} (kopā)
          </Text>
        </View>

        {/* Activate button (DRAFT + canManage) */}
        {isDraft && canManage && (
          <TouchableOpacity
            style={[s.activateBtn, activating && { opacity: 0.6 }]}
            onPress={handleActivate}
            disabled={activating}
            activeOpacity={0.85}
          >
            {activating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.activateBtnText}>Aktivizēt līgumu</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Positions */}
        {contract.positions.length > 0 && (
          <View style={s.sectionGap}>
            <Text style={s.sectionLabel}>POZĪCIJAS</Text>
            {contract.positions.map((pos) => (
              <PositionCard
                key={pos.id}
                pos={pos}
                canRelease={isActive && canReleaseCallOffs}
                onRelease={openReleaseSheet}
              />
            ))}
          </View>
        )}

        {/* Notes */}
        {contract.notes && (
          <View style={s.sectionGap}>
            <Text style={s.sectionLabel}>PIEZĪMES</Text>
            <View style={s.notesBox}>
              <Text style={s.notesText}>{contract.notes}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Release call-off bottom sheet */}
      <BottomSheet
        visible={sheetOpen}
        onClose={() => !submitting && setSheetOpen(false)}
        title={`Izpildīt: ${activePos?.description ?? ''}`}
        scrollable
        maxHeightPct={0.92}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 20 }}>
            {activePos && (
              <View style={s.posInfoBar}>
                <Text style={s.posInfoText}>
                  Atlikums: {activePos.remainingQty} {activePos.unit}
                </Text>
              </View>
            )}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>DAUDZUMS * ({activePos?.unit ?? ''})</Text>
              <TextInput
                style={s.input}
                value={callOffForm.quantity}
                onChangeText={(v) => setCallOffForm((f) => ({ ...f, quantity: v }))}
                placeholder="0"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>IEKRAUŠANAS DATUMS * (GGGG-MM-DD)</Text>
              <TextInput
                style={s.input}
                value={callOffForm.pickupDate}
                onChangeText={(v) => setCallOffForm((f) => ({ ...f, pickupDate: v }))}
                placeholder="2026-06-15"
                placeholderTextColor="#9ca3af"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>PIEGĀDES DATUMS (GGGG-MM-DD)</Text>
              <TextInput
                style={s.input}
                value={callOffForm.deliveryDate}
                onChangeText={(v) => setCallOffForm((f) => ({ ...f, deliveryDate: v }))}
                placeholder="2026-06-16"
                placeholderTextColor="#9ca3af"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>PIEZĪMES</Text>
              <TextInput
                style={[s.input, { minHeight: 80, paddingTop: 14 }]}
                value={callOffForm.notes}
                onChangeText={(v) => setCallOffForm((f) => ({ ...f, notes: v }))}
                placeholder="Papildu informācija..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={400}
              />
            </View>
          </View>
          <View style={s.sheetFooter}>
            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleReleaseCallOff}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.submitBtnText}>Izveidot pasūtījumu</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>
    </ScreenContainer>
  );
}

// ─── Position card styles ─────────────────────────────────────────────────────

const ps = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563',
  },
  releaseBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  releaseBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  route: {
    fontSize: 13,
    color: colors.textMuted,
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  price: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bgMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 34,
    textAlign: 'right',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 4,
  },
  toggleText: {
    fontSize: 13,
    color: '#6b7280',
  },
  callOffList: {
    gap: 6,
  },
  callOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  callOffJob: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  callOffDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  callOffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  callOffBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

// ─── Main screen styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  hero: {
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaBox: {
    flexDirection: 'row',
    backgroundColor: colors.bgSubtle,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metaDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sectionGap: {
    marginTop: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bgMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 38,
    textAlign: 'right',
  },
  progressSub: {
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: -2,
  },
  activateBtn: {
    backgroundColor: '#166534',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  activateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notesBox: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 14,
    padding: 16,
  },
  notesText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  // Sheet fields
  posInfoBar: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  posInfoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#166534',
  },
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
