/**
 * (buyer)/disputes.tsx
 *
 * Buyer: list of disputes raised by this user.
 * Disputes can be raised from individual order detail screens.
 */

import React, { useCallback, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useScreenLoad } from '@/lib/use-screen-load';
import { api, type ApiDispute, type DisputeReason, type DisputeStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { AlertCircle } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { GuestWall } from '@/components/ui/GuestWall';
import { StatusPill } from '@/components/ui/StatusPill';
import { Text } from '@/components/ui/text';
import { colors } from '@/lib/theme';

const REASON_LABEL: Record<DisputeReason, string> = {
  SHORT_DELIVERY: 'Trūkst daudzums',
  WRONG_MATERIAL: 'Nepareiza prece',
  DAMAGE: 'Bojāta prece',
  LATE_DELIVERY: 'Kavējas piegāde',
  NO_DELIVERY: 'Nav piegādes',
  QUALITY_ISSUE: 'Kvalitātes problēma',
  OTHER: 'Cits',
};

const STATUS_MAP: Record<DisputeStatus, { label: string; bg: string; color: string }> = {
  OPEN: { label: 'Atvērts', bg: '#fff7ed', color: '#f59e0b' },
  UNDER_REVIEW: { label: 'Izskatīšanā', bg: '#eff6ff', color: '#3b82f6' },
  RESOLVED: { label: 'Atrisināts', bg: '#ecfdf5', color: '#10b981' },
  REJECTED: { label: 'Noraidīts', bg: '#fef2f2', color: '#ef4444' },
};

export default function DisputesScreen() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();

  if (!isLoading && !user) {
    return (
      <GuestWall
        headerTitle="Strīdi"
        title="Pierakstieties, lai skatītu strīdus"
        subtitle="Strīdi par pasūtījumiem ir pieejami tikai reģistrētiem lietotājiem."
      />
    );
  }

  const [disputes, setDisputes] = useState<ApiDispute[]>([]);

  const fetcher = useCallback(async () => {
    if (!token) return;
    const data = await api.listDisputes(token);
    setDisputes(data);
  }, [token]);

  const { loading, refreshing, onRefresh } = useScreenLoad(fetcher);

  const renderItem = ({ item }: { item: ApiDispute }) => {
    const status = STATUS_MAP[item.status] ?? STATUS_MAP.OPEN;
    const reason = REASON_LABEL[item.reason] ?? item.reason;

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => {
          haptics.light();
          if (item.order?.id) {
            router.push({
              pathname: '/(buyer)/order/[id]',
              params: { id: item.order.id },
            } as any);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={s.cardTopRow}>
          <Text style={s.orderNum} numberOfLines={1}>
            {item.order?.orderNumber ?? item.orderId}
          </Text>
          <StatusPill label={status.label} bg={status.bg} color={status.color} size="sm" />
        </View>

        <Text style={s.reason}>{reason}</Text>

        {item.description ? (
          <Text style={s.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {item.resolution ? (
          <View style={s.resolutionBox}>
            <Text style={s.resolutionLabel}>ATRISINĀJUMS</Text>
            <Text style={s.resolutionText} numberOfLines={2}>
              {item.resolution}
            </Text>
          </View>
        ) : null}

        <Text style={s.date}>{formatDateShort(item.createdAt)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer bg="white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Strīdi" />

      {loading ? (
        <View style={{ padding: 20 }}>
          <SkeletonCard count={4} />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={true}
          initialNumToRender={10}
          renderItem={renderItem}
          contentContainerStyle={disputes.length === 0 ? s.emptyScroll : s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<AlertCircle size={42} color="#9ca3af" />}
              title="Nav strīdu"
              subtitle="Ja ir problēmas ar pasūtījumu, varat iesniegt strīdu no pasūtījuma detaļām."
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
  orderNum: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
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
  reason: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  resolutionBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    gap: 2,
    marginTop: 2,
  },
  resolutionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resolutionText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  date: {
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
  },
});
