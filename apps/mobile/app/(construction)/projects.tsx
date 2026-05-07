import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { getConstructionProjects } from '@/lib/api';
import type { ConstructionProject } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHeaderConfig } from '@/lib/header-context';
import { haptics } from '@/lib/haptics';
import { FolderKanban, ChevronRight, ExternalLink } from 'lucide-react-native';

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Plānošana',
  ACTIVE: 'Aktīvs',
  ON_HOLD: 'Pauze',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const STATUS_COLOR: Record<string, string> = {
  PLANNING: '#6366f1',
  ACTIVE: '#16a34a',
  ON_HOLD: '#d97706',
  COMPLETED: '#64748b',
  CANCELLED: '#ef4444',
};

const FILTERS = [
  { key: undefined, label: 'Visi' },
  { key: 'ACTIVE', label: 'Aktīvie' },
  { key: 'PLANNING', label: 'Plānošana' },
  { key: 'COMPLETED', label: 'Pabeigti' },
] as const;

export default function ConstructionProjectsScreen() {
  const { token } = useAuth();
  const { setConfig } = useHeaderConfig();
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (status?: string) => {
      if (!token) return;
      try {
        const res = await getConstructionProjects(token, { status, limit: 50 });
        setProjects(res.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      setConfig({ title: 'Projekti' });
      load(filter);
      return () => setConfig(null);
    }, [load, setConfig, filter]),
  );

  const handleFilterChange = (key: string | undefined) => {
    haptics.light();
    setFilter(key);
    setLoading(true);
    load(key);
  };

  return (
    <ScreenContainer>
      {/* Filter pills */}
      <View style={ls.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={String(f.key)}
            style={[ls.filterPill, filter === f.key && ls.filterPillActive]}
            onPress={() => handleFilterChange(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[ls.filterText, filter === f.key && ls.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={ls.skeletons}>
          {[1, 2, 3].map((k) => (
            <SkeletonCard key={k} style={{ height: 80, marginBottom: 10 }} />
          ))}
        </View>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Nav projektu" subtitle="Projekti parādīsies šeit" />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={ls.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(filter);
              }}
            />
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={ls.card}
              activeOpacity={0.8}
              onPress={() => {
                haptics.light();
                Linking.openURL(`https://b3hub.lv/dashboard/construction/projects/${p.id}`).catch(
                  () => null,
                );
              }}
            >
              <View style={ls.cardLeft}>
                <View
                  style={[ls.statusBar, { backgroundColor: STATUS_COLOR[p.status] ?? '#64748b' }]}
                />
              </View>
              <View style={ls.cardBody}>
                <Text style={ls.cardName} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.clientName ? (
                  <Text style={ls.cardClient} numberOfLines={1}>
                    {p.clientName}
                  </Text>
                ) : null}
                {p.siteAddress ? (
                  <Text style={ls.cardAddress} numberOfLines={1}>
                    {p.siteAddress}
                  </Text>
                ) : null}
                <View style={ls.cardFooter}>
                  <Text style={[ls.cardStatus, { color: STATUS_COLOR[p.status] ?? '#64748b' }]}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Text>
                  {p.contractValue > 0 && (
                    <Text style={ls.cardValue}>€{p.contractValue.toLocaleString('lv-LV')}</Text>
                  )}
                </View>
              </View>
              <View style={ls.cardRight}>
                <ExternalLink size={14} color="#9ca3af" strokeWidth={2} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#475569' },
  filterTextActive: { color: '#fff' },
  skeletons: { padding: 16 },
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
  cardLeft: { width: 6 },
  statusBar: { flex: 1 },
  cardBody: { flex: 1, padding: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardClient: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardAddress: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardStatus: { fontSize: 11, fontWeight: '600' },
  cardValue: { fontSize: 12, fontWeight: '700', color: '#111827' },
  cardRight: { padding: 12, justifyContent: 'center' },
});
