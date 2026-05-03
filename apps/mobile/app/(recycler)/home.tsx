import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerIncomingJobs, getRecyclerWasteRecords, getMyRecyclingCenters } from '@/lib/api';
import type { IncomingJob, WasteRecord, RecyclerCenter } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { Inbox, FileText, Recycle, ChevronRight } from 'lucide-react-native';

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <View style={ls.statCard}>
      <View style={ls.statIcon}>{icon}</View>
      <Text style={ls.statValue}>{value}</Text>
      <Text style={ls.statLabel}>{label}</Text>
    </View>
  );
}

export default function RecyclerHomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { setConfig } = useHeaderConfig();
  const [centers, setCenters] = useState<RecyclerCenter[]>([]);
  const [incomingJobs, setIncomingJobs] = useState<IncomingJob[]>([]);
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [c, j, r] = await Promise.all([
        getMyRecyclingCenters(token),
        getRecyclerIncomingJobs(token),
        getRecyclerWasteRecords(token),
      ]);
      setCenters(c);
      setIncomingJobs(j);
      setRecords(r);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Reciklēšana' });
      load();
      return () => setConfig(null);
    }, [load, setConfig]),
  );

  const pending = incomingJobs.filter(
    (j) => j.status === 'AVAILABLE' || j.status === 'ASSIGNED',
  ).length;

  const todayRecords = records.filter((r) => {
    const d = new Date(r.createdAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  const totalWeightToday = todayRecords.reduce((s, r) => s + (r.weightKg ?? 0), 0);

  if (loading) {
    return (
      <ScreenContainer>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
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
        {/* greeting */}
        <Text style={ls.greeting}>Sveiki, {user?.firstName ?? 'Operators'}!</Text>
        <Text style={ls.sub}>
          {centers.length > 0
            ? centers.map((c) => c.name).join(', ')
            : 'Atkritumu savākšanas punkts'}
        </Text>

        {/* stats row */}
        <View style={ls.statsRow}>
          <StatCard
            label="Gaidošie"
            value={pending}
            icon={<Inbox size={20} color={colors.primary} />}
          />
          <StatCard
            label="Šodien, kg"
            value={
              totalWeightToday >= 1000
                ? `${(totalWeightToday / 1000).toFixed(1)}t`
                : `${totalWeightToday.toFixed(0)}`
            }
            icon={<Recycle size={20} color={colors.primary} />}
          />
          <StatCard
            label="Ieraksti"
            value={records.length}
            icon={<FileText size={20} color={colors.primary} />}
          />
        </View>

        {/* recent incoming jobs */}
        <Text style={ls.sectionTitle}>Ienākošie transports</Text>
        {incomingJobs.length === 0 ? (
          <View style={ls.emptyBox}>
            <Text style={ls.emptyText}>Nav aktīvu piegāžu</Text>
          </View>
        ) : (
          incomingJobs.slice(0, 5).map((job) => (
            <TouchableOpacity
              key={job.id}
              style={ls.jobCard}
              activeOpacity={0.85}
              onPress={() => {
                haptics.light();
                router.push('/(recycler)/incoming');
              }}
            >
              <View style={ls.jobCardLeft}>
                <Text style={ls.jobId}>#{job.id.slice(-6).toUpperCase()}</Text>
                <Text style={ls.jobMeta}>
                  {job.requester
                    ? `${job.requester.firstName} ${job.requester.lastName}`
                    : 'Pasūtītājs'}
                </Text>
              </View>
              <View style={ls.jobCardRight}>
                <View
                  style={[
                    ls.statusBadge,
                    {
                      backgroundColor:
                        job.status === 'DELIVERED'
                          ? '#dcfce7'
                          : job.status === 'IN_PROGRESS'
                            ? '#dbeafe'
                            : '#fef3c7',
                    },
                  ]}
                >
                  <Text
                    style={[
                      ls.statusText,
                      {
                        color:
                          job.status === 'DELIVERED'
                            ? '#166534'
                            : job.status === 'IN_PROGRESS'
                              ? '#1d4ed8'
                              : '#92400e',
                      },
                    ]}
                  >
                    {job.status}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sub: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIcon: { marginBottom: 6 },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: colors.textMuted },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobCardLeft: { gap: 2 },
  jobCardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jobId: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  jobMeta: { fontSize: 12, color: colors.textMuted },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
});
