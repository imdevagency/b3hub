/**
 * (seller)/framework-contracts.tsx
 *
 * Seller: view framework contracts where this company is the supplier.
 * Read-only — sellers cannot create contracts.
 */

import React, { useCallback, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useScreenLoad } from '@/lib/use-screen-load';
import { api, type ApiFrameworkContract, type FrameworkContractStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { Handshake } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { colors } from '@/lib/theme';

const STATUS: Record<FrameworkContractStatus, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: colors.textMuted },
  ACTIVE: { label: 'Aktīvs', bg: '#ecfdf5', color: '#10b981' },
  COMPLETED: { label: 'Pabeigts', bg: '#f8fafc', color: '#64748b' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: colors.textDisabled },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#ef4444' },
};

function getProgressColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

export default function SellerFrameworkContractsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);

  const fetcher = useCallback(async () => {
    if (!token) return;
    const data = await api.frameworkContracts.list(token);
    setContracts(data);
  }, [token]);

  const { loading, refreshing, onRefresh } = useScreenLoad(fetcher);

  const renderItem = ({ item: contract }: { item: ApiFrameworkContract }) => {
    const status = STATUS[contract.status] ?? STATUS.ACTIVE;
    const pct = Math.min(100, contract.totalProgressPct);
    const progColor = getProgressColor(pct);

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => {
          haptics.light();
          router.push({
            pathname: '/(seller)/framework-contract/[id]',
            params: { id: contract.id },
          } as any);
        }}
        activeOpacity={0.7}
      >
        <View style={s.cardTopRow}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {contract.title}
          </Text>
          <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <Text style={s.cardMeta}>
          {contract.contractNumber}
          {contract.buyer ? ` • ${contract.buyer.name}` : ''}
        </Text>

        <Text style={s.cardDates}>
          {formatDateShort(contract.startDate)}
          {contract.endDate ? ` – ${formatDateShort(contract.endDate)}` : ' – Neierobežots'}
        </Text>

        <View style={s.progressRow}>
          <View style={s.progressTrack}>
            <View
              style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: progColor }]}
            />
          </View>
          <Text style={[s.progressLabel, { color: progColor }]}>{pct}%</Text>
        </View>

        {contract.positions.length > 0 && (
          <Text style={s.posCount}>
            {contract.positions.length} pozīcij{contract.positions.length === 1 ? 'a' : 'as'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bg="white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Rāmjlīgumi" />

      {loading ? (
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <FlatList
          data={contracts}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={true}
          initialNumToRender={10}
          renderItem={renderItem}
          contentContainerStyle={contracts.length === 0 ? s.emptyScroll : s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Handshake size={42} color="#9ca3af" />}
              title="Nav rāmjlīgumu"
              subtitle="Šeit redzēsiet līgumus, kuros esat piegādātājs."
            />
          }
        />
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyScroll: {
    flexGrow: 1,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    gap: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: -0.3,
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
  cardMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  cardDates: {
    fontSize: 13,
    color: colors.textDisabled,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
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
  posCount: {
    fontSize: 12,
    color: colors.textDisabled,
  },
});
