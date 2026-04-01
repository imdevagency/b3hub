import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useFocusEffect, useRouter } from 'expo-router';
import { t } from '@/lib/translations';
import { Check, Clock, TrendingUp, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiTransportJob } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { haptics } from '@/lib/haptics';

// ── Types & helpers ───────────────────────────────────────────────────────

interface EarningsStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedJobs: number;
  pendingPayout: number;
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
  jobNumber: string;
  date: string;
  rawDate: Date;
  route: string;
  amount: number;
  paid: boolean;
  status: string;
}

const ACTIVE_STATUSES = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
];

function buildDailyChart(jobs: ApiTransportJob[]): DayBar[] {
  const now = new Date();
  const bars: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const nextD = new Date(d.getTime() + 86_400_000);
    const amount = jobs
      .filter((j) => {
        if (j.status !== 'DELIVERED') return false;
        const jd = new Date(j.deliveryDate ?? j.pickupDate);
        return jd >= d && jd < nextD;
      })
      .reduce((sum, j) => sum + j.rate, 0);
    bars.push({
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      shortLabel: i === 0 ? 'Šod' : LV_DAYS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }
  return bars;
}

function computeStats(jobs: ApiTransportJob[]): {
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

  for (const job of jobs) {
    const d = new Date(job.deliveryDate ?? job.pickupDate);
    if (job.status === 'DELIVERED') {
      completedJobs++;
      if (d >= todayStart) todayEarnings += job.rate;
      if (d >= weekStart) weekEarnings += job.rate;
      if (d >= monthStart) monthEarnings += job.rate;
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' }),
        rawDate: d,
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: false,
        status: job.status,
      });
    } else if (ACTIVE_STATUSES.includes(job.status)) {
      pendingPayout += job.rate;
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: new Date(job.pickupDate).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
        }),
        rawDate: new Date(job.pickupDate),
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: false,
        status: job.status,
      });
    }
  }
  // Sort history by date descending
  history.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  return {
    stats: { todayEarnings, weekEarnings, monthEarnings, completedJobs, pendingPayout },
    history,
    dailyChart: buildDailyChart(jobs),
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
        // Ensure at least a tiny bit visible if amounts are 0 but max > 0, or just show 0 height
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

export default function EarningsScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [setupLoading, setSetupLoading] = useState(false);
  const [stats, setStats] = useState<EarningsStats>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    completedJobs: 0,
    pendingPayout: 0,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dailyChart, setDailyChart] = useState<DayBar[]>([]);

  const handleSetupPayouts = async () => {
    if (!token) return;
    try {
      setSetupLoading(true);
      const { url } = await api.setupPayouts(token);
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Kļūda', 'Neizdevās iegūt saiti.');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Kļūda', err.message || 'Neizdevās savienoties ar Stripe.');
    } finally {
      setSetupLoading(false);
    }
  };

  const fetchEarnings = useCallback(async () => {
    if (!token) return;
    try {
      const jobs = await api.transportJobs.myJobs(token);
      const { stats: s, history: h, dailyChart: dc } = computeStats(jobs);
      setStats(s);
      setHistory(h);
      setDailyChart(dc);
    } catch (e) {
      // silent fail or toast
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
    }, [fetchEarnings]),
  );

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
    // month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return history.filter((e) => e.rawDate >= monthStart);
  })();

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Šodien' },
    { key: 'week', label: 'Šonedēļ' },
    { key: 'month', label: 'Mēnesī' },
  ];

  if (loading) {
    return (
      <ScreenContainer standalone>
        <ScreenHeader title="Izpeļņa" />
        <View style={{ padding: 24, gap: 20 }}>
          <Skeleton style={{ height: 48, width: 128, alignSelf: 'center', borderRadius: 8 }} />
          <Skeleton style={{ height: 160, width: '100%', borderRadius: 16 }} />
          <Skeleton style={{ height: 32, width: '100%', borderRadius: 8 }} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer standalone bg="white">
      <ScreenHeader title="Izpeļņa" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {user?.isCompany && user.payoutEnabled === false && (
          <View className="mb-4 mx-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <Text className="text-orange-900 font-bold mb-1">Aktivizēt izmaksas</Text>
            <Text className="text-orange-800 text-sm mb-3">
              Pievienojiet bankas kontu, lai saņemtu izpeļņu.
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
            {period === 'today' ? 'Šodienas' : period === 'week' ? 'Šīs nedēļas' : 'Mēneša'} izpeļņa
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
            <Text style={s.metricLabel}>Braucieni</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricItem}>
            <Text style={s.metricValue}>€{stats.pendingPayout.toFixed(0)}</Text>
            <Text style={s.metricLabel}>Gaida izmaksu</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricItem}>
            <Text style={s.metricValue}>--:--</Text>
            <Text style={s.metricLabel}>Tiešsaistē</Text>
          </View>
        </View>

        {/* ── Recent Activity List ──────────────────────── */}
        <View style={s.listSection}>
          <Text style={s.sectionTitle}>Nesenā aktivitāte</Text>

          {filteredHistory.length === 0 ? (
            <EmptyState title="Nav aktivitātes" subtitle="Šajā periodā nav reģistrētu braucienu" />
          ) : (
            <View>
              {filteredHistory.map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.listItem, i < filteredHistory.length - 1 && s.listBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(buyer)/transport-job/${item.id}` as any)}
                >
                  <View style={s.listLeft}>
                    {/* Time or Date only if not strictly visible in header context, but here we show date */}
                    <Text style={s.listTime}>{item.date}</Text>
                    <Text style={s.listRoute} numberOfLines={1}>
                      {item.route}
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
