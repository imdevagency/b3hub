import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  BellOff,
  CheckCheck,
  Package,
  CheckCircle2,
  Truck,
  XCircle,
  Briefcase,
  Award,
  Banknote,
  FileText,
  Bell,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { ApiNotification } from '@/lib/api';

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;
interface TypeInfo {
  Icon: LucideIcon;
  bg: string;
  iconColor: string;
}

const TYPE_INFO: Record<string, TypeInfo> = {
  ORDER_PLACED: { Icon: Package, bg: '#fff7ed', iconColor: '#c2410c' },
  ORDER_CONFIRMED: { Icon: CheckCircle2, bg: '#f0fdf4', iconColor: '#16a34a' },
  ORDER_SHIPPED: { Icon: Truck, bg: '#eff6ff', iconColor: '#1d4ed8' },
  ORDER_DELIVERED: { Icon: CheckCircle2, bg: '#dcfce7', iconColor: '#15803d' },
  ORDER_CANCELLED: { Icon: XCircle, bg: '#fef2f2', iconColor: '#dc2626' },
  JOB_AVAILABLE: { Icon: Briefcase, bg: '#f5f3ff', iconColor: '#6d28d9' },
  JOB_ACCEPTED: { Icon: CheckCircle2, bg: '#f0fdf4', iconColor: '#059669' },
  JOB_COMPLETED: { Icon: Award, bg: '#fffbeb', iconColor: '#d97706' },
  PAYMENT_RECEIVED: { Icon: Banknote, bg: '#f0fdf4', iconColor: '#16a34a' },
  INVOICE_ISSUED: { Icon: FileText, bg: '#f8fafc', iconColor: '#475569' },
  SYSTEM: { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' },
};
const DEFAULT_TYPE_INFO: TypeInfo = { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' };

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Tikko';
  if (diff < 3600) return `${Math.floor(diff / 60)} min. atpakaļ`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} st. atpakaļ`;
  return new Date(iso).toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' });
}

function NotifCard({
  notif,
  onMarkRead,
}: {
  notif: ApiNotification;
  onMarkRead: (id: string) => void;
}) {
  const { Icon, bg, iconColor } = TYPE_INFO[notif.type] ?? DEFAULT_TYPE_INFO;
  return (
    <TouchableOpacity
      style={[s.card, !notif.isRead && s.cardUnread]}
      onPress={() => !notif.isRead && onMarkRead(notif.id)}
      activeOpacity={0.88}
    >
      <View style={s.iconWrap}>
        <View style={[s.iconCircle, { backgroundColor: bg }]}>
          <Icon size={20} color={iconColor} />
        </View>
        {!notif.isRead && <View style={s.unreadDot} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={s.cardMsg} numberOfLines={2}>
          {notif.message}
        </Text>
        <Text style={s.cardTime}>{timeAgo(notif.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) return;
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        const data = await api.notifications.getAll(token);
        setNotifs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    if (!token) return;
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await api.notifications.markRead(id, token);
    } catch {
      /* optimistic */
    }
  };

  const markAllRead = async () => {
    if (!token) return;
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead(token);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <ScreenContainer standalone>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Paziņojumi {unreadCount > 0 ? `(${unreadCount})` : ''}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll} hitSlop={12}>
            {markingAll ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <CheckCheck size={20} color="#dc2626" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {loading ? (
        <SkeletonCard count={5} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#dc2626"
            />
          }
        >
          {notifs.length === 0 ? (
            <View style={s.emptyWrap}>
              <BellOff size={48} color="#9ca3af" />
              <Text style={s.emptyTitle}>Nav paziņojumu</Text>
              <Text style={s.emptyDesc}>Šeit parādīsies jūsu paziņojumi</Text>
            </View>
          ) : (
            notifs.map((n) => <NotifCard key={n.id} notif={n} onMarkRead={markRead} />)
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: '#fef9f9',
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  iconWrap: { position: 'relative' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardMsg: { fontSize: 13, color: '#374151', lineHeight: 18 },
  cardTime: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af' },
});
