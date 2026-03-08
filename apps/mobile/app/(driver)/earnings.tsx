import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/lib/translations';
import { Check, Clock, TrendingUp, CalendarDays, BarChart2, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiTransportJob } from '@/lib/api';

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

export default function EarningsScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ActivityIndicator color="#dc2626" style={{ flex: 1, marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title */}
        <Text style={styles.title}>{t.earnings.title}</Text>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <View style={styles.statCardTop}>
              <TrendingUp size={18} color="rgba(255,255,255,0.65)" />
            </View>
            <Text style={styles.statLabelLight}>{t.earnings.today}</Text>
            <Text style={styles.statValueLight}>€{stats.todayEarnings}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardTop}>
              <CalendarDays size={18} color="#d1d5db" />
            </View>
            <Text style={styles.statLabel}>{t.earnings.thisWeek}</Text>
            <Text style={styles.statValue}>€{stats.weekEarnings}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardTop}>
              <BarChart2 size={18} color="#d1d5db" />
            </View>
            <Text style={styles.statLabel}>{t.earnings.thisMonth}</Text>
            <Text style={styles.statValue}>€{stats.monthEarnings}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statCardTop}>
              <CheckCircle2 size={18} color="#d1d5db" />
            </View>
            <Text style={styles.statLabel}>{t.earnings.completedJobs}</Text>
            <Text style={styles.statValue}>{stats.completedJobs}</Text>
          </View>
        </View>

        {/* Pending payout */}
        <View style={styles.pendingCard}>
          <View>
            <Text style={styles.pendingLabel}>{t.earnings.pending}</Text>
            <Text style={styles.pendingAmount}>€{stats.pendingPayout}</Text>
          </View>
          <Clock size={32} color="#92400e" />
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>{t.earnings.history}</Text>
        <View style={styles.historyList}>
          {history.map((job) => (
            <View key={job.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyJob}>#{job.jobNumber}</Text>
                <Text style={styles.historyRoute}>{job.route}</Text>
                <Text style={styles.historyDate}>{job.date}</Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyAmount}>€{job.amount}</Text>
                <View
                  style={[
                    styles.payStatus,
                    job.paid ? styles.payStatusPaid : styles.payStatusPending,
                  ]}
                >
                  {job.paid ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Check size={11} color="#16a34a" />
                      <Text style={[styles.payStatusText, styles.payStatusTextPaid]}>
                        Izmaksāts
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} color="#d97706" />
                      <Text style={[styles.payStatusText, styles.payStatusTextPending]}>Gaida</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 16 },

  title: { fontSize: 24, fontWeight: '700', color: '#111827' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardPrimary: { backgroundColor: '#dc2626' },
  statLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  statLabelLight: { fontSize: 12, color: '#fca5a5', fontWeight: '500' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 4 },
  statValueLight: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginTop: 4 },
  statCardTop: { alignSelf: 'flex-end', marginBottom: 6 },

  pendingCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingLabel: { fontSize: 13, color: '#92400e', fontWeight: '500' },
  pendingAmount: { fontSize: 24, fontWeight: '800', color: '#92400e', marginTop: 2 },
  pendingIcon: { fontSize: 32 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  historyList: { gap: 2 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  historyJob: { fontSize: 13, fontWeight: '700', color: '#111827' },
  historyRoute: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  historyDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  historyRight: { alignItems: 'flex-end', gap: 6 },
  historyAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  payStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  payStatusPaid: { backgroundColor: '#dcfce7' },
  payStatusPending: { backgroundColor: '#fef3c7' },
  payStatusText: { fontSize: 11, fontWeight: '600' },
  payStatusTextPaid: { color: '#16a34a' },
  payStatusTextPending: { color: '#d97706' },
});
