/**
 * (buyer)/analytics.tsx
 *
 * Buyer analytics overview — monthly spend, order breakdown, material breakdown, CO2 footprint.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useScreenLoad } from '@/lib/use-screen-load';
import { api, type AnalyticsOverview, type BuyerAnalytics } from '@/lib/api';
import { BarChart2, Leaf, Package, TrendingUp, AlertTriangle, Download } from 'lucide-react-native';
import type { ArAging } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { colors, spacing, radius, fontSizes } from '@/lib/tokens';
import { API_URL } from '@/lib/api/common';

// Guard: expo-file-system / expo-sharing — available in dev builds and Expo Go
let FileSystem: typeof import('expo-file-system') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  FileSystem = require('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  Sharing = require('expo-sharing');
} catch {
  /* fallback — download unavailable */
}

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
  const [downloading, setDownloading] = useState(false);

  const fetcher = useCallback(async () => {
    if (!token) return;
    const data = await api.analytics.overview(token);
    setOverview(data);
  }, [token]);

  const { loading, refreshing, error, onRefresh } = useScreenLoad(fetcher);

  const handleDownloadPdf = async () => {
    if (!token || !FileSystem || !Sharing) {
      return;
    }
    setDownloading(true);
    try {
      const url = `${API_URL}/analytics/export-pdf`;
      const fileUri = `${(FileSystem as any).documentDirectory ?? ''}analytics-report.pdf`;
      const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (downloadRes.status !== 200) throw new Error('Neizdevās lejupielādēt atskaiti');
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(downloadRes.uri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
        });
      } else {
        await Sharing.shareAsync(downloadRes.uri);
      }
    } catch {
      // silent — sharing dialog handles user feedback
    } finally {
      setDownloading(false);
    }
  };

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
      <ScreenHeader
        title="Analītika"
        rightAction={
          <TouchableOpacity
            onPress={handleDownloadPdf}
            style={{ padding: 4 }}
            activeOpacity={0.7}
            disabled={downloading}
          >
            <Download size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

        {/* AR Aging — outstanding invoices */}
        {buyer?.arAging &&
          (() => {
            const ag = buyer.arAging as ArAging;
            const overdueTotal =
              ag.days30.total + ag.days60.total + ag.days90.total + ag.over90.total;
            const overdueCount =
              ag.days30.count + ag.days60.count + ag.days90.count + ag.over90.count;
            if (overdueTotal <= 0) return null;
            const rows: {
              label: string;
              bucket: { count: number; total: number };
              accent: string;
            }[] = [
              { label: '1–30 dienas', bucket: ag.days30, accent: '#d97706' },
              { label: '31–60 dienas', bucket: ag.days60, accent: '#ea580c' },
              { label: '61–90 dienas', bucket: ag.days90, accent: '#dc2626' },
              { label: '90+ dienas', bucket: ag.over90, accent: '#991b1b' },
            ].filter((r) => r.bucket.count > 0);
            return (
              <SectionCard title="Kavētie rēķini">
                <View style={styles.agingHeader}>
                  <AlertTriangle size={18} color="#dc2626" />
                  <Text style={styles.agingTotal}>
                    {overdueCount} rēķins · {fmtEur(overdueTotal)} kavēts
                  </Text>
                </View>
                {rows.map((r) => (
                  <View key={r.label} style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: r.accent }]}>{r.label}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max((r.bucket.total / overdueTotal) * 100, 2)}%` as any,
                            backgroundColor: r.accent,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.breakdownValue, { color: r.accent }]}>
                      {fmtEur(r.bucket.total)}
                    </Text>
                  </View>
                ))}
              </SectionCard>
            );
          })()}

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
    color: colors.textPrimary,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bgMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  breakdownValue: {
    width: 36,
    fontSize: 13,
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  materialRight: {
    alignItems: 'flex-end',
  },
  materialAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
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
    color: colors.dangerText,
  },
  agingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  agingTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  breakdownValueWide: {
    width: 70,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
});
