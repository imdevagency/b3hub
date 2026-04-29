import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiOrder } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Inbox, ArrowRight, Plus, CheckCircle, Wallet, ChevronRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useHeaderConfig } from '@/lib/header-context';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors } from '@/lib/theme';

const TAB_H = 52;

const REVENUE_STATUSES = [
  'CONFIRMED',
  'PROCESSING',
  'IN_PROGRESS',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
];

function fmtEur(v: number) {
  if (v >= 1000) return `€${(v / 1000).toFixed(1)}k`;
  return `€${v.toFixed(0)}`;
}

function getStatusMeta(status: string) {
  switch (status) {
    case 'PENDING':
      return { text: 'Gaida', color: '#d97706', bg: '#fef3c7' };
    case 'CONFIRMED':
      return { text: 'Apstiprināts', color: '#166534', bg: '#dcfce7' };
    case 'DELIVERED':
      return { text: 'Piegādāts', color: '#1d4ed8', bg: '#dbeafe' };
    case 'CANCELLED':
      return { text: 'Atcelts', color: colors.dangerText, bg: '#fef2f2' };
    default:
      return { text: status, color: colors.textMuted, bg: '#f3f4f6' };
  }
}

export default function SellerHomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setConfig } = useHeaderConfig();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [materialCount, setMaterialCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [todayRevenue, setTodayRevenue] = useState<number | null>(null);
  const [weekRevenue, setWeekRevenue] = useState<number | null>(null);
  const [monthRevenue, setMonthRevenue] = useState<number | null>(null);
  const toast = useToast();

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      api.orders
        .myOrders(token)
        .then((orders) => {
          const companyId = user?.company?.id;
          const sellerOrders = companyId
            ? orders.filter((o) => o.buyer?.id !== companyId)
            : orders.filter((o) => o.createdBy?.id !== user?.id);
          const pending = sellerOrders.filter(
            (o) => o.status === 'PENDING' || o.status === 'CONFIRMED',
          ).length;
          setPendingCount(pending);
          // Revenue KPIs computed from seller orders
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekStart = new Date(todayStart);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          let today = 0,
            week = 0,
            month = 0;
          for (const o of sellerOrders) {
            if (!REVENUE_STATUSES.includes(o.status)) continue;
            const d = new Date(o.createdAt);
            const v = o.total ?? 0;
            if (d >= monthStart) month += v;
            if (d >= weekStart) week += v;
            if (d >= todayStart) today += v;
          }
          setTodayRevenue(today);
          setWeekRevenue(week);
          setMonthRevenue(month);
          // Recent = last 5 seller orders sorted by newest
          const sorted = [...sellerOrders].sort(
            (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
          );
          setRecentOrders(sorted.slice(0, 5));
        })
        .catch(() => {
          toast.error('Neizdevās ielādēt pasūtījumus');
          setPendingCount(0);
        })
        .finally(() => setRefreshing(false));
      api.notifications
        .unreadCount(token)
        .then((res) => setUnreadCount(res.count))
        .catch((err) =>
          console.warn('Unread count failed:', err instanceof Error ? err.message : err),
        );
      const companyId = user?.company?.id;
      if (companyId) {
        api.materials
          .getAll(token, { supplierId: companyId })
          .then((data) => {
            const items = Array.isArray(data) ? data : data.items;
            setMaterialCount(items.length);
          })
          .catch(() => setMaterialCount(null));
      } else {
        setMaterialCount(null);
      }
    },
    [token, toast, user?.company?.id, user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
  );

  // Show the layout-level TopBar while this tab is focused
  useFocusEffect(
    useCallback(() => {
      setConfig({});
      return () => setConfig(null);
    }, [setConfig]),
  );

  return (
    <ScreenContainer noAnimation bg="#ffffff" topBg="#ffffff">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: TAB_H + insets.bottom + 32,
          paddingTop: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#111827"
          />
        }
      >
        <View className="px-5">
          {/* FIRST-RUN ONBOARDING */}
          {materialCount === 0 && pendingCount === 0 && (
            <View className="bg-[#166534] rounded-3xl p-5 mb-6">
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '600',
                  color: colors.white,
                  letterSpacing: -0.5,
                  marginBottom: 8,
                }}
              >
                Sāciet pārdot
              </Text>
              <Text className="text-gray-400 mb-6 font-medium leading-5" style={{ fontSize: 15 }}>
                Izpildiet 3 soļus, lai saņemtu pirmo pasūtījumu
              </Text>
              {[
                {
                  icon: Plus,
                  label: 'Pievienojiet materiālus katalogā',
                  route: '/(seller)/catalog',
                },
                {
                  icon: CheckCircle,
                  label: 'Apstipriniet ienākošos pasūtījumus',
                  route: '/(seller)/incoming',
                },
                { icon: Wallet, label: 'Sekojiet ienākumiem', route: '/(seller)/earnings' },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      if (!step.route) return;
                      haptics.light();
                      router.push(step.route);
                    }}
                    activeOpacity={step.route ? 0.75 : 1}
                    className={`flex-row items-center ${i < 2 ? 'mb-4' : ''}`}
                    style={{ gap: 14 }}
                  >
                    <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
                      <Icon size={18} color="#ffffff" strokeWidth={2} />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{
                          fontSize: 15,
                          color: colors.white,
                          fontWeight: '600',
                          letterSpacing: -0.2,
                        }}
                      >
                        {step.label}
                      </Text>
                    </View>
                    <ArrowRight size={16} color="#6b7280" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* STATUS CARD (UBER STYLE) */}
          <View className="mb-8">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                haptics.medium();
                router.push('/(seller)/incoming');
              }}
              className={`rounded-3xl p-5 min-h-[160px] justify-between ${
                pendingCount !== null && pendingCount > 0 ? 'bg-[#166534]' : 'bg-gray-100'
              }`}
            >
              {pendingCount !== null ? (
                pendingCount > 0 ? (
                  <>
                    <View className="flex-row justify-between items-start">
                      <View>
                        <View className="flex-row items-center mb-1">
                          <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '600',
                              color: '#d1d5db',
                              letterSpacing: -0.3,
                            }}
                          >
                            Jauni pasūtījumi
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 72,
                            fontWeight: '700',
                            color: colors.white,
                            lineHeight: 72,
                            letterSpacing: -3.5,
                            marginTop: 4,
                          }}
                        >
                          {pendingCount}
                        </Text>
                      </View>
                      <View className="w-12 h-12 rounded-full items-center justify-center bg-white/10">
                        <ArrowRight size={24} color="#ffffff" strokeWidth={2.5} />
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: colors.white,
                        marginTop: 16,
                        opacity: 0.8,
                      }}
                    >
                      Pieskaries, lai skatītu
                    </Text>
                  </>
                ) : (
                  <>
                    <View className="flex-row justify-between items-start">
                      <View>
                        <View className="flex-row items-center mb-1">
                          <View className="w-2 h-2 rounded-full bg-gray-300 mr-2" />
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '600',
                              color: colors.textMuted,
                              letterSpacing: -0.3,
                            }}
                          >
                            Statuss
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 32,
                            fontWeight: '700',
                            color: colors.textPrimary,
                            letterSpacing: -1,
                            marginTop: 4,
                          }}
                        >
                          Gatavs darbam
                        </Text>
                      </View>
                      <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
                        <Inbox size={24} color="#111827" strokeWidth={2.5} />
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: colors.textMuted,
                        marginTop: 32,
                      }}
                    >
                      Pagaidām nav jaunu pieprasījumu
                    </Text>
                  </>
                )
              ) : (
                <SkeletonCard count={2} />
              )}
            </TouchableOpacity>
          </View>

          {/* REVENUE KPI TILES */}
          {(todayRevenue !== null || weekRevenue !== null || monthRevenue !== null) && (
            <View style={ls.kpiRow}>
              {[
                { label: 'Šodien', value: todayRevenue },
                { label: 'Nedēļā', value: weekRevenue },
                { label: 'Mēnesī', value: monthRevenue },
              ].map((t) => (
                <View key={t.label} style={ls.kpiTile}>
                  <Text style={ls.kpiValue}>{t.value !== null ? fmtEur(t.value) : '—'}</Text>
                  <Text style={ls.kpiLabel}>{t.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* RECENT ORDERS HEADER */}
          <View className="flex-row justify-between items-center mb-2">
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: colors.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              Pēdējie pasūtījumi
            </Text>
            <TouchableOpacity onPress={() => router.push('/(seller)/incoming')}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Visi</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RECENT ORDERS LIST */}
        <View className="mt-1">
          {pendingCount === null ? (
            <View className="px-5 pt-2">
              <SkeletonCard count={3} />
            </View>
          ) : recentOrders.length === 0 ? (
            <View className="items-center py-10" style={{ gap: 12 }}>
              <Inbox size={32} color="#d1d5db" />
              <Text className="text-gray-400 font-medium " style={{ fontSize: 15 }}>
                Pagaidām nav pasūtījumu
              </Text>
            </View>
          ) : (
            recentOrders.map((order, i) => {
              const meta = getStatusMeta(order.status);
              return (
                <TouchableOpacity
                  key={order.id}
                  className={`flex-row items-center py-4 px-5 bg-white border-gray-100 ${i !== recentOrders.length - 1 ? 'border-b' : ''}`}
                  activeOpacity={0.7}
                  onPress={() => {
                    haptics.light();
                    router.push(`/(seller)/order/${order.id}`);
                  }}
                >
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center mb-1.5" style={{ gap: 10 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                        #{order.orderNumber}
                      </Text>
                      <StatusPill label={meta.text} bg={meta.bg} color={meta.color} size="sm" />
                    </View>
                    <Text className="text-sm text-gray-500 font-medium" numberOfLines={1}>
                      {order.buyer?.name ?? '—'} · {order.deliveryCity}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                    €{order.total.toFixed(0)}
                  </Text>
                  <ChevronRight size={18} color="#d1d5db" className="ml-2" />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const ls = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
