'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useChat } from '@/lib/use-chat';
import { getMyTransportJobs, type ApiTransportJob } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, Wifi, WifiOff } from 'lucide-react';

export default function ChatPage() {
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load transport jobs for job selector
  useEffect(() => {
    if (!token) return;
    getMyTransportJobs(token)
      .then((data) => {
        const active = data.filter((j) =>
          ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'].includes(j.status),
        );
        setJobs(active);
        if (active.length > 0) setSelectedJobId(active[0].id);
      })
      .catch(() => {});
  }, [token]);

  const { messages, loading, connected, sending, sendMessage } = useChat({
    jobId: selectedJobId ?? '',
    token,
    currentUser: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName } : null,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-6 overflow-hidden">
      {/* Job list */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Transporta Darbi
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nav aktīvu darbu</p>
        ) : (
          jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(job.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                selectedJobId === job.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-muted'
              }`}
            >
              <p className="font-medium truncate">
                {job.pickupAddress?.split(',')[0] ?? 'Pickup'} →{' '}
                {job.deliveryAddress?.split(',')[0] ?? 'Delivery'}
              </p>
              <p className="text-xs opacity-70 mt-0.5">{job.status}</p>
            </button>
          ))
        )}
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {selectedJob
              ? `${selectedJob.pickupAddress?.split(',')[0] ?? ''} → ${selectedJob.deliveryAddress?.split(',')[0] ?? ''}`
              : 'Izvēlieties darbu'}
          </span>
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
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!selectedJobId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Izvēlieties transporta darbu, lai sāktu čatu
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Ielādē ziņojumus...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Šajā darbā vēl nav ziņojumu
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-xs font-semibold mb-1 opacity-70">{msg.senderName}</p>
                    )}
                    <p className="leading-relaxed">{msg.body}</p>
                    <p className={`text-xs mt-1 opacity-60 text-right`}>
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

        {/* Input */}
        {selectedJobId && (
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
        )}
      </div>
    </div>
  );
}
