/**
 * NotificationsContext
 *
 * Centralises the unread notification count so it is only polled once
 * (at the root layout level) rather than separately in every tab layout.
 *
 * Usage:
 *   const { unreadCount } = useNotifications();
 */
import React, { createContext, useContext } from 'react';
import { useUnreadCount } from './use-unread-count';

interface NotificationsContextValue {
  unreadCount: number;
}

const NotificationsContext = createContext<NotificationsContextValue>({ unreadCount: 0 });

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const unreadCount = useUnreadCount();
  return (
    <NotificationsContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
