'use client';

/**
 * /dashboard/admin/integrations/jumis
 *
 * Jumis grāmatvedības integrācija — B3Hub platforma (B3Hub SIA)
 * https://www.jumis.lv
 *
 * Šī integrācija ir paredzēta B3Hub SIA kā juridiskai personai:
 * tirgu rēķini, piegādātāju un pārvadātāju norēķini.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Receipt,
  Eye,
  EyeOff,
  Info,
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

// ─── helpers ────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function str(s: Record<string, string> | null, key: string, fallback = ''): string {
  return s?.[key] ?? fallback;
}

function bool(s: Record<string, string> | null, key: string): boolean {
  return s?.[key] === 'true';
}

// ─── SaveRow ────────────────────────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PlatformJumisPage() {
  const { session } = useAuth();

  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connSave, setConnSave] = useState<SaveState>('idle');
  const [exportSave, setExportSave] = useState<SaveState>('idle');
  const [journalSave, setJournalSave] = useState<SaveState>('idle');
  const [showApiKey, setShowApiKey] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      setSettings(await adminGetSettings(session.access_token));
    } catch {
      setError('Neizdevās ielādēt iestatījumus.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  async function save(keys: string[], setSave: (s: SaveState) => void) {
    if (!session?.access_token || !settings) return;
    setSave('saving');
    try {
      await adminUpdateSettings(
        session.access_token,
        Object.fromEntries(keys.map((k) => [k, settings[k] ?? ''])),
      );
      setSave('saved');
      setTimeout(() => setSave('idle'), 2500);
    } catch {
      setSave('error');
    }
  }

  const jumisEnabled = bool(settings, 'jumis.enabled');

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
        <PageHeader title="Jumis — Platforma" description="B3Hub SIA grāmatvedības integrācija" />
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
        title="Jumis — Platforma"
        description="Jumis integrācija B3Hub SIA grāmatvedībai — tirgu rēķini, norēķini ar piegādātājiem un pārvadātājiem."
      >
        <a
          href="https://www.jumis.lv"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          jumis.lv <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </PageHeader>

      {/* Scope notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>B3Hub SIA</strong> Jumis konts — apkopo tirgus rēķinus un apakšuzņēmēju norēķinus.
        </div>
      </div>

      <div className="space-y-4">
        {/* Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Savienojuma statuss
                </CardTitle>
                <CardDescription className="mt-1">
                  Ieslēdzot, sistēma sāk eksportēt darījumus uz B3Hub SIA Jumis serveri.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Badge
                  variant="outline"
                  className={
                    jumisEnabled
                      ? 'text-emerald-600 border-emerald-300 bg-emerald-50'
                      : 'text-muted-foreground'
                  }
                >
                  {jumisEnabled ? 'Aktīvs' : 'Izslēgts'}
                </Badge>
                <Switch
                  id="jumis.enabled"
                  checked={jumisEnabled}
                  onCheckedChange={(v) => set('jumis.enabled', String(v))}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Savienojuma dati</CardTitle>
            <CardDescription>B3Hub SIA Jumis servera adrese un autentifikācija.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="jumis.apiUrl">Jumis servera adrese (URL)</Label>
                <Input
                  id="jumis.apiUrl"
                  value={str(settings, 'jumis.apiUrl')}
                  onChange={(e) => set('jumis.apiUrl', e.target.value)}
                  placeholder="https://jūsu-jumis-serveris.lv/api"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jumis.companyCode">Uzņēmuma kods Jumis sistēmā</Label>
                <Input
                  id="jumis.companyCode"
                  value={str(settings, 'jumis.companyCode')}
                  onChange={(e) => set('jumis.companyCode', e.target.value)}
                  placeholder="B3HUB"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jumis.username">Lietotājvārds</Label>
                <Input
                  id="jumis.username"
                  value={str(settings, 'jumis.username')}
                  onChange={(e) => set('jumis.username', e.target.value)}
                  autoComplete="off"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jumis.apiKey">API atslēga / Parole</Label>
                <div className="relative">
                  <Input
                    id="jumis.apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={str(settings, 'jumis.apiKey')}
                    onChange={(e) => set('jumis.apiKey', e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    disabled={!jumisEnabled}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowApiKey((v) => !v)}
                    tabIndex={-1}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <SaveRow
              saveState={connSave}
              onSave={() =>
                save(
                  [
                    'jumis.enabled',
                    'jumis.apiUrl',
                    'jumis.companyCode',
                    'jumis.username',
                    'jumis.apiKey',
                  ],
                  setConnSave,
                )
              }
            />
          </CardContent>
        </Card>

        {/* Export options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eksporta opcijas</CardTitle>
            <CardDescription>
              Kādi tirgus darījumi automātiski jāreģistrē B3Hub SIA Jumis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'jumis.autoExportInvoices',
                label: 'Automātiski eksportēt rēķinus',
                desc: 'Katrs jaunais rēķins tiek nosūtīts uz Jumis uzreiz pēc izrakstīšanas',
              },
              {
                key: 'jumis.exportSupplierPayouts',
                label: 'Eksportēt piegādātāju norēķinus',
                desc: 'Apstiprināti piegādātāju maksājumi (SupplierPayout) tiek reģistrēti Jumis',
              },
              {
                key: 'jumis.exportCarrierPayouts',
                label: 'Eksportēt pārvadātāju norēķinus',
                desc: 'Apstiprināti pārvadātāju maksājumi (CarrierPayout) tiek reģistrēti Jumis',
              },
              {
                key: 'jumis.exportFrameworkAdvances',
                label: 'Eksportēt ietvarlīgumu avansa rēķinus',
                desc: 'Framework contract advance invoices tiek sinhronizēti ar Jumis',
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
                  disabled={!jumisEnabled}
                />
              </div>
            ))}
            <Separator />
            <SaveRow
              saveState={exportSave}
              onSave={() =>
                save(
                  [
                    'jumis.enabled',
                    'jumis.autoExportInvoices',
                    'jumis.exportSupplierPayouts',
                    'jumis.exportCarrierPayouts',
                    'jumis.exportFrameworkAdvances',
                  ],
                  setExportSave,
                )
              }
            />
          </CardContent>
        </Card>

        {/* Journal codes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jumis žurnālu kodi</CardTitle>
            <CardDescription>Atstājiet tukšu, ja nav vajadzīgs atsevišķs žurnāls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  key: 'jumis.journalSales',
                  label: 'Pārdošanas žurnāls',
                  placeholder: 'PARDSALES',
                },
                { key: 'jumis.journalPurchase', label: 'Pirkumu žurnāls', placeholder: 'PURCHASE' },
                { key: 'jumis.journalBank', label: 'Bankas žurnāls', placeholder: 'BANK' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={str(settings, key)}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={placeholder}
                    disabled={!jumisEnabled}
                  />
                </div>
              ))}
            </div>
            {str(settings, 'jumis.lastSyncAt') && (
              <p className="text-xs text-muted-foreground">
                Pēdējā sinhronizācija:{' '}
                <strong>
                  {new Date(str(settings, 'jumis.lastSyncAt')).toLocaleString('lv-LV')}
                </strong>
              </p>
            )}
            <SaveRow
              saveState={journalSave}
              onSave={() =>
                save(
                  [
                    'jumis.enabled',
                    'jumis.journalSales',
                    'jumis.journalPurchase',
                    'jumis.journalBank',
                  ],
                  setJournalSave,
                )
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
