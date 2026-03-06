import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import type { SkipHireOrder, ApiOrder } from '@/lib/api';
import { MapPin, CalendarDays, Trash2, Package, Truck, Phone, User } from 'lucide-react-native';

// ── Helpers ───────────────────────────────────────────────────

const SIZE_LABEL: Record<string, string> = {
  MINI: 'Mini · 2 m³',
  MIDI: 'Midi · 4 m³',
  BUILDERS: 'Celtniecības · 6 m³',
  LARGE: 'Liels · 8 m³',
};

const MAT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Gaida', bg: '#fef9c3', color: '#a16207' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#dbeafe', color: '#1d4ed8' },
  PROCESSING: { label: 'Apstrādā', bg: '#ede9fe', color: '#6d28d9' },
  SHIPPED: { label: 'Ceļā', bg: '#e0f2fe', color: '#0284c7' },
  DELIVERED: { label: 'Piegādāts', bg: '#dcfce7', color: '#15803d' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', color: '#b91c1c' },
};

const UNIT_SHORT: Record<string, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gab.',
  LOAD: 'krava',
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Skip-hire card ────────────────────────────────────────────

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <MapPin size={13} color="#374151" />
          <Text style={s.orderMeta} numberOfLines={1}>
            {order.location}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <CalendarDays size={13} color="#374151" />
          <Text style={s.orderMeta}>{formatDate(order.deliveryDate)}</Text>
        </View>
      </View>
      <View style={s.orderFooter}>
        <Text style={s.orderPrice}>€{order.price}</Text>
        <Text style={s.orderCurrency}>{order.currency}</Text>
      </View>
    </View>
  );
}

// ── Material order card ───────────────────────────────────────

function MaterialOrderCard({ order }: { order: ApiOrder }) {
  const st = MAT_STATUS[order.status] ?? MAT_STATUS.PENDING;
  const first = order.items[0];
  const extra = order.items.length - 1;
  return (
    <View style={s.orderCard}>
      <View style={s.orderTop}>
        <View style={s.orderTopLeft}>
          <Text style={s.orderNum}>{order.orderNumber}</Text>
          <Text style={s.orderSize} numberOfLines={1}>
            {first
              ? `${first.material.name}${extra > 0 ? ` +${extra}` : ''}`
              : 'Materiālu pasūtījums'}
          </Text>
        </View>
        <View style={[s.badge, { backgroundColor: st.bg }]}>
          <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <View style={s.orderDivider} />
      {order.status === 'SHIPPED' &&
        (() => {
          const activeJob = order.transportJobs?.find(
            (j) =>
              j.status === 'EN_ROUTE_DELIVERY' ||
              j.status === 'AT_DELIVERY' ||
              j.status === 'LOADED',
          );
          const driver = activeJob?.driver;
          return (
            <View style={s.driverRow}>
              <View style={s.driverInfo}>
                <User size={14} color="#0284c7" />
                <Text style={s.driverName}>
                  {driver ? `${driver.firstName} ${driver.lastName}` : 'Šoferis ceļā'}
                </Text>
              </View>
              {driver?.phone ? (
                <TouchableOpacity
                  style={s.callDriverBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${driver.phone}`).catch(() =>
                      Alert.alert('Kļūda', 'Neizdevās iniciēt zvanu'),
                    )
                  }
                >
                  <Phone size={14} color="#ffffff" />
                  <Text style={s.callDriverText}>Zvanīt</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })()}
      <View style={s.orderBottom}>
        {order.deliveryAddress ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <MapPin size={13} color="#374151" />
            <Text style={s.orderMeta} numberOfLines={1}>
              {order.deliveryAddress}
              {order.deliveryCity ? `, ${order.deliveryCity}` : ''}
            </Text>
          </View>
        ) : null}
        {order.deliveryDate ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <CalendarDays size={13} color="#374151" />
            <Text style={s.orderMeta}>{formatDate(order.deliveryDate)}</Text>
          </View>
        ) : null}
      </View>
      {first && (
        <View style={s.matRow}>
          <Text style={s.matDetail}>
            {first.quantity} {UNIT_SHORT[first.unit] ?? first.unit} · {first.material.name}
          </Text>
          <Text style={s.matPrice}>€{first.total.toFixed(2)}</Text>
        </View>
      )}
      <View style={s.orderFooter}>
        <Text style={s.orderPrice}>€{order.total.toFixed(2)}</Text>
        <Text style={s.orderCurrency}>{order.currency}</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function OrdersScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [skipData, matData] = await Promise.all([
        api.skipHire.myOrders(token),
        api.orders.myOrders(token),
      ]);
      setSkipOrders(skipData);
      setMatOrders(matData);
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

        {/* ── Skip-hire section ── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Trash2 size={14} color="#6b7280" />
            <Text style={s.sectionLabel}>Atkritumu konteineri</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#dc2626" size="large" style={{ marginTop: 48 }} />
          ) : skipOrders.length === 0 ? (
            <View style={s.empty}>
              <Package size={40} color="#d1d5db" />
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
              {skipOrders.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </View>
          )}
        </View>

        {/* ── Material orders section ── */}
        <View style={[s.section, { marginTop: 8 }]}>
          <View style={s.sectionRow}>
            <Truck size={14} color="#6b7280" />
            <Text style={s.sectionLabel}>Materiālu piegādes</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#dc2626" size="small" style={{ marginVertical: 20 }} />
          ) : matOrders.length === 0 ? (
            <View style={s.matEmpty}>
              <Package size={36} color="#d1d5db" />
              <Text style={s.matEmptyTitle}>Nav materiālu pasūtījumu</Text>
              <Text style={s.matEmptySub}>Pasūtiet materiālus katalogā</Text>
            </View>
          ) : (
            <View style={s.list}>
              {matOrders.map((o) => (
                <MaterialOrderCard key={o.id} order={o} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
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
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderTopLeft: { gap: 2, flex: 1, marginRight: 8 },
  orderNum: { fontSize: 15, fontWeight: '700', color: '#111827' },
  orderSize: { fontSize: 13, color: '#6b7280' },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  orderDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  trackText: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  driverName: { fontSize: 13, fontWeight: '600', color: '#0284c7' },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  callDriverText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  orderBottom: { gap: 4 },
  orderMeta: { fontSize: 13, color: '#374151' },
  matRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  matDetail: { fontSize: 12, color: '#6b7280', flex: 1 },
  matPrice: { fontSize: 13, fontWeight: '600', color: '#374151' },
  orderFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 10 },
  orderPrice: { fontSize: 20, fontWeight: '700', color: '#111827' },
  orderCurrency: { fontSize: 12, color: '#9ca3af' },

  // ── Empty states
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
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
  matEmpty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  matEmptyTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  matEmptySub: { fontSize: 13, color: '#9ca3af' },
});
