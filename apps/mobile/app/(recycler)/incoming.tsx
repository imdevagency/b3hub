import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerIncomingJobs } from '@/lib/api';
import type { IncomingJob } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHeaderConfig } from '@/lib/header-context';
import { colors } from '@/lib/theme';
import { getRecyclerJobStatus } from '@/lib/status';
import { Truck, Calendar } from 'lucide-react-native';

function JobCard({ job }: { job: IncomingJob }) {
  const statusMeta = getRecyclerJobStatus(job.status);
  const pickupDate = job.scheduledPickupAt
    ? new Date(job.scheduledPickupAt).toLocaleDateString('lv-LV', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <TouchableOpacity style={ls.card} activeOpacity={0.85}>
      <View style={ls.cardTop}>
        <Text style={ls.cardId}>#{job.id.slice(-6).toUpperCase()}</Text>
        <View style={[ls.badge, { backgroundColor: statusMeta.bg }]}>
          <Text style={[ls.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
      </View>

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
            {job.vehicle.plateNumber} · {job.vehicle.type}
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
  const [jobs, setJobs] = useState<IncomingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          icon="inbox"
          title="Nav ienākošo piegāžu"
          description="Šeit parādīsies transporta darbi, kas ved atkritumus uz jūsu centru"
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
          <JobCard key={j.id} job={j} />
        ))}
      </ScrollView>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  notes: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
