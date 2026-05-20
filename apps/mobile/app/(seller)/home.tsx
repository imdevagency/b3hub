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
import {
  Inbox,
  ArrowRight,
  Plus,
  CheckCircle,
  Wallet,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { useHeaderConfig } from '@/lib/header-context';
import { StatusPill } from '@/components/ui/StatusPill';
import { getOrderStatus } from '@/lib/status';
import { colors } from '@/lib/theme';

const TAB_H = 52;

export default function SellerHomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setConfig } = useHeaderConfig();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<ApiOrder[]>([]);
  const [materialCount, setMaterialCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      api.orders
        .sellerOrders(token)
        .then((orders) => {
          const pending = orders.filter((o) => o.status === 'PENDING').length;
          setPendingCount(pending);
          // Today's loading schedule — CONFIRMED/IN_PROGRESS orders due today
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const todayEnd = new Date(todayStart.getTime() + 86_400_000);
          const schedule = orders
            .filter((o) => {
              if (!['CONFIRMED', 'PROCESSING', 'IN_PROGRESS'].includes(o.status)) return false;
              if (!o.deliveryDate) return false;
              const d = new Date(o.deliveryDate);
              return d >= todayStart && d < todayEnd;
            })
            .sort((a, b) => {
              const w: Record<string, number> = { AM: 0, PM: 1, ANY: 2 };
              return (w[a.deliveryWindow ?? 'ANY'] ?? 2) - (w[b.deliveryWindow ?? 'ANY'] ?? 2);
            });
          setTodaySchedule(schedule);
          // Recent = last 5 orders sorted by newest
          const sorted = [...orders].sort(
            (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
          );
          setRecentOrders(sorted.slice(0, 5));
        })
        .catch(() => {
          toast.error('Neizdevās ielādēt pasūtījumus');
          setPendingCount(0);
        })
        .finally(() => setRefreshing(false));
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
    [token, toast, user?.company?.id],
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
          {/* IBAN NUDGE — shown when seller has not configured payout details */}
          {user && user.payoutEnabled === false && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                haptics.light();
                router.push('/(seller)/profile');
              }}
              style={{
                backgroundColor: '#fffbeb',
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#fde68a',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#fef3c7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={20} color="#d97706" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    color: '#92400e',
                    marginBottom: 2,
                  }}
                >
                  Pievienojiet IBAN, lai saņemtu maksājumus
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Inter_400Regular',
                    color: '#b45309',
                  }}
                >
                  Bez IBAN konta jūs nevarat saņemt izmaksas
                </Text>
              </View>
              <ChevronRight size={16} color="#d97706" />
            </TouchableOpacity>
          )}

          {/* TODAY'S LOADING SCHEDULE */}
          {todaySchedule.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  letterSpacing: -0.5,
                  marginBottom: 12,
                }}
              >
                Šodienas iekraušanas
              </Text>
              {todaySchedule.map((order) => {
                const job = order.transportJobs?.[0];
                const vehicle = job?.vehicle;
                const material = order.items?.[0];
                const win = order.deliveryWindow;
                return (
                  <TouchableOpacity
                    key={order.id}
                    onPress={() => {
                      haptics.light();
                      router.push(`/(seller)/order/${order.id}`);
                    }}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      padding: 14,
                      backgroundColor: '#f0fdf4',
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#bbf7d0',
                      marginBottom: 8,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: '#166534',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 10,
                        minWidth: 52,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>
                        {win === 'AM' ? '8–12' : win === 'PM' ? '12–17' : '—'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: colors.textPrimary,
                          letterSpacing: -0.2,
                        }}
                      >
                        {material?.material?.name ?? 'Materīls'}
                        {material?.quantity ? ` · ${material.quantity}t` : ''}
                      </Text>
                      <Text
                        style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {order.buyer?.name ?? '—'}
                      </Text>
                      {vehicle && (
                        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                          {vehicle.licensePlate}
                          {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ''}
                        </Text>
                      )}
                    </View>
                    <ChevronRight size={16} color="#9ca3af" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

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
              const meta = getOrderStatus(order.status);
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
                      <StatusPill label={meta.label} bg={meta.bg} color={meta.color} size="sm" />
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

const ls = StyleSheet.create({});
