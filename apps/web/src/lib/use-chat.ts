/**
 * useChat hook.
 * Manages chat state for a conversation: fetches message history, sends messages,
 * and polls for new messages at a regular interval.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getChatMessages, sendChatMessage, ChatMessage } from './api';

// The socket server lives at the API host root (no /api/v1 prefix).
const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1')
  .replace(/\/api\/v1\/?$/, '');

interface UseChatOptions {
  jobId: string;
  token: string | null;
  currentUser?: { id: string; firstName: string; lastName: string } | null;
}

interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  connected: boolean;
  sending: boolean;
  sendMessage: (text: string) => Promise<void>;
}

export function useChat({ jobId, token, currentUser }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // ── Initial HTTP load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !jobId) return;
    let cancelled = false;
    getChatMessages(jobId, token)
      .then((data) => { if (!cancelled) { setMessages(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, token]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !jobId) return;

    const socket = io(`${WS_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinJob', { jobId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('newMessage', (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.emit('leaveJob', { jobId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [jobId, token]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !token || !jobId || sending) return;
    setSending(true);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      jobId,
      senderId: currentUser?.id ?? '',
      senderName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '',
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const saved = await sendChatMessage(jobId, text, token);
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? saved : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      throw new Error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [jobId, token, sending, currentUser]);

  return { messages, loading, connected, sending, sendMessage };
}
