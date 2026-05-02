/**
 * Notifications page — /dashboard/notifications
 * Minimal inbox: list shows truncated preview; clicking opens a detail sheet.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Package,
  Truck,
  CreditCard,
  AlertCircle,
  RefreshCw,
  XCircle,
  MessageSquare,
  FileText,
  Scale,
  Recycle,
  Award,
  Receipt,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from '@/lib/api';

// ─── Type metadata ────────────────────────────────────────────────────────────

interface TypeMeta {
  Icon: React.ElementType;
  bg: string;
  iconColor: string;
  label: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  ORDER_CREATED: { Icon: Package, bg: '#f3f4f6', iconColor: '#374151', label: 'Jauns pasūtījums' },
  ORDER_CONFIRMED: {
    Icon: CheckCheck,
    bg: '#f0fdf4',
    iconColor: '#15803d',
    label: 'Pasūtījums apstiprināts',
  },
  ORDER_CANCELLED: {
    Icon: XCircle,
    bg: '#fef2f2',
    iconColor: '#b91c1c',
    label: 'Pasūtījums atcelts',
  },
  ORDER_DELIVERED: {
    Icon: CheckCheck,
    bg: '#dcfce7',
    iconColor: '#15803d',
    label: 'Pasūtījums piegādāts',
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
    Icon: CreditCard,
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
    Icon: CheckCheck,
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
  SYSTEM_ALERT: {
    Icon: AlertCircle,
    bg: '#fefce8',
    iconColor: '#ca8a04',
    label: 'Sistēmas brīdinājums',
  },
  SYSTEM: { Icon: Bell, bg: '#f3f4f6', iconColor: '#6b7280', label: 'Sistēmas paziņojums' },
  DOCUMENT_EXPIRING_SOON: {
    Icon: FileText,
    bg: '#fefce8',
    iconColor: '#ca8a04',
    label: 'Dokuments beidzas',
  },
  WEIGHING_SLIP: { Icon: Receipt, bg: '#f9fafb', iconColor: '#374151', label: 'Svēršanas kvīts' },
  JOB_AVAILABLE: { Icon: Briefcase, bg: '#f3f4f6', iconColor: '#374151', label: 'Pieejams darbs' },
  JOB_ACCEPTED: { Icon: CheckCheck, bg: '#f0fdf4', iconColor: '#059669', label: 'Darbs pieņemts' },
  JOB_COMPLETED: { Icon: Award, bg: '#f3f4f6', iconColor: '#6b7280', label: 'Darbs pabeigts' },
  INVOICE_ISSUED: {
    Icon: Receipt,
    bg: '#f9fafb',
    iconColor: '#6b7280',
    label: 'Izrakstīts rēķins',
  },
  DISPOSAL_ORDER_CREATED: {
    Icon: Recycle,
    bg: '#f0fdf4',
    iconColor: '#059669',
    label: 'Utilizācijas pasūtījums',
  },
  DISPOSAL_ORDER_CONFIRMED: {
    Icon: Recycle,
    bg: '#f0fdf4',
    iconColor: '#059669',
    label: 'Utilizācija apstiprināta',
  },
  DISPOSAL_ORDER_CANCELLED: {
    Icon: XCircle,
    bg: '#fef2f2',
    iconColor: '#b91c1c',
    label: 'Utilizācija atcelta',
  },
  DISPOSAL_ORDER_COMPLETED: {
    Icon: Scale,
    bg: '#f0fdf4',
    iconColor: '#059669',
    label: 'Utilizācija pabeigta',
  },
};

const DEFAULT_META: TypeMeta = {
  Icon: Bell,
  bg: '#f3f4f6',
  iconColor: '#6b7280',
  label: 'Paziņojums',
};

// ─── Deep-link to web dashboard routes ────────────────────────────────────────

function deepLink(n: AppNotification): string | null {
  const d = (n.data ?? {}) as Record<string, string>;
  switch (n.type as NotificationType) {
    case 'ORDER_CREATED':
      return d.orderId ? `/dashboard/orders/${d.orderId}` : '/dashboard/orders';
    case 'ORDER_CONFIRMED':
    case 'ORDER_DELIVERED':
    case 'ORDER_CANCELLED':
      return d.orderId ? `/dashboard/orders/${d.orderId}` : '/dashboard/orders';
    case 'TRANSPORT_ASSIGNED':
    case 'TRANSPORT_STARTED':
    case 'TRANSPORT_COMPLETED':
      return d.jobId ? `/dashboard/transport-jobs/${d.jobId}` : '/dashboard/fleet';
    case 'PAYMENT_RECEIVED':
      return '/dashboard/earnings';
    case 'QUOTE_RECEIVED':
    case 'QUOTE_ACCEPTED':
    case 'QUOTE_SUBMITTED':
    case 'QUOTE_REQUEST_RECEIVED':
      return '/dashboard/orders';
    case 'DOCUMENT_EXPIRING_SOON':
      return '/dashboard/garage';
    case 'WEIGHING_SLIP':
      return d.orderId ? `/dashboard/orders/${d.orderId}` : '/dashboard/deliveries';
    case 'SYSTEM_ALERT':
      return d.jobId ? `/dashboard/transport-jobs/${d.jobId}` : '/dashboard';
    default:
      return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripEmojis(text: string) {
  if (!text) return text;
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Tikko';
  if (mins < 60) return `${mins} min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} st.`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d.`;
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' });
}

function fmtFull(iso: string): string {
  return new Date(iso).toLocaleString('lv-LV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupNotifications(items: AppNotification[]) {
  const today: AppNotification[] = [];
  const thisWeek: AppNotification[] = [];
  const older: AppNotification[] = [];
  const now = Date.now();
  for (const n of items) {
    const age = now - new Date(n.createdAt).getTime();
    if (age < 86_400_000) today.push(n);
    else if (age < 7 * 86_400_000) thisWeek.push(n);
    else older.push(n);
  }
  return { today, thisWeek, older };
}

// ─── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ n, onClick }: { n: AppNotification; onClick: (n: AppNotification) => void }) {
  const { Icon, bg, iconColor } = TYPE_META[n.type] ?? DEFAULT_META;
  const title = stripEmojis(n.title);
  const preview = stripEmojis(n.message);

  return (
    <button
      onClick={() => onClick(n)}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${
        !n.isRead ? 'bg-blue-50/30' : ''
      }`}
    >
      {/* Icon */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: bg }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`truncate text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}
          >
            {title}
          </p>
          <span className="shrink-0 text-[11px] text-slate-400">{fmtRelative(n.createdAt)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{preview}</p>
      </div>

      {/* Unread dot */}
      {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
    </button>
  );
}

// ─── Group section ─────────────────────────────────────────────────────────────

function GroupSection({
  title,
  items,
  onClick,
}: {
  title: string;
  items: AppNotification[];
  onClick: (n: AppNotification) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <div className="divide-y divide-slate-100">
        {items.map((n) => (
          <NotifRow key={n.id} n={n} onClick={onClick} />
        ))}
      </div>
    </div>
  );
}

// ─── Detail sheet ──────────────────────────────────────────────────────────────

function NotifSheet({
  notif,
  open,
  onClose,
}: {
  notif: AppNotification | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!notif) return null;
  const { Icon, bg, iconColor, label } = TYPE_META[notif.type] ?? DEFAULT_META;
  const title = stripEmojis(notif.title);
  const message = stripEmojis(notif.message);
  const link = deepLink(notif);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="border-b border-slate-100 px-6 py-4">
          <SheetTitle className="text-sm font-semibold text-slate-900">Paziņojums</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Icon + type + date */}
          <div className="flex flex-col items-center text-center gap-2 pb-5 border-b border-slate-100">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: bg }}
            >
              <Icon className="h-7 w-7" style={{ color: iconColor }} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {label}
            </p>
            <p className="text-xs text-slate-400">{fmtFull(notif.createdAt)}</p>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-slate-900 leading-snug">{title}</h2>

          {/* Message */}
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>

        {/* Action */}
        {link && (
          <div className="border-t border-slate-100 px-6 py-4">
            <Link
              href={link}
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Atvērt
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { token } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AppNotification | null>(null);

  const load = useCallback(
    async (p = 1) => {
      if (!token) return;
      try {
        const res = await getNotifications(token, p, 30);
        setNotifs((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
        setTotal(res.total);
        setPage(p);
      } catch {}
    },
    [token],
  );

  useEffect(() => {
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, [load]);

  const handleOpen = async (n: AppNotification) => {
    setSelected(n);
    if (!n.isRead && token) {
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      await markNotificationRead(n.id, token).catch(() => {});
    }
  };

  const handleMarkAll = async () => {
    if (!token) return;
    setMarking(true);
    try {
      await markAllNotificationsRead(token);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = notifs.filter((n) => !n.isRead).length;
  const { today, thisWeek, older } = groupNotifications(notifs);

  return (
    <>
      <div className="flex flex-col gap-0 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Paziņojumi</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} nelasīti` : 'Visi izlasīti'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
              onClick={() => load(1)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={marking}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="h-3 w-3" />
                {marking ? 'Apstrādā…' : 'Atzīmēt izlasītus'}
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/5 rounded" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Bell className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-700">Nav paziņojumu</p>
            <p className="text-sm text-slate-500">
              Šeit parādīsies pasūtījumu un transporta atjauninājumi.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
            <GroupSection title="Šodien" items={today} onClick={handleOpen} />
            <GroupSection title="Šonedēļ" items={thisWeek} onClick={handleOpen} />
            <GroupSection title="Agrāk" items={older} onClick={handleOpen} />

            {notifs.length < total && (
              <div className="px-4 py-3">
                <button
                  onClick={() => load(page + 1)}
                  className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 transition-colors"
                >
                  Ielādēt vairāk
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <NotifSheet notif={selected} open={!!selected} onClose={() => setSelected(null)} />
    </>
  );
}
