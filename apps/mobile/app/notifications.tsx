import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useRouter, useFocusEffect } from 'expo-router';
import { useToast } from '@/components/ui/Toast';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
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

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
interface TypeInfo {
  Icon: LucideIcon;
  bg: string;
  iconColor: string;
}

const TYPE_INFO: Record<string, TypeInfo> = {
  // Backend types
  ORDER_CREATED: { Icon: Package, bg: '#f3f4f6', iconColor: '#374151' },
  ORDER_CONFIRMED: { Icon: CheckCircle2, bg: '#f0fdf4', iconColor: '#111827' },
  ORDER_DELIVERED: { Icon: CheckCircle2, bg: '#dcfce7', iconColor: '#15803d' },
  TRANSPORT_ASSIGNED: { Icon: Truck, bg: '#eff6ff', iconColor: '#2563eb' },
  TRANSPORT_STARTED: { Icon: Truck, bg: '#f3f4f6', iconColor: '#374151' },
  TRANSPORT_COMPLETED: { Icon: Award, bg: '#f0fdf4', iconColor: '#059669' },
  PAYMENT_RECEIVED: { Icon: Banknote, bg: '#f0fdf4', iconColor: '#111827' },
  SYSTEM_ALERT: { Icon: Bell, bg: '#fefce8', iconColor: '#ca8a04' },
  // Legacy / future
  ORDER_PLACED: { Icon: Package, bg: '#f3f4f6', iconColor: '#374151' },
  ORDER_SHIPPED: { Icon: Truck, bg: '#f3f4f6', iconColor: '#374151' },
  ORDER_CANCELLED: { Icon: XCircle, bg: '#fef2f2', iconColor: '#111827' },
  JOB_AVAILABLE: { Icon: Briefcase, bg: '#f3f4f6', iconColor: '#374151' },
  JOB_ACCEPTED: { Icon: CheckCircle2, bg: '#f0fdf4', iconColor: '#059669' },
  JOB_COMPLETED: { Icon: Award, bg: '#f3f4f6', iconColor: '#6b7280' },
  INVOICE_ISSUED: { Icon: FileText, bg: '#f9fafb', iconColor: '#6b7280' },
  SYSTEM: { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' },
};
const DEFAULT_TYPE_INFO: TypeInfo = { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' };

function deepLinkPath(notif: ApiNotification): string | null {
  const d = (notif.data ?? {}) as Record<string, string>;
  switch (notif.type) {
    // ── Buyer: transport / disposal job notifications ──────────
    case 'TRANSPORT_ASSIGNED':
    case 'ORDER_DELIVERED':
    case 'SYSTEM_ALERT':
      return d.jobId ? `/(buyer)/transport-job/${d.jobId}` : '/(buyer)/orders';
    // ── Buyer: material / skip-hire order notifications ────────
    case 'ORDER_CREATED':
    case 'ORDER_CONFIRMED':
    case 'ORDER_PLACED':
    case 'ORDER_SHIPPED':
    case 'ORDER_CANCELLED':
      return '/(buyer)/orders';
    // ── Driver ────────────────────────────────────────────────
    case 'JOB_AVAILABLE':
      return '/(driver)/jobs';
    case 'JOB_ACCEPTED':
    case 'TRANSPORT_STARTED':
      return '/(driver)/active';
    case 'JOB_COMPLETED':
    case 'TRANSPORT_COMPLETED':
      return '/(driver)/earnings';
    // ── Finance / docs ─────────────────────────────────────────
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
}: {
  notif: ApiNotification;
  onMarkRead: (id: string) => void;
}) {
  const { Icon, bg, iconColor } = TYPE_INFO[notif.type] ?? DEFAULT_TYPE_INFO;
  const router = useRouter();

  const handlePress = () => {
    if (!notif.isRead) onMarkRead(notif.id);
    const path = deepLinkPath(notif);
    if (path) router.push(path as Parameters<typeof router.push>[0]);
  };

  return (
    <View className="border-b border-gray-100">
      <TouchableOpacity
        className={`flex-row items-start gap-4 p-5 bg-white ${
          !notif.isRead ? 'bg-blue-50/50' : ''
        }`}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View className="relative">
          <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center">
            <Icon size={22} color="#000000" strokeWidth={2} />
          </View>
          {!notif.isRead && (
            <View className="absolute top-0 right-0 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
          )}
        </View>
        <View className="flex-1 pt-1 space-y-1">
          <Text className="text-[16px] font-semibold text-black tracking-tight" numberOfLines={1}>
            {notif.title}
          </Text>
          <Text className="text-[15px] text-gray-500 leading-[22px]" numberOfLines={2}>
            {notif.message}
          </Text>
          <Text className="text-[13px] text-gray-400 mt-1 font-medium">
            {timeAgo(notif.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
    <ScreenContainer standalone noAnimation bg="#ffffff">
      <ScreenHeader
        title={unreadCount > 0 ? `Paziņojumi (${unreadCount})` : 'Paziņojumi'}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              onPress={markAllRead}
              disabled={markingAll}
              className="h-10 px-4 rounded-full bg-gray-100 items-center justify-center"
            >
              {markingAll ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text className="text-[14px] font-semibold text-black">Atzīmēt</Text>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View className="p-4 gap-2">
          <SkeletonCard count={5} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#000000"
            />
          }
        >
          {notifs.length === 0 ? (
            <View className="flex-1 min-h-[400px] items-center justify-center">
              <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
                <Bell size={28} color="#9ca3af" strokeWidth={2} />
              </View>
              <Text className="text-[20px] font-bold text-black mb-2">Nav paziņojumu</Text>
              <Text className="text-[16px] text-gray-500">Šeit parādīsies jūsu paziņojumi</Text>
            </View>
          ) : (
            <View className="bg-white">
              {notifs.map((n) => (
                <NotifCard key={n.id} notif={n} onMarkRead={markRead} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
