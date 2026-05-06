/**
 * toilet-cabins.tsx — Carrier: manage assigned toilet cabin hire orders.
 * Accessed from the More screen when user.canSkipHire === true.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Toilet, Phone, Calendar, Navigation2, Users, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ToiletCabinOrder, ToiletCabinStatus } from '@/lib/api';
import { formatDateNumeric } from '@/lib/format';
import { colors } from '@/lib/theme';

// ── Status display config ─────────────────────────────────────────────────────

const STATUS_INFO: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Gaida', bg: '#f3f4f6', color: colors.textMuted },
  CONFIRMED: { label: 'Jāpiegādā', bg: '#f3f4f6', color: colors.textPrimary },
  DELIVERED: { label: 'Piegādāts', bg: '#e5e7eb', color: colors.textPrimary },
  IN_USE: { label: 'Tiek izmantots', bg: '#e5e7eb', color: colors.textPrimary },
  COLLECTED: { label: 'Savākts', bg: '#d1fae5', color: '#065f46' },
  COMPLETED: { label: 'Pabeigts', bg: '#d1fae5', color: '#065f46' },
  CANCELLED: { label: 'Atcelts', bg: '#f9fafb', color: colors.textDisabled },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function openMaps(address: string, city: string) {
  const query = encodeURIComponent(`${address}, ${city}`);
  const url = Platform.OS === 'ios' ? `maps:?q=${query}` : `geo:0,0?q=${query}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${query}`));
}

// ── Order card ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: ToiletCabinOrder;
  onStatusUpdate: (id: string, status: ToiletCabinStatus) => void;
  updating: boolean;
}

function OrderCard({ order, onStatusUpdate, updating }: OrderCardProps) {
  const statusInfo = STATUS_INFO[order.status] ?? {
    label: order.status,
    bg: '#f3f4f6',
    color: colors.textSecondary,
  };

  const canDeliver = order.status === 'CONFIRMED';
  const canMarkInUse = order.status === 'DELIVERED';
  const canCollect = order.status === 'IN_USE';

  const nextStatus: ToiletCabinStatus | null = canDeliver
    ? 'DELIVERED'
    : canMarkInUse
      ? 'IN_USE'
      : canCollect
        ? 'COLLECTED'
        : null;

  const nextLabel = canDeliver
    ? 'Atzīmēt kā piegādātu'
    : canMarkInUse
      ? 'Atzīmēt kā aktīvu'
      : canCollect
        ? 'Atzīmēt kā savāktu'
        : null;

  const confirmMsg = canDeliver
    ? 'Apstiprināt, ka kabīne ir nogādāta pasūtītājam?'
    : canMarkInUse
      ? 'Apstiprināt, ka kabīne ir nodota lietošanā?'
      : 'Apstiprināt, ka kabīne ir savākta no vietas?';

  const confirmTitle = canDeliver
    ? 'Kabīnes piegāde'
    : canMarkInUse
      ? 'Kabīne nodota lietošanā'
      : 'Kabīnes savākšana';

  const handleAction = () => {
    if (!nextStatus) return;
    Alert.alert(confirmTitle, confirmMsg, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Apstiprināt',
        onPress: () => onStatusUpdate(order.id, nextStatus),
      },
    ]);
  };

  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text style={s.orderNumber}>#{order.orderNumber}</Text>
            <StatusPill
              label={statusInfo.label}
              bg={statusInfo.bg}
              color={statusInfo.color}
              size="sm"
            />
          </View>
          <Text style={s.addressText} numberOfLines={2}>
            {order.address}, {order.city}
          </Text>
        </View>
      </View>

      <View style={s.metaWrap}>
        <View style={s.metaItem}>
          <Toilet size={14} color={colors.textMuted} />
          <Text style={s.metaItemText}>
            {order.cabinCount} {order.cabinCount === 1 ? 'kabīne' : 'kabīnes'}
          </Text>
        </View>
        <View style={s.metaItem}>
          <Users size={14} color={colors.textMuted} />
          <Text style={s.metaItemText}>{order.hireDays} dienas</Text>
        </View>
        <View style={s.metaItem}>
          <Calendar size={14} color={colors.textMuted} />
          <Text style={s.metaItemText}>{formatDateNumeric(order.deliveryDate)}</Text>
        </View>
      </View>

      {order.notes ? (
        <View style={s.notesBox}>
          <Text style={s.notesText}>{order.notes}</Text>
        </View>
      ) : null}

      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => openMaps(order.address, order.city)}
          activeOpacity={0.8}
        >
          <Navigation2 size={16} color="#fff" />
          <Text style={s.navBtnText}>Rādīt ceļu</Text>
        </TouchableOpacity>
        {order.contactPhone ? (
          <TouchableOpacity
            style={s.callBtn}
            onPress={() => Linking.openURL(`tel:${order.contactPhone}`)}
            activeOpacity={0.8}
          >
            <Phone size={16} color="#000" />
          </TouchableOpacity>
        ) : null}
      </View>

      {nextStatus && nextLabel ? (
        <TouchableOpacity
          style={[s.actionBtnPrimary, updating && { opacity: 0.5 }]}
          onPress={handleAction}
          disabled={updating}
          activeOpacity={0.8}
        >
          {updating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.actionBtnPrimaryText}>{nextLabel}</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ToiletCabinsScreen() {
  const { user, session } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState<ToiletCabinOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await api.getCarrierToiletCabins(session.access_token);
      // Show active orders first, completed/cancelled last
      const sorted = [...data].sort((a, b) => {
        const activeStatuses = ['CONFIRMED', 'DELIVERED', 'IN_USE'];
        const aActive = activeStatuses.includes(a.status) ? 0 : 1;
        const bActive = activeStatuses.includes(b.status) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
      });
      setOrders(sorted);
    } catch {
      toast.show({ message: 'Neizdevās ielādēt pasūtījumus', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleStatusUpdate = async (id: string, status: ToiletCabinStatus) => {
    if (!session?.access_token) return;
    setUpdatingId(id);
    try {
      const updated = await api.updateToiletCabinCarrierStatus(id, status, session.access_token);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      toast.show({ message: 'Statuss atjaunināts', type: 'success' });
    } catch {
      toast.show({ message: 'Neizdevās atjaunināt statusu', type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const activeOrders = orders.filter((o) =>
    ['CONFIRMED', 'DELIVERED', 'IN_USE'].includes(o.status),
  );
  const pastOrders = orders.filter((o) =>
    ['COLLECTED', 'COMPLETED', 'CANCELLED'].includes(o.status),
  );

  return (
    <ScreenContainer topInset={0} noAnimation>
      <ScreenHeader title="Tualetes kabīnes" subtitle={`${activeOrders.length} aktīvi`} />

      {loading ? (
        <View style={s.loadingWrap}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Toilet size={40} color={colors.textDisabled} />}
          title="Nav aktīvu kabīņu"
          description="Kad jums tiks piešķirti tualetes kabīņu pasūtījumi, tie parādīsies šeit"
        />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#111827" />
          }
        >
          {activeOrders.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Aktīvie pasūtījumi</Text>
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusUpdate={handleStatusUpdate}
                  updating={updatingId === order.id}
                />
              ))}
            </>
          )}
          {pastOrders.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Vēsture</Text>
              {pastOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusUpdate={handleStatusUpdate}
                  updating={updatingId === order.id}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loadingWrap: {
    padding: 16,
    gap: 12,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  notesBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
  },
  notesText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  actionBtnPrimary: {
    backgroundColor: '#00A878',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
