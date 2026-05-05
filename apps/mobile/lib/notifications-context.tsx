/**
 * NotificationsContext
 *
 * Centralises unread counts so they are polled once at the root layout level
 * rather than separately in every tab layout.
 *
 * Usage:
 *   const { unreadCount, chatUnreadCount } = useNotifications();
 */
import React, { createContext, useContext } from 'react';
import { useUnreadCount } from './use-unread-count';
import { useChatUnreadCount } from './use-chat-unread-count';

interface NotificationsContextValue {
  unreadCount: number;
  chatUnreadCount: number;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  chatUnreadCount: 0,
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const unreadCount = useUnreadCount();
  const chatUnreadCount = useChatUnreadCount();
  return (
    <NotificationsContext.Provider value={{ unreadCount, chatUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
