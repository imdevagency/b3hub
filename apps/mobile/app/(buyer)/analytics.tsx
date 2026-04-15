/**
 * (buyer)/analytics.tsx
 *
 * Buyer analytics overview — monthly spend, order breakdown, material breakdown, CO2 footprint.
 */

import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { api, type AnalyticsOverview, type BuyerAnalytics } from '@/lib/api';
import { BarChart2, Leaf, Package, TrendingUp } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

const CATEGORY_LABELS: Record<string, string> = {
  GRAVEL: 'Grants',
  SAND: 'Smiltis',
  STONE: 'Akmens',
  CONCRETE: 'Betons',
  SOIL: 'Grunts',
  RECYCLED_CONCRETE: 'Rec. betons',
  RECYCLED_SOIL: 'Rec. grunts',
  ASPHALT: 'Asfalts',
  OTHER: 'Citi',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprin.',
  IN_PROGRESS: 'Izpildē',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

// ─── Subcomponents ────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Icon size={20} color={accent ?? colors.primary} />
      <Text style={[styles.statValue, { color: accent ?? colors.textPrimary }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.analytics.overview(token);
        setOverview(data);
        setError(null);
      } catch {
        setError('Neizdevās ielādēt analītikas datus');
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

  const buyer: BuyerAnalytics | null = overview?.buyer ?? null;

  const totalSpend = buyer?.monthlySpend?.reduce((s, m) => s + m.value, 0) ?? 0;
  const completedOrders = buyer?.orderBreakdown?.find((b) => b.status === 'COMPLETED')?.count ?? 0;
  const activeOrders =
    (buyer?.orderBreakdown?.find((b) => b.status === 'IN_PROGRESS')?.count ?? 0) +
    (buyer?.orderBreakdown?.find((b) => b.status === 'CONFIRMED')?.count ?? 0);

  if (loading || !overview) {
    return (
      <ScreenContainer bg="#f4f5f7">
        <ScreenHeader title="Analītika" />
        <SkeletonCard count={4} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f4f5f7">
      <ScreenHeader title="Analītika" />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Key stats */}
        <View style={styles.statsRow}>
          <StatTile icon={TrendingUp} label="Kopā iztērēts" value={fmtEur(totalSpend)} />
          <StatTile icon={Package} label="Pabeigti" value={String(completedOrders)} />
          <StatTile icon={BarChart2} label="Aktīvi" value={String(activeOrders)} />
          <StatTile
            icon={Leaf}
            label="CO₂ (kg)"
            value={buyer?.co2Kg != null ? String(Math.round(buyer.co2Kg)) : '—'}
            accent="#16a34a"
          />
        </View>

        {/* Order breakdown */}
        {buyer && buyer.orderBreakdown.length > 0 && (
          <SectionCard title="Pasūtījumu statusi">
            {buyer.orderBreakdown.map((row) => {
              const maxCount = Math.max(...buyer.orderBreakdown.map((r) => r.count), 1);
              const pct = row.count / maxCount;
              return (
                <View key={row.status} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${Math.max(pct * 100, 2)}%` as any }]}
                    />
                  </View>
                  <Text style={styles.breakdownValue}>{row.count}</Text>
                </View>
              );
            })}
          </SectionCard>
        )}

        {/* Material breakdown */}
        {buyer && buyer.materialBreakdown.length > 0 && (
          <SectionCard title="Izdevumi pēc kategorijas">
            {buyer.materialBreakdown.slice(0, 6).map((m) => (
              <View key={m.category} style={styles.materialRow}>
                <Text style={styles.materialLabel}>
                  {CATEGORY_LABELS[m.category] ?? m.category}
                </Text>
                <View style={styles.materialRight}>
                  <Text style={styles.materialAmount}>{fmtEur(m.totalSpent)}</Text>
                  <Text style={styles.materialMeta}>{m.orderCount} pas.</Text>
                </View>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Monthly spend sparkline (text-only) */}
        {buyer && buyer.monthlySpend.length > 0 && (
          <SectionCard title="Ikmēneša izdevumi">
            {buyer.monthlySpend.slice(-6).map((m) => {
              const maxVal = Math.max(...buyer.monthlySpend.map((x) => x.value), 1);
              const pct = m.value / maxVal;
              const [y, mo] = m.month.split('-');
              return (
                <View key={m.month} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {mo}/{y?.slice(2)}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(pct * 100, 2)}%` as any, backgroundColor: '#3b82f6' },
                      ]}
                    />
                  </View>
                  <Text style={styles.breakdownValue}>{fmtEur(m.value)}</Text>
                </View>
              );
            })}
          </SectionCard>
        )}

        {/* Seller analytics (if user is also a seller) */}
        {overview.seller && (
          <SectionCard title="Pārdevēja rādītāji">
            <View style={styles.sellerStats}>
              <View style={styles.sellerStat}>
                <Text style={styles.sellerStatValue}>
                  {fmtPct(overview.seller.performanceStats.completionRate)}
                </Text>
                <Text style={styles.sellerStatLabel}>Izpildes rādītājs</Text>
              </View>
              <View style={styles.sellerStat}>
                <Text style={styles.sellerStatValue}>
                  {overview.seller.performanceStats.avgRating.toFixed(1)}
                </Text>
                <Text style={styles.sellerStatLabel}>Vidējais vērtējums</Text>
              </View>
              <View style={styles.sellerStat}>
                <Text style={styles.sellerStatValue}>
                  {overview.seller.performanceStats.totalOrders}
                </Text>
                <Text style={styles.sellerStatLabel}>Kopā pasūtījumi</Text>
              </View>
            </View>
          </SectionCard>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.base,
    gap: 12,
    paddingTop: spacing.base,
    marginBottom: spacing.lg,
  },
  statTile: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: spacing.base,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    padding: spacing.base,
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLabel: {
    width: 74,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#111827',
    borderRadius: 3,
  },
  breakdownValue: {
    width: 36,
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'right',
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  materialLabel: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  materialRight: {
    alignItems: 'flex-end',
  },
  materialAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  materialMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sellerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  sellerStat: {
    alignItems: 'center',
    gap: 4,
  },
  sellerStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sellerStatLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  errorBox: {
    margin: spacing.base,
    backgroundColor: '#fef2f2',
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
  },
});
