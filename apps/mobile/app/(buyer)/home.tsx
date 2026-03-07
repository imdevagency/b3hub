import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import type React from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { t } from '@/lib/translations';
import {
  ShoppingCart,
  Trash2,
  ClipboardList,
  User,
  Package,
  Inbox,
  PlusCircle,
  BarChart2,
  Map,
  CheckCircle,
  Wallet,
} from 'lucide-react-native';

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;
type QuickAction = { icon: LucideIcon; label: string; route?: string };

const ROLE_ACTIONS: Record<string, QuickAction[]> = {
  BUYER: [
    { icon: ShoppingCart, label: 'Pirkt materiālus', route: '/(buyer)/order-request' },
    { icon: Trash2, label: 'Nomāt konteineru', route: '/order' },
    { icon: ClipboardList, label: 'Pasūtījumi', route: '/(buyer)/orders' },
    { icon: User, label: 'Profils', route: '/(buyer)/profile' },
  ],
  SUPPLIER: [
    { icon: Package, label: 'Mani produkti' },
    { icon: Inbox, label: 'Saņemtie pasūtījumi' },
    { icon: PlusCircle, label: 'Pievienot preci' },
    { icon: BarChart2, label: 'Statistika' },
  ],
  CARRIER: [
    { icon: ClipboardList, label: 'Aktīvie darbi' },
    { icon: Map, label: 'Maršruts' },
    { icon: CheckCircle, label: 'Pabeigt piegādi' },
    { icon: Wallet, label: 'Ieņēmumi' },
  ],
};

const USER_TYPE_LABEL: Record<string, string> = {
  BUYER: 'Pasūtītājs',
  SUPPLIER: 'Pārdevējs',
  CARRIER: 'Pārvadātājs',
};

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{
    activeOrders: number;
    myOrders: number;
    documents: number;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    api.orders
      .stats(token)
      .then((data: any) => {
        const b = data?.buyer ?? {};
        setStats({
          activeOrders: b.activeOrders ?? 0,
          myOrders: b.myOrders ?? 0,
          documents: b.documents ?? 0,
        });
      })
      .catch(() => {});
  }, [token]);

  const role = user?.userType ?? 'BUYER';
  const actions = ROLE_ACTIONS[role] ?? ROLE_ACTIONS.BUYER;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerGreeting}>{t.home.greeting}</Text>
          <Text style={s.headerName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <View style={s.typeBadge}>
            <Text style={s.typeBadgeText}>{USER_TYPE_LABEL[role] ?? role}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* Stats card */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>{t.home.overview}</Text>
            <View style={s.statsRow}>
              {[
                { label: t.home.stats.orders, value: stats ? String(stats.activeOrders) : '—' },
                { label: 'Konteineri', value: stats ? String(stats.myOrders) : '—' },
                { label: t.home.stats.pending, value: stats ? String(stats.documents) : '—' },
              ].map((stat) => (
                <View key={stat.label} style={s.statItem}>
                  <Text style={s.statValue}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Quick actions */}
          <Text style={s.quickTitle}>{t.home.quickActions}</Text>
          <View style={s.actionGrid}>
            {actions.map((action, idx) => {
              const isPrimary = role === 'BUYER' ? idx < 2 : idx === 0;
              const IconComp = action.icon;
              return (
                <TouchableOpacity
                  key={action.label}
                  style={[s.actionBtn, isPrimary ? s.actionBtnPrimary : null]}
                  activeOpacity={0.7}
                  onPress={() => action.route && router.push(action.route as any)}
                >
                  <View style={[s.iconWrap, isPrimary ? s.iconWrapPrimary : null]}>
                    <IconComp size={22} color={isPrimary ? '#dc2626' : '#6b7280'} />
                  </View>
                  <Text style={[s.actionLabel, isPrimary ? s.actionLabelPrimary : null]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerGreeting: { color: '#fca5a5', fontSize: 14 },
  headerName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  typeBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  body: { paddingHorizontal: 20, marginTop: -20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  quickTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  actionBtnPrimary: {
    backgroundColor: '#fff7f7',
    borderColor: '#fecaca',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPrimary: {
    backgroundColor: '#fee2e2',
  },
  actionLabel: { fontSize: 13, fontWeight: '500', color: '#374151', textAlign: 'center' },
  actionLabelPrimary: { color: '#dc2626', fontWeight: '600' },
});
