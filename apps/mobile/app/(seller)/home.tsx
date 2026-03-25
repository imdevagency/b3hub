import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  Inbox,
  LayoutGrid,
  FileText,
  Wallet,
  Bell,
  ChevronRight,
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
    <ScreenContainer topInset={0} bg="#ffffff">
      {/* MINIMAL TOP BAR */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
            {user?.firstName?.[0]?.toUpperCase() ?? 'S'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            router.push('/notifications' as any);
          }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}
        >
          <Bell size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: TAB_H + insets.bottom + 32, paddingHorizontal: 20, paddingTop: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO SECTION / PRIMARY ACTION */}
        <View style={{ alignItems: 'center', marginBottom: 48, minHeight: 200, justifyContent: 'center' }}>
          {pendingCount !== null ? (
            pendingCount > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.medium();
                  router.push('/(seller)/incoming' as any);
                }}
                activeOpacity={0.8}
                style={{ alignItems: 'center', width: '100%' }}
              >
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Text style={{ color: '#ffffff', fontSize: 36, fontWeight: '800' }}>{pendingCount}</Text>
                </View>
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                  Jauni pasūtījumi
                </Text>
                <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
                  Pārskatiet gaidošos pasūtījumus
                </Text>
                <Button 
                  onPress={() => {
                    haptics.medium();
                    router.push('/(seller)/incoming' as any);
                  }}
                  className="rounded-3xl w-full"
                >
                  Skatīt sarakstu
                </Button>
              </TouchableOpacity>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Inbox size={40} color="#9ca3af" />
                </View>
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                  Gatavs darbam
                </Text>
                <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
                  Pagaidām jaunu pasūtījumu nav
                </Text>
              </View>
            )
          ) : (
             <View style={{ alignItems: 'center' }}>
               <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }} />
             </View>
          )}
        </View>

        {/* LIST / MENU */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Ātrās darbības</Text>

          {[
            { id: 'incoming', icon: Inbox, label: 'Visi ienākošie', route: '/(seller)/incoming' },
            ...QUICK_ACTIONS
          ].map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.id}
                onPress={() => {
                  haptics.light();
                  router.push(action.route as any);
                }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <Icon size={20} color="#111827" />
                </View>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' }}>
                  {action.label}
                </Text>
                <ChevronRight size={20} color="#d1d5db" />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
