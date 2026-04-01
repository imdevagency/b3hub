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
import { Text } from '@/components/ui/text';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';

// ─── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  PLANNING: { label: 'Plānošana', bg: '#f3f4f6', color: '#6b7280' },
  ACTIVE: { label: 'Aktīvs', bg: '#dcfce7', color: '#15803d' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0f9ff', color: '#0369a1' },
  ON_HOLD: { label: 'Apturēts', bg: '#fef2f2', color: '#b91c1c' },
};

// ─── Components ───────────────────────────────────────────────────────────

function StatusPillLocal({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PLANNING;
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function SpendBar({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const color = clamped > 90 ? '#ef4444' : clamped > 70 ? '#f59e0b' : '#22c55e';
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
        <View style={styles.cardTitle}>
          <Building2 size={16} color={colors.primary} />
          <Text style={styles.cardName} numberOfLines={1}>
            {project.name}
          </Text>
        </View>
        <StatusPillLocal status={project.status} />
      </View>

      {project.clientName ? (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {project.clientName}
        </Text>
      ) : null}

      {project.siteAddress ? (
        <View style={styles.row}>
          <MapPin size={12} color={colors.textMuted} />
          <Text style={styles.cardMeta} numberOfLines={1}>
            {'  '}
            {project.siteAddress}
          </Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Līgums</Text>
          <Text style={styles.statValue}>{formatEur(project.contractValue)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Izmaksas</Text>
          <Text style={styles.statValue}>{formatEur(project.materialCosts)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Peļņa</Text>
          <Text
            style={[styles.statValue, { color: project.grossMargin >= 0 ? '#15803d' : '#ef4444' }]}
          >
            {project.marginPct !== null ? `${Math.round(project.marginPct)}%` : '—'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Package size={12} color={colors.textMuted} />
          <Text style={styles.statLabel}> {project.orderCount} pasūt.</Text>
        </View>
      </View>

      {project.budgetUsedPct !== null ? (
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Budžets: {Math.round(project.budgetUsedPct)}%</Text>
          <SpendBar pct={project.budgetUsedPct} />
        </View>
      ) : null}

      {project.startDate || project.endDate ? (
        <View style={styles.row}>
          <Calendar size={12} color={colors.textMuted} />
          <Text style={styles.dateText}>
            {'  '}
            {project.startDate ? formatDateShort(project.startDate) : '—'}
            {project.endDate ? ` → ${formatDateShort(project.endDate)}` : ''}
          </Text>
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
      <ScreenContainer standalone bg="#ffffff">
        <ScreenHeader title="Projekti" />
        <SkeletonCard count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer standalone bg="#ffffff">
      <ScreenHeader
        title="Projekti"
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/(buyer)/project/new' as any)}
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
            onPress={() => router.push(`/(buyer)/project/${item.id}` as any)}
          />
        )}
        contentContainerStyle={projects.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  createBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#111827',
    borderRadius: radius.md,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: fontSizes.sm,
    fontWeight: '600' as const,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  cardName: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  cardMeta: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  budgetRow: {
    marginTop: spacing.xs,
    gap: 4,
  },
  budgetLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  barTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  dateText: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pillText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
});
