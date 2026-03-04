import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { t } from '@/lib/translations';
import { useAuth } from '@/lib/auth-context';
import { api, ApiTransportJob } from '@/lib/api';
import { Map, Phone, CheckCircle2, Navigation2 } from 'lucide-react-native';

// ── Status progression ────────────────────────────────────────────────────────
const STATUS_STEPS = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
] as const;

type JobStatus = (typeof STATUS_STEPS)[number];

const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  ACCEPTED: 'EN_ROUTE_PICKUP',
  EN_ROUTE_PICKUP: 'AT_PICKUP',
  AT_PICKUP: 'LOADED',
  LOADED: 'EN_ROUTE_DELIVERY',
  EN_ROUTE_DELIVERY: 'AT_DELIVERY',
  AT_DELIVERY: 'DELIVERED',
  DELIVERED: null,
};

export default function ActiveJobScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [job, setJob] = React.useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchActiveJob = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.transportJobs.myActive(token);
      setJob(data);
    } catch (e) {
      console.error('Failed to fetch active job', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchActiveJob();
  }, [fetchActiveJob]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Map size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{t.activeJob.noJob}</Text>
          <Text style={styles.emptyDesc}>{t.activeJob.noJobDesc}</Text>
          <TouchableOpacity style={styles.goBtn} onPress={() => router.push('/(tabs)/jobs')}>
            <Text style={styles.goBtnText}>{t.activeJob.goToJobs}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatus = job.status as JobStatus;
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);
  const nextStatus = NEXT_STATUS[currentStatus];

  const handleUpdateStatus = () => {
    if (!nextStatus || !token) return;
    Alert.alert(t.activeJob.updateStatus, `→ ${t.activeJob.status[nextStatus]}`, [
      { text: 'Atcelt', style: 'cancel' },
      {
        text: 'Apstiprināt',
        onPress: async () => {
          try {
            const updated = await api.transportJobs.updateStatus(job.id, nextStatus, token);
            setJob(updated);
          } catch (err: any) {
            Alert.alert('Kļūda', err.message ?? 'Neizdevās atjaunināt statusu');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.activeJob.title}</Text>
          <View style={styles.priceTag}>
            <Text style={styles.price}>€{job.rate.toFixed(2)}</Text>
          </View>
        </View>

        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {t.activeJob.status[currentStatus] ?? currentStatus}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            {STATUS_STEPS.map((step, i) => (
              <View
                key={step}
                style={[
                  styles.progressDot,
                  i <= currentIndex && styles.progressDotActive,
                  i < currentIndex && styles.progressDotDone,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Job details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>
            #{job.jobNumber} · {job.cargoType} {job.cargoWeight ?? 0}t
          </Text>

          <View style={styles.routeSection}>
            {/* From */}
            <View style={styles.routeRow}>
              <View style={styles.routeDot} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>{t.jobs.from}</Text>
                <Text style={styles.routeValue}>
                  {job.pickupAddress}, {job.pickupCity}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() =>
                  Alert.alert(t.activeJob.call, job.pickupWindow ?? t.activeJob.noContact)
                }
              >
                <Phone size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.routeLine} />

            {/* To */}
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>{t.jobs.to}</Text>
                <Text style={styles.routeValue}>
                  {job.deliveryAddress}, {job.deliveryCity}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() =>
                  Alert.alert(t.activeJob.call, job.deliveryWindow ?? t.activeJob.noContact)
                }
              >
                <Phone size={18} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.navigateBtn}
            onPress={() => Alert.alert(t.activeJob.navigate, 'Atvērt navigāciju...')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Navigation2 size={18} color="#ffffff" />
              <Text style={styles.navigateBtnText}>{t.activeJob.navigate}</Text>
            </View>
          </TouchableOpacity>

          {nextStatus && (
            <TouchableOpacity style={styles.nextBtn} onPress={handleUpdateStatus}>
              <Text style={styles.nextBtnText}>{t.activeJob.nextStep} →</Text>
            </TouchableOpacity>
          )}

          {!nextStatus && (
            <View style={styles.completedBanner}>
              <CheckCircle2 size={20} color="#16a34a" />
              <Text style={styles.completedText}>Piegādāts!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  priceTag: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  price: { color: '#fff', fontWeight: '800', fontSize: 18 },

  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },

  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
    flex: 1,
  },
  progressDotActive: { backgroundColor: '#fca5a5' },
  progressDotDone: { backgroundColor: '#dc2626' },

  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  detailsTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },

  routeSection: { gap: 0 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  routeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#dc2626',
    borderWidth: 3,
    borderColor: '#fecaca',
  },
  routeDotEnd: { backgroundColor: '#16a34a', borderColor: '#bbf7d0' },
  routeLine: { width: 2, height: 20, backgroundColor: '#e5e7eb', marginLeft: 6 },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnText: { fontSize: 18 },

  actionsRow: { gap: 10 },
  navigateBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navigateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nextBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  completedBanner: {
    backgroundColor: '#dcfce7',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  completedText: { color: '#16a34a', fontWeight: '700', fontSize: 16 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  goBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#dc2626',
  },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
