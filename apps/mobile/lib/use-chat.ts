import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, ApiChatMessage } from './api';

// The socket server lives at the API host root (no /api/v1 prefix).
// e.g. http://localhost:3000  →  ws://localhost:3000/chat
const WS_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1')
  .replace(/\/api\/v1\/?$/, '');

// ─────────────────────────────────────────────────────────────────────────────

interface UseChatOptions {
  jobId: string;
  token: string | null;
  currentUser?: { id: string; firstName: string; lastName: string } | null;
}

interface UseChatReturn {
  messages: ApiChatMessage[];
  loading: boolean;
  connected: boolean;
  sending: boolean;
  sendMessage: (text: string) => Promise<void>;
  sendImageMessage: (base64: string, mimeType: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useChat({ jobId, token, currentUser }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // ── Initial HTTP load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !jobId) return;

    let cancelled = false;
    api.chat.getMessages(jobId, token).then((data) => {
      if (!cancelled) {
        setMessages(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

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

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('newMessage', (msg: ApiChatMessage) => {
      setMessages((prev) => {
        // Avoid duplicates (the sender already added it optimistically)
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

    // Optimistic UI — add immediately for the sender
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ApiChatMessage = {
      id: optimisticId,
      senderId: currentUser?.id ?? '',
      senderName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '',
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const saved = await api.chat.sendMessage(jobId, text, token);
      // Replace optimistic with the real persisted message
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? saved : m)),
      );
    } catch {
      // Rollback on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      throw new Error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [jobId, token, sending, currentUser]);

  // ── Send image ────────────────────────────────────────────────────────────
  const sendImageMessage = useCallback(async (base64: string, mimeType: string) => {
    if (!token || !jobId || sending) return;
    setSending(true);

    // Optimistic placeholder
    const optimisticId = `optimistic-img-${Date.now()}`;
    const optimistic: ApiChatMessage = {
      id: optimisticId,
      senderId: currentUser?.id ?? '',
      senderName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '',
      body: '',
      imageUrl: `data:${mimeType};base64,${base64.replace(/^data:[^,]+,/, '')}`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { imageUrl } = await api.chat.uploadImage(jobId, base64, mimeType, token);
      const saved = await api.chat.sendMessage(jobId, '', token, imageUrl);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? saved : m)),
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      throw new Error('Failed to send image');
    } finally {
      setSending(false);
    }
  }, [jobId, token, sending, currentUser]);

  return { messages, loading, connected, sending, sendMessage, sendImageMessage };
}
