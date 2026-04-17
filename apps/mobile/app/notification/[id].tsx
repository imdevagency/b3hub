import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  ExternalLink,
} from 'lucide-react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { api } from '@/lib/api';
import { notifStore } from '@/lib/notif-store';
import type { ApiNotification } from '@/lib/api';
import { colors } from '@/lib/theme';

// ── Icon map (mirrors notifications.tsx) ─────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
interface TypeInfo {
  Icon: LucideIcon;
  bg: string;
  iconColor: string;
  label: string;
}

const TYPE_INFO: Record<string, TypeInfo> = {
  ORDER_CREATED: { Icon: Package, bg: '#f3f4f6', iconColor: '#374151', label: 'Jauns pasūtījums' },
  ORDER_CONFIRMED: {
    Icon: CheckCircle2,
    bg: '#f0fdf4',
    iconColor: '#111827',
    label: 'Pasūtījums apstiprināts',
  },
  ORDER_DELIVERED: {
    Icon: CheckCircle2,
    bg: '#dcfce7',
    iconColor: '#15803d',
    label: 'Pasūtījums piegādāts',
  },
  ORDER_CANCELLED: {
    Icon: XCircle,
    bg: '#fef2f2',
    iconColor: '#b91c1c',
    label: 'Pasūtījums atcelts',
  },
  ORDER_PLACED: {
    Icon: Package,
    bg: '#f3f4f6',
    iconColor: '#374151',
    label: 'Pasūtījums iesniegts',
  },
  ORDER_SHIPPED: { Icon: Truck, bg: '#f3f4f6', iconColor: '#374151', label: 'Pasūtījums nosūtīts' },
  ORDER_REJECTED: {
    Icon: XCircle,
    bg: '#fef2f2',
    iconColor: '#b91c1c',
    label: 'Pasūtījums noraidīts',
  },
  TRANSPORT_ASSIGNED: {
    Icon: Truck,
    bg: '#eff6ff',
    iconColor: '#2563eb',
    label: 'Pārvadātājs piešķirts',
  },
  TRANSPORT_STARTED: {
    Icon: Truck,
    bg: '#f3f4f6',
    iconColor: '#374151',
    label: 'Transports uzsākts',
  },
  TRANSPORT_COMPLETED: {
    Icon: Award,
    bg: '#f0fdf4',
    iconColor: '#059669',
    label: 'Transports pabeigts',
  },
  PAYMENT_RECEIVED: {
    Icon: Banknote,
    bg: '#f0fdf4',
    iconColor: '#111827',
    label: 'Maksājums saņemts',
  },
  QUOTE_RECEIVED: {
    Icon: MessageSquare,
    bg: '#f0f9ff',
    iconColor: '#0369a1',
    label: 'Piedāvājums saņemts',
  },
  QUOTE_ACCEPTED: {
    Icon: CheckCircle2,
    bg: '#dcfce7',
    iconColor: '#15803d',
    label: 'Piedāvājums pieņemts',
  },
  QUOTE_SUBMITTED: {
    Icon: MessageSquare,
    bg: '#f0f9ff',
    iconColor: '#0369a1',
    label: 'Piedāvājums iesniegts',
  },
  QUOTE_REQUEST_RECEIVED: {
    Icon: MessageSquare,
    bg: '#fef9c3',
    iconColor: '#a16207',
    label: 'Jauns cenu pieprasījums',
  },
  SYSTEM_ALERT: { Icon: Bell, bg: '#fefce8', iconColor: '#ca8a04', label: 'Sistēmas brīdinājums' },
  SYSTEM: { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280', label: 'Sistēmas paziņojums' },
  DOCUMENT_EXPIRING_SOON: {
    Icon: FileText,
    bg: '#fefce8',
    iconColor: '#ca8a04',
    label: 'Dokuments beidzas',
  },
  WEIGHING_SLIP: { Icon: Receipt, bg: '#f9fafb', iconColor: '#374151', label: 'Svēršanas kvīts' },
  JOB_AVAILABLE: { Icon: Briefcase, bg: '#f3f4f6', iconColor: '#374151', label: 'Pieejams darbs' },
  JOB_ACCEPTED: {
    Icon: CheckCircle2,
    bg: '#f0fdf4',
    iconColor: '#059669',
    label: 'Darbs pieņemts',
  },
  JOB_COMPLETED: { Icon: Award, bg: '#f3f4f6', iconColor: '#6b7280', label: 'Darbs pabeigts' },
  INVOICE_ISSUED: {
    Icon: Receipt,
    bg: '#f9fafb',
    iconColor: '#6b7280',
    label: 'Izrakstīts rēķins',
  },
};
const DEFAULT_TYPE_INFO: TypeInfo = {
  Icon: Bell,
  bg: '#f3f4f6',
  iconColor: '#6b7280',
  label: 'Paziņojums',
};

// ── Deep-link resolver (mirrors notifications.tsx) ───────────────────────────
function deepLinkPath(notif: ApiNotification, mode: string): string | null {
  const d = (notif.data ?? {}) as Record<string, string>;
  switch (notif.type) {
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
    case 'ORDER_CREATED':
      return d.orderId ? `/(seller)/order/${d.orderId}` : '/(seller)/incoming';
    case 'QUOTE_REQUEST_RECEIVED':
    case 'QUOTE_ACCEPTED':
      return '/(seller)/quotes';
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

function stripEmojis(str: string): string {
  return str
    .replace(/\p{Emoji}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('lv-LV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { mode } = useMode();

  // Read from store (set by NotifCard before navigating)
  const notif = notifStore.get();

  // Mark as read (defensive — NotifCard already marks optimistically, this ensures backend sync)
  useEffect(() => {
    if (notif && !notif.isRead && token) {
      api.notifications.markRead(notif.id, token).catch(() => {});
    }
    return () => {
      notifStore.clear();
    };
  }, []);

  if (!notif || notif.id !== id) {
    // Store cleared (e.g. app reload) — fallback to list
    return (
      <ScreenContainer standalone bg="#ffffff">
        <ScreenHeader
          title="Paziņojums"
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace('/notifications' as any)
          }
        />
        <View style={s.center}>
          <Bell size={40} color="#d1d5db" strokeWidth={1.5} />
          <Text style={s.emptyText}>Paziņojums nav pieejams</Text>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.replace('/notifications' as any)}
          >
            <Text style={s.backBtnText}>Uz paziņojumiem</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const { Icon, bg, iconColor, label } = TYPE_INFO[notif.type] ?? DEFAULT_TYPE_INFO;
  const deepLink = deepLinkPath(notif, mode);
  const title = stripEmojis(notif.title);
  const message = stripEmojis(notif.message);

  const handleAction = () => {
    if (deepLink) router.replace(deepLink as any);
  };

  return (
    <ScreenContainer standalone bg="#ffffff">
      <ScreenHeader
        title="Paziņojums"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/notifications' as any)
        }
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Icon + type label */}
        <View style={s.iconRow}>
          <View style={[s.iconCircle, { backgroundColor: bg }]}>
            <Icon size={30} color={iconColor} strokeWidth={1.8} />
          </View>
          <Text style={s.typeLabel}>{label}</Text>
          <Text style={s.dateText}>{formatDate(notif.createdAt)}</Text>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Title */}
        <Text style={s.title}>{title}</Text>

        {/* Message */}
        <Text style={s.message}>{message}</Text>

        {/* Action button */}
        {deepLink && (
          <TouchableOpacity style={s.actionBtn} onPress={handleAction} activeOpacity={0.85}>
            <ExternalLink size={16} color="#ffffff" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={s.actionBtnText}>Atvērt</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 60,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: colors.textDisabled,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    backgroundColor: colors.bgMuted,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 30,
    marginBottom: 14,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 26,
    marginBottom: 32,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '500',
  },
  backBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.bgMuted,
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
