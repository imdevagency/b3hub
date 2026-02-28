import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { SkipHireOrder } from '@/lib/api';
import { t } from '@/lib/translations';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  DELIVERED: '#8b5cf6',
  COLLECTED: '#6b7280',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

export default function OrdersScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<SkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.skipHire.myOrders(token);
      setOrders(data);
    } catch {
      // silently fail — user sees empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t.skipHire.myOrders}</Text>
        <TouchableOpacity
          style={s.newOrderBtn}
          onPress={() => router.push('/order')}
          activeOpacity={0.8}
        >
          <Text style={s.newOrderText}>+ {t.skipHire.orderNew}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
        contentContainerStyle={s.listContent}
      >
        {orders.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>🗑️</Text>
            <Text style={s.emptyTitle}>{t.skipHire.noOrders}</Text>
            <Text style={s.emptyDesc}>{t.skipHire.noOrdersDesc}</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => router.push('/order')}
              activeOpacity={0.8}
            >
              <Text style={s.emptyBtnText}>{t.skipHire.orderNew}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order) => {
            const statusColor = STATUS_COLORS[order.status] ?? '#6b7280';
            const sizeInfo = t.skipHire.step3.sizes[order.skipSize];
            const wasteInfo = t.skipHire.step2.types[order.wasteCategory];
            const sizeLabel = sizeInfo ? `${sizeInfo.label} (${sizeInfo.volume})` : order.skipSize;
            const wasteLabel = wasteInfo?.label ?? order.wasteCategory;

            return (
              <View key={order.id} style={s.orderCard}>
                <View style={s.cardHeader}>
                  <Text style={s.orderNum}>{order.orderNumber}</Text>
                  <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
                    <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[s.statusText, { color: statusColor }]}>{order.status}</Text>
                  </View>
                </View>

                <View style={s.cardDetails}>
                  <Text style={s.detailRow}>📍 {order.location}</Text>
                  <Text style={s.detailRow}>📦 {sizeLabel}</Text>
                  <Text style={s.detailRow}>🗂️ {wasteLabel}</Text>
                  <Text style={s.detailRow}>
                    💰 €{order.price} {order.currency}
                  </Text>
                </View>

                <View style={s.cardFooter}>
                  <Text style={s.deliveryDate}>
                    📅{' '}
                    {new Date(order.deliveryDate).toLocaleDateString('lv-LV', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#dc2626',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  newOrderBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  newOrderText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  emptyBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNum: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardDetails: { gap: 4, marginBottom: 12 },
  detailRow: { fontSize: 13, color: '#6b7280' },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  deliveryDate: { fontSize: 13, color: '#374151', fontWeight: '500' },
});
