/**
 * schedules.tsx — Buyer: recurring order schedule management
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { type ApiOrderSchedule } from '@/lib/api/orders';
import { haptics } from '@/lib/haptics';
import { Calendar } from 'lucide-react-native';
import { format } from 'date-fns';
import { lv } from 'date-fns/locale';
import { colors } from '@/lib/theme';

const INTERVAL_LABELS: Record<number, string> = {
  1: 'Katru dienu',
  7: 'Katru nedēļu',
  14: 'Katru 2 nedēļas',
  30: 'Katru mēnesi',
};

function ScheduleRow({
  schedule,
  onPause,
  onResume,
}: {
  schedule: ApiOrderSchedule;
  onPause: () => void;
  onResume: () => void;
}) {
  const intervalLabel =
    INTERVAL_LABELS[schedule.intervalDays] ?? `Ik ${schedule.intervalDays} dienas`;
  const nextDate = schedule.nextRunAt
    ? format(new Date(schedule.nextRunAt), 'd. MMM yyyy', { locale: lv })
    : '—';

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {schedule.deliveryCity || schedule.deliveryAddress}
        </Text>
        <StatusPill
          label={schedule.enabled ? 'Aktīvs' : 'Pauzēts'}
          bg={schedule.enabled ? '#dcfce7' : '#f3f4f6'}
          color={schedule.enabled ? '#166534' : '#6b7280'}
          size="sm"
        />
      </View>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <Calendar size={12} color="#9ca3af" />
          <Text style={s.metaText}>{intervalLabel}</Text>
        </View>
        <Text style={s.sep}>·</Text>
        <Text style={s.metaText}>Nākamais: {nextDate}</Text>
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={schedule.enabled ? onPause : onResume}
          style={s.actionBtn}
        >
          <Text style={s.actionBtnText}>{schedule.enabled ? 'Pauzēt' : 'Atsākt'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SchedulesScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  React.useEffect(() => {
    if (user && !user.isCompany) router.replace('/(buyer)/profile');
  }, [user, router]);
  if (user && !user.isCompany) return null;
  const [schedules, setSchedules] = useState<ApiOrderSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const data = await api.schedules.list(token);
        setSchedules(data);
      } catch {
        // silent fail
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

  const handlePause = async (id: string) => {
    if (!token) return;
    haptics.light();
    await api.schedules.pause(id, token);
    await load(true);
  };

  const handleResume = async (id: string) => {
    if (!token) return;
    haptics.light();
    await api.schedules.resume(id, token);
    await load(true);
  };

  return (
    <ScreenContainer bg="#f9fafb">
      <ScreenHeader title="Atkārtoti pasūtījumi" />

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={110} radius={14} />
          <Skeleton height={110} radius={14} />
          <Skeleton height={110} radius={14} />
        </View>
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={<Calendar size={36} color="#d1d5db" />}
          title="Nav atkārtotu pasūtījumu"
          subtitle="Atkārtoti pasūtījumi tiek iestatīti pasūtījuma izveidē"
        />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor="#166534"
            />
          }
        >
          {schedules.map((sched) => (
            <ScheduleRow
              key={sched.id}
              schedule={sched}
              onPause={() => handlePause(sched.id)}
              onResume={() => handleResume(sched.id)}
            />
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted },
  sep: { fontSize: 12, color: '#d1d5db' },

  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
