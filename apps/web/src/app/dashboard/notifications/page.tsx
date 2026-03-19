/**
 * Notifications page — /dashboard/notifications
 * Inbox for all user notifications with mark-read and mark-all-read actions.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Package, Truck, CreditCard, AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from '@/lib/api';

// ─── Notification icon + color map ───────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  ORDER_CREATED:     { icon: Package,      color: 'text-blue-600',   bg: 'bg-blue-100' },
  ORDER_CONFIRMED:   { icon: CheckCheck,   color: 'text-green-600',  bg: 'bg-green-100' },
  ORDER_DELIVERED:   { icon: CheckCheck,   color: 'text-green-700',  bg: 'bg-green-100' },
  TRANSPORT_ASSIGNED:{ icon: Truck,        color: 'text-primary',    bg: 'bg-primary/10' },
  TRANSPORT_STARTED: { icon: Truck,        color: 'text-primary',    bg: 'bg-primary/10' },
  TRANSPORT_COMPLETED:{ icon: Truck,       color: 'text-green-600',  bg: 'bg-green-100' },
  PAYMENT_RECEIVED:  { icon: CreditCard,   color: 'text-emerald-600',bg: 'bg-emerald-100' },
  SYSTEM_ALERT:      { icon: AlertCircle,  color: 'text-amber-600',  bg: 'bg-amber-100' },
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Tikko';
  if (mins < 60) return `${mins} min. atpakaļ`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} st. atpakaļ`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d. atpakaļ`;
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

// ─── Notification row ────────────────────────────────────────────────────────

function NotifRow({
  n,
  onMarkRead,
}: {
  n: AppNotification;
  onMarkRead: (id: string) => void;
}) {
  const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted' };
  const Icon = meta.icon;

  return (
    <div
      className={`flex items-start gap-4 px-4 py-4 rounded-xl transition-colors cursor-default ${
        n.isRead ? 'bg-transparent' : 'bg-primary/5 border border-primary/10'
      }`}
    >
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
        <Icon className={`h-4 w-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${n.isRead ? 'text-foreground' : 'font-semibold text-foreground'}`}>
          {n.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">{fmtRelative(n.createdAt)}</p>
      </div>
      {!n.isRead && (
        <button
          onClick={() => onMarkRead(n.id)}
          className="mt-1 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          Atzīmēt
        </button>
      )}
    </div>
  );
}

function GroupSection({ title, items, onMarkRead }: {
  title: string;
  items: AppNotification[];
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((n) => (
          <NotifRow key={n.id} n={n} onMarkRead={onMarkRead} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { token } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

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

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await markNotificationRead(id, token).catch(() => {});
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
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Paziņojumi"
        description={unreadCount > 0 ? `${unreadCount} nelasīti paziņojumi` : 'Visi paziņojumi izlasīti'}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => load(1)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atjaunot
            </Button>
            {unreadCount > 0 && (
              <Button size="sm" onClick={handleMarkAll} disabled={marking}>
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                {marking ? 'Apstrādā...' : 'Atzīmēt visus'}
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 px-4 py-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nav paziņojumu"
          description="Šeit parādīsies jūsu pasūtījumu, transporta un maksājumu atjauninājumi."
        />
      ) : (
        <div className="space-y-6">
          <GroupSection title="Šodien" items={today} onMarkRead={handleMarkRead} />
          <GroupSection title="Šonedēļ" items={thisWeek} onMarkRead={handleMarkRead} />
          <GroupSection title="Agrāk" items={older} onMarkRead={handleMarkRead} />

          {notifs.length < total && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => load(page + 1)}>
                Ielādēt vairāk
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
