import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/lib/translations';

// ── Mock data — replace with real API calls ──────────────────────────────────
interface TransportJob {
  id: string;
  jobNumber: string;
  vehicleType: string;
  payload: string;
  weightTonnes: number;
  from: string;
  to: string;
  distanceKm: number;
  date: string;
  price: number;
  currency: string;
  status: 'AVAILABLE';
}

const MOCK_JOBS: TransportJob[] = [
  {
    id: 'job-001',
    jobNumber: 'JOB-001',
    vehicleType: '🚛 26t Kravas auto',
    payload: 'Grants 0/45mm',
    weightTonnes: 26,
    from: 'Rūpnīca, Jūrmala',
    to: 'Būvobjekts, Rīga',
    distanceKm: 34,
    date: '29.04.2025',
    price: 169,
    currency: 'EUR',
    status: 'AVAILABLE',
  },
  {
    id: 'job-002',
    jobNumber: 'JOB-002',
    vehicleType: '🚚 18t Kravas auto',
    payload: 'Smilts 0/4mm',
    weightTonnes: 18,
    from: 'Karjers, Ogre',
    to: 'Privātmāja, Sigulda',
    distanceKm: 62,
    date: '30.04.2025',
    price: 215,
    currency: 'EUR',
    status: 'AVAILABLE',
  },
  {
    id: 'job-003',
    jobNumber: 'JOB-003',
    vehicleType: '🚛 26t Kravas auto',
    payload: 'Betons B25',
    weightTonnes: 24,
    from: 'Betonrūpnīca, Rīga',
    to: 'Būvobjekts, Ventspils',
    distanceKm: 185,
    date: '01.05.2025',
    price: 380,
    currency: 'EUR',
    status: 'AVAILABLE',
  },
];

// ── Job card component ────────────────────────────────────────────────────────
function JobCard({ job, onAccept }: { job: TransportJob; onAccept: (id: string) => void }) {
  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.jobNumber}>#{job.jobNumber}</Text>
          <Text style={styles.vehicleType}>{job.vehicleType}</Text>
        </View>
        <View style={styles.priceTag}>
          <Text style={styles.priceAmount}>€{job.price}</Text>
          <Text style={styles.priceSub}>{job.distanceKm} km</Text>
        </View>
      </View>

      {/* Payload info */}
      <View style={styles.payloadRow}>
        <Text style={styles.payloadText}>
          {job.payload} — {job.weightTonnes}t
        </Text>
      </View>

      {/* Route */}
      <View style={styles.routeSection}>
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>📍</Text>
          <View>
            <Text style={styles.routeLabel}>{t.jobs.from}</Text>
            <Text style={styles.routeValue}>{job.from}</Text>
          </View>
        </View>
        <View style={styles.routeDivider} />
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>🏁</Text>
          <View>
            <Text style={styles.routeLabel}>{t.jobs.to}</Text>
            <Text style={styles.routeValue}>{job.to}</Text>
          </View>
        </View>
      </View>

      {/* Date + actions */}
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>📅 {job.date}</Text>
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() =>
              Alert.alert(
                `#${job.jobNumber}`,
                `${job.payload} — ${job.weightTonnes}t\n${job.from} → ${job.to}\n€${job.price}`,
              )
            }
          >
            <Text style={styles.detailsBtnText}>{t.jobs.details}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(job.id)}>
            <Text style={styles.acceptBtnText}>{t.jobs.accept}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function JobsScreen() {
  const [jobs, setJobs] = useState<TransportJob[]>(MOCK_JOBS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: fetch from API
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleAccept = (jobId: string) => {
    Alert.alert(t.jobs.accepted, t.jobs.acceptedDesc, [
      {
        text: 'OK',
        onPress: () => {
          // Remove from available list (in real app: PATCH /transport-jobs/:id/accept)
          setJobs((prev) => prev.filter((j) => j.id !== jobId));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.jobs.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{jobs.length}</Text>
        </View>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>{t.jobs.empty}</Text>
          <Text style={styles.emptyDesc}>{t.jobs.emptyDesc}</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Text style={styles.refreshBtnText}>{t.jobs.refresh}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />
          }
        >
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onAccept={handleAccept} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827', flex: 1 },
  badge: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  list: { padding: 16, gap: 12 },

  // ── Card ──
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  jobNumber: { fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 0.5 },
  vehicleType: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 2 },

  priceTag: { alignItems: 'flex-end' },
  priceAmount: { fontSize: 22, fontWeight: '800', color: '#dc2626' },
  priceSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  payloadRow: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payloadText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  routeSection: { gap: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeIcon: { fontSize: 16, marginTop: 2 },
  routeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeValue: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 2 },
  routeDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 26 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  footerActions: { flexDirection: 'row', gap: 8 },

  detailsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  detailsBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  acceptBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#dc2626',
  },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  // ── Empty ──
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  refreshBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#dc2626',
  },
  refreshBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
