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
  MessageSquare,
  Receipt,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { useMode, type AppMode } from '@/lib/mode-context';
import { api } from '@/lib/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { ApiNotification } from '@/lib/api';
import { haptics } from '@/lib/haptics';

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
  ORDER_CANCELLED: { Icon: XCircle, bg: '#fef2f2', iconColor: '#b91c1c' },
  TRANSPORT_ASSIGNED: { Icon: Truck, bg: '#eff6ff', iconColor: '#2563eb' },
  TRANSPORT_STARTED: { Icon: Truck, bg: '#f3f4f6', iconColor: '#374151' },
  TRANSPORT_COMPLETED: { Icon: Award, bg: '#f0fdf4', iconColor: '#059669' },
  PAYMENT_RECEIVED: { Icon: Banknote, bg: '#f0fdf4', iconColor: '#111827' },
  QUOTE_RECEIVED: { Icon: MessageSquare, bg: '#f0f9ff', iconColor: '#0369a1' },
  QUOTE_ACCEPTED: { Icon: CheckCircle2, bg: '#dcfce7', iconColor: '#15803d' },
  SYSTEM_ALERT: { Icon: Bell, bg: '#fefce8', iconColor: '#ca8a04' },
  DOCUMENT_EXPIRING_SOON: { Icon: FileText, bg: '#fefce8', iconColor: '#ca8a04' },
  WEIGHING_SLIP: { Icon: Receipt, bg: '#f9fafb', iconColor: '#374151' },
  // Legacy / future
  ORDER_PLACED: { Icon: Package, bg: '#f3f4f6', iconColor: '#374151' },
  ORDER_SHIPPED: { Icon: Truck, bg: '#f3f4f6', iconColor: '#374151' },
  JOB_AVAILABLE: { Icon: Briefcase, bg: '#f3f4f6', iconColor: '#374151' },
  JOB_ACCEPTED: { Icon: CheckCircle2, bg: '#f0fdf4', iconColor: '#059669' },
  JOB_COMPLETED: { Icon: Award, bg: '#f3f4f6', iconColor: '#6b7280' },
  INVOICE_ISSUED: { Icon: Receipt, bg: '#f9fafb', iconColor: '#6b7280' },
  QUOTE_SUBMITTED: { Icon: MessageSquare, bg: '#f0f9ff', iconColor: '#0369a1' },
  QUOTE_REQUEST_RECEIVED: { Icon: MessageSquare, bg: '#fef9c3', iconColor: '#a16207' },
  ORDER_REJECTED: { Icon: XCircle, bg: '#fef2f2', iconColor: '#b91c1c' },
  SYSTEM: { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' },
};
const DEFAULT_TYPE_INFO: TypeInfo = { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280' };

// ── Notification → role mapping ──────────────────────────────────────────────
// Types exclusively targeted at each role. Used for both list filtering AND
// deciding which mode's route prefix to use when navigating.
const BUYER_TYPES = new Set([
  'TRANSPORT_ASSIGNED', // driver assigned to buyer's transport order
  'ORDER_CONFIRMED',
  'ORDER_DELIVERED',
  'ORDER_PLACED',
  'ORDER_SHIPPED',
  'ORDER_REJECTED',
  'QUOTE_RECEIVED',
  'QUOTE_SUBMITTED',
  'INVOICE_ISSUED',
  'WEIGHING_SLIP',
]);
const SELLER_TYPES = new Set([
  'ORDER_CREATED', // new order received by seller
  'QUOTE_REQUEST_RECEIVED', // seller received an RFQ
  'QUOTE_ACCEPTED', // seller's quote accepted
]);
const CARRIER_TYPES = new Set([
  'JOB_AVAILABLE',
  'JOB_ACCEPTED',
  'JOB_COMPLETED',
  'TRANSPORT_STARTED',
  'TRANSPORT_COMPLETED',
  'DOCUMENT_EXPIRING_SOON',
]);
// PAYMENT_RECEIVED, SYSTEM_ALERT, SYSTEM → universal (shown in all modes)
// ORDER_CANCELLED → split by data: jobId → CARRIER, orderId → BUYER, neither → all

function notifBelongsToMode(notif: ApiNotification, mode: AppMode): boolean {
  if (BUYER_TYPES.has(notif.type)) return mode === 'BUYER';
  if (SELLER_TYPES.has(notif.type)) return mode === 'SUPPLIER';
  if (CARRIER_TYPES.has(notif.type)) return mode === 'CARRIER';
  if (notif.type === 'ORDER_CANCELLED') {
    const d = (notif.data ?? {}) as Record<string, string>;
    if (d.jobId && !d.orderId) return mode === 'CARRIER';
    if (d.orderId && !d.jobId) return mode === 'BUYER';
    return true; // ambiguous — show everywhere
  }
  return true; // PAYMENT_RECEIVED, SYSTEM_ALERT, SYSTEM
}

function deepLinkPath(notif: ApiNotification, mode: AppMode): string | null {
  const d = (notif.data ?? {}) as Record<string, string>;
  switch (notif.type) {
    // ── Buyer ─────────────────────────────────────────────────
    case 'TRANSPORT_ASSIGNED':
      return d.jobId ? `/(buyer)/transport-job/${d.jobId}` : '/(buyer)/orders';
    case 'ORDER_DELIVERED':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/orders';
    case 'ORDER_CONFIRMED':
    case 'ORDER_PLACED':
    case 'ORDER_SHIPPED':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/orders';
    case 'ORDER_REJECTED':
    case 'INVOICE_ISSUED':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/invoices';
    case 'WEIGHING_SLIP':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/documents';
    case 'QUOTE_SUBMITTED':
      return d.quoteRequestId ? `/(buyer)/rfq/${d.quoteRequestId}` : '/(buyer)/orders';
    case 'QUOTE_RECEIVED':
      return d.requestId ? `/(buyer)/rfq/${d.requestId}` : '/(buyer)/orders';
    // ── Seller ────────────────────────────────────────────────
    case 'ORDER_CREATED':
      return d.orderId ? `/(seller)/order/${d.orderId}` : '/(seller)/incoming';
    case 'QUOTE_REQUEST_RECEIVED':
    case 'QUOTE_ACCEPTED':
      return '/(seller)/quotes';
    // ── Driver ────────────────────────────────────────────────
    case 'JOB_AVAILABLE':
      return '/(driver)/jobs';
    case 'JOB_ACCEPTED':
    case 'TRANSPORT_STARTED':
      return '/(driver)/active';
    case 'JOB_COMPLETED':
    case 'TRANSPORT_COMPLETED':
      return '/(driver)/earnings';
    case 'DOCUMENT_EXPIRING_SOON':
      return '/(driver)/documents';
    // ── Cross-role (route by current mode) ────────────────────
    case 'ORDER_CANCELLED':
      if (mode === 'CARRIER' && d.jobId) return '/(driver)/jobs';
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/orders';
    case 'PAYMENT_RECEIVED':
      if (mode === 'CARRIER') return '/(driver)/earnings';
      if (mode === 'SUPPLIER') return '/(seller)/earnings';
      return '/(buyer)/invoices';
    case 'SYSTEM_ALERT':
      if (mode === 'CARRIER') return d.jobId ? '/(driver)/active' : '/(driver)/home';
      if (mode === 'SUPPLIER') return '/(seller)/home';
      return d.jobId ? `/(buyer)/transport-job/${d.jobId}` : '/(buyer)/home';
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
  const { mode } = useMode();

  const handlePress = () => {
    haptics.light();
    if (!notif.isRead) onMarkRead(notif.id);
    const path = deepLinkPath(notif, mode);
    if (path) router.push(path as Parameters<typeof router.push>[0]);
  };

  return (
    <TouchableOpacity
      className={`flex-row items-start px-5 py-4 ${!notif.isRead ? 'bg-blue-50/40' : 'bg-white'}`}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View
        style={{ backgroundColor: bg }}
        className="w-12 h-12 rounded-full items-center justify-center mr-4"
      >
        <Icon size={22} color={iconColor} strokeWidth={2} />
      </View>
      <View className="flex-1 pt-1">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="flex-1 text-base font-bold text-gray-900 mr-2" numberOfLines={1}>
            {notif.title}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Text className="text-xs font-medium text-gray-400 mr-1.5">
              {timeAgo(notif.createdAt)}
            </Text>
            {!notif.isRead && <View className="w-2 h-2 rounded-full bg-blue-600" />}
          </View>
        </View>
        <Text className="text-sm text-gray-500 leading-5" numberOfLines={2}>
          {notif.message}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const { mode } = useMode();
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
    haptics.light();
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

  const visibleNotifs = notifs.filter((n) => notifBelongsToMode(n, mode));
  const unreadCount = visibleNotifs.filter((n) => !n.isRead).length;

  return (
    <ScreenContainer standalone bg="#ffffff" noAnimation>
      <ScreenHeader
        title={unreadCount > 0 ? `Paziņojumi (${unreadCount})` : 'Paziņojumi'}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              onPress={markAllRead}
              disabled={markingAll}
              className="h-10 px-4 rounded-full bg-gray-100 items-center justify-center"
              activeOpacity={0.7}
            >
              {markingAll ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text className="text-sm font-bold text-gray-900">Atzīmēt</Text>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View className="px-4 py-4 gap-4">
          <SkeletonCard count={5} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#111827"
            />
          }
        >
          {visibleNotifs.length === 0 ? (
            <View className="flex-1 items-center justify-center min-h-[400px]">
              <View className="w-16 h-16 rounded-full bg-gray-50 items-center justify-center mb-4 border border-gray-100">
                <Bell size={28} color="#d1d5db" strokeWidth={1.5} />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2">Nav jaunu paziņojumu</Text>
              <Text className="text-base text-gray-500 font-medium">
                Šeit parādīsies jūsu paziņojumi
              </Text>
            </View>
          ) : (
            <View className="bg-white">
              {visibleNotifs.map((n) => (
                <NotifCard key={n.id} notif={n} onMarkRead={markRead} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
