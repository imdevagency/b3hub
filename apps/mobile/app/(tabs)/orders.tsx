import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import type { SkipHireOrder } from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────

const SIZE_LABEL: Record<string, string> = {
  MINI: 'Mini · 2 m³',
  MIDI: 'Midi · 4 m³',
  BUILDERS: 'Celtniecības · 6 m³',
  LARGE: 'Liels · 8 m³',
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Order card ────────────────────────────────────────────────

function OrderCard({ order }: { order: SkipHireOrder }) {
  const status = t.skipHire.status[order.status] ?? t.skipHire.status.PENDING;
  return (
    <View style={s.orderCard}>
      <View style={s.orderTop}>
        <View style={s.orderTopLeft}>
          <Text style={s.orderNum}>{order.orderNumber}</Text>
          <Text style={s.orderSize}>{SIZE_LABEL[order.skipSize] ?? order.skipSize}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: status.bg }]}>
          <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <View style={s.orderDivider} />
      <View style={s.orderBottom}>
        <Text style={s.orderMeta} numberOfLines={1}>
          📍 {order.location}
        </Text>
        <Text style={s.orderMeta}>📅 {formatDate(order.deliveryDate)}</Text>
      </View>
      <View style={s.orderFooter}>
        <Text style={s.orderPrice}>€{order.price}</Text>
        <Text style={s.orderCurrency}>{order.currency}</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function OrdersScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<SkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.skipHire.myOrders(token);
      setOrders(data);
    } catch {
      // show empty state on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{t.skipHire.myOrders}</Text>
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => router.push('/order')}
            activeOpacity={0.85}
          >
            <Text style={s.newBtnText}>＋ {t.skipHire.orderNew}</Text>
          </TouchableOpacity>
        </View>

        {/* Section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>🗑️ Atkritumu konteineri</Text>

          {loading ? (
            <ActivityIndicator color="#dc2626" size="large" style={{ marginTop: 48 }} />
          ) : orders.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📦</Text>
              <Text style={s.emptyTitle}>{t.skipHire.noOrders}</Text>
              <Text style={s.emptyDesc}>{t.skipHire.noOrdersDesc}</Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push('/order')}
                activeOpacity={0.85}
              >
                <Text style={s.emptyBtnText}>{t.skipHire.orderNew}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.list}>
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </View>
          )}
        </View>

        {/* Coming soon sections */}
        {[
          { emoji: '🚛', label: 'Materiālu piegādes' },
          { emoji: '🔄', label: 'Spedīcijas pasūtījumi' },
        ].map((sec) => (
          <View key={sec.label} style={s.comingSoonCard}>
            <Text style={s.comingSoonEmoji}>{sec.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.comingSoonLabel}>{sec.label}</Text>
              <Text style={s.comingSoonSub}>Drīzumā pieejams</Text>
            </View>
            <View style={s.soonBadge}>
              <Text style={s.soonBadgeText}>Drīz</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  newBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  section: { paddingHorizontal: 16, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: { gap: 10 },

  // ── Order card
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderTopLeft: { gap: 2 },
  orderNum: { fontSize: 15, fontWeight: '700', color: '#111827' },
  orderSize: { fontSize: 13, color: '#6b7280' },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  orderDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  orderBottom: { gap: 4 },
  orderMeta: { fontSize: 13, color: '#374151' },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 10,
  },
  orderPrice: { fontSize: 20, fontWeight: '700', color: '#111827' },
  orderCurrency: { fontSize: 12, color: '#9ca3af' },

  // ── Empty state
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  emptyDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // ── Coming soon
  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 16,
    opacity: 0.6,
  },
  comingSoonEmoji: { fontSize: 28 },
  comingSoonLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  comingSoonSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  soonBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  soonBadgeText: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
});
