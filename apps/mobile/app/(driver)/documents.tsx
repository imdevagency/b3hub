/**
 * documents.tsx — Driver: delivery history with document artifacts
 * Shows all completed transport jobs (DELIVERED) with their key artifacts:
 * weighing slip photo, delivery proof, CMR status.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiTransportJob } from '@/lib/api';
import {
  MapPin,
  Weight,
  ClipboardCheck,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Artifact badge ────────────────────────────────────────────

function ArtifactBadge({
  icon: Icon,
  label,
  present,
}: {
  icon: React.ElementType;
  label: string;
  present: boolean;
}) {
  return (
    <View style={[s.badge, present ? s.badgePresent : s.badgeMissing]}>
      <Icon size={11} color={present ? '#16a34a' : '#9ca3af'} />
      <Text style={[s.badgeText, present ? s.badgeTextPresent : s.badgeTextMissing]}>{label}</Text>
    </View>
  );
}

// ── Job row ───────────────────────────────────────────────────

function JobRow({ job, onPress }: { job: ApiTransportJob; onPress: () => void }) {
  const hasWeighingPhoto = !!job.pickupPhotoUrl;
  // A DELIVERED job always implies delivery proof was submitted
  const hasDeliveryProof = job.status === 'DELIVERED';

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={s.rowLeft}>
        {/* Route */}
        <View style={s.routeRow}>
          <MapPin size={12} color="#6b7280" />
          <Text style={s.routeText} numberOfLines={1}>
            {job.pickupCity} → {job.deliveryCity}
          </Text>
        </View>

        {/* Date + cargo */}
        <View style={s.metaRow}>
          <Text style={s.metaDate}>{fmtDate(job.deliveryDate)}</Text>
          {job.actualWeightKg != null && (
            <>
              <Text style={s.metaSep}>·</Text>
              <Text style={s.metaWeight}>{(job.actualWeightKg / 1000).toFixed(1)} t</Text>
            </>
          )}
          {job.rate > 0 && (
            <>
              <Text style={s.metaSep}>·</Text>
              <Text style={s.metaRate}>€{job.rate.toFixed(0)}</Text>
            </>
          )}
        </View>

        {/* Artifact badges */}
        <View style={s.badges}>
          <ArtifactBadge icon={Weight} label="Svēršana" present={hasWeighingPhoto} />
          <ArtifactBadge icon={ClipboardCheck} label="Piegāde" present={hasDeliveryProof} />
        </View>
      </View>

      <ChevronRight size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function DriverDocumentsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const all = await api.transportJobs.myJobs(token);
        // Only keep completed deliveries
        const delivered = all.filter((j) => j.status === 'DELIVERED');
        // Sort newest first by deliveryDate
        delivered.sort(
          (a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime(),
        );
        setJobs(delivered);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleOpenWeighingPhoto = (url: string) => {
    haptics.light();
    Linking.openURL(url).catch(() => Alert.alert('Kļūda', 'Neizdevās atvērt attēlu.'));
  };

  const withPhotoCount = jobs.filter((j) => j.pickupPhotoUrl).length;
  const totalWeight = jobs.reduce((sum, j) => sum + (j.actualWeightKg ?? 0), 0);

  if (loading) {
    return (
      <ScreenContainer bg="#f9fafb">
        <ScreenHeader title="Mans darba vēsture" />
        <View style={{ padding: 20 }}>
          <SkeletonCard count={5} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f9fafb">
      <ScreenHeader title="Mans darba vēsture" />

      {/* Summary strip */}
      {jobs.length > 0 && (
        <View style={s.summary}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{jobs.length}</Text>
            <Text style={s.summaryLabel}>Piegādes</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{(totalWeight / 1000).toFixed(1)} t</Text>
            <Text style={s.summaryLabel}>Kopā pārvests</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{withPhotoCount}</Text>
            <Text style={s.summaryLabel}>Svēršanas foto</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={jobs.length === 0 ? s.listEmpty : s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
      >
        {jobs.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={36} color="#9ca3af" />}
            title="Nav izpildītu piegāžu"
            subtitle="Pabeidziet piegādi, un tā parādīsies šeit."
          />
        ) : (
          <View style={s.card}>
            {jobs.map((job, idx) => (
              <View key={job.id}>
                <JobRow
                  job={job}
                  onPress={() => {
                    haptics.light();
                    if (job.pickupPhotoUrl) {
                      // Offer: view weighing photo or go to job
                      Alert.alert(`Darbs #${job.jobNumber}`, 'Ko vēlaties darīt?', [
                        {
                          text: 'Skatīt svēršanas foto',
                          onPress: () => handleOpenWeighingPhoto(job.pickupPhotoUrl!),
                        },
                        {
                          text: 'Darba detaļas',
                          onPress: () =>
                            router.push({
                              pathname: '/(driver)/active',
                              params: { jobId: job.id },
                            }),
                        },
                        { text: 'Atcelt', style: 'cancel' },
                      ]);
                    } else {
                      router.push({
                        pathname: '/(driver)/active',
                        params: { jobId: job.id },
                      });
                    }
                  }}
                />
                {idx < jobs.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 14,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  summaryLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#f3f4f6' },

  listContent: { padding: 16 },
  listEmpty: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLeft: { flex: 1, gap: 5 },

  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeText: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDate: { fontSize: 12, color: '#6b7280' },
  metaSep: { fontSize: 11, color: '#d1d5db' },
  metaWeight: { fontSize: 12, color: '#374151', fontWeight: '500' },
  metaRate: { fontSize: 12, color: '#374151', fontWeight: '600' },

  badges: { flexDirection: 'row', gap: 6, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgePresent: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  badgeMissing: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextPresent: { color: '#16a34a' },
  badgeTextMissing: { color: '#9ca3af' },
});
