import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, CalendarDays, Package, Truck, User, Phone } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { InfoSection } from '@/components/ui/InfoSection';
import { StatusPill } from '@/components/ui/StatusPill';
import { DetailRow } from '@/components/ui/DetailRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import { useOrderDetail } from '@/lib/use-order-detail';
import { UNIT_SHORT } from '@/lib/materials';
import { formatDate } from '@/lib/format';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';

function getStatusColors(status: string): { bg: string; color: string } {
  switch (status) {
    case 'CONFIRMED':
    case 'IN_PROGRESS':
      return { bg: '#dcfce7', color: '#166534' };
    case 'COMPLETED':
    case 'DELIVERED':
      return { bg: '#f1f5f9', color: '#475569' };
    case 'PENDING':
    case 'SUBMITTED':
      return { bg: '#fff7ed', color: '#9a3412' };
    case 'CANCELLED':
    case 'REJECTED':
      return { bg: '#fef2f2', color: '#991b1b' };
    default:
      return { bg: '#f3f4f6', color: '#4b5563' };
  }
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Gaida',
    SUBMITTED: 'Iesniegts',
    CONFIRMED: 'Apstiprināts',
    IN_PROGRESS: 'Izpildē',
    DELIVERED: 'Piegādāts',
    COMPLETED: 'Pabeigts',
    CANCELLED: 'Atcelts',
    ACCEPTED: 'Pieņemts',
    REJECTED: 'Noraidīts',
  };
  return map[status] || status;
}

export default function SellerOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { order, loading, reload: refresh } = useOrderDetail(id);
  const [actioning, setActioning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh?.();
    setRefreshing(false);
  }, [refresh]);

  const handleConfirm = async () => {
    if (!token || !order) return;
    setActioning('confirm');
    try {
      await api.orders.confirm(order.id, token);
      haptics.success();
      toast.success('Pasūtījums apstiprināts!');
      refresh?.();
    } catch {
      haptics.error();
      toast.error('Neizdevās apstiprināt.');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = () => {
    if (!token || !order) return;
    Alert.alert('Noraidīt pasūtījumu?', 'Šo darbību nevar atcelt.', [
      { text: 'Atpakaļ', style: 'cancel' },
      {
        text: 'Noraidīt',
        style: 'destructive',
        onPress: async () => {
          setActioning('reject');
          try {
            await api.orders.cancel(order.id, token!);
            haptics.success();
            toast.success('Pasūtījums noraidīts.');
            router.back();
          } catch {
            haptics.error();
            toast.error('Neizdevās noraidīt.');
          } finally {
            setActioning(null);
          }
        },
      },
    ]);
  };

  const handleStartLoading = async () => {
    if (!token || !order) return;
    setActioning('load');
    try {
      await api.orders.startLoading(order.id, token);
      haptics.success();
      toast.success('Iekraušana sākta!');
      refresh?.();
    } catch {
      haptics.error();
      toast.error('Neizdevās sākt iekraušanu.');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Pasūtījums" />
        <View style={s.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Pasūtījums" />
        <EmptyState
          title="Pasūtījums nav atrasts"
          subtitle="Šis pasūtījums neeksistē vai nav pieejams."
        />
      </ScreenContainer>
    );
  }

  const statusColors = getStatusColors(order.status);

  return (
    <ScreenContainer>
      <ScreenHeader title={`#${order.orderNumber}`} />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status */}
        <View style={s.statusRow}>
          <StatusPill
            label={formatStatus(order.status)}
            bg={statusColors.bg}
            color={statusColors.color}
            size="md"
          />
        </View>

        {/* Order Items */}
        <InfoSection icon={<Package size={14} color="#6b7280" />} title="Materiāli">
          {order.items?.map((item: any, i: number) => (
            <DetailRow
              key={item.id || i}
              label={item.material?.name ?? item.product?.name ?? 'Materiāls'}
              value={`${item.quantity} ${UNIT_SHORT[item.unit as keyof typeof UNIT_SHORT] ?? item.unit ?? 't'}`}
              last={i === (order.items?.length ?? 0) - 1}
            />
          ))}
          {order.total != null && <DetailRow label="Summa" value={`€${order.total}`} last />}
        </InfoSection>

        {/* Delivery */}
        <InfoSection icon={<MapPin size={14} color="#6b7280" />} title="Piegāde">
          <DetailRow label="Adrese" value={order.deliveryAddress} />
          {order.deliveryCity && <DetailRow label="Pilsēta" value={order.deliveryCity} />}
          {order.deliveryDate && (
            <DetailRow label="Datums" value={formatDate(order.deliveryDate)} last />
          )}
        </InfoSection>

        {/* Buyer info */}
        {order.buyer && (
          <InfoSection icon={<User size={14} color="#6b7280" />} title="Pircējs">
            <DetailRow label="Vārds" value={order.buyer.name} />
            {order.buyer?.phone && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={s.phoneRow}
                onPress={() =>
                  Linking.openURL(`tel:${order.buyer?.phone}`).catch(() =>
                    Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'),
                  )
                }
              >
                <Text style={s.phoneLabel}>Tālrunis</Text>
                <View style={s.phoneRight}>
                  <Phone size={13} color={colors.primary} />
                  <Text style={s.phoneValue}>{order.buyer?.phone}</Text>
                </View>
              </TouchableOpacity>
            )}
            {order.buyer?.email && <DetailRow label="E-pasts" value={order.buyer?.email} last />}
          </InfoSection>
        )}

        {/* Transport */}
        {order.transportJobs && order.transportJobs.length > 0 && (
          <InfoSection icon={<Truck size={14} color="#6b7280" />} title="Transports">
            {order.transportJobs.map((job: any, i: number) => (
              <DetailRow
                key={job.id}
                label={`Brauciens ${i + 1}`}
                value={formatStatus(job.status)}
                last={i === (order.transportJobs?.length ?? 0) - 1}
              />
            ))}
          </InfoSection>
        )}

        {/* Timeline */}
        <InfoSection icon={<CalendarDays size={14} color="#6b7280" />} title="Laika zīmogi">
          <DetailRow label="Izveidots" value={formatDate(order.createdAt)} last />
        </InfoSection>

        {/* Actions */}
        {order.status === 'PENDING' && (
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.btnOutline}
              onPress={handleReject}
              disabled={!!actioning}
              activeOpacity={0.75}
            >
              <Text style={s.btnOutlineText}>Noraidīt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSolid, !!actioning && s.btnDisabled]}
              onPress={handleConfirm}
              disabled={!!actioning}
              activeOpacity={0.75}
            >
              {actioning === 'confirm' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnSolidText}>Apstiprināt</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        {order.status === 'CONFIRMED' && (
          <TouchableOpacity
            style={[s.btnSolid, s.btnFull, !!actioning && s.btnDisabled]}
            onPress={handleStartLoading}
            disabled={!!actioning}
            activeOpacity={0.75}
          >
            {actioning === 'load' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnSolidText}>Sākt iekraušanu</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  phoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  phoneLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  phoneRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  phoneValue: { fontSize: 13, fontWeight: '600', color: colors.primary },
  phoneLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 60,
    gap: 12,
  },
  statusRow: {
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnOutline: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  btnOutlineText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textMuted,
  } as any,
  btnSolid: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  btnFull: {
    flex: 0,
    width: '100%',
  } as any,
  btnSolidText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  } as any,
  btnDisabled: {
    opacity: 0.5,
  },
});
