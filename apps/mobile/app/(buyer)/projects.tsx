/**
 * (buyer)/projects.tsx
 *
 * Buyer: list of construction projects.
 * Each project aggregates multiple orders and tracks P&L vs. contract value.
 */

import React, { useCallback, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiProject, type ProjectStatus } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { Building2, Package, MapPin, Calendar, Plus } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { Text } from '@/components/ui/text';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';
import { haptics } from '@/lib/haptics';

// ─── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  PLANNING: { label: 'Plānošana', bg: '#f3f4f6', color: '#6b7280' },
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: '#15803d' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  ON_HOLD: { label: 'Apturēts', bg: '#fef2f2', color: '#b91c1c' },
};

// ─── Components ───────────────────────────────────────────────────────────

function SpendBar({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const color = clamped > 90 ? colors.danger : clamped > 70 ? colors.warning : colors.success;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clamped}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function ProjectCard({ project, onPress }: { project: ApiProject; onPress: () => void }) {
  const formatEur = (v: number) =>
    new Intl.NumberFormat('lv-LV', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>
          {project.name}
        </Text>
        <StatusPill
          label={STATUS_CONFIG[project.status]?.label ?? project.status}
          bg={STATUS_CONFIG[project.status]?.bg ?? '#f3f4f6'}
          color={STATUS_CONFIG[project.status]?.color ?? '#6b7280'}
          size="sm"
        />
      </View>

      {(project.clientName || project.siteAddress) && (
        <View style={styles.addressRow}>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[project.clientName, project.siteAddress].filter(Boolean).join(' • ')}
          </Text>
        </View>
      )}

      <View style={styles.metricsRow}>
        <View style={styles.metricGroup}>
          <Text style={styles.metricLabel}>Līgums</Text>
          <Text style={styles.metricValue}>{formatEur(project.contractValue)}</Text>
        </View>
        <View style={styles.metricGroup}>
          <Text style={styles.metricLabel}>Izmaksas</Text>
          <Text style={styles.metricValue}>{formatEur(project.materialCosts)}</Text>
        </View>
        <View style={styles.metricGroup}>
          <Text style={styles.metricLabel}>Peļņa</Text>
          <Text style={[styles.metricValue, { color: project.grossMargin >= 0 ? '#15803d' : '#ef4444' }]}>
            {project.marginPct !== null ? `${Math.round(project.marginPct)}%` : '—'}
          </Text>
        </View>
        <View style={[styles.metricGroup, { alignItems: 'flex-end', flex: 1 }]}>
          <Text style={styles.metricLabel}>Pasūtījumi</Text>
          <Text style={[styles.metricValue, { color: '#111827' }]}>{project.orderCount}</Text>
        </View>
      </View>

      {project.budgetUsedPct !== null ? (
        <View style={styles.budgetRow}>
          <SpendBar pct={project.budgetUsedPct} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function ProjectsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.projects.getAll(token);
        setProjects(data);
      } catch {
        // silently ignore — list stays empty
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff">
        <ScreenHeader title="Projekti" />
        <SkeletonCard count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff">
      <ScreenHeader
        title="Projekti"
        rightAction={
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              router.push('/(buyer)/project/new' as any);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <Plus size={22} color="#111827" />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => {
              haptics.light();
              router.push(`/(buyer)/project/${item.id}` as any);
            }}
          />
        )}
        contentContainerStyle={projects.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#111827" />}
        ListEmptyComponent={
          <EmptyState
            icon={<Building2 size={40} color={colors.textMuted} />}
            title="Nav projektu"
            subtitle="Jūsu projekti parādīsies šeit"
            action={
              <TouchableOpacity
                onPress={() => router.push('/(buyer)/project/new' as any)}
                style={styles.createBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.createBtnText}>Jauns projekts</Text>
              </TouchableOpacity>
            }
          />
        }
      />
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: 0,
    paddingBottom: 100,
    gap: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  createBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#000000',
    borderRadius: 999,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  card: {
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 2,
  },
  cardName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    flex: 1,
    letterSpacing: -0.5,
  },
  addressRow: {
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 24,
  },
  metricGroup: {
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.4,
  },
  budgetRow: {
    marginTop: 16,
  },
  barTrack: {
    height: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});
