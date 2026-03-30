import React from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useLocalSearchParams } from 'expo-router';
import { MapPin, CalendarDays, Package, Truck, User } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { InfoSection } from '@/components/ui/InfoSection';
import { StatusPill } from '@/components/ui/StatusPill';
import { DetailRow } from '@/components/ui/DetailRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { useOrderDetail } from '@/lib/use-order-detail';
import { UNIT_SHORT } from '@/lib/materials';
import { formatDate } from '@/lib/format';

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
  const { order, loading } = useOrderDetail(id);

  if (loading) {
    return (
      <ScreenContainer standalone>
        <ScreenHeader title="Pasūtījums" />
        <View style={s.center}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer standalone>
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
    <ScreenContainer standalone>
      <ScreenHeader title={`#${order.orderNumber}`} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
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
            {order.buyer.phone && <DetailRow label="Tālrunis" value={order.buyer.phone} />}
            {order.buyer.email && <DetailRow label="E-pasts" value={order.buyer.email} last />}
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
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
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
});
