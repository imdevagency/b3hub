import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  Inbox,
  LayoutGrid,
  FileText,
  Wallet,
  Bell,
  ArrowRight,
  Plus,
  CheckCircle,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';

const QUICK_ACTIONS = [
  {
    id: 'catalog',
    icon: LayoutGrid,
    label: 'Katalogs',
    route: '/(seller)/catalog',
  },
  {
    id: 'quotes',
    icon: FileText,
    label: 'Pieprasījumi',
    route: '/(seller)/quotes',
  },
  {
    id: 'earnings',
    icon: Wallet,
    label: 'Ienākumi',
    route: '/(seller)/earnings',
  },
  {
    id: 'all_orders',
    icon: Inbox,
    label: 'Visi pasūtījumi',
    route: '/(seller)/incoming',
  },
];

const TAB_H = 52;

export default function SellerHomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
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
      // Detect new seller: check if they have any materials listed
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
      {/* MINIMAL TOP BAR */}
      <View
        style={{
          paddingTop: 16,
          paddingBottom: 16,
          paddingHorizontal: 24,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 28,
              fontFamily: 'Inter_800ExtraBold',
              fontWeight: '800',
              color: '#111827',
              letterSpacing: -0.7,
            }}
          >
            Sveiki, {user?.firstName || 'Pārdevēj'}!
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            router.push('/notifications' as any);
          }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Bell size={22} color="#111827" />
          {unreadCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: '#ef4444',
                borderWidth: 2,
                borderColor: '#ffffff',
              }}
            />
          )}
        </TouchableOpacity>
      </View>

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

        {/* QUICK ACTIONS GRID */}
        <View style={{ gap: 12 }}>
          {/* Row 1 */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {QUICK_ACTIONS.slice(0, 2).map((action) => {
              const Icon = action.icon;
              return (
                <TouchableOpacity
                  key={action.id}
                  onPress={() => {
                    haptics.light();
                    router.push(action.route as any);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: '#ffffff',
                    borderRadius: 24,
                    padding: 16,
                    height: 116,
                    justifyContent: 'space-between',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#f3f4f6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color="#000000" strokeWidth={2} />
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                      color: '#000000',
                      marginLeft: 4,
                      letterSpacing: -0.4,
                    }}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Row 2 */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {QUICK_ACTIONS.slice(2, 4).map((action) => {
              const Icon = action.icon;
              return (
                <TouchableOpacity
                  key={action.id}
                  onPress={() => {
                    haptics.light();
                    router.push(action.route as any);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: '#ffffff',
                    borderRadius: 24,
                    padding: 16,
                    height: 116,
                    justifyContent: 'space-between',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#f3f4f6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color="#000000" strokeWidth={2} />
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Inter_600SemiBold',
                      fontWeight: '600',
                      color: '#000000',
                      marginLeft: 4,
                      letterSpacing: -0.4,
                    }}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
