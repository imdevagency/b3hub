'use client';

import { useState } from 'react';
import {
  Bell,
  Send,
  Users,
  Truck,
  ShoppingCart,
  Store,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminBroadcastNotification } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// ─── Audience options ─────────────────────────────────────────────────────────

type Audience = 'ALL' | 'BUYERS' | 'SELLERS' | 'CARRIERS';

interface AudienceOption {
  value: Audience;
  label: string;
  description: string;
  icon: React.ElementType;
}

const AUDIENCE_OPTIONS: AudienceOption[] = [
  {
    value: 'ALL',
    label: 'Visi lietotāji',
    description: 'Paziņojumu saņems visi reģistrētie lietotāji',
    icon: Users,
  },
  {
    value: 'BUYERS',
    label: 'Pircēji',
    description: 'Lietotāji, kas veic pasūtījumus (bez piegādes/pārvadāšanas tiesībām)',
    icon: ShoppingCart,
  },
  {
    value: 'SELLERS',
    label: 'Piegādātāji',
    description: 'Uzņēmumi ar materiālu pārdošanas tiesībām (canSell = true)',
    icon: Store,
  },
  {
    value: 'CARRIERS',
    label: 'Pārvadātāji / Vadītāji',
    description: 'Lietotāji ar transporta tiesībām (canTransport = true)',
    icon: Truck,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBroadcastPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('ALL');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; audience: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !sending;
  const selectedAudience = AUDIENCE_OPTIONS.find((o) => o.value === audience)!;

  function handleSendClick() {
    if (!canSend) return;
    setConfirming(true);
  }

  async function confirmSend() {
    if (!canSend) return;
    setConfirming(false);
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminBroadcastNotification(title.trim(), message.trim(), audience, token);
      setResult(res);
      setTitle('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda nosūtot paziņojumu');
    } finally {
      setSending(false);
    }
  }

  if (authLoading) return null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sūtīt paziņojumu"
        description="Broadcast paziņojums visiem vai konkrētai lietotāju grupai"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Compose form */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Paziņojuma saturs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Virsraksts</Label>
                <Input
                  id="title"
                  placeholder="Piemēram: Sistēmas apkope 15. jūlijā"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground text-right">{title.length}/120</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Ziņojums</Label>
                <Textarea
                  id="message"
                  placeholder="Detalizēts paziņojuma teksts..."
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
              </div>
            </CardContent>
          </Card>

          {/* Send / confirm */}
          {confirming ? (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Apstiprināt sūtīšanu?</p>
                    <p className="mt-1">
                      Paziņojums tiks nosūtīts grupai: <strong>{selectedAudience.label}</strong>. Šo
                      darbību nevar atsaukt.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={confirmSend} disabled={sending}>
                    {sending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Jā, sūtīt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                    disabled={sending}
                  >
                    Atcelt
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button size="lg" className="w-full" disabled={!canSend} onClick={handleSendClick}>
              <Send className="h-4 w-4 mr-2" />
              Nosūtīt paziņojumu
            </Button>
          )}

          {/* Result */}
          {result && (
            <Card className="border-emerald-300 bg-emerald-50">
              <CardContent className="p-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-800">
                  Paziņojums nosūtīts <strong>{result.sent}</strong> lietotājiem.
                </p>
              </CardContent>
            </Card>
          )}
          {error && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Audience selector */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mērķauditorija</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {AUDIENCE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = audience === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAudience(opt.value)}
                    className={`w-full flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-2 shrink-0 ${
                        selected ? 'bg-primary/10' : 'bg-muted'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${selected ? 'text-primary' : 'text-foreground'}`}
                      >
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                    {selected && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5 ml-auto" />
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">Priekšskatījums</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <Bell className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold truncate">
                    {title || 'Paziņojuma virsraksts'}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 pl-8">
                  {message || 'Paziņojuma teksts tiks parādīts šeit...'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
