import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiOrder, type SellerAnalytics } from '@/lib/api';
import { CATEGORY_LABELS } from '@/lib/materials';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';

// ── Types & helpers ───────────────────────────────────────────────────────

interface EarningsStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedJobs: number;
  pendingPayout: number;
  avgOrderValue: number;
  fulfillmentRate: number; // 0–100 %
  repeatBuyerRate: number; // 0–100 %
  topMaterials: { label: string; amount: number }[]; // top 3
}

interface DayBar {
  label: string; // '23.2'
  shortLabel: string; // 'Pr'
  amount: number;
  isToday: boolean;
}

// Latvian weekday abbreviations (Sun=0)
const LV_DAYS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];

interface HistoryEntry {
  id: string;
  orderNumber: string;
  buyerName: string;
  date: string;
  rawDate: Date;
  amount: number;
  status: string;
}

const REVENUE_STATUSES = [
  'CONFIRMED',
  'PROCESSING',
  'IN_PROGRESS',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
];
const PENDING_STATUSES = ['PENDING'];

function buildDailyChart(orders: ApiOrder[]): DayBar[] {
  const now = new Date();
  const bars: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const nextD = new Date(d.getTime() + 86_400_000);
    const amount = orders
      .filter((o) => {
        if (!REVENUE_STATUSES.includes(o.status)) return false;
        const od = new Date(o.createdAt);
        return od >= d && od < nextD;
      })
      .reduce((sum, o) => sum + (o.total ?? 0), 0);
    bars.push({
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      shortLabel: i === 0 ? 'Šod' : LV_DAYS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }
  return bars;
}

function computeStats(orders: ApiOrder[]): {
  stats: EarningsStats;
  history: HistoryEntry[];
  dailyChart: DayBar[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayEarnings = 0,
    weekEarnings = 0,
    monthEarnings = 0,
    completedJobs = 0,
    pendingPayout = 0;

  const history: HistoryEntry[] = [];

  const confirmedOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const avgOrderValue =
    confirmedOrders.length > 0
      ? confirmedOrders.reduce((s, o) => s + (o.total ?? 0), 0) / confirmedOrders.length
      : 0;

  // Fulfillment rate: delivered / (delivered + cancelled)
  const deliveredCount = orders.filter(
    (o) => o.status === 'DELIVERED' || o.status === 'COMPLETED',
  ).length;
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;
  const fulfillmentRate =
    deliveredCount + cancelledCount > 0
      ? Math.round((deliveredCount / (deliveredCount + cancelledCount)) * 100)
      : 100;

  // Repeat buyer rate: buyers with ≥2 orders
  const buyerOrderCount = new Map<string, number>();
  for (const o of orders) {
    if (o.buyer?.id) buyerOrderCount.set(o.buyer.id, (buyerOrderCount.get(o.buyer.id) ?? 0) + 1);
  }
  const uniqueBuyers = buyerOrderCount.size;
  const repeatBuyers = [...buyerOrderCount.values()].filter((c) => c >= 2).length;
  const repeatBuyerRate = uniqueBuyers > 0 ? Math.round((repeatBuyers / uniqueBuyers) * 100) : 0;

  // Top materials by revenue (all-time)
  const materialRevenue = new Map<string, number>();
  for (const o of confirmedOrders) {
    for (const item of o.items) {
      const key = item.material.category;
      materialRevenue.set(key, (materialRevenue.get(key) ?? 0) + (item.total ?? 0));
    }
  }
  const topMaterials = [...materialRevenue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => ({
      label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
      amount: amt,
    }));

  for (const order of orders) {
    const d = new Date(order.createdAt);
    const amount = order.total ?? 0;

    if (REVENUE_STATUSES.includes(order.status)) {
      completedJobs++;
      if (d >= todayStart) todayEarnings += amount;
      if (d >= weekStart) weekEarnings += amount;
      if (d >= monthStart) monthEarnings += amount;
      history.push({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer?.name ?? 'Pircējs',
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' }),
        rawDate: d,
        amount,
        status: order.status,
      });
    } else if (PENDING_STATUSES.includes(order.status)) {
      pendingPayout += amount;
      history.push({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer?.name ?? 'Pircējs',
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' }),
        rawDate: d,
        amount,
        status: order.status,
      });
    }
  }

  // Sort history by date descending
  history.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  return {
    stats: {
      todayEarnings,
      weekEarnings,
      monthEarnings,
      completedJobs,
      pendingPayout,
      avgOrderValue,
      fulfillmentRate,
      repeatBuyerRate,
      topMaterials,
    },
    history,
    dailyChart: buildDailyChart(orders),
  };
}

// ── Components ────────────────────────────────────────────────────────────

const CHART_H = 120;
const CHART_W = Dimensions.get('window').width - 48; // padding horizontal

function MinimalBarChart({ bars }: { bars: DayBar[] }) {
  const maxAmt = Math.max(...bars.map((b) => b.amount), 1);
  const barW = (CHART_W - 6 * 8) / 7; // 7 bars, 6 gaps of 8px

  return (
    <View
      style={{
        height: CHART_H + 30,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      {bars.map((bar, i) => {
        const fillH = (bar.amount / maxAmt) * CHART_H;
        const h = bar.amount > 0 ? Math.max(fillH, 4) : 4;

        return (
          <View key={i} style={{ alignItems: 'center', width: barW, gap: 8 }}>
            <View style={{ height: CHART_H, justifyContent: 'flex-end', width: '100%' }}>
              <View
                style={{
                  height: h,
                  backgroundColor: bar.isToday ? '#111827' : '#e5e7eb',
                  borderRadius: 6,
                  width: '100%',
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                color: bar.isToday ? '#111827' : '#9ca3af',
                fontWeight: bar.isToday ? '600' : '500',
              }}
            >
              {bar.shortLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type Period = 'today' | 'week' | 'month';

export default function SellerEarningsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<EarningsStats>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    completedJobs: 0,
    pendingPayout: 0,
    avgOrderValue: 0,
    fulfillmentRate: 100,
    repeatBuyerRate: 0,
    topMaterials: [],
  });

  const handleSetupPayouts = async () => {
    if (!token) return;
    setSetupLoading(true);
    try {
      const { url } = await api.setupPayouts(token);
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Kļūda', 'Neizdevās iegūt saiti.');
      }
    } catch (err: any) {
      Alert.alert('Kļūda', err.message || 'Neizdevās savienoties ar Stripe.');
    } finally {
      setSetupLoading(false);
    }
  };

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dailyChart, setDailyChart] = useState<DayBar[]>([]);
  const [sellerAnalytics, setSellerAnalytics] = useState<SellerAnalytics | null>(null);

  const fetchEarnings = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const orders = await api.orders.myOrders(token);
        // For hybrid users (canSell + canBuy), exclude orders they placed as a buyer
        const sellerOrders = user?.canSell
          ? orders.filter((o) => o.createdBy?.id !== user.id)
          : orders;
        const { stats: s, history: h, dailyChart: dc } = computeStats(sellerOrders);
        setStats(s);
        setHistory(h);
        setDailyChart(dc);
        // Fetch seller analytics (non-critical — provides 12-month chart + official KPIs)
        api.analytics
          .overview(token)
          .then((ov) => setSellerAnalytics(ov.seller ?? null))
          .catch(() => {});
      } catch (e) {
        if (!silent) showToast('Kļūda ielādējot datus', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
    }, [fetchEarnings]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings(true);
  };

  const heroAmount =
    period === 'today'
      ? stats.todayEarnings
      : period === 'week'
        ? stats.weekEarnings
        : stats.monthEarnings;

  const filteredHistory = (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') {
      return history.filter((e) => e.rawDate >= todayStart);
    }
    if (period === 'week') {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return history.filter((e) => e.rawDate >= weekStart);
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return history.filter((e) => e.rawDate >= monthStart);
  })();

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Šodien' },
    { key: 'week', label: 'Šonedēļ' },
    { key: 'month', label: 'Mēnesī' },
  ];

  if (loading && !refreshing) {
    return (
      <ScreenContainer bg="white">
        <ScreenHeader title="Ienākumi" />
        <View style={{ padding: 24, gap: 20 }}>
          <Skeleton style={{ height: 48, width: 128, alignSelf: 'center', borderRadius: 8 }} />
          <Skeleton style={{ height: 160, width: '100%', borderRadius: 16 }} />
          <Skeleton style={{ height: 32, width: '100%', borderRadius: 8 }} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="white">
      <ScreenHeader title="Ienākumi" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00A878" />
        }
      >
        {user?.isCompany && user.payoutEnabled === false && (
          <View className="mb-4 mx-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <Text className="text-orange-900 font-bold mb-1">Aktivizēt izmaksas</Text>
            <Text className="text-orange-800 text-sm mb-3">
              Pievienojiet bankas kontu, lai saņemtu ienēmumus.
            </Text>
            <TouchableOpacity
              onPress={handleSetupPayouts}
              disabled={setupLoading}
              className="bg-orange-600 py-2 px-4 rounded-md items-center"
            >
              {setupLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-medium">Iestaītīt ar Stripe</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Hero Section ──────────────────────────────── */}
        <View style={s.heroContainer}>
          <Text style={s.heroLabel}>
            {period === 'today' ? 'Šodienas' : period === 'week' ? 'Šīs nedēļas' : 'Mēneša'}{' '}
            ieņēmumi
          </Text>
          <Text style={s.heroAmount}>€{heroAmount.toFixed(2)}</Text>

          {/* Segmented Control */}
          <View style={s.segmentedControl}>
            {PERIODS.map((p) => {
              const isActive = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[s.segment, isActive && s.segmentActive]}
                  onPress={() => {
                    haptics.light();
                    setPeriod(p.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.segmentText, isActive && s.segmentTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Chart ─────────────────────────────────────── */}
        <View style={s.chartSection}>
          <MinimalBarChart bars={dailyChart} />
        </View>

        {/* ── Key Metrics ───────────────────────────────── */}
        <View style={s.metricsRow}>
          <View style={s.metricItem}>
            <Text style={s.metricValue}>{stats.completedJobs}</Text>
            <Text style={s.metricLabel}>Pasūtījumi</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricItem}>
            <Text style={s.metricValue}>€{stats.pendingPayout.toFixed(0)}</Text>
            <Text style={s.metricLabel}>Gaida apstiprin.</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricItem}>
            <Text style={s.metricValue}>€{stats.avgOrderValue.toFixed(0)}</Text>
            <Text style={s.metricLabel}>Vid. pasūt.</Text>
          </View>
        </View>

        {/* ── Analytics Section ──────────────────────── */}
        <View style={s.analyticsSection}>
          <Text style={s.sectionTitle}>Analītika</Text>

          {/* 12-month revenue chart */}
          {sellerAnalytics && sellerAnalytics.monthlyRevenue.length > 0 && (
            <View style={s.an12Card}>
              <Text style={s.an12Label}>12 mēneši</Text>
              {sellerAnalytics.monthlyRevenue.slice(-12).map((m) => {
                const maxVal = Math.max(...sellerAnalytics.monthlyRevenue.map((x) => x.value), 1);
                const pct = m.value / maxVal;
                const [y, mo] = m.month.split('-');
                const isThisMonth =
                  m.month ===
                  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                return (
                  <View key={m.month} style={s.an12Row}>
                    <Text
                      style={[
                        s.an12MonthLabel,
                        isThisMonth && { color: '#111827', fontWeight: '700' },
                      ]}
                    >
                      {mo}/{y?.slice(2)}
                    </Text>
                    <View style={s.anBar}>
                      <View
                        style={[
                          s.anBarFill,
                          {
                            width: `${Math.max(pct * 100, 2)}%` as any,
                            backgroundColor: isThisMonth ? '#111827' : '#e5e7eb',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.an12ValLabel, isThisMonth && { color: '#111827' }]}>
                      €{m.value >= 1000 ? `${(m.value / 1000).toFixed(1)}k` : m.value.toFixed(0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Fulfillment rate + Repeat buyers side by side */}
          <View style={s.anRowCards}>
            <View style={s.anCard}>
              <Text style={s.anCardValue}>{stats.fulfillmentRate}%</Text>
              <Text style={s.anCardLabel}>Izpildes līmenis</Text>
              <View style={s.anBar}>
                <View style={[s.anBarFill, { width: `${stats.fulfillmentRate}%` as any }]} />
              </View>
            </View>
            <View style={s.anCard}>
              <Text style={s.anCardValue}>{stats.repeatBuyerRate}%</Text>
              <Text style={s.anCardLabel}>Atkārtoti klienti</Text>
              <View style={s.anBar}>
                <View
                  style={[
                    s.anBarFill,
                    { width: `${stats.repeatBuyerRate}%` as any, backgroundColor: '#16a34a' },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Official performance stats from analytics API */}
          {sellerAnalytics?.performanceStats && (
            <View style={s.anRowCards}>
              <View style={s.anCard}>
                <Text style={s.anCardValue}>{sellerAnalytics.performanceStats.onTimeRate}%</Text>
                <Text style={s.anCardLabel}>Laicīga piegāde</Text>
                <View style={s.anBar}>
                  <View
                    style={[
                      s.anBarFill,
                      {
                        width: `${sellerAnalytics.performanceStats.onTimeRate}%` as any,
                        backgroundColor: '#0284c7',
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={s.anCard}>
                <Text style={s.anCardValue}>
                  {sellerAnalytics.performanceStats.avgRating > 0
                    ? sellerAnalytics.performanceStats.avgRating.toFixed(1)
                    : '—'}
                </Text>
                <Text style={s.anCardLabel}>
                  Vērtējums ({sellerAnalytics.performanceStats.totalReviews} ats.)
                </Text>
                <View style={s.anBar}>
                  <View
                    style={[
                      s.anBarFill,
                      {
                        width: `${(sellerAnalytics.performanceStats.avgRating / 5) * 100}%` as any,
                        backgroundColor: '#f59e0b',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Top materials */}
          {stats.topMaterials.length > 0 && (
            <View style={s.anTopMats}>
              <Text style={s.anTopMatsTitle}>Top materiāli</Text>
              {stats.topMaterials.map((m, i) => {
                const maxAmt = stats.topMaterials[0].amount;
                return (
                  <View key={m.label} style={s.anMatRow}>
                    <Text style={s.anMatRank}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={s.anMatLabelRow}>
                        <Text style={s.anMatLabel} numberOfLines={1}>
                          {m.label}
                        </Text>
                        <Text style={s.anMatAmt}>€{m.amount.toFixed(0)}</Text>
                      </View>
                      <View style={s.anBar}>
                        <View
                          style={[
                            s.anBarFill,
                            {
                              width: `${(m.amount / maxAmt) * 100}%` as any,
                              backgroundColor: '#374151',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Recent Activity List ──────────────────────── */}
        <View style={s.listSection}>
          <Text style={s.sectionTitle}>Nesenā aktivitāte</Text>

          {filteredHistory.length === 0 ? (
            <EmptyState title="Nav aktivitātes" subtitle="Šajā periodā nav reģistrētu pasūtījumu" />
          ) : (
            <View>
              {filteredHistory.map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.listItem, i < filteredHistory.length - 1 && s.listBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(seller)/order/${item.id}` as any)}
                >
                  <View style={s.listLeft}>
                    <Text style={s.listTime}>{item.date}</Text>
                    <Text style={s.listRoute} numberOfLines={1}>
                      {item.buyerName} · #{item.orderNumber}
                    </Text>
                  </View>
                  <View style={s.listRight}>
                    <Text style={s.listAmount}>
                      {item.amount > 0 ? `€${item.amount.toFixed(2)}` : '€0.00'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  heroContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  heroLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '800', // Heavy weight like Uber/Lyft
    color: '#111827',
    letterSpacing: -1.5,
  },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    padding: 4,
    marginTop: 16,
    width: '90%', // slightly less than full width
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#111827',
  },

  // Chart
  chartSection: {
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 24,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    fontWeight: '500',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
  },

  // List
  listSection: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  // Analytics
  analyticsSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  anRowCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  anCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  anCardValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  anCardLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 6 },
  anBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  anBarFill: {
    height: 4,
    backgroundColor: '#111827',
    borderRadius: 2,
  },
  an12Card: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  an12Label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  an12Row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  an12MonthLabel: {
    width: 40,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500' as const,
  },
  an12ValLabel: {
    width: 50,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
  anTopMats: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  anTopMatsTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  anMatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  anMatRank: { fontSize: 13, fontWeight: '700', color: '#9ca3af', width: 16, textAlign: 'center' },
  anMatLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  anMatLabel: { fontSize: 13, fontWeight: '500', color: '#374151', flex: 1 },
  anMatAmt: { fontSize: 13, fontWeight: '700', color: '#111827' },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  listBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listLeft: {
    gap: 4,
    flex: 1,
  },
  listTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  listRoute: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
});
