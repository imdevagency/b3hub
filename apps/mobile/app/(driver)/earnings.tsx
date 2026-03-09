import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { t } from '@/lib/translations';
import { Check, Clock, TrendingUp, Banknote, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiTransportJob } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';

// ── Types & helpers ───────────────────────────────────────────────────────
interface EarningsStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedJobs: number;
  pendingPayout: number;
}

interface HistoryEntry {
  id: string;
  jobNumber: string;
  date: string;
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

function computeStats(jobs: ApiTransportJob[]): { stats: EarningsStats; history: HistoryEntry[] } {
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
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: true,
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
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: false,
      });
    }
  }
  return {
    stats: { todayEarnings, weekEarnings, monthEarnings, completedJobs, pendingPayout },
    history,
  };
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

  const fetchEarnings = useCallback(async () => {
    if (!token) return;
    try {
      const jobs = await api.transportJobs.myJobs(token);
      const { stats: s, history: h } = computeStats(jobs);
      setStats(s);
      setHistory(h);
    } catch (e) {
      console.error('Failed to load earnings', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const heroAmount =
    period === 'today'
      ? stats.todayEarnings
      : period === 'week'
        ? stats.weekEarnings
        : stats.monthEarnings;

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
          {/* ── Summary row ── */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: '#dcfce7' }]}>
                <CheckCircle2 size={18} color="#16a34a" />
              </View>
              <Text style={styles.summaryValue}>{stats.completedJobs}</Text>
              <Text style={styles.summaryLabel}>{t.earnings.completedJobs}</Text>
            </View>
            <View
              style={[styles.summaryCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}
            >
              <View style={[styles.summaryIcon, { backgroundColor: '#fef3c7' }]}>
                <Clock size={18} color="#d97706" />
              </View>
              <Text style={[styles.summaryValue, { color: '#92400e' }]}>
                €{stats.pendingPayout.toFixed(0)}
              </Text>
              <Text style={[styles.summaryLabel, { color: '#a16207' }]}>{t.earnings.pending}</Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: '#fee2e2' }]}>
                <TrendingUp size={18} color="#dc2626" />
              </View>
              <Text style={styles.summaryValue}>€{stats.monthEarnings.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>{t.earnings.thisMonth}</Text>
            </View>
          </View>

          {/* ── History ── */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>{t.earnings.history}</Text>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Banknote size={36} color="#d1d5db" />
                <Text style={styles.emptyHistoryText}>Nav darbu vēsturē</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {history.map((job, idx) => (
                  <View
                    key={job.id}
                    style={[styles.historyRow, idx < history.length - 1 && styles.historyRowBorder]}
                  >
                    <View
                      style={[
                        styles.historyDot,
                        { backgroundColor: job.paid ? '#dcfce7' : '#fef3c7' },
                      ]}
                    >
                      {job.paid ? (
                        <Check size={13} color="#16a34a" />
                      ) : (
                        <Clock size={13} color="#d97706" />
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
                          {job.paid ? 'Izmaksāts' : 'Gaida'}
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
    backgroundColor: '#dc2626',
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
  periodChipTextActive: { color: '#dc2626' },

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
  payStatusPending: { backgroundColor: '#fef3c7' },
  payStatusText: { fontSize: 10, fontWeight: '700' },
  payStatusTextPaid: { color: '#16a34a' },
  payStatusTextPending: { color: '#d97706' },
});
