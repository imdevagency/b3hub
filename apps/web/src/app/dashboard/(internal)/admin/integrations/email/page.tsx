'use client';

/**
 * /dashboard/admin/integrations/email
 *
 * SMTP e-pasta integrācija — darījumu paziņojumi, apstiprinājumi, rēķini.
 * Atbalsta jebkuru SMTP serveri (Gmail, SendGrid, Mailgun, AWS SES, u.c.)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { adminGetSettings, adminUpdateSettings } from '@/lib/api/admin';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function str(s: Record<string, string> | null, key: string, fallback = ''): string {
  return s?.[key] ?? fallback;
}
function bool(s: Record<string, string> | null, key: string): boolean {
  return s?.[key] === 'true';
}

function SaveRow({ saveState, onSave }: { saveState: SaveState; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-2 text-xs">
        {saveState === 'saving' && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Saglabā…</span>
          </>
        )}
        {saveState === 'saved' && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-emerald-600">Saglabāts</span>
          </>
        )}
        {saveState === 'error' && (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-destructive">Kļūda saglabājot</span>
          </>
        )}
      </div>
      <Button size="sm" onClick={onSave} disabled={saveState === 'saving'}>
        {saveState === 'saving' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        Saglabāt
      </Button>
    </div>
  );
}

export default function EmailIntegrationPage() {
  const { token: authTok } = useAuth();
  const token = authTok ?? '';

  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connSave, setConnSave] = useState<SaveState>('idle');
  const [senderSave, setSenderSave] = useState<SaveState>('idle');
  const [triggerSave, setTriggerSave] = useState<SaveState>('idle');
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setSettings(await adminGetSettings(token));
    } catch {
      setError('Neizdevās ielādēt iestatījumus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  async function save(keys: string[], setSave: (s: SaveState) => void) {
    if (!token || !settings) return;
    setSave('saving');
    try {
      await adminUpdateSettings(Object.fromEntries(keys.map((k) => [k, settings[k] ?? ''])), token);
      setSave('saved');
      setTimeout(() => setSave('idle'), 2500);
    } catch {
      setSave('error');
    }
  }

  async function sendTestEmail() {
    if (!testEmail || !token) return;
    setTestState('sending');
    try {
      // Saves test recipient and triggers a test send via the settings endpoint
      await adminUpdateSettings(
        { 'email.testRecipient': testEmail, 'email.sendTest': 'true' },
        token,
      );
      // Reset the trigger flag immediately
      await adminUpdateSettings({ 'email.sendTest': 'false' }, token);
      setTestState('sent');
      setTimeout(() => setTestState('idle'), 3000);
    } catch {
      setTestState('error');
      setTimeout(() => setTestState('idle'), 3000);
    }
  }

  const enabled = bool(settings, 'email.enabled');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="E-pasts (SMTP)" description="Darījumu e-pasta paziņojumi" />
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Mēģināt vēlreiz
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="E-pasts (SMTP)"
        description="Darījumu e-pasta sūtīšana — pasūtījumu apstiprinājumi, rēķini, paziņojumi."
        action={
          <a
            href="https://nodemailer.com/smtp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Nodemailer SMTP <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          Backends izmanto <strong>Nodemailer</strong> ar SMTP. Atbalstīti: Gmail (ar App Password),
          SendGrid SMTP relay, Mailgun, AWS SES, un jebkurš cits SMTP serveris.
        </div>
      </div>

      <div className="space-y-4">
        {/* Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  E-pasta sūtīšana
                </CardTitle>
                <CardDescription className="mt-1">
                  Ieslēdzot, sistēma sūta darījumu paziņojumus pa e-pastu.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Badge
                  variant="outline"
                  className={
                    enabled
                      ? 'text-emerald-600 border-emerald-300 bg-emerald-50'
                      : 'text-muted-foreground'
                  }
                >
                  {enabled ? 'Aktīvs' : 'Izslēgts'}
                </Badge>
                <Switch
                  id="email.enabled"
                  checked={enabled}
                  onCheckedChange={(v) => set('email.enabled', String(v))}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* SMTP connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SMTP savienojuma dati</CardTitle>
            <CardDescription>Servera adrese, ports un autentifikācija.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2 sm:grid sm:grid-cols-[1fr_auto] sm:gap-4 sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="email.smtpHost">SMTP serveris (host)</Label>
                  <Input
                    id="email.smtpHost"
                    value={str(settings, 'email.smtpHost')}
                    onChange={(e) => set('email.smtpHost', e.target.value)}
                    placeholder="smtp.gmail.com"
                    disabled={!enabled}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email.smtpPort">Ports</Label>
                  <Input
                    id="email.smtpPort"
                    type="number"
                    value={str(settings, 'email.smtpPort', '587')}
                    onChange={(e) => set('email.smtpPort', e.target.value)}
                    placeholder="587"
                    disabled={!enabled}
                    className="w-24"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email.smtpUser">Lietotājvārds</Label>
                <Input
                  id="email.smtpUser"
                  value={str(settings, 'email.smtpUser')}
                  onChange={(e) => set('email.smtpUser', e.target.value)}
                  placeholder="no-reply@b3hub.lv"
                  disabled={!enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email.smtpPass">Parole / App Password</Label>
                <div className="relative">
                  <Input
                    id="email.smtpPass"
                    type={showPassword ? 'text' : 'password'}
                    value={str(settings, 'email.smtpPass')}
                    onChange={(e) => set('email.smtpPass', e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    disabled={!enabled}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">TLS/SSL</p>
                <p className="text-xs text-muted-foreground">
                  Ieslēdziet STARTTLS (ports 587) vai SSL (ports 465). Atstājiet izslēgtu tikai
                  lokālam testēšanas SMTP.
                </p>
              </div>
              <Switch
                id="email.smtpSecure"
                checked={bool(settings, 'email.smtpSecure')}
                onCheckedChange={(v) => set('email.smtpSecure', String(v))}
                disabled={!enabled}
              />
            </div>

            <SaveRow
              saveState={connSave}
              onSave={() =>
                save(
                  [
                    'email.enabled',
                    'email.smtpHost',
                    'email.smtpPort',
                    'email.smtpUser',
                    'email.smtpPass',
                    'email.smtpSecure',
                  ],
                  setConnSave,
                )
              }
            />
          </CardContent>
        </Card>

        {/* Sender identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sūtītāja identitāte</CardTitle>
            <CardDescription>
              No kura e-pasta vārda un adreses tiek sūtīti visi tirgus e-pasti.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email.fromName">Sūtītāja vārds</Label>
                <Input
                  id="email.fromName"
                  value={str(settings, 'email.fromName', 'B3Hub')}
                  onChange={(e) => set('email.fromName', e.target.value)}
                  placeholder="B3Hub"
                  disabled={!enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email.fromAddress">Sūtītāja adrese (From)</Label>
                <Input
                  id="email.fromAddress"
                  type="email"
                  value={str(settings, 'email.fromAddress')}
                  onChange={(e) => set('email.fromAddress', e.target.value)}
                  placeholder="no-reply@b3hub.lv"
                  disabled={!enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email.replyTo">Reply-To adrese (pēc izvēles)</Label>
                <Input
                  id="email.replyTo"
                  type="email"
                  value={str(settings, 'email.replyTo')}
                  onChange={(e) => set('email.replyTo', e.target.value)}
                  placeholder="support@b3hub.lv"
                  disabled={!enabled}
                />
              </div>
            </div>

            <SaveRow
              saveState={senderSave}
              onSave={() =>
                save(['email.fromName', 'email.fromAddress', 'email.replyTo'], setSenderSave)
              }
            />
          </CardContent>
        </Card>

        {/* Notification triggers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">E-pasta paziņojumu trigeri</CardTitle>
            <CardDescription>Kuri notikumi automātiski sūta e-pastu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'email.sendOrderConfirmation',
                label: 'Pasūtījuma apstiprinājums',
                desc: 'Pircējam pēc pasūtījuma veikšanas',
              },
              {
                key: 'email.sendDeliveryConfirmation',
                label: 'Piegādes apstiprinājums',
                desc: 'Pircējam pēc piegādes pabeigšanas',
              },
              {
                key: 'email.sendInvoice',
                label: 'Rēķins',
                desc: 'B2B klientiem pēc pasūtījuma izpildes',
              },
              {
                key: 'email.sendPayoutNotification',
                label: 'Izmaksas paziņojums',
                desc: 'Piegādātājiem un pārvadātājiem par ieskaitīto summu',
              },
              {
                key: 'email.sendRegistrationWelcome',
                label: 'Reģistrācijas apsveikums',
                desc: 'Jauniem lietotājiem pēc konta izveides',
              },
              {
                key: 'email.sendPasswordReset',
                label: 'Paroles atiestatīšana',
                desc: 'Drošības e-pasts paroles maiņas gadījumā',
              },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  id={key}
                  checked={bool(settings, key)}
                  onCheckedChange={(v) => set(key, String(v))}
                  disabled={!enabled}
                />
              </div>
            ))}
            <Separator />
            <SaveRow
              saveState={triggerSave}
              onSave={() =>
                save(
                  [
                    'email.sendOrderConfirmation',
                    'email.sendDeliveryConfirmation',
                    'email.sendInvoice',
                    'email.sendPayoutNotification',
                    'email.sendRegistrationWelcome',
                    'email.sendPasswordReset',
                  ],
                  setTriggerSave,
                )
              }
            />
          </CardContent>
        </Card>

        {/* Test send */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Testa e-pasts</CardTitle>
            <CardDescription>
              Nosūtiet testa e-pastu, lai pārbaudītu SMTP savienojumu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="jūsu@epasts.lv"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                disabled={!enabled || testState === 'sending'}
                className="max-w-sm"
              />
              <Button
                variant="outline"
                onClick={sendTestEmail}
                disabled={!enabled || !testEmail || testState === 'sending'}
              >
                {testState === 'sending' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                {testState === 'sent'
                  ? 'Nosūtīts!'
                  : testState === 'error'
                    ? 'Kļūda'
                    : 'Sūtīt testu'}
              </Button>
            </div>
            {testState === 'sent' && (
              <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Testa e-pasts nosūtīts uz {testEmail}
              </p>
            )}
            {testState === 'error' && (
              <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Neizdevās nosūtīt — pārbaudiet SMTP
                iestatījumus
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
