/**
 * Notifications page — /dashboard/notifications
 * Inbox for all user notifications with mark-read and mark-all-read actions.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Package, Truck, CreditCard, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from '@/lib/api';

// ─── Notification icon + color map ───────────────────────────────────────────

const TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> =
  {
    ORDER_CREATED: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-100' },
    ORDER_CONFIRMED: { icon: CheckCheck, color: 'text-green-600', bg: 'bg-green-100' },
    ORDER_DELIVERED: { icon: CheckCheck, color: 'text-green-700', bg: 'bg-green-100' },
    TRANSPORT_ASSIGNED: { icon: Truck, color: 'text-primary', bg: 'bg-primary/10' },
    TRANSPORT_STARTED: { icon: Truck, color: 'text-primary', bg: 'bg-primary/10' },
    TRANSPORT_COMPLETED: { icon: Truck, color: 'text-green-600', bg: 'bg-green-100' },
    PAYMENT_RECEIVED: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    SYSTEM_ALERT: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
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
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

// ─── Notification row ────────────────────────────────────────────────────────

function NotifRow({ n, onMarkRead }: { n: AppNotification; onMarkRead: (id: string) => void }) {
  const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted' };
  const Icon = meta.icon;

  return (
    <div
      className={`group relative flex items-start gap-4 p-4 sm:p-5 rounded-[2rem] transition-all duration-200 border ${
        n.isRead
          ? 'bg-muted/10 border-transparent hover:bg-muted/30'
          : 'bg-white dark:bg-zinc-950 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border-border/40'
      }`}
    >
      <div
        className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${n.isRead ? 'opacity-60 saturate-50' : ''} ${meta.bg}`}
      >
        <Icon className={`h-5 w-5 ${meta.color}`} />
      </div>

      <div className="flex-1 min-w-0 pr-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 justify-between">
          <p
            className={`text-[15px] leading-tight ${
              n.isRead ? 'font-medium text-foreground/70' : 'font-semibold text-foreground'
            }`}
          >
            {n.title}
            {!n.isRead && (
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            )}
          </p>
          <span className="text-xs font-medium text-muted-foreground shrink-0 bg-muted/40 px-2 py-0.5 rounded-full whitespace-nowrap">
            {fmtRelative(n.createdAt)}
          </span>
        </div>

        <p
          className={`mt-1.5 text-sm leading-relaxed ${
            n.isRead ? 'text-muted-foreground/70' : 'text-muted-foreground'
          }`}
        >
          {n.message}
        </p>

        {!n.isRead && (
          <div className="mt-4 flex">
            <button
              onClick={() => onMarkRead(n.id)}
              className="inline-flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all duration-200"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Atzīmēt kā lasītu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupSection({
  title,
  items,
  onMarkRead,
}: {
  title: string;
  items: AppNotification[];
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-4 ml-1 md:ml-4 text-xs font-bold tracking-wider uppercase text-muted-foreground/60">
        {title}
      </h3>
      <div className="space-y-3">
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
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Paziņojumi"
        description={
          unreadCount > 0 ? `${unreadCount} nelasīti paziņojumi` : 'Visi paziņojumi izlasīti'
        }
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 sm:p-5 rounded-[2rem] bg-muted/10 border border-transparent mb-3 last:mb-0"
            >
              <Skeleton className="h-12 w-12 rounded-2xl shrink-0 opacity-40" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-1/3 opacity-40 rounded-lg" />
                  <Skeleton className="h-3 w-16 opacity-30 rounded-full" />
                </div>
                <Skeleton className="h-3 w-3/4 opacity-30 rounded-lg" />
                <Skeleton className="h-3 w-1/2 opacity-30 rounded-lg" />
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
