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

function deepLinkPath(
  notif: ApiNotification,
  canSell = false,
  canTransport = false,
): string | null {
  const d = (notif.data ?? {}) as Record<string, string>;
  switch (notif.type) {
    // ── Buyer: transport / disposal job notifications ──────────
    case 'TRANSPORT_ASSIGNED':
    case 'SYSTEM_ALERT':
      return d.jobId ? `/(buyer)/transport-job/${d.jobId}` : '/(buyer)/orders';
    // ORDER_DELIVERED is sent to buyers with orderId (not jobId) — link directly to the order
    case 'ORDER_DELIVERED':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/orders';
    // ── Seller: new order notification ────────────────────────
    // ORDER_CREATED is sent exclusively to sellers; route to seller order detail
    case 'ORDER_CREATED':
      return d.orderId
        ? canSell
          ? `/(seller)/order/${d.orderId}`
          : `/(buyer)/order/${d.orderId}`
        : canSell
          ? '/(seller)/incoming'
          : '/(buyer)/orders';
    // ── Buyer: material / skip-hire order notifications ────────
    case 'ORDER_CONFIRMED':
    case 'ORDER_PLACED':
    case 'ORDER_SHIPPED':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/orders';
    // ORDER_CANCELLED is sent to buyers AND to drivers whose job was cancelled
    case 'ORDER_CANCELLED':
      if (canTransport && !canSell && d.jobId) return '/(driver)/jobs';
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/orders';
    // ── Driver ────────────────────────────────────────────────
    case 'JOB_AVAILABLE':
      return '/(driver)/jobs';
    case 'JOB_ACCEPTED':
    case 'TRANSPORT_STARTED':
      return '/(driver)/active';
    case 'JOB_COMPLETED':
    case 'TRANSPORT_COMPLETED':
      return '/(driver)/earnings';
    // ── Quote requests ──────────────────────────────────────────
    case 'QUOTE_SUBMITTED':
      return d.quoteRequestId ? `/(buyer)/rfq/${d.quoteRequestId}` : '/(buyer)/orders';
    case 'QUOTE_REQUEST_RECEIVED':
      return '/(seller)/quotes'; // ── Quote responses ─────────────────────────────────────────
    case 'QUOTE_RECEIVED':
      return d.requestId ? `/(buyer)/rfq/${d.requestId}` : '/(buyer)/orders';
    case 'QUOTE_ACCEPTED':
      return '/(seller)/quotes';
    // ── Documents ───────────────────────────────────────────────
    case 'DOCUMENT_EXPIRING_SOON':
      return '/(driver)/documents';
    case 'WEIGHING_SLIP':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/documents'; // ── Rejected / cancelled ──────────────────────────────────────
    case 'ORDER_REJECTED':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/orders';
    // ── Finance / docs ─────────────────────────────────────────
    case 'PAYMENT_RECEIVED':
      return canSell ? '/(seller)/earnings' : '/(driver)/earnings';
    case 'INVOICE_ISSUED':
      return d.orderId ? `/(buyer)/order/${d.orderId}` : '/(buyer)/invoices';
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
  const { user } = useAuth();

  const handlePress = () => {
    haptics.light();
    if (!notif.isRead) onMarkRead(notif.id);
    const path = deepLinkPath(notif, user?.canSell ?? false, user?.canTransport ?? false);
    if (path) router.push(path as Parameters<typeof router.push>[0]);
  };

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
      <TouchableOpacity
        style={[
          {
            flexDirection: 'row',
            alignItems: 'flex-start',
            padding: 20,
            backgroundColor: '#ffffff',
            gap: 16,
          },
          !notif.isRead ? { backgroundColor: 'rgba(239,246,255,0.5)' } : undefined,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={{ position: 'relative' }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: bg,
            }}
          >
            <Icon size={22} color={iconColor} strokeWidth={2} />
          </View>
          {!notif.isRead && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: '#2563eb',
                borderWidth: 2,
                borderColor: '#ffffff',
              }}
            />
          )}
        </View>
        <View style={{ flex: 1, paddingTop: 4, gap: 4 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Inter_600SemiBold',
              fontWeight: '600',
              color: '#000000',
              letterSpacing: -0.4,
            }}
            numberOfLines={1}
          >
            {notif.title}
          </Text>
          <Text style={{ fontSize: 15, color: '#6b7280', lineHeight: 22 }} numberOfLines={2}>
            {notif.message}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Inter_500Medium',
              fontWeight: '500',
              color: '#9ca3af',
              marginTop: 4,
            }}
          >
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
              style={{
                height: 40,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: '#f3f4f6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {markingAll ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Inter_600SemiBold',
                    fontWeight: '600',
                    color: '#000000',
                  }}
                >
                  Atzīmēt
                </Text>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading ? (
        <View style={{ padding: 16, gap: 8 }}>
          <SkeletonCard count={5} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
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
            <View
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 400 }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#f3f4f6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Bell size={28} color="#9ca3af" strokeWidth={2} />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Inter_700Bold',
                  fontWeight: '700',
                  color: '#000000',
                  marginBottom: 8,
                }}
              >
                Nav paziņojumu
              </Text>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>
                Šeit parādīsīsies jūsu paziņojumi
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#ffffff' }}>
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
