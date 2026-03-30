/**
 * (buyer)/project/[id].tsx
 *
 * Buyer: construction project detail.
 * Shows P&L stats, project info, and the list of linked orders.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiProjectDetail, type ProjectStatus, type ApiProjectOrder } from '@/lib/api';
import { formatDate, formatDateShort } from '@/lib/format';
import { Building2, MapPin, User, Calendar, ChevronRight, Plus } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatEur(v: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

// ─── Sub-components ───────────────────────────────────────────────────────

function StatusPillLocal({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PLANNING;
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.pillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statCardValue, { color: color ?? colors.textPrimary }]}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
}

function SpendBar({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const color = clamped > 90 ? '#ef4444' : clamped > 70 ? '#f59e0b' : '#22c55e';
  return (
    <View>
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>Budžeta izlietojums</Text>
        <Text style={styles.barLabel}>{Math.round(clamped)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${clamped}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function OrderRow({ order, onPress }: { order: ApiProjectOrder; onPress: () => void }) {
  const ORDER_STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Melnraksts',
    PENDING: 'Gaida',
    CONFIRMED: 'Apstiprināts',
    IN_PROGRESS: 'Izpildē',
    DELIVERED: 'Piegādāts',
    COMPLETED: 'Pabeigts',
    CANCELLED: 'Atcelts',
  };

  return (
    <TouchableOpacity style={styles.orderRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.orderLeft}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.orderMeta}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Text>
      </View>
      <View style={styles.orderRight}>
        <Text style={styles.orderTotal}>{formatEur(order.total)}</Text>
        {order.deliveryDate ? (
          <Text style={styles.orderMeta}>{formatDateShort(order.deliveryDate)}</Text>
        ) : null}
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<ApiProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!token || !id) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.projects.getOne(id, token);
        setProject(data);
      } catch {
        Alert.alert('Kļūda', 'Neizdevās ielādēt projektu');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id],
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

  if (loading || !project) {
    return (
      <ScreenContainer standalone bg="#f4f5f7">
        <ScreenHeader title="Projekts" />
        <SkeletonCard count={5} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer standalone bg="#f4f5f7">
      <ScreenHeader
        title="Projekts"
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/(buyer)/catalog' as any)}
            style={{ padding: 4 }}
            activeOpacity={0.7}
          >
            <Plus size={22} color="#111827" />
          </TouchableOpacity>
        }
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>{project.name}</Text>
            <StatusPillLocal status={project.status} />
          </View>
          {project.description ? (
            <Text style={styles.description}>{project.description}</Text>
          ) : null}
        </View>

        {/* P&L stat cards */}
        <View style={styles.statsGrid}>
          <StatCard label="Līguma vērtība" value={formatEur(project.contractValue)} />
          <StatCard label="Materiālu izm." value={formatEur(project.materialCosts)} />
          <StatCard
            label="Bruto peļņa"
            value={formatEur(project.grossMargin)}
            color={project.grossMargin >= 0 ? '#15803d' : '#ef4444'}
          />
          <StatCard label="Pasūtījumi" value={String(project.orderCount)} />
        </View>

        {/* Budget progress */}
        {project.budgetAmount ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budžets</Text>
            <View style={styles.sectionCard}>
              <View style={styles.budgetAmounts}>
                <Text style={styles.metaLabel}>Plānots: {formatEur(project.budgetAmount)}</Text>
                <Text style={styles.metaLabel}>
                  Izmantots: {formatEur(project.materialCosts + project.pendingCosts)}
                </Text>
              </View>
              <SpendBar pct={project.budgetUsedPct} />
            </View>
          </View>
        ) : null}

        {/* Project info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informācija</Text>
          <View style={styles.sectionCard}>
            {project.clientName ? (
              <View style={styles.infoRow}>
                <User size={14} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Klients</Text>
                <Text style={styles.infoValue}>{project.clientName}</Text>
              </View>
            ) : null}
            {project.siteAddress ? (
              <View style={styles.infoRow}>
                <MapPin size={14} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Atrašanās vieta</Text>
                <Text style={styles.infoValue}>{project.siteAddress}</Text>
              </View>
            ) : null}
            {project.startDate ? (
              <View style={styles.infoRow}>
                <Calendar size={14} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Sākums</Text>
                <Text style={styles.infoValue}>{formatDate(project.startDate)}</Text>
              </View>
            ) : null}
            {project.endDate ? (
              <View style={styles.infoRow}>
                <Calendar size={14} color={colors.textMuted} />
                <Text style={styles.infoLabel}>Beigas</Text>
                <Text style={styles.infoValue}>{formatDate(project.endDate)}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Building2 size={14} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Izveidots</Text>
              <Text style={styles.infoValue}>
                {project.createdBy.firstName} {project.createdBy.lastName}
              </Text>
            </View>
          </View>
        </View>

        {/* Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pasūtījumi ({project.orders.length})</Text>
          <View style={styles.sectionCard}>
            {project.orders.length === 0 ? (
              <Text style={styles.emptyOrders}>Nav piesaistītu pasūtījumu</Text>
            ) : (
              project.orders.map((order, idx) => (
                <React.Fragment key={order.id}>
                  {idx > 0 ? <View style={styles.divider} /> : null}
                  <OrderRow
                    order={order}
                    onPress={() => router.push(`/(buyer)/order/${order.id}` as any)}
                  />
                </React.Fragment>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  backBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backLabel: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  pageHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  description: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  statCardValue: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  statCardLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  budgetAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  metaLabel: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  barRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    width: 120,
  },
  infoValue: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderLeft: {
    flex: 1,
    gap: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  orderNumber: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  orderMeta: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  orderTotal: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyOrders: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
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
