import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { TopBar } from '@/components/ui/TopBar';
import { useFocusEffect, useRouter } from 'expo-router';
import { t } from '@/lib/translations';
import { Check, Clock, ChevronRight, AlertCircle, Truck } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api, type ApiTransportJob, type CarrierAnalytics } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';
import { colors } from '@/lib/theme';

// ── Types & helpers ───────────────────────────────────────────────────────

interface EarningsStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedJobs: number;
  pendingPayout: number;
}

interface DayBar {
  label: string; // '23.2'
  shortLabel: string; // 'Pr'
  amount: number;
  isToday: boolean;
}

// Latvian weekday abbreviations (Sun=0)
const LV_DAYS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];

interface HistoryEntry {
  id: string;
  jobNumber: string;
  date: string;
  rawDate: Date;
  route: string;
  pickupCity: string;
  deliveryCity: string;
  pickupAddress: string;
  deliveryAddress: string;
  amount: number;
  paid: boolean;
  status: string;
  // Cargo
  cargoType: string;
  cargoWeight: number | null; // planned weight (tonnes)
  actualWeightKg: number | null; // real weigh-in (kg)
  distanceKm: number | null;
  pricePerTonne: number | null;
  // Evidence
  pickupPhotoUrl: string | null;
}

const ACTIVE_STATUSES = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
];

function buildDailyChart(jobs: ApiTransportJob[]): DayBar[] {
  const now = new Date();
  const bars: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const nextD = new Date(d.getTime() + 86_400_000);
    const amount = jobs
      .filter((j) => {
        if (j.status !== 'DELIVERED') return false;
        const jd = new Date(j.deliveryDate ?? j.pickupDate);
        return jd >= d && jd < nextD;
      })
      .reduce((sum, j) => sum + j.rate, 0);
    bars.push({
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      shortLabel: i === 0 ? 'Šod' : LV_DAYS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }
  return bars;
}

function computeStats(jobs: ApiTransportJob[]): {
  stats: EarningsStats;
  history: HistoryEntry[];
  dailyChart: DayBar[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayEarnings = 0,
    weekEarnings = 0,
    monthEarnings = 0,
    completedJobs = 0,
    pendingPayout = 0;

  const history: HistoryEntry[] = [];

  for (const job of jobs) {
    const d = new Date(job.deliveryDate ?? job.pickupDate);
    if (job.status === 'DELIVERED') {
      completedJobs++;
      if (d >= todayStart) todayEarnings += job.rate;
      if (d >= weekStart) weekEarnings += job.rate;
      if (d >= monthStart) monthEarnings += job.rate;
      const entry: HistoryEntry = {
        id: job.id,
        jobNumber: job.jobNumber,
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' }),
        rawDate: d,
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        pickupCity: job.pickupCity,
        deliveryCity: job.deliveryCity,
        pickupAddress: job.pickupAddress,
        deliveryAddress: job.deliveryAddress,
        amount: job.rate,
        paid: false,
        status: job.status,
        cargoType: job.cargoType,
        cargoWeight: job.cargoWeight,
        actualWeightKg: job.actualWeightKg ?? null,
        distanceKm: job.distanceKm ?? null,
        pricePerTonne: job.pricePerTonne ?? null,
        pickupPhotoUrl: job.pickupPhotoUrl ?? null,
      };
      history.push(entry);
    } else if (ACTIVE_STATUSES.includes(job.status)) {
      pendingPayout += job.rate;
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: new Date(job.pickupDate).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
        }),
        rawDate: new Date(job.pickupDate),
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        pickupCity: job.pickupCity,
        deliveryCity: job.deliveryCity,
        pickupAddress: job.pickupAddress,
        deliveryAddress: job.deliveryAddress,
        amount: job.rate,
        paid: false,
        status: job.status,
        cargoType: job.cargoType,
        cargoWeight: job.cargoWeight,
        actualWeightKg: job.actualWeightKg ?? null,
        distanceKm: job.distanceKm ?? null,
        pricePerTonne: job.pricePerTonne ?? null,
        pickupPhotoUrl: job.pickupPhotoUrl ?? null,
      });
    }
  }
  // Sort history by date descending
  history.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  return {
    stats: { todayEarnings, weekEarnings, monthEarnings, completedJobs, pendingPayout },
    history,
    dailyChart: buildDailyChart(jobs),
  };
}

