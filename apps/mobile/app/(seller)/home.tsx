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
    <ScreenContainer standalone noAnimation bg="#F3F4F6">
      {/* MINIMAL TOP BAR */}
      <View className="pt-4 pb-4 px-6 flex-row justify-between items-center">
        <View>
          <Text className="text-[28px] font-extrabold text-gray-900 tracking-tight">
            Sveiki, {user?.firstName || 'Pārdevēj'}!
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            router.push('/notifications' as any);
          }}
          className="w-11 h-11 rounded-full bg-white items-center justify-center shadow-sm"
        >
          <Bell size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: TAB_H + insets.bottom + 32,
          paddingHorizontal: 24,
          paddingTop: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* STATUS CARD (UBER STYLE) */}
        <View className="mb-6">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              haptics.medium();
              router.push('/(seller)/incoming' as any);
            }}
            className={`rounded-3xl p-6 min-h-[160px] justify-between ${
              pendingCount !== null && pendingCount > 0
                ? 'bg-black'
                : 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
            }`}
          >
            {pendingCount !== null ? (
              pendingCount > 0 ? (
                <>
                  <View className="flex-row justify-between items-start">
                    <View>
                      <View className="flex-row items-center mb-1">
                        <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                        <Text className="text-gray-300 text-[15px] font-medium tracking-tight">
                          Jauni pasūtījumi
                        </Text>
                      </View>
                      <Text className="text-white text-[64px] font-bold tracking-tighter leading-none mt-2">
                        {pendingCount}
                      </Text>
                    </View>
                    <View className="w-12 h-12 rounded-full bg-white/10 items-center justify-center">
                      <ArrowRight size={24} color="#ffffff" strokeWidth={2.5} />
                    </View>
                  </View>
                  <Text className="text-white text-[15px] font-medium mt-4 opacity-80">
                    Pieskaries, lai skatītu
                  </Text>
                </>
              ) : (
                <>
                  <View className="flex-row justify-between items-start">
                    <View>
                      <View className="flex-row items-center mb-1">
                        <View className="w-2 h-2 rounded-full bg-gray-300 mr-2" />
                        <Text className="text-gray-500 text-[15px] font-medium tracking-tight">
                          Statuss
                        </Text>
                      </View>
                      <Text className="text-black text-[28px] font-bold tracking-tight mt-2">
                        Gatavs darbam
                      </Text>
                    </View>
                    <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
                      <Inbox size={24} color="#000000" strokeWidth={2} />
                    </View>
                  </View>
                  <Text className="text-gray-500 text-[15px] font-medium mt-6">
                    Pagaidām nav jaunu pieprasījumu
                  </Text>
                </>
              )
            ) : (
              <View className="flex-1" />
            )}
          </TouchableOpacity>
        </View>

        {/* QUICK ACTIONS GRID */}
        <View className="gap-3">
          {/* Row 1 */}
          <View className="flex-row gap-3">
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
                  className="flex-1 bg-white rounded-3xl p-4 h-[116px] justify-between shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
                    <Icon size={20} color="#000000" strokeWidth={2} />
                  </View>
                  <Text className="text-[16px] font-semibold text-black ml-1 tracking-tight">
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Row 2 */}
          <View className="flex-row gap-3">
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
                  className="flex-1 bg-white rounded-3xl p-4 h-[116px] justify-between shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
                    <Icon size={20} color="#000000" strokeWidth={2} />
                  </View>
                  <Text className="text-[16px] font-semibold text-black ml-1 tracking-tight">
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
