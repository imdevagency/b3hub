/**
 * NotificationBell component.
 * Bell icon in the top nav; shows unread count badge and a dropdown of recent
 * in-app notifications fetched from the API.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Package,
  Truck,
  CreditCard,
  AlertCircle,
  XCircle,
  MessageSquare,
  FileText,
  Scale,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/api';

const TYPE_META: Record<string, { icon: React.ElementType }> = {
  ORDER_CREATED: { icon: Package },
  ORDER_CONFIRMED: { icon: CheckCheck },
  ORDER_CANCELLED: { icon: XCircle },
  ORDER_DELIVERED: { icon: CheckCheck },
  TRANSPORT_ASSIGNED: { icon: Truck },
  TRANSPORT_STARTED: { icon: Truck },
  TRANSPORT_COMPLETED: { icon: Truck },
  PAYMENT_RECEIVED: { icon: CreditCard },
  QUOTE_RECEIVED: { icon: MessageSquare },
  QUOTE_ACCEPTED: { icon: CheckCheck },
  SYSTEM_ALERT: { icon: AlertCircle },
  DOCUMENT_EXPIRING_SOON: { icon: FileText },
  WEIGHING_SLIP: { icon: Scale },
};

function stripEmojis(text: string) {
  if (!text) return text;
  return text.replace(/\p{Extended_Pictographic}/gu, '').trim();
}

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
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${open || count > 0 ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-100 text-gray-500'}`}
        aria-label="Paziņojumi"
      >
        <Bell className="h-[22px] w-[22px]" strokeWidth={2} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Paziņojumi</h3>
            {count > 0 && (
              <button
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                onClick={handleMarkAll}
              >
                Atzīmēt izlasītus
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
                  <Bell className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-[14px] font-medium text-gray-900">Nav paziņojumu</p>
                <p className="text-xs text-gray-500 mt-1">Jūs esat lietas kursā par visu.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((n) => {
                  const meta = TYPE_META[n.type] ?? { icon: Bell };
                  const Icon = meta.icon;
                  const cleanTitle = stripEmojis(n.title);
                  const cleanMessage = stripEmojis(n.message);

                  return (
                    <div
                      key={n.id}
                      className={`group relative flex items-start gap-4 p-4 border-b border-gray-50 last:border-0 transition-colors ${
                        n.isRead
                          ? 'bg-white opacity-70 hover:bg-gray-50'
                          : 'bg-blue-50/30 hover:bg-blue-50/50'
                      }`}
                    >
                      <div
                        className={`flex shrink-0 h-10 w-10 items-center justify-center rounded-full mt-0.5 ${
                          n.isRead ? 'bg-gray-100 text-gray-400' : 'bg-black text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-sm truncate leading-tight ${n.isRead ? 'font-medium text-gray-600' : 'font-bold text-gray-900'}`}
                          >
                            {cleanTitle}
                          </p>
                          <p className="text-[10px] font-medium text-gray-400 shrink-0">
                            {fmtRelative(n.createdAt)}
                          </p>
                        </div>
                        <p
                          className={`text-[13px] mt-1 leading-relaxed line-clamp-2 ${n.isRead ? 'text-gray-500' : 'text-gray-700'}`}
                        >
                          {cleanMessage}
                        </p>
                      </div>

                      {!n.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkOne(n.id);
                          }}
                          className="absolute right-4 top-4 opacity-100 md:opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-900 transition-all"
                          aria-label="Atzīmēt lasītu"
                          title="Atzīmēt izlasītu"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 text-center">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Rāda pēdējos 10
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
