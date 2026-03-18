/**
 * NotificationBell component.
 * Bell icon in the top nav; shows unread count badge and a dropdown of recent
 * in-app notifications fetched from the API.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/api';

const TYPE_ICONS: Record<string, string> = {
  ORDER_CREATED: '📦',
  ORDER_CONFIRMED: '✅',
  ORDER_DELIVERED: '🎉',
  TRANSPORT_ASSIGNED: '🚛',
  TRANSPORT_STARTED: '🛣️',
  TRANSPORT_COMPLETED: '🏁',
  PAYMENT_RECEIVED: '💳',
  SYSTEM_ALERT: '⚠️',
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'tikko';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Poll unread count every 30s
  const pollCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getUnreadNotificationCount(token);
      setCount(res.count);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    pollCount();
    timerRef.current = setInterval(pollCount, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pollCount]);

  // Load full list when dropdown opens
  const loadNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getNotifications(token, 1, 10);
      setNotifications(res.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  };

  const handleMarkAll = async () => {
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  const handleMarkOne = async (id: string) => {
    if (!token) return;
    try {
      await markNotificationRead(id, token);
      setCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // ignore
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
        aria-label="Paziņojumi"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-white shadow-lg ring-1 ring-black/5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Paziņojumi</h3>
            {count > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={handleMarkAll}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Atzīmēt visus lasītu
              </Button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto divide-y">
            {loading ? (
              <div className="flex h-24 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-red-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nav paziņojumu</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 transition-colors ${
                    n.isRead ? 'bg-background' : 'bg-blue-50/60'
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5 select-none">
                    {TYPE_ICONS[n.type] ?? '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-snug">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {fmtRelative(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkOne(n.id)}
                      className="shrink-0 mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      aria-label="Atzīmēt lasītu"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 text-center">
              <p className="text-xs text-muted-foreground/60">Rāda pēdējos 10 paziņojumus</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
