import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter } from 'expo-router';
import { useToast } from '@/components/ui/Toast';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { t } from '@/lib/translations';
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
import { EmptyState } from '@/components/ui/EmptyState';
import type { ApiNotification } from '@/lib/api';

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;
interface TypeInfo {
  Icon: LucideIcon;
  bg: string;
  iconColor: string;
}

const TYPE_INFO: Record<string, TypeInfo> = {
  ORDER_PLACED: { Icon: Package, bg: '#f3f4f6', iconColor: '#374151' },
  ORDER_CONFIRMED: { Icon: CheckCircle2, bg: '#f0fdf4', iconColor: '#111827' },
  ORDER_SHIPPED: { Icon: Truck, bg: '#f3f4f6', iconColor: '#374151' },
  ORDER_DELIVERED: { Icon: CheckCircle2, bg: '#dcfce7', iconColor: '#15803d' },
  ORDER_CANCELLED: { Icon: XCircle, bg: '#fef2f2', iconColor: '#111827' },
  JOB_AVAILABLE: { Icon: Briefcase, bg: '#f3f4f6', iconColor: '#374151' },
  JOB_ACCEPTED: { Icon: CheckCircle2, bg: '#f0fdf4', iconColor: '#059669' },
  JOB_COMPLETED: { Icon: Award, bg: '#f3f4f6', iconColor: '#6b7280' },
  PAYMENT_RECEIVED: { Icon: Banknote, bg: '#f0fdf4', iconColor: '#111827' },
  INVOICE_ISSUED: { Icon: FileText, bg: '#f9fafb', iconColor: '#6b7280' },
  SYSTEM: { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' },
};
const DEFAULT_TYPE_INFO: TypeInfo = { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' };

function deepLinkPath(notif: ApiNotification): string | null {
  const d = (notif.data ?? {}) as Record<string, string>;
  switch (notif.type) {
    case 'JOB_AVAILABLE':
    case 'JOB_ACCEPTED':
    case 'JOB_COMPLETED':
    case 'TRANSPORT_ASSIGNED':
      return d.jobId ? `/(driver)/jobs` : '/(driver)/jobs';
    case 'ORDER_PLACED':
    case 'ORDER_CONFIRMED':
    case 'ORDER_SHIPPED':
    case 'ORDER_DELIVERED':
    case 'ORDER_CANCELLED':
      return d.orderId ? `/(buyer)/orders` : '/(buyer)/orders';
    case 'PAYMENT_RECEIVED':
      return '/(driver)/earnings';
    case 'INVOICE_ISSUED':
      return '/(seller)/orders';
    default:
      return null;
  }
}

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
  index = 0,
}: {
  notif: ApiNotification;
  onMarkRead: (id: string) => void;
  index?: number;
}) {
  const { Icon, bg, iconColor } = TYPE_INFO[notif.type] ?? DEFAULT_TYPE_INFO;
  const router = useRouter();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: index * 55,
      useNativeDriver: true,
      tension: 72,
      friction: 11,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const handlePress = () => {
    if (!notif.isRead) onMarkRead(notif.id);
    const path = deepLinkPath(notif);
    if (path) router.push(path as Parameters<typeof router.push>[0]);
  };

  const pressScale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }, { scale: pressScale }] }}>
      <TouchableOpacity
        style={[s.card, !notif.isRead && s.cardUnread]}
        onPress={handlePress}
        onPressIn={() =>
          Animated.spring(pressScale, {
            toValue: 0.97,
            useNativeDriver: true,
            tension: 300,
            friction: 8,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(pressScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 8,
          }).start()
        }
        activeOpacity={1}
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
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
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
        setNotifs(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Neizdevās ielādēt paziņojumus');
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
      toast.error(err instanceof Error ? err.message : 'Neizdevās atzīmēt kā lasītu');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <ScreenContainer standalone>
      <ScreenHeader
        title={unreadCount > 0 ? `${t.nav.notifications} (${unreadCount})` : t.nav.notifications}
        rightSlot={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead} disabled={markingAll} hitSlop={12}>
              {markingAll ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <CheckCheck size={20} color="#111827" />
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <SkeletonCard count={5} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#111827"
            />
          }
        >
          {notifs.length === 0 ? (
            <EmptyState
              icon={<BellOff size={32} color="#9ca3af" />}
              title="Nav paziņojumu"
              subtitle="Šeit parādīsies jūsu paziņojumi"
            />
          ) : (
            notifs.map((n, i) => <NotifCard key={n.id} notif={n} index={i} onMarkRead={markRead} />)
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#111827' },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
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
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#111827' },
  cardMsg: { fontSize: 13, color: '#374151', lineHeight: 18 },
  cardTime: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});
