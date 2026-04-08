import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
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

import { TopBar } from '@/components/ui/TopBar';

const TAB_H = 52;

export default function SellerHomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [materialCount, setMaterialCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const loadData = useCallback(
    (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      api.orders
        .myOrders(token)
        .then((orders) => {
          const companyId = user?.company?.id;
          const sellerOrders = companyId ? orders.filter((o) => o.buyer?.id !== companyId) : orders;
          const pending = sellerOrders.filter(
            (o) => o.status === 'PENDING' || o.status === 'CONFIRMED',
          ).length;
          setPendingCount(pending);
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
        .catch(() => {});
      const companyId = user?.company?.id;
      if (companyId) {
        api.materials
          .getAll(token, { supplierId: companyId })
          .then((data) => {
            const items = Array.isArray(data) ? data : ((data as any).items ?? []);
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

  return (
    <ScreenContainer noAnimation bg="#F3F4F6">
      <TopBar
        transparent
        title=""
        unreadCount={unreadCount}
        leftElement={
          <TouchableOpacity
            style={s.avatarBtn}
            activeOpacity={0.85}
            onPress={() => {
              haptics.light();
              router.push('/(seller)/profile');
            }}
          >
            <Text style={s.avatarBtnText}>
              {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: TAB_H + insets.bottom + 32,
          paddingHorizontal: 24,
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
        {/* FIRST-RUN ONBOARDING — shown when seller has no materials listed yet */}
        {materialCount === 0 && pendingCount === 0 && (
          <View
            style={{
              backgroundColor: '#000000',
              borderRadius: 24,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontFamily: 'Inter_700Bold',
                fontWeight: '700',
                color: '#ffffff',
                letterSpacing: -0.5,
                marginBottom: 6,
              }}
            >
              Sāciet pārdot
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: '#9ca3af',
                fontFamily: 'Inter_400Regular',
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              Izpildiet 3 soļus, lai saņemtu pirmo pasūtījumu
            </Text>
            {[
              { icon: Plus, label: 'Pievienojiet materiālus katalogā', route: '/(seller)/catalog' },
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
                    router.push(step.route as any);
                  }}
                  activeOpacity={step.route ? 0.75 : 1}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: i < 2 ? 16 : 0,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} color="#ffffff" strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#ffffff',
                        fontFamily: 'Inter_500Medium',
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
        <View style={{ marginBottom: 24 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              haptics.medium();
              router.push('/(seller)/incoming' as any);
            }}
            style={[
              {
                borderRadius: 24,
                padding: 24,
                minHeight: 160,
                justifyContent: 'space-between',
              },
              pendingCount !== null && pendingCount > 0
                ? { backgroundColor: '#000000' }
                : {
                    backgroundColor: '#ffffff',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  },
            ]}
          >
            {pendingCount !== null ? (
              pendingCount > 0 ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#22c55e',
                            marginRight: 8,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: 'Inter_500Medium',
                            fontWeight: '500',
                            color: '#d1d5db',
                            letterSpacing: -0.3,
                          }}
                        >
                          Jauni pasūtījumi
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 64,
                          fontFamily: 'Inter_700Bold',
                          fontWeight: '700',
                          color: '#ffffff',
                          lineHeight: 64,
                          letterSpacing: -3.2,
                          marginTop: 8,
                        }}
                      >
                        {pendingCount}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <ArrowRight size={24} color="#ffffff" strokeWidth={2.5} />
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Inter_500Medium',
                      fontWeight: '500',
                      color: '#ffffff',
                      marginTop: 16,
                      opacity: 0.8,
                    }}
                  >
                    Pieskaries, lai skatītu
                  </Text>
                </>
              ) : (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#d1d5db',
                            marginRight: 8,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 15,
                            fontFamily: 'Inter_500Medium',
                            fontWeight: '500',
                            color: '#6b7280',
                            letterSpacing: -0.3,
                          }}
                        >
                          Statuss
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 28,
                          fontFamily: 'Inter_700Bold',
                          fontWeight: '700',
                          color: '#000000',
                          letterSpacing: -0.7,
                          marginTop: 8,
                        }}
                      >
                        Gatavs darbam
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#f3f4f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Inbox size={24} color="#000000" strokeWidth={2} />
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Inter_500Medium',
                      fontWeight: '500',
                      color: '#6b7280',
                      marginTop: 24,
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

        {/* RECENT ORDERS */}
        <View style={s.recentSection}>
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>Pēdējie pasūtījumi</Text>
            <TouchableOpacity onPress={() => router.push('/(seller)/incoming' as any)}>
              <Text style={s.recentSeeAll}>Visi</Text>
            </TouchableOpacity>
          </View>

          {pendingCount === null ? (
            <SkeletonCard count={3} />
          ) : recentOrders.length === 0 ? (
            <View style={s.recentEmpty}>
              <Inbox size={28} color="#d1d5db" />
              <Text style={s.recentEmptyText}>Pagaidām nav pasūtījumu</Text>
            </View>
          ) : (
            recentOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={s.recentRow}
                activeOpacity={0.75}
                onPress={() => {
                  haptics.light();
                  router.push(`/(seller)/order/${order.id}` as any);
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={s.recentRowTop}>
                    <Text style={s.recentOrderNum}>#{order.orderNumber}</Text>
                    <View
                      style={[
                        s.recentStatusPill,
                        order.status === 'PENDING'
                          ? s.pillPending
                          : order.status === 'CONFIRMED'
                            ? s.pillConfirmed
                            : order.status === 'DELIVERED'
                              ? s.pillDelivered
                              : s.pillNeutral,
                      ]}
                    >
                      <Text
                        style={[
                          s.recentStatusText,
                          order.status === 'PENDING'
                            ? { color: '#92400e' }
                            : order.status === 'CONFIRMED'
                              ? { color: '#166534' }
                              : order.status === 'DELIVERED'
                                ? { color: '#1d4ed8' }
                                : { color: '#6b7280' },
                        ]}
                      >
                        {order.status === 'PENDING'
                          ? 'Gaida'
                          : order.status === 'CONFIRMED'
                            ? 'Apstiprināts'
                            : order.status === 'DELIVERED'
                              ? 'Piegādāts'
                              : order.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.recentOrderSub} numberOfLines={1}>
                    {order.buyer?.name ?? '—'} · {order.deliveryCity}
                  </Text>
                </View>
                <Text style={s.recentOrderTotal}>€{order.total.toFixed(0)}</Text>
                <ChevronRight size={16} color="#d1d5db" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  recentSection: { marginTop: 8 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  recentSeeAll: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  recentEmpty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  recentEmptyText: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  recentRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  recentOrderNum: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#111827',
  },
  recentStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  pillPending: { backgroundColor: '#fef3c7' },
  pillConfirmed: { backgroundColor: '#dcfce7' },
  pillDelivered: { backgroundColor: '#dbeafe' },
  pillNeutral: { backgroundColor: '#f3f4f6' },
  recentStatusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  recentOrderSub: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  recentOrderTotal: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color: '#111827',
  },
});
