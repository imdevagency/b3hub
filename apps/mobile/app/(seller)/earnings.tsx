/**
 * earnings.tsx — Seller: revenue dashboard
 *
 * Shows today / week / month totals from confirmed orders,
 * and a history list of all orders with revenue breakdown.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useFocusEffect } from 'expo-router';
import {
  TrendingUp,
  Banknote,
  CheckCircle2,
  Clock,
  Package,
  ArrowUpRight,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiOrder } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';

// ── Types ──────────────────────────────────────────────────────

interface RevenueStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalOrders: number;
  pendingRevenue: number;
  avgOrderValue: number;
}

interface OrderEntry {
  id: string;
  orderNumber: string;
  buyerName: string;
  date: string;
  rawDate: Date;
  amount: number;
  status: 'confirmed' | 'pending' | 'delivered';
}

type Period = 'today' | 'week' | 'month';

// ── Helpers ────────────────────────────────────────────────────

const REVENUE_STATUSES = [
  'CONFIRMED',
  'PROCESSING',
  'IN_PROGRESS',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
];
const PENDING_STATUSES = ['PENDING'];

function computeRevenue(orders: ApiOrder[]): { stats: RevenueStats; entries: OrderEntry[] } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayRevenue = 0,
    weekRevenue = 0,
    monthRevenue = 0,
    pendingRevenue = 0;
  const entries: OrderEntry[] = [];

  for (const order of orders) {
    const d = new Date(order.createdAt);
    const amount = order.total ?? 0;

    if (REVENUE_STATUSES.includes(order.status)) {
      if (d >= todayStart) todayRevenue += amount;
      if (d >= weekStart) weekRevenue += amount;
      if (d >= monthStart) monthRevenue += amount;
      entries.push({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer?.name ?? 'Pircējs',
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rawDate: d,
        amount,
        status:
          order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'delivered' : 'confirmed',
      });
    } else if (PENDING_STATUSES.includes(order.status)) {
      pendingRevenue += amount;
      entries.push({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer?.name ?? 'Pircējs',
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rawDate: d,
        amount,
        status: 'pending',
      });
    }
  }

  const confirmedOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const avgOrderValue =
    confirmedOrders.length > 0
      ? confirmedOrders.reduce((s, o) => s + (o.total ?? 0), 0) / confirmedOrders.length
      : 0;

  return {
    stats: {
      todayRevenue,
      weekRevenue,
      monthRevenue,
      totalOrders: confirmedOrders.length,
      pendingRevenue,
      avgOrderValue,
    },
    entries,
  };
}

// ── Main ───────────────────────────────────────────────────────

export default function SellerEarningsScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<RevenueStats>({
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    totalOrders: 0,
    pendingRevenue: 0,
    avgOrderValue: 0,
  });
  const [entries, setEntries] = useState<OrderEntry[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const orders = await api.orders.myOrders(token);
        const { stats: s, entries: e } = computeRevenue(orders);
        setStats(s);
        setEntries(e);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const heroAmount =
    period === 'today'
      ? stats.todayRevenue
      : period === 'week'
        ? stats.weekRevenue
        : stats.monthRevenue;

  // Filter history to match the selected period
  const filteredEntries = (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') {
      return entries.filter((e) => e.rawDate >= todayStart);
    }
    if (period === 'week') {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return entries.filter((e) => e.rawDate >= weekStart);
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return entries.filter((e) => e.rawDate >= monthStart);
  })();

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Šodien' },
    { key: 'week', label: 'Šonedēļ' },
    { key: 'month', label: 'Šomēnes' },
  ];

  const STATUS_STYLE: Record<OrderEntry['status'], { bg: string; color: string; label: string }> = {
    delivered: { bg: '#dcfce7', color: '#15803d', label: 'Piegādāts' },
    confirmed: { bg: '#f3f4f6', color: '#374151', label: 'Apstiprin.' },
    pending: { bg: '#f3f4f6', color: '#6b7280', label: 'Gaida' },
  };

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonCard count={3} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
      >
        {/* ── Green hero ── */}
        <View style={s.hero}>
          <Text style={s.heroSuper}>Ieņēmumi</Text>
          <Text style={s.heroAmount}>€{heroAmount.toFixed(0)}</Text>

          <View style={s.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[s.chip, period === p.key && s.chipActive]}
                onPress={() => setPeriod(p.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, period === p.key && s.chipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.body}>
          {/* ── Summary cards ── */}
          <View style={s.summaryRow}>
            <View style={s.card}>
              <View style={[s.cardIcon, { backgroundColor: '#dcfce7' }]}>
                <CheckCircle2 size={18} color="#111827" />
              </View>
              <Text style={s.cardVal}>{stats.totalOrders}</Text>
              <Text style={s.cardLabel}>Pasūtījumi</Text>
            </View>
            <View style={[s.card, { backgroundColor: '#f3f4f6', borderColor: '#f3f4f6' }]}>
              <View style={[s.cardIcon, { backgroundColor: '#f3f4f6' }]}>
                <Clock size={18} color="#6b7280" />
              </View>
              <Text style={[s.cardVal, { color: '#6b7280' }]}>
                €{stats.pendingRevenue.toFixed(0)}
              </Text>
              <Text style={[s.cardLabel, { color: '#6b7280' }]}>Gaida apstiprin.</Text>
            </View>
            <View style={s.card}>
              <View style={[s.cardIcon, { backgroundColor: '#f3f4f6' }]}>
                <ArrowUpRight size={18} color="#111827" />
              </View>
              <Text style={s.cardVal}>€{stats.avgOrderValue.toFixed(0)}</Text>
              <Text style={s.cardLabel}>Vid. pasūt.</Text>
            </View>
          </View>

          {/* ── Month trend bar ── */}
          <View style={s.trendCard}>
            <View style={s.trendHeader}>
              <TrendingUp size={16} color="#111827" />
              <Text style={s.trendTitle}>Mēneša ieņēmumi</Text>
              <Text style={s.trendAmount}>€{stats.monthRevenue.toFixed(0)}</Text>
            </View>
            <View style={s.trendTrack}>
              <View
                style={[
                  s.trendFill,
                  {
                    width:
                      stats.monthRevenue > 0
                        ? (`${Math.min(100, (stats.monthRevenue / Math.max(stats.weekRevenue * 4, stats.monthRevenue)) * 100)}%` as any)
                        : '0%',
                  },
                ]}
              />
            </View>
          </View>

          {/* ── Order history ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Darījumu vēsture</Text>
            {filteredEntries.length === 0 ? (
              <View style={s.empty}>
                <Banknote size={36} color="#d1d5db" />
                <Text style={s.emptyText}>Nav darījumu vēstures</Text>
              </View>
            ) : (
              <View style={s.historyCard}>
                {filteredEntries.map((e, idx) => {
                  const meta = STATUS_STYLE[e.status];
                  return (
                    <View key={e.id}>
                      <View style={s.entryRow}>
                        <View style={[s.entryDot, { backgroundColor: meta.bg }]}>
                          {e.status === 'delivered' ? (
                            <CheckCircle2 size={13} color={meta.color} />
                          ) : e.status === 'confirmed' ? (
                            <Package size={13} color={meta.color} />
                          ) : (
                            <Clock size={13} color={meta.color} />
                          )}
                        </View>
                        <View style={s.entryBody}>
                          <Text style={s.entryBuyer}>{e.buyerName}</Text>
                          <Text style={s.entryMeta}>
                            #{e.orderNumber} · {e.date}
                          </Text>
                        </View>
                        <View style={s.entryRight}>
                          <Text style={s.entryAmount}>€{e.amount}</Text>
                          <View style={[s.entryBadge, { backgroundColor: meta.bg }]}>
                            <Text style={[s.entryBadgeText, { color: meta.color }]}>
                              {meta.label}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {idx < filteredEntries.length - 1 && <View style={s.divider} />}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f2f7' },

  hero: {
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  heroSuper: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  heroAmount: { fontSize: 42, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -1 },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  chipActive: { backgroundColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  chipTextActive: { color: '#111827' },

  body: { padding: 16, gap: 16, paddingBottom: 40 },

  summaryRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardVal: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cardLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', textAlign: 'center' },

  trendCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  trendHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  trendAmount: { fontSize: 15, fontWeight: '800', color: '#111827' },
  trendTrack: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 999 },
  trendFill: { height: 8, backgroundColor: '#111827', borderRadius: 999 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  empty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  entryDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  entryBody: { flex: 1, gap: 2 },
  entryBuyer: { fontSize: 13, fontWeight: '700', color: '#111827' },
  entryMeta: { fontSize: 11, color: '#9ca3af' },
  entryRight: { alignItems: 'flex-end', gap: 4 },
  entryAmount: { fontSize: 15, fontWeight: '800', color: '#111827' },
  entryBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  entryBadgeText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },
});
