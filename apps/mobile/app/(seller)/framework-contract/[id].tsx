/**
 * (seller)/framework-contract/[id].tsx
 *
 * Seller: detail view for a single framework contract.
 * Read-only — shows contract meta, positions with progress, and recent call-offs.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type ApiFrameworkContract,
  type ApiFrameworkPosition,
  type FrameworkContractStatus,
  type FrameworkPositionType,
} from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/Toast';
import { colors } from '@/lib/theme';
import { SkeletonCard } from '@/components/ui/Skeleton';

const STATUS: Record<FrameworkContractStatus, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: colors.textMuted },
  ACTIVE: { label: 'Aktīvs', bg: '#ecfdf5', color: '#10b981' },
  COMPLETED: { label: 'Pabeigts', bg: '#f8fafc', color: '#64748b' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: colors.textDisabled },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#ef4444' },
};

const POS_TYPE_LABEL: Record<FrameworkPositionType, string> = {
  MATERIAL_DELIVERY: 'Materiāli',
  WASTE_DISPOSAL: 'Atkritumi',
  FREIGHT_TRANSPORT: 'Krava',
};

function getProgressColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

function PositionCard({ pos }: { pos: ApiFrameworkPosition }) {
  const pct = Math.min(100, pos.progressPct);
  const progColor = getProgressColor(pct);

  return (
    <View style={s.posCard}>
      <View style={s.posTopRow}>
        <Text style={s.posDesc} numberOfLines={2}>
          {pos.description}
        </Text>
        <View style={s.posTypeBadge}>
          <Text style={s.posTypeText}>{POS_TYPE_LABEL[pos.positionType]}</Text>
        </View>
      </View>

      <View style={s.posMetaRow}>
        <Text style={s.posMeta}>
          {pos.consumedQty.toFixed(1)} / {pos.agreedQty.toFixed(1)} {pos.unit}
        </Text>
        {pos.unitPrice != null && (
          <Text style={s.posMeta}>
            €{pos.unitPrice}/{pos.unit}
          </Text>
        )}
      </View>

      {(pos.pickupCity || pos.deliveryCity) && (
        <Text style={s.posRoute}>
          {pos.pickupCity ?? '—'} → {pos.deliveryCity ?? '—'}
        </Text>
      )}

      <View style={s.progressRow}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: progColor }]} />
        </View>
        <Text style={[s.progressLabel, { color: progColor }]}>{pct.toFixed(0)}%</Text>
      </View>

      {pos.callOffs.length > 0 && (
        <Text style={s.callOffCount}>
          {pos.callOffs.length} pasūtījum{pos.callOffs.length === 1 ? 's' : 'i'}
        </Text>
      )}
    </View>
  );
}

export default function SellerFrameworkContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const toast = useToast();

  const [contract, setContract] = useState<ApiFrameworkContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (skeleton = true) => {
      if (!token || !id) return;
      if (skeleton) setLoading(true);
      try {
        const data = await api.frameworkContracts.get(id, token);
        setContract(data);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Neizdevās ielādēt līgumu');
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

  if (loading) {
    return (
      <ScreenContainer bg="white">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Rāmjlīgums" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      </ScreenContainer>
    );
  }

  if (!contract) return null;

  const status = STATUS[contract.status] ?? STATUS.ACTIVE;
  const pct = Math.min(100, contract.totalProgressPct);
  const progColor = getProgressColor(pct);

  return (
    <ScreenContainer bg="white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={contract.contractNumber} />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
            }}
            tintColor="#000"
          />
        }
      >
        {/* Title + status */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>{contract.title}</Text>
          <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={s.metaBox}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>PASŪTĪTĀJS</Text>
            <Text style={s.metaValue}>{contract.buyer?.name ?? '—'}</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>SĀKUMS</Text>
            <Text style={s.metaValue}>{formatDateShort(contract.startDate)}</Text>
          </View>
          <View style={s.metaDivider} />
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>BEIGAS</Text>
            <Text style={s.metaValue}>
              {contract.endDate ? formatDateShort(contract.endDate) : '∞'}
            </Text>
          </View>
        </View>

        {/* Overall progress */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Izpilde</Text>
            <Text style={[s.progressPct, { color: progColor }]}>{pct.toFixed(0)}%</Text>
          </View>
          <View style={s.bigProgressTrack}>
            <View
              style={[s.bigProgressFill, { width: `${pct}%` as any, backgroundColor: progColor }]}
            />
          </View>
          <Text style={s.progressSummary}>
            {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)} t •{' '}
            {contract.totalCallOffs} pasūtījumi
          </Text>
        </View>

        {/* Notes */}
        {contract.notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Piezīmes</Text>
            <Text style={s.notesText}>{contract.notes}</Text>
          </View>
        )}

        {/* Positions */}
        {contract.positions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Pozīcijas ({contract.positions.length})</Text>
            {contract.positions.map((pos) => (
              <PositionCard key={pos.id} pos={pos} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 8,
  },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: -0.4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    marginBottom: 24,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metaDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  progressPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  bigProgressTrack: {
    height: 8,
    backgroundColor: colors.bgMuted,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  bigProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressSummary: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  // Position card
  posCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  posTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  posDesc: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  posTypeBadge: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  posTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  posMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  posMeta: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  posRoute: {
    fontSize: 12,
    color: colors.textDisabled,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.bgMuted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  callOffCount: {
    fontSize: 12,
    color: colors.textDisabled,
  },
});
