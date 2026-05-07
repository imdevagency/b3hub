import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getConstructionDailyReports } from '@/lib/api';
import type { DailyReport } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { FileText, Plus } from 'lucide-react-native';
import { colors } from '@/lib/theme';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Melnraksts',
  SUBMITTED: 'Iesniegts',
  APPROVED: 'Apstiprināts',
  REJECTED: 'Noraidīts',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#6b7280',
  SUBMITTED: '#2563eb',
  APPROVED: '#16a34a',
  REJECTED: '#ef4444',
};

export default function DailyReportsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { setConfig } = useHeaderConfig();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getConstructionDailyReports(token, { limit: 50 });
      setReports(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Dienas atskaites' });
      load();
      return () => setConfig(null);
    }, [load, setConfig]),
  );

  return (
    <ScreenContainer>
      {/* New report button */}
      <View style={ls.topBar}>
        <Text style={ls.topTitle}>Dienas atskaites</Text>
        <TouchableOpacity
          style={ls.newBtn}
          activeOpacity={0.8}
          onPress={() => {
            haptics.light();
            router.push('/(construction)/daily-report-new');
          }}
        >
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text style={ls.newBtnText}>Jauna</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map((k) => (
            <SkeletonCard key={k} style={{ height: 72, marginBottom: 10 }} />
          ))}
        </View>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nav atskaišu"
          subtitle="Pievienojiet pirmo dienas atskaiti"
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={ls.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item: r }) => (
            <View style={ls.card}>
              <View style={ls.cardLeft}>
                <Text style={ls.cardDate}>
                  {new Date(r.reportDate).toLocaleDateString('lv-LV', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </Text>
                <Text style={ls.cardYear}>{new Date(r.reportDate).getFullYear()}</Text>
              </View>
              <View style={ls.cardBody}>
                <Text style={ls.cardProject} numberOfLines={1}>
                  {r.project?.name ?? '—'}
                </Text>
                {r.siteLabel ? (
                  <Text style={ls.cardSite} numberOfLines={1}>
                    {r.siteLabel}
                  </Text>
                ) : null}
                <View style={ls.cardFooter}>
                  <View style={[ls.statusPill, { backgroundColor: STATUS_COLOR[r.status] + '20' }]}>
                    <Text style={[ls.statusText, { color: STATUS_COLOR[r.status] }]}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Text>
                  </View>
                  <Text style={ls.cardCost}>€{r.totalCost.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardLeft: {
    width: 60,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  cardDate: { fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'center' },
  cardYear: { fontSize: 10, color: '#9ca3af', textAlign: 'center' },
  cardBody: { flex: 1, padding: 12 },
  cardProject: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardSite: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardCost: { fontSize: 13, fontWeight: '700', color: '#111827' },
});
