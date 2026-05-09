import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerIncomingJobs, cancelIncomingJob } from '@/lib/api';
import type { IncomingJob } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useHeaderConfig } from '@/lib/header-context';
import { colors } from '@/lib/theme';
import { getRecyclerJobStatus } from '@/lib/status';
import {
  Truck,
  Calendar,
  MapPin,
  FileText,
  XCircle,
  Scale,
  Phone,
  Package,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function JobCard({ job, onPress }: { job: IncomingJob; onPress: () => void }) {
  const statusMeta = getRecyclerJobStatus(job.status);
  const pickupDate = job.pickupDate
    ? new Date(job.pickupDate).toLocaleDateString('lv-LV', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <TouchableOpacity style={ls.card} activeOpacity={0.85} onPress={onPress}>
      <View style={ls.cardTop}>
        <Text style={ls.cardId}>#{job.id.slice(-6).toUpperCase()}</Text>
        <View style={[ls.badge, { backgroundColor: statusMeta.bg }]}>
          <Text style={[ls.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
      </View>

      {job.cargoType && (
        <View style={ls.row}>
          <Package size={14} color={colors.textMuted} />
          <Text style={ls.rowText}>
            {job.cargoType}
            {job.cargoWeight ? ` · ${job.cargoWeight} t` : ''}
          </Text>
        </View>
      )}
      {job.requester && (
        <View style={ls.row}>
          <Truck size={14} color={colors.textMuted} />
          <Text style={ls.rowText}>
            {job.requester.firstName} {job.requester.lastName}
            {job.requester.phone ? ` · ${job.requester.phone}` : ''}
          </Text>
        </View>
      )}
      {pickupDate && (
        <View style={ls.row}>
          <Calendar size={14} color={colors.textMuted} />
          <Text style={ls.rowText}>{pickupDate}</Text>
        </View>
      )}
      {job.vehicle && (
        <View style={ls.row}>
          <Truck size={14} color={colors.textMuted} />
          <Text style={ls.rowText}>
            {job.vehicle.licensePlate} · {job.vehicle.vehicleType}
          </Text>
        </View>
      )}
      {job.notes && (
        <Text style={ls.notes} numberOfLines={2}>
          {job.notes}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function RecyclerIncomingScreen() {
  const { token } = useAuth();
  const { setConfig } = useHeaderConfig();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<IncomingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<IncomingJob | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const CANCELLABLE = ['AVAILABLE', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE_PICKUP'];

  async function handleCancel(job: IncomingJob) {
    if (!token || !job.recyclingCenter?.id) return;
    Alert.alert(
      'Atcelt piegādi',
      'Vai tiešām vēlaties atcelt šo atkritumu piegādi? Klients tiks informēts.',
      [
        { text: 'Nē', style: 'cancel' },
        {
          text: 'Jā, atcelt',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelIncomingJob(token, job.recyclingCenter!.id, job.id);
              setJobs((prev) => prev.filter((j) => j.id !== job.id));
              setSelectedJob(null);
            } catch {
              Alert.alert('Kļūda', 'Neizdevās atcelt piegādi. Mēģiniet vēlreiz.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getRecyclerIncomingJobs(token);
      setJobs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Ienākošie' });
      load();
      return () => setConfig(null);
    }, [load, setConfig]),
  );

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScreenContainer>
    );
  }

  if (jobs.length === 0) {
    return (
      <ScreenContainer>
        <EmptyState
          icon={<Truck size={32} color="#9ca3af" />}
          title="Nav ienākošo piegāžu"
          subtitle="Šeit parādīsīsies transporta darbi, kas ved atkritumu uz jūsu centru"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={ls.scroll}
      >
        <Text style={ls.count}>{jobs.length} piegādes</Text>
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} onPress={() => setSelectedJob(j)} />
        ))}
      </ScrollView>

      {/* Job detail sheet */}
      <BottomSheet visible={selectedJob !== null} onClose={() => setSelectedJob(null)} scrollable>
        {selectedJob &&
          (() => {
            const meta = getRecyclerJobStatus(selectedJob.status);
            const pickupDate = selectedJob.pickupDate
              ? new Date(selectedJob.pickupDate).toLocaleDateString('lv-LV', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null;
            return (
              <View style={{ paddingBottom: insets.bottom + 16 }}>
                <View style={ls.sheetHeader}>
                  <Text style={ls.sheetId}>#{selectedJob.id.slice(-6).toUpperCase()}</Text>
                  <View style={[ls.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[ls.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {selectedJob.requester && (
                  <View style={ls.row}>
                    <Truck size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>
                      {selectedJob.requester.firstName} {selectedJob.requester.lastName}
                      {selectedJob.requester.phone ? ` · ${selectedJob.requester.phone}` : ''}
                    </Text>
                  </View>
                )}
                {selectedJob.cargoType && (
                  <View style={ls.row}>
                    <Package size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>
                      {selectedJob.cargoType}
                      {selectedJob.cargoWeight ? ` · ~${selectedJob.cargoWeight} t` : ''}
                    </Text>
                  </View>
                )}
                {selectedJob.bisNumber && (
                  <View style={ls.row}>
                    <FileText size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>BIS: {selectedJob.bisNumber}</Text>
                  </View>
                )}
                {(selectedJob.siteContactName || selectedJob.siteContactPhone) && (
                  <View style={ls.row}>
                    <Phone size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>
                      {[selectedJob.siteContactName, selectedJob.siteContactPhone]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                )}
                {selectedJob.loadingBy && (
                  <View style={ls.row}>
                    <Scale size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>
                      {selectedJob.loadingBy === 'BUYER_CREW'
                        ? 'Klients krauj pats'
                        : selectedJob.loadingBy === 'DRIVER_HANDS'
                          ? 'Kraušana ar rokām (vadītājs)'
                          : selectedJob.loadingBy === 'NEEDS_MACHINERY'
                            ? 'Nepieciešama tehnika'
                            : selectedJob.loadingBy}
                      {selectedJob.wasteReadiness === 'PILED'
                        ? ' · Sablietēts'
                        : selectedJob.wasteReadiness === 'NEEDS_PREP'
                          ? ' · Nepieciešama sagatavošana'
                          : ''}
                    </Text>
                  </View>
                )}
                {pickupDate && (
                  <View style={ls.row}>
                    <Calendar size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>{pickupDate}</Text>
                  </View>
                )}
                {selectedJob.vehicle && (
                  <View style={ls.row}>
                    <Truck size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>
                      {selectedJob.vehicle.licensePlate} · {selectedJob.vehicle.vehicleType}
                    </Text>
                  </View>
                )}
                {selectedJob.pickupAddress && (
                  <View style={ls.row}>
                    <MapPin size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>{selectedJob.pickupAddress}</Text>
                  </View>
                )}
                {selectedJob.notes && (
                  <View style={ls.row}>
                    <FileText size={14} color={colors.textMuted} />
                    <Text style={ls.rowText}>{selectedJob.notes}</Text>
                  </View>
                )}
                {CANCELLABLE.includes(selectedJob.status) && (
                  <TouchableOpacity
                    style={ls.cancelBtn}
                    activeOpacity={0.8}
                    onPress={() => handleCancel(selectedJob)}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <XCircle size={15} color="#dc2626" />
                    )}
                    <Text style={ls.cancelBtnText}>
                      {cancelling ? 'Atceļ...' : 'Atcelt piegādi'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
      </BottomSheet>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  count: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardId: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rowText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  notes: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // Detail sheet
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sheetId: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#dc2626' },
});
