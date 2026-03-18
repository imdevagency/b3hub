import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useFocusEffect } from 'expo-router';
import { t } from '@/lib/translations';
import { Check, Clock, TrendingUp, Banknote, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiTransportJob } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Types & helpers ───────────────────────────────────────────────────────
interface EarningsStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedJobs: number;
  pendingPayout: number;
}

interface DayBar {
  label: string; // '23.2' or 'Šod'
  shortLabel: string; // 2-char day abbreviation
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
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rawDate: d,
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: false, // no real payout mechanism yet — always show as pending
      });
    } else if (ACTIVE_STATUSES.includes(job.status)) {
      pendingPayout += job.rate;
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: new Date(job.pickupDate).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        rawDate: new Date(job.pickupDate),
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: false,
      });
    }
  }
  return {
    stats: { todayEarnings, weekEarnings, monthEarnings, completedJobs, pendingPayout },
    history,
    dailyChart: buildDailyChart(jobs),
  };
}

// ── Weekly bar chart component ────────────────────────────────────────────────
const CHART_H = 72;
const CHART_W = Dimensions.get('window').width - 48; // 24px padding each side

function WeeklyBarChart({ bars }: { bars: DayBar[] }) {
  const maxAmt = Math.max(...bars.map((b) => b.amount), 1);
  const barW = Math.floor((CHART_W - 6 * 4) / 7); // 4px gap between bars
  return (
    <View style={chartStyles.wrap}>
      <Text style={chartStyles.title}>Izpeļņa pa dienām</Text>
      <View style={chartStyles.chart}>
        {bars.map((bar, i) => {
          const fillH = Math.max(
            Math.round((bar.amount / maxAmt) * CHART_H),
            bar.amount > 0 ? 4 : 0,
          );
          return (
            <View key={i} style={[chartStyles.col, { width: barW }]}>
              {bar.amount > 0 && (
                <Text style={chartStyles.barAmt} numberOfLines={1}>
                  €{bar.amount >= 100 ? Math.round(bar.amount) : bar.amount.toFixed(0)}
                </Text>
              )}
              <View style={chartStyles.barTrack}>
                <View
                  style={[
                    chartStyles.barFill,
                    { height: fillH, backgroundColor: bar.isToday ? '#111827' : '#d1d5db' },
                    bar.amount > 0 && !bar.isToday && { backgroundColor: '#374151' },
                  ]}
                />
              </View>
              <Text
                style={[
                  chartStyles.dayLabel,
                  bar.isToday && { color: '#111827', fontWeight: '700' },
                ]}
              >
                {bar.shortLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type Period = 'today' | 'week' | 'month';

export default function EarningsScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<EarningsStats>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    completedJobs: 0,
    pendingPayout: 0,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dailyChart, setDailyChart] = useState<DayBar[]>([]);

  const fetchEarnings = useCallback(async () => {
    if (!token) return;
    try {
      const jobs = await api.transportJobs.myJobs(token);
      const { stats: s, history: h, dailyChart: dc } = computeStats(jobs);
      setStats(s);
      setHistory(h);
      setDailyChart(dc);
    } catch (e) {
      Alert.alert('Kļūda', 'Neizdevās ielādēt ienākumu datus');
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

  // Filter history list to match the selected period
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
    { key: 'today', label: t.earnings.today },
    { key: 'week', label: t.earnings.thisWeek },
    { key: 'month', label: t.earnings.thisMonth },
  ];

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonCard count={3} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Red hero header ── */}
        <View style={styles.header}>
          <Text style={styles.headerSuper}>{t.earnings.title}</Text>
          <Text style={styles.heroAmount}>€{heroAmount.toFixed(0)}</Text>

          {/* Period filter chips */}
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodChip, period === p.key && styles.periodChipActive]}
                onPress={() => setPeriod(p.key)}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.periodChipText, period === p.key && styles.periodChipTextActive]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Weekly bar chart ── */}
          {dailyChart.length > 0 && <WeeklyBarChart bars={dailyChart} />}

          {/* ── Summary row ── */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: '#dcfce7' }]}>
                <CheckCircle2 size={18} color="#111827" />
              </View>
              <Text style={styles.summaryValue}>{stats.completedJobs}</Text>
              <Text style={styles.summaryLabel}>{t.earnings.completedJobs}</Text>
            </View>
            <View
              style={[styles.summaryCard, { backgroundColor: '#f3f4f6', borderColor: '#f3f4f6' }]}
            >
              <View style={[styles.summaryIcon, { backgroundColor: '#f3f4f6' }]}>
                <Clock size={18} color="#6b7280" />
              </View>
              <Text style={[styles.summaryValue, { color: '#6b7280' }]}>
                €{stats.pendingPayout.toFixed(0)}
              </Text>
              <Text style={[styles.summaryLabel, { color: '#6b7280' }]}>{t.earnings.pending}</Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: '#fee2e2' }]}>
                <TrendingUp size={18} color="#111827" />
              </View>
              <Text style={styles.summaryValue}>€{stats.monthEarnings.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>{t.earnings.thisMonth}</Text>
            </View>
          </View>

          {/* ── History ── */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>{t.earnings.history}</Text>
            {filteredHistory.length === 0 ? (
              <EmptyState icon={<Banknote size={36} color="#d1d5db" />} title="Nav darbu vēsturē" />
            ) : (
              <View style={styles.historyList}>
                {filteredHistory.map((job, idx) => (
                  <View
                    key={job.id}
                    style={[
                      styles.historyRow,
                      idx < filteredHistory.length - 1 && styles.historyRowBorder,
                    ]}
                  >
                    <View
                      style={[
                        styles.historyDot,
                        { backgroundColor: job.paid ? '#dcfce7' : '#f3f4f6' },
                      ]}
                    >
                      {job.paid ? (
                        <Check size={13} color="#111827" />
                      ) : (
                        <Clock size={13} color="#6b7280" />
                      )}
                    </View>
                    <View style={styles.historyBody}>
                      <Text style={styles.historyRoute}>{job.route}</Text>
                      <Text style={styles.historyDate}>
                        #{job.jobNumber} · {job.date}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyAmount}>€{job.amount}</Text>
                      <View
                        style={[
                          styles.payStatus,
                          job.paid ? styles.payStatusPaid : styles.payStatusPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.payStatusText,
                            job.paid ? styles.payStatusTextPaid : styles.payStatusTextPending,
                          ]}
                        >
                          {job.paid ? 'Izmaksāts' : 'Gaida izmaksu'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },

  // ── Header ──
  header: {
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 4,
  },
  headerSuper: { fontSize: 13, color: '#fca5a5', fontWeight: '500', letterSpacing: 0.3 },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
    letterSpacing: -1,
  },

  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  periodChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  periodChipActive: {
    backgroundColor: '#ffffff',
  },
  periodChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  periodChipTextActive: { color: '#111827' },

  // ── Body ──
  body: { padding: 16, gap: 18, paddingBottom: 40 },

  summaryRow: { flexDirection: 'row', gap: 10, marginTop: -4 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 2 },
  summaryLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', textAlign: 'center' },

  // ── History ──
  historySection: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyHistoryText: { fontSize: 14, color: '#9ca3af' },

  historyList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historyDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyBody: { flex: 1, gap: 2 },
  historyRoute: { fontSize: 13, fontWeight: '700', color: '#111827' },
  historyDate: { fontSize: 11, color: '#9ca3af' },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  payStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  payStatusPaid: { backgroundColor: '#dcfce7' },
  payStatusPending: { backgroundColor: '#f3f4f6' },
  payStatusText: { fontSize: 10, fontWeight: '700' },
  payStatusTextPaid: { color: '#111827' },
  payStatusTextPending: { color: '#6b7280' },
});

const chartStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  title: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.3 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: CHART_H + 36, // bars + label + amount
  },
  col: { alignItems: 'center', gap: 4 },
  barAmt: { fontSize: 9, fontWeight: '700', color: '#374151' },
  barTrack: {
    width: '100%',
    height: CHART_H,
    justifyContent: 'flex-end',
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 4 },
  dayLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
});
