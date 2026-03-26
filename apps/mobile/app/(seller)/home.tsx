import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Text } from '@/components/ui/text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Inbox, LayoutGrid, FileText, Wallet, Bell, ArrowRight } from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { FadeInView } from '@/components/ui/FadeInView';

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

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api.orders
        .myOrders(token)
        .then((orders) => {
          const pending = orders.filter(
            (o) => o.status === 'PENDING' || o.status === 'CONFIRMED',
          ).length;
          setPendingCount(pending);
        })
        .catch(() => {});
    }, [token]),
  );

  return (
    <ScreenContainer standalone noAnimation bg="#ffffff">
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
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 }}>
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
            backgroundColor: '#f3f4f6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: TAB_H + insets.bottom + 32,
          paddingHorizontal: 24,
          paddingTop: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* STATUS CARD (UBER STYLE) */}
        <FadeInView variant="fadeSlideUp" index={0}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              haptics.medium();
              router.push('/(seller)/incoming' as any);
            }}
            style={{
              backgroundColor: pendingCount && pendingCount > 0 ? '#111827' : '#f3f4f6',
              borderRadius: 24,
              padding: 24,
              marginBottom: 32,
              minHeight: 140,
              justifyContent: 'space-between',
            }}
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
                      <Text
                        style={{
                          color: '#9ca3af',
                          fontSize: 16,
                          fontWeight: '600',
                          marginBottom: 4,
                        }}
                      >
                        Jauni pasūtījumi
                      </Text>
                      <Text
                        style={{
                          color: '#ffffff',
                          fontSize: 40,
                          fontWeight: '800',
                          letterSpacing: -1,
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
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <ArrowRight size={24} color="#ffffff" />
                    </View>
                  </View>
                  <Text
                    style={{ color: '#ffffff', fontSize: 16, fontWeight: '500', marginTop: 16 }}
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
                      <Text
                        style={{
                          color: '#6b7280',
                          fontSize: 16,
                          fontWeight: '600',
                          marginBottom: 4,
                        }}
                      >
                        Statuss
                      </Text>
                      <Text
                        style={{
                          color: '#111827',
                          fontSize: 24,
                          fontWeight: '800',
                          letterSpacing: -0.5,
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
                        backgroundColor: '#ffffff',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Inbox size={24} color="#111827" />
                    </View>
                  </View>
                  <Text
                    style={{ color: '#6b7280', fontSize: 16, fontWeight: '500', marginTop: 16 }}
                  >
                    Jaunu pasūtījumu pagaidām nav
                  </Text>
                </>
              )
            ) : (
              <View style={{ flex: 1, backgroundColor: 'transparent' }} />
            )}
          </TouchableOpacity>
        </FadeInView>

        {/* QUICK ACTIONS GRID */}
        <FadeInView variant="fadeSlideUp" index={1}>
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
                      backgroundColor: '#f3f4f6', // Uber style flat gray
                      borderRadius: 16,
                      padding: 16,
                      height: 100, // Squator rectangles instead of huge squares
                      justifyContent: 'space-between',
                    }}
                  >
                    <Icon size={24} color="#111827" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
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
                      backgroundColor: '#f3f4f6', // Uber style flat gray
                      borderRadius: 16,
                      padding: 16,
                      height: 100, // Squator rectangles instead of huge squares
                      justifyContent: 'space-between',
                    }}
                  >
                    <Icon size={24} color="#111827" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </FadeInView>
      </ScrollView>
    </ScreenContainer>
  );
}
