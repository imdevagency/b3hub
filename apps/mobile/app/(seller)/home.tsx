import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  Inbox,
  LayoutGrid,
  FileText,
  Wallet,
  Bell,
  ChevronRight,
  ArrowRight,
} from 'lucide-react-native';
import { haptics } from '@/lib/haptics';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Labrīt';
  if (h < 17) return 'Labdien';
  return 'Labvakar';
}

const QUICK_ACTIONS = [
  {
    id: 'incoming',
    icon: Inbox,
    label: 'Ienākošie',
    sub: 'Jauni pasūtījumi',
    route: '/(seller)/incoming',
  },
  {
    id: 'catalog',
    icon: LayoutGrid,
    label: 'Katalogs',
    sub: 'Pārvaldīt materiālus',
    route: '/(seller)/catalog',
  },
  {
    id: 'quotes',
    icon: FileText,
    label: 'Pieprasījumi',
    sub: 'Cenu pieprasījumi',
    route: '/(seller)/quotes',
  },
  {
    id: 'earnings',
    icon: Wallet,
    label: 'Ienākumi',
    sub: 'Pārdošanas statistika',
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
      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user?.firstName?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.greetingLabel}>{greeting()},</Text>
          <Text style={s.greetingName} numberOfLines={1}>
            {user?.firstName ?? 'Pārdevējs'}
          </Text>
        </View>
        <TouchableOpacity
          style={s.bellBtn}
          onPress={() => {
            haptics.light();
            router.push('/notifications' as any);
          }}
          activeOpacity={0.75}
        >
          <Bell size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: TAB_H + insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending orders alert */}
        {pendingCount != null && pendingCount > 0 && (
          <TouchableOpacity
            style={s.alertCard}
            onPress={() => {
              haptics.light();
              router.push('/(seller)/incoming' as any);
            }}
            activeOpacity={0.85}
          >
            <View style={s.alertBadge}>
              <Text style={s.alertBadgeNum}>{pendingCount}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>Jauni pasūtījumi gaida</Text>
              <Text style={s.alertSub}>Apstipriniet vai noraidiet</Text>
            </View>
            <ChevronRight size={18} color="#92400e" />
          </TouchableOpacity>
        )}

        {/* Primary CTA */}
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => {
            haptics.medium();
            router.push('/(seller)/incoming' as any);
          }}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>Ienākošie pasūtījumi →</Text>
        </TouchableOpacity>

        {/* Section label */}
        <SectionLabel label="Ātrās darbības" />

        {/* 2×2 quick action grid */}
        <View style={s.grid}>
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <View key={a.id} style={{ width: '48%' }}>
                <TouchableOpacity
                  style={s.gridTile}
                  onPress={() => {
                    haptics.light();
                    router.push(a.route as any);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={s.gridIcon}>
                    <Icon size={24} color="#111827" />
                  </View>
                  <Text style={s.gridLabel}>{a.label}</Text>
                  <Text style={s.gridSub} numberOfLines={1}>
                    {a.sub}
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <ArrowRight size={14} color="#9ca3af" />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#f2f2f7',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  greetingLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    lineHeight: 24,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  scroll: { paddingHorizontal: 16, gap: 12 },

  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fefce8',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  alertBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeNum: { color: '#fff', fontWeight: '800', fontSize: 16, lineHeight: 20 },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#92400e',
    lineHeight: 20,
  },
  alertSub: { fontSize: 12, color: '#a16207', marginTop: 2, lineHeight: 17 },

  // Primary CTA button
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
  },

  // 2×2 grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridTile: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  gridIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    lineHeight: 20,
  },
  gridSub: { fontSize: 12, color: '#9ca3af', lineHeight: 17, marginTop: 2 },
});
