/**
 * Chat page — /dashboard/chat
 * Conversation list sidebar + message thread view for in-app messaging.
 *
 * Uses GET /chat/my-rooms (same endpoint as mobile) so drivers, buyers and
 * sellers all see the same rooms regardless of platform.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useChat } from '@/lib/use-chat';
import {
  getMyChatRooms,
  getOrderChatMessages,
  sendOrderChatMessage,
  type ChatRoom,
  type ChatMessage,
} from '@/lib/api/chat';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, Wifi, WifiOff, Truck, Package, Trash2 } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Tikko';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} st`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} d`;
}

function roomLabel(room: ChatRoom): string {
  if (room.type === 'order') return `Pasūtījums #${room.orderNumber ?? ''}`;
  return (
    room.otherParticipantName ??
    (room.pickupCity && room.deliveryCity
      ? `${room.pickupCity} → ${room.deliveryCity}`
      : room.jobNumber ?? '')
  );
}

function RoomIcon({ room }: { room: ChatRoom }) {
  if (room.type === 'order') return <Package className="h-4 w-4" />;
  if (room.jobType === 'WASTE_COLLECTION') return <Trash2 className="h-4 w-4" />;
  return <Truck className="h-4 w-4" />;
}

// ── Order chat thread (HTTP polling — no WS room for orders yet) ──────────────

function OrderChatThread({
  orderId,
  token,
  userId,
}: {
  orderId: string;
  token: string;
  userId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getOrderChatMessages(orderId, token)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [orderId, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    setSending(true);
    try {
      const msg = await sendOrderChatMessage(orderId, text, token);
      setMessages((prev) => [...prev, msg]);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loadingMsgs ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Ielādē ziņojumus...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nav ziņojumu
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === userId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}
                >
                  {!isMe && (
                    <p className="text-xs font-semibold mb-1 opacity-70">{msg.senderName}</p>
                  )}
                  <p className="leading-relaxed">{msg.body}</p>
                  <p className="text-xs mt-1 opacity-60 text-right">
                    {new Date(msg.createdAt).toLocaleTimeString('lv-LV', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-border">
        <input
          className="flex-1 bg-muted rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          placeholder="Rakstiet ziņojumu..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sending}
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user, token } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selected, setSelected] = useState<ChatRoom | null>(null);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load rooms using the same /chat/my-rooms endpoint as mobile
  const loadRooms = useCallback(() => {
    if (!token) return;
    getMyChatRooms(token)
      .then((data) => {
        setRooms(data);
        setSelected((prev) => prev ?? data[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoadingRooms(false));
  }, [token]);

  useEffect(() => { loadRooms(); }, [loadRooms]);
  // Poll room list every 30 s (same cadence as mobile)
  useEffect(() => {
    const id = setInterval(loadRooms, 30_000);
    return () => clearInterval(id);
  }, [loadRooms]);

  const selectedJobId = selected?.type === 'job' ? (selected.jobId ?? '') : '';

  const { messages, loading: loadingMsgs, connected, sending, sendMessage } = useChat({
    jobId: selectedJobId,
    token,
    currentUser: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName } : null,
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    try {
      await sendMessage(text);
    } catch {
      setInput(text);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-6 overflow-hidden">
      {/* Sidebar — room list */}
      <div className="w-72 shrink-0 flex flex-col gap-1 overflow-y-auto">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
          Sarunas
        </h2>

        {loadingRooms ? (
          <div className="space-y-2 px-1">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">Nav sarunu</p>
        ) : (
          rooms.map((room) => {
            const id = room.type === 'job' ? room.jobId : room.orderId;
            const selId = selected?.type === 'job' ? selected.jobId : selected?.orderId;
            const isActive = id === selId;
            return (
              <button
                key={id}
                onClick={() => setSelected(room)}
                className={`w-full text-left px-3 py-3 rounded-xl border transition-colors flex items-start gap-3 ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}
              >
                <div
                  className={`mt-0.5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  <RoomIcon room={room} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold truncate">{roomLabel(room)}</p>
                    {room.lastMessage && (
                      <span
                        className={`text-xs shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                      >
                        {formatRelative(room.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  {room.type === 'job' &&
                    room.pickupCity &&
                    room.deliveryCity &&
                    room.otherParticipantName && (
                      <p
                        className={`text-xs truncate mt-0.5 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                      >
                        {room.pickupCity} → {room.deliveryCity}
                      </p>
                    )}
                  {room.lastMessage ? (
                    <p
                      className={`text-xs truncate mt-0.5 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                    >
                      {room.lastMessage.senderName}: {room.lastMessage.body}
                    </p>
                  ) : (
                    <p
                      className={`text-xs mt-0.5 ${isActive ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}
                    >
                      Nav ziņojumu
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {selected ? roomLabel(selected) : 'Izvēlieties sarunu'}
          </span>
          {selected?.type === 'job' && (
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              {connected ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" /> Savienots
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-red-400" /> Nesavienots
                </>
              )}
            </div>
          )}
        </div>

        {/* Thread body */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Izvēlieties sarunu no saraksta
          </div>
        ) : selected.type === 'order' && selected.orderId && token && user ? (
          <OrderChatThread orderId={selected.orderId} token={token} userId={user.id} />
        ) : selected.type === 'job' ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Ielādē ziņojumus...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nav ziņojumu
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}
                      >
                        {!isMe && (
                          <p className="text-xs font-semibold mb-1 opacity-70">{msg.senderName}</p>
                        )}
                        <p className="leading-relaxed">{msg.body}</p>
                        <p className="text-xs mt-1 opacity-60 text-right">
                          {new Date(msg.createdAt).toLocaleTimeString('lv-LV', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div className="flex items-center gap-2 p-3 border-t border-border">
              <input
                className="flex-1 bg-muted rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                placeholder="Rakstiet ziņojumu..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!connected}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || !connected || sending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
