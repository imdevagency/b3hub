/**
 * (buyer)/analytics.tsx
 *
 * Mobile analytics: at-a-glance stats only.
 * Full BI (charts, AR aging, supplier leaderboard, CSV export) lives at
 * https://b3hub.lv/dashboard/analytics — a back-office task done at a desk.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useScreenLoad } from '@/lib/use-screen-load';
import { api, type AnalyticsOverview } from '@/lib/api';
import { BarChart2, Leaf, Package, TrendingUp, ExternalLink } from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/text';
import { colors, spacing, radius } from '@/lib/tokens';

const WEB_ANALYTICS_URL = 'https://b3hub.lv/dashboard/analytics';

function fmtEur(v: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <View style={s.tile}>
      <Icon size={22} color={accent ?? colors.primary} />
      <Text style={[s.tileValue, { color: accent ?? colors.textPrimary }]}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {sub ? <Text style={s.tileSub}>{sub}</Text> : null}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { token, user } = useAuth();
  const _router = useRouter();
  React.useEffect(() => {
    if (user && !user.isCompany) _router.replace('/(buyer)/profile');
  }, [user, _router]);
  if (user && !user.isCompany) return null;
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);

  const fetcher = useCallback(async () => {
    if (!token) return;
    const data = await api.analytics.overview(token);
    setOverview(data);
  }, [token]);

  const { loading, refreshing, onRefresh } = useScreenLoad(fetcher);

  const buyer = overview?.buyer ?? null;

  const totalSpend = buyer?.monthlySpend?.reduce((s, m) => s + m.value, 0) ?? 0;
  const thisMonth = buyer?.monthlySpend?.slice(-1)[0]?.value ?? 0;
  const completedOrders = buyer?.orderBreakdown?.find((b) => b.status === 'COMPLETED')?.count ?? 0;
  const activeOrders =
    (buyer?.orderBreakdown?.find((b) => b.status === 'IN_PROGRESS')?.count ?? 0) +
    (buyer?.orderBreakdown?.find((b) => b.status === 'CONFIRMED')?.count ?? 0);
  const co2 = buyer?.co2Kg != null ? Math.round(buyer.co2Kg) : null;

  if (loading) {
    return (
      <ScreenContainer bg="#f4f5f7">
        <ScreenHeader title="Statistika" />
        <SkeletonCard count={3} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#f4f5f7">
      <ScreenHeader title="Statistika" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.scroll}
      >
        {/* Key stats */}
        <View style={s.grid}>
          <StatTile icon={TrendingUp} label="Šomēnes" value={fmtEur(thisMonth)} />
          <StatTile icon={Package} label="Aktīvi" value={String(activeOrders)} />
          <StatTile
            icon={BarChart2}
            label="Pabeigti"
            value={String(completedOrders)}
            sub={`Kopā: ${fmtEur(totalSpend)}`}
          />
          {co2 != null && (
            <StatTile icon={Leaf} label="CO₂ (kg)" value={String(co2)} accent="#16a34a" />
          )}
        </View>

        {/* Web CTA */}
        <TouchableOpacity
          style={s.banner}
          activeOpacity={0.8}
          onPress={() => Linking.openURL(WEB_ANALYTICS_URL)}
        >
          <View style={s.bannerLeft}>
            <ExternalLink size={18} color="#2563eb" />
            <View style={s.bannerText}>
              <Text style={s.bannerTitle}>Pilna analītika</Text>
              <Text style={s.bannerSub}>
                Diagrammas, rēķinu novecošana, piegādātāju reitings un CSV eksports — b3hub.lv
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: { padding: spacing.base, gap: spacing.base, paddingBottom: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    flex: 1,
    minWidth: '44%',
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
  tileValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.textPrimary,
    marginTop: 4,
  },
  tileLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tileSub: {
    fontSize: 11,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: 1,
  },
  banner: {
    backgroundColor: '#eff6ff',
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  bannerText: { flex: 1, gap: 3 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },
  bannerSub: { fontSize: 12, color: '#3b82f6', lineHeight: 17 },
});
