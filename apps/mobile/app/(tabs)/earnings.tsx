import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/lib/translations';

// ── Mock data ─────────────────────────────────────────────────────────────────
const STATS = {
  todayEarnings: 169,
  weekEarnings: 843,
  monthEarnings: 3210,
  completedJobs: 6,
  pendingPayout: 338,
};

const JOB_HISTORY = [
  {
    id: 'h-001',
    jobNumber: 'JOB-001',
    date: '28.04.2025',
    route: 'Jūrmala → Rīga',
    amount: 169,
    paid: true,
  },
  {
    id: 'h-002',
    jobNumber: 'JOB-008',
    date: '27.04.2025',
    route: 'Ogre → Sigulda',
    amount: 215,
    paid: true,
  },
  {
    id: 'h-003',
    jobNumber: 'JOB-007',
    date: '25.04.2025',
    route: 'Rīga → Ventspils',
    amount: 380,
    paid: false,
  },
  {
    id: 'h-004',
    jobNumber: 'JOB-005',
    date: '23.04.2025',
    route: 'Jelgava → Rīga',
    amount: 79,
    paid: true,
  },
];

export default function EarningsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title */}
        <Text style={styles.title}>{t.earnings.title}</Text>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statLabelLight}>{t.earnings.today}</Text>
            <Text style={styles.statValueLight}>€{STATS.todayEarnings}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t.earnings.thisWeek}</Text>
            <Text style={styles.statValue}>€{STATS.weekEarnings}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t.earnings.thisMonth}</Text>
            <Text style={styles.statValue}>€{STATS.monthEarnings}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t.earnings.completedJobs}</Text>
            <Text style={styles.statValue}>{STATS.completedJobs}</Text>
          </View>
        </View>

        {/* Pending payout */}
        <View style={styles.pendingCard}>
          <View>
            <Text style={styles.pendingLabel}>{t.earnings.pending}</Text>
            <Text style={styles.pendingAmount}>€{STATS.pendingPayout}</Text>
          </View>
          <Text style={styles.pendingIcon}>⏳</Text>
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>{t.earnings.history}</Text>
        <View style={styles.historyList}>
          {JOB_HISTORY.map((job) => (
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
                  <Text
                    style={[
                      styles.payStatusText,
                      job.paid ? styles.payStatusTextPaid : styles.payStatusTextPending,
                    ]}
                  >
                    {job.paid ? '✓ Izmaksāts' : '⏳ Gaida'}
                  </Text>
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
    borderWidth: 1,
    borderColor: '#f3f4f6',
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