// ── Components ────────────────────────────────────────────────────────────

const CHART_H = 120;
const CHART_W = Dimensions.get('window').width - 40; // padding horizontal 20 + 20

function MinimalBarChart({ bars }: { bars: DayBar[] }) {
  const maxAmt = Math.max(...bars.map((b) => b.amount), 1);
  const barW = (CHART_W - 6 * 8) / 7; // 7 bars, 6 gaps of 8px

  return (
    <View
      style={{
        height: CHART_H + 30,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      {bars.map((bar, i) => {
        const fillH = (bar.amount / maxAmt) * CHART_H;
        // Ensure at least a tiny bit visible if amounts are 0 but max > 0, or just show 0 height
        const h = bar.amount > 0 ? Math.max(fillH, 4) : 4;

        return (
          <View key={i} style={{ alignItems: 'center', width: barW, gap: 8 }}>
            <View style={{ height: CHART_H, justifyContent: 'flex-end', width: '100%' }}>
              <View
                style={{
                  height: h,
                  backgroundColor: bar.isToday ? '#111827' : '#f3f4f6',
                  borderRadius: 6,
                  width: '100%',
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                color: bar.isToday ? '#111827' : '#9ca3af',
                fontWeight: bar.isToday ? '700' : '600',
              }}
            >
              {bar.shortLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type Period = 'today' | 'week' | 'month';

export default function EarningsScreen() {
  const { user, token } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('week');
  const [setupLoading, setSetupLoading] = useState(false);
  const [stripeAvailable, setStripeAvailable] = useState<number | null>(null);
  const [stripePending, setStripePending] = useState<number | null>(null);
  const [stripeOnboarded, setStripeOnboarded] = useState(false);
  const [stats, setStats] = useState<EarningsStats>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    completedJobs: 0,
    pendingPayout: 0,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dailyChart, setDailyChart] = useState<DayBar[]>([]);
  const [carrierAnalytics, setCarrierAnalytics] = useState<CarrierAnalytics | null>(null);

  const handleSetupPayouts = async () => {
    if (!token) return;
    try {
      setSetupLoading(true);
      const { url } = await api.setupPayouts(token);
      if (url) {
        await Linking.openURL(url);
      } else {
        toast.error('Neizdevās iegūt saiti.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Neizdevās savienoties ar Stripe.');
    } finally {
      setSetupLoading(false);
    }
  };

  const fetchEarnings = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      try {
        const [jobs, balance] = await Promise.all([
          api.transportJobs.myJobs(token),
          api.getBalance(token).catch(() => null),
        ]);
        // Fetch carrier analytics in parallel (non-critical)
        api.analytics
          .overview(token)
          .then((ov) => setCarrierAnalytics(ov.carrier ?? null))
          .catch((err) =>
            console.warn('Carrier analytics failed:', err instanceof Error ? err.message : err),
          );
        const { stats: s, history: h, dailyChart: dc } = computeStats(jobs);
        setStats(s);
        setHistory(h);
        setDailyChart(dc);
        if (balance) {
          setStripeAvailable(balance.available);
          setStripePending(balance.pending);
          setStripeOnboarded(balance.onboarded);
        }
      } catch (e) {
        showToast('Kļūda ielādējot datus', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
    }, [fetchEarnings]),
  );

  const heroAmount =
    period === 'today'
      ? stats.todayEarnings
      : period === 'week'
        ? stats.weekEarnings
        : stats.monthEarnings;

  const filteredHistory = (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') {
      return history.filter((e) => e.rawDate >= todayStart);
    }
    if (period === 'week') {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return history.filter((e) => e.rawDate >= weekStart);
    }
    // month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return history.filter((e) => e.rawDate >= monthStart);
  })();

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Šodien' },
    { key: 'week', label: 'Šonedēļ' },
    { key: 'month', label: 'Mēnesī' },
  ];

  if (loading) {
    return (
      <ScreenContainer bg="#ffffff" topBg="#ffffff">
        <TopBar transparent />
        <View className="px-5 pt-2 pb-6">
          <Text
            style={{
              fontSize: 32,
              fontWeight: '800',
              color: colors.textPrimary,
              letterSpacing: -0.8,
            }}
          >
            Izpeļņa
          </Text>
        </View>
        <View className="px-5">
          <SkeletonCard count={3} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bg="#ffffff" topBg="#ffffff">
      <TopBar transparent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchEarnings(true)}
            tintColor="#111827"
          />
        }
      >
        <View className="px-5 pt-1 pb-4">
          <Text
            style={{
              fontSize: 32,
              fontWeight: '800',
              color: colors.textPrimary,
              letterSpacing: -0.8,
            }}
          >
            Izpeļņa
          </Text>
        </View>

        {user?.isCompany && user.payoutEnabled === false && (
          <View className="mx-5 mb-8 bg-gray-50 rounded-3xl p-5 border border-gray-100">
            <View className="flex-row items-center mb-3">
              <AlertCircle size={20} color="#ea580c" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: colors.textPrimary,
                  marginLeft: 8,
                }}
              >
                Aktivizēt izmaksas
              </Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                color: '#4b5563',
                fontWeight: '500',
                lineHeight: 22,
                marginBottom: 16,
              }}
            >
              Pievienojiet bankas kontu Stripe sistēmā, lai mēs varētu pārskaitīt jūsu izpeļņu.
            </Text>
            <TouchableOpacity
              onPress={handleSetupPayouts}
              disabled={setupLoading}
              className="bg-gray-900 py-3.5 px-6 rounded-full items-center mt-4"
              activeOpacity={0.8}
            >
              {setupLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.white }}>
                  Iestatīt bankas kontu
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Segmented Control */}
        <View className="px-5 mb-8">
          <View className="flex-row bg-gray-100 p-1 rounded-2xl">
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${active ? 'bg-white' : ''}`}
                  style={
                    active
                      ? {
                          shadowColor: '#000',
                          shadowOpacity: 0.06,
                          shadowRadius: 4,
                          elevation: 1,
                          shadowOffset: { width: 0, height: 1 },
                        }
                      : {}
                  }
                  onPress={() => {
                    haptics.light();
                    setPeriod(p.key);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: active ? '#111827' : '#6b7280',
                    }}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Hero Section ──────────────────────────────── */}
        <View className="px-5 items-center mb-10">
          <Text
            style={{
              fontSize: 14,
              color: colors.textMuted,
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            {period === 'today' ? 'Šodien' : period === 'week' ? 'Šonedēļ' : 'Mēnesī'}
          </Text>
          <Text
            style={{
              fontSize: 64,
              fontWeight: '800',
              color: colors.textPrimary,
              letterSpacing: -2.5,
            }}
          >
            €{heroAmount.toFixed(2)}
          </Text>
        </View>

        {/* ── Chart ─────────────────────────────────────── */}
        <View className="px-5 mb-10">
          <MinimalBarChart bars={dailyChart} />
        </View>

        {/* ── Key Metrics ───────────────────────────────── */}
        <View className="flex-row px-5 mb-12">
          <View className="flex-1 items-center justify-center">
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: colors.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              {stats.completedJobs}
            </Text>
            <Text
              style={{ fontSize: 13, color: colors.textDisabled, fontWeight: '600', marginTop: 4 }}
            >
              Braucieni
            </Text>
          </View>
          <View className="w-[1px] bg-gray-100 h-10 self-center" />
          <View className="flex-1 items-center justify-center">
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: colors.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              €{stats.pendingPayout.toFixed(0)}
            </Text>
            <Text
              style={{ fontSize: 13, color: colors.textDisabled, fontWeight: '600', marginTop: 4 }}
            >
              Gaida apmaksu
            </Text>
          </View>
          <View className="w-[1px] bg-gray-100 h-10 self-center" />
          <View className="flex-1 items-center justify-center">
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: colors.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              --:--
            </Text>
            <Text
              style={{ fontSize: 13, color: colors.textDisabled, fontWeight: '600', marginTop: 4 }}
            >
              Stundas
            </Text>
          </View>
        </View>

        {/* ── 12-Month Earnings Chart ───────────────────── */}
        {carrierAnalytics && carrierAnalytics.monthlyEarnings.length > 0 && (
          <View className="px-5 mb-12">
            <Text style={es.sectionLabel}>12 mēneši</Text>
            <View style={es.analyticsCard}>
              {carrierAnalytics.monthlyEarnings.slice(-12).map((m) => {
                const maxVal = Math.max(...carrierAnalytics.monthlyEarnings.map((x) => x.value), 1);
                const pct = m.value / maxVal;
                const [y, mo] = m.month.split('-');
                const isThisMonth =
                  m.month ===
                  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                return (
                  <View key={m.month} style={es.barRow}>
                    <Text
                      style={[
                        es.barLabel,
                        isThisMonth && { color: colors.textPrimary, fontWeight: '700' },
                      ]}
                    >
                      {mo}/{y?.slice(2)}
                    </Text>
                    <View style={es.barTrack}>
                      <View
                        style={[
                          es.barFill,
                          {
                            width: `${Math.max(pct * 100, 2)}%` as any,
                            backgroundColor: isThisMonth ? '#111827' : '#e5e7eb',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[es.barValue, isThisMonth && { color: colors.textPrimary }]}>
                      €{m.value >= 1000 ? `${(m.value / 1000).toFixed(1)}k` : m.value.toFixed(0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Fleet Utilization ─────────────────────────── */}
        {carrierAnalytics?.fleetUtilization && carrierAnalytics.fleetUtilization.total > 0 && (
          <View className="px-5 mb-10">
            <Text style={es.sectionLabel}>Flote</Text>
            <View style={es.fleetCard}>
              <View style={es.fleetRow}>
                <Truck size={20} color="#6b7280" />
                <Text style={es.fleetTitle}>
                  {carrierAnalytics.fleetUtilization.inUse} /{' '}
                  {carrierAnalytics.fleetUtilization.total} transportlīdzekļi darbā
                </Text>
                <Text style={es.fleetPct}>
                  {Math.round(carrierAnalytics.fleetUtilization.utilizationRate * 100)}%
                </Text>
              </View>
              <View style={es.fleetBar}>
                <View
                  style={[
                    es.fleetBarFill,
                    {
                      width:
                        `${Math.max(carrierAnalytics.fleetUtilization.utilizationRate * 100, 2)}%` as any,
                    },
                  ]}
                />
              </View>
              <View style={es.fleetStats}>
                <Text style={es.fleetStat}>Kopā: {carrierAnalytics.fleetUtilization.total}</Text>
                <Text style={es.fleetStat}>Aktīvi: {carrierAnalytics.fleetUtilization.active}</Text>
                <Text style={es.fleetStat}>Darbā: {carrierAnalytics.fleetUtilization.inUse}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Stripe Balance Card ───────────────────────── */}
        {stripeOnboarded && (
          <View className="px-5 mb-8">
            <View className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
              <View className="flex-row items-center mb-6" style={{ gap: 8 }}>
                <View className="w-2 h-2 rounded-full bg-green-500" />
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textPrimary,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Stripe Konts
                </Text>
              </View>
              <View className="flex-row">
                <View className="flex-1">
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: '800',
                      color: colors.textPrimary,
                      letterSpacing: -1,
                    }}
                  >
                    €{(stripeAvailable ?? 0).toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textMuted,
                      fontWeight: '500',
                      marginTop: 2,
                    }}
                  >
                    Pieejams uzreiz
                  </Text>
                </View>
                <View className="w-[1px] bg-gray-200 mx-4" />
                <View className="flex-1">
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: '800',
                      color: colors.textDisabled,
                      letterSpacing: -1,
                    }}
                  >
                    €{(stripePending ?? 0).toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textDisabled,
                      fontWeight: '500',
                      marginTop: 2,
                    }}
                  >
                    Apstrādē
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Payout Timeline ───────────────────────────── */}
        <View className="px-5 mb-10">
          <View className="bg-gray-50 rounded-3xl p-6">
            <Text
              style={{
                fontSize: 13,
                color: colors.textDisabled,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                marginBottom: 20,
              }}
            >
              Kā strādā izmaksas
            </Text>
            {[
              {
                step: '1',
                label: 'Piegāde pabeigta',
                sub: 'Darbs atzīmēts kā piegādāts',
                color: '#10b981',
              },
              {
                step: '2',
                label: 'Klienta apstiprinājums',
                sub: 'Līdz 48h (vai automātiski)',
                color: '#6366f1',
              },
              { step: '3', label: 'Nauda atbrīvota', sub: 'Stripe atlikumā', color: '#f59e0b' },
              {
                step: '4',
                label: 'Izmaksa uz banku',
                sub: '1–2 dienu laikā',
                color: colors.textPrimary,
              },
            ].map((item, i, arr) => (
              <View key={item.step} className="flex-row items-start" style={{ gap: 16 }}>
                <View className="items-center" style={{ width: 28 }}>
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center"
                    style={{ backgroundColor: item.color }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.white }}>
                      {item.step}
                    </Text>
                  </View>
                  {i < arr.length - 1 && (
                    <View className="w-0.5 bg-gray-200 flex-1 my-1 min-h-[16px]" />
                  )}
                </View>
                <View className="flex-1" style={{ paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textMuted,
                      fontWeight: '500',
                      marginTop: 2,
                    }}
                  >
                    {item.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Recent Activity List ──────────────────────── */}
        <View>
          <View className="px-5 pb-2 flex-row justify-between items-end">
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: colors.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              Visi braucieni
            </Text>
          </View>

          {filteredHistory.length === 0 ? (
            <View className="items-center py-10 mt-4">
              <Text style={{ fontSize: 15, color: colors.textDisabled, fontWeight: '500' }}>
                Šajā periodā nav braucienu
              </Text>
            </View>
          ) : (
            <View className="mt-2 text-black">
              {filteredHistory.map((item, i) => (
                <TouchableOpacity
                  key={item.id}
                  className={`flex-row items-center justify-between py-4 px-5 bg-white border-gray-100 ${i < filteredHistory.length - 1 ? 'border-b' : ''}`}
                  activeOpacity={0.7}
                  onPress={() => {
                    haptics.light();
                    router.push(`/(driver)/job-stat/${item.id}`);
                  }}
                >
                  <View className="flex-1 pr-4 gap-1">
                    <Text style={{ fontSize: 12, color: colors.textDisabled, fontWeight: '600' }}>
                      {item.date}
                      {item.distanceKm ? ` · ${Math.round(item.distanceKm)} km` : ''}
                      {item.actualWeightKg
                        ? ` · ${(item.actualWeightKg / 1000).toFixed(2)} t`
                        : item.cargoWeight
                          ? ` · ${item.cargoWeight} t`
                          : ''}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '700',
                        color: colors.textPrimary,
                        letterSpacing: -0.2,
                      }}
                      numberOfLines={1}
                    >
                      {item.route}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted }} numberOfLines={1}>
                      {item.cargoType}
                    </Text>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                      {item.amount > 0 ? `€${item.amount.toFixed(2)}` : '€0.00'}
                    </Text>
                    <ChevronRight size={18} color="#d1d5db" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const es = StyleSheet.create({
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  analyticsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    gap: 8,
  },
  barRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  barLabel: {
    width: 46,
    fontSize: 13,
    color: colors.textDisabled,
    fontWeight: '500' as const,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bgMuted,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  barFill: {
    height: '100%' as any,
    borderRadius: 3,
  },
  barValue: {
    width: 52,
    fontSize: 13,
    color: colors.textDisabled,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
  fleetCard: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 12,
  },
  fleetRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  fleetTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  fleetPct: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  fleetBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  fleetBarFill: {
    height: '100%' as any,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  fleetStats: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  fleetStat: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500' as const,
  },
});
