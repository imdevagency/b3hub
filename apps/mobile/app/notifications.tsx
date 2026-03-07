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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, BellOff, CheckCheck } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { ApiNotification } from '@/lib/api';

const TYPE_ICON: Record<string, string> = {
  ORDER_PLACED: '📦',
  ORDER_CONFIRMED: '✅',
  ORDER_SHIPPED: '🚚',
  ORDER_DELIVERED: '🏁',
  ORDER_CANCELLED: '❌',
  JOB_AVAILABLE: '💼',
  JOB_ACCEPTED: '🤝',
  JOB_COMPLETED: '🏆',
  PAYMENT_RECEIVED: '💶',
  INVOICE_ISSUED: '🧾',
  SYSTEM: '🔔',
};

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
  return (
    <TouchableOpacity
      style={[s.card, !notif.isRead && s.cardUnread]}
      onPress={() => !notif.isRead && onMarkRead(notif.id)}
      activeOpacity={0.88}
    >
      <View style={s.iconWrap}>
        <Text style={s.icon}>{TYPE_ICON[notif.type] ?? '🔔'}</Text>
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
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Paziņojumi {unreadCount > 0 ? `(${unreadCount})` : ''}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll} hitSlop={12}>
            {markingAll ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : (
              <CheckCheck size={20} color="#3b82f6" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#3b82f6" />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#3b82f6"
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
    </SafeAreaView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  iconWrap: { position: 'relative' },
  icon: { fontSize: 28 },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    borderWidth: 1.5,
    borderColor: '#eff6ff',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardMsg: { fontSize: 13, color: '#374151', lineHeight: 18 },
  cardTime: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9ca3af' },
});
