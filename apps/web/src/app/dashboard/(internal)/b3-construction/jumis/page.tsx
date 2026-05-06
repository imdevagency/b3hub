'use client';

/**
 * /dashboard/b3-construction/jumis
 *
 * Jumis grāmatvedības integrācija — B3 Construction
 * https://www.jumis.lv
 *
 * Konfigurē savienojumu ar Jumis serveri un automātiskā eksporta opcijas:
 * rēķini, piegādātāju un pārvadātāju norēķini, ietvarlīgumu avansi.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Plug,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import Link from 'next/link';
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

function SaveRow({
  saveState,
  onSave,
}: {
  saveState: SaveState;
  onSave: () => void;
}) {
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
        {saveState === 'saving' ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : null}
        Saglabāt
      </Button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function JumisPage() {
  const { session } = useAuth();

  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [showApiKey, setShowApiKey] = useState(false);

  // ─── load settings ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetSettings(session.access_token);
      setSettings(data);
    } catch {
      setError('Neizdevās ielādēt iestatījumus.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── local mutations ─────────────────────────────────────────────────────

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  // ─── save ─────────────────────────────────────────────────────────────────

  async function save(keys: string[]) {
    if (!session?.access_token || !settings) return;
    setSaveState('saving');
    try {
      const patch = Object.fromEntries(keys.map((k) => [k, settings[k] ?? '']));
      await adminUpdateSettings(session.access_token, patch);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    }
  }

  // ─── derived ──────────────────────────────────────────────────────────────

  const jumisEnabled = bool(settings, 'b3construction.jumis.enabled');

  // ─── loading / error states ───────────────────────────────────────────────

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
        <PageHeader title="Jumis" description="Grāmatvedības integrācija" />
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
        title="Jumis — B3 Construction"
        description="Jumis integrācija B3 Construction SIA grāmatvedībai — rēķinu un norēķinu eksports."
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
          <strong>B3 Construction SIA</strong> Jumis konts. B3Hub platforma izmanto{' '}
          <Link
            href="/dashboard/admin/integrations/jumis"
            className="underline underline-offset-4 hover:text-blue-900"
          >
            atsevišķu kontu
          </Link>
          .
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Enable / status ────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plug className="h-4 w-4" />
                  Savienojuma statuss
                </CardTitle>
                <CardDescription className="mt-1">
                  Ieslēdzot integrāciju, sistēma sāk sūtīt datus uz Jumis serveri.
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
                  id="b3construction.jumis.enabled"
                  checked={jumisEnabled}
                  onCheckedChange={(v) => set('b3construction.jumis.enabled', String(v))}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* ── Connection settings ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Savienojuma dati</CardTitle>
            <CardDescription>Jumis servera adrese un autentifikācijas dati.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="b3construction.jumis.apiUrl">Jumis servera adrese (URL)</Label>
                <Input
                  id="b3construction.jumis.apiUrl"
                  value={str(settings, 'b3construction.jumis.apiUrl')}
                  onChange={(e) => set('b3construction.jumis.apiUrl', e.target.value)}
                  placeholder="https://jūsu-jumis-serveris.lv/api"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b3construction.jumis.companyCode">Uzņēmuma kods Jumis sistēmā</Label>
                <Input
                  id="b3construction.jumis.companyCode"
                  value={str(settings, 'b3construction.jumis.companyCode')}
                  onChange={(e) => set('b3construction.jumis.companyCode', e.target.value)}
                  placeholder="B3CONST"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b3construction.jumis.username">Lietotājvārds</Label>
                <Input
                  id="b3construction.jumis.username"
                  value={str(settings, 'b3construction.jumis.username')}
                  onChange={(e) => set('b3construction.jumis.username', e.target.value)}
                  autoComplete="off"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b3construction.jumis.apiKey">API atslēga / Parole</Label>
                <div className="relative">
                  <Input
                    id="b3construction.jumis.apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={str(settings, 'b3construction.jumis.apiKey')}
                    onChange={(e) => set('b3construction.jumis.apiKey', e.target.value)
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
              saveState={saveState}
              onSave={() =>
                save(['b3construction.jumis.enabled', 'b3construction.jumis.apiUrl', 'b3construction.jumis.companyCode', 'b3construction.jumis.username', 'b3construction.jumis.apiKey'])
              }
            />
          </CardContent>
        </Card>

        {/* ── Export options ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eksporta opcijas</CardTitle>
            <CardDescription>
              Kādi dati automātiski jānosūta uz Jumis pēc katras operācijas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Automātiski eksportēt rēķinus</p>
                <p className="text-xs text-muted-foreground">
                  Katrs jaunais rēķins tiek nosūtīts uz Jumis uzreiz pēc izrakstīšanas
                </p>
              </div>
              <Switch
                id="b3construction.jumis.autoExportInvoices"
                checked={bool(settings, 'b3construction.jumis.autoExportInvoices')}
                onCheckedChange={(v) => set('b3construction.jumis.autoExportInvoices', String(v))}
                disabled={!jumisEnabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Eksportēt piegādātāju norēķinus</p>
                <p className="text-xs text-muted-foreground">
                  Apstiprināti piegādātāju maksājumi (SupplierPayout) tiek reģistrēti Jumis
                </p>
              </div>
              <Switch
                id="b3construction.jumis.exportSupplierPayouts"
                checked={bool(settings, 'b3construction.jumis.exportSupplierPayouts')}
                onCheckedChange={(v) => set('b3construction.jumis.exportSupplierPayouts', String(v))}
                disabled={!jumisEnabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Eksportēt pārvadātāju norēķinus</p>
                <p className="text-xs text-muted-foreground">
                  Apstiprināti pārvadātāju maksājumi (CarrierPayout) tiek reģistrēti Jumis
                </p>
              </div>
              <Switch
                id="b3construction.jumis.exportCarrierPayouts"
                checked={bool(settings, 'b3construction.jumis.exportCarrierPayouts')}
                onCheckedChange={(v) => set('b3construction.jumis.exportCarrierPayouts', String(v))}
                disabled={!jumisEnabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Eksportēt ietvarlīgumu avansa rēķinus</p>
                <p className="text-xs text-muted-foreground">
                  Framework contract advance invoices tiek sinhronizēti ar Jumis
                </p>
              </div>
              <Switch
                id="b3construction.jumis.exportFrameworkAdvances"
                checked={bool(settings, 'b3construction.jumis.exportFrameworkAdvances')}
                onCheckedChange={(v) => set('b3construction.jumis.exportFrameworkAdvances', String(v))}
                disabled={!jumisEnabled}
              />
            </div>

            <Separator />

            <SaveRow
              saveState={saveState}
              onSave={() =>
                save([
                  'b3construction.jumis.enabled',
                  'b3construction.jumis.autoExportInvoices',
                  'b3construction.jumis.exportSupplierPayouts',
                  'b3construction.jumis.exportCarrierPayouts',
                  'b3construction.jumis.exportFrameworkAdvances',
                ])
              }
            />
          </CardContent>
        </Card>

        {/* ── Journal codes ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jumis žurnālu kodi</CardTitle>
            <CardDescription>
              Norādiet Jumis grāmatvedības žurnālu kodus. Atstājiet tukšu, ja nav vajadzīgs
              atsevišķs žurnāls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="b3construction.jumis.journalSales">Pārdošanas žurnāls</Label>
                <Input
                  id="b3construction.jumis.journalSales"
                  value={str(settings, 'b3construction.jumis.journalSales')}
                  onChange={(e) => set('b3construction.jumis.journalSales', e.target.value)}
                  placeholder="PARDSALES"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b3construction.jumis.journalPurchase">Pirkumu žurnāls</Label>
                <Input
                  id="b3construction.jumis.journalPurchase"
                  value={str(settings, 'b3construction.jumis.journalPurchase')}
                  onChange={(e) => set('b3construction.jumis.journalPurchase', e.target.value)}
                  placeholder="PURCHASE"
                  disabled={!jumisEnabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b3construction.jumis.journalBank">Bankas žurnāls</Label>
                <Input
                  id="b3construction.jumis.journalBank"
                  value={str(settings, 'b3construction.jumis.journalBank')}
                  onChange={(e) => set('b3construction.jumis.journalBank', e.target.value)}
                  placeholder="BANK"
                  disabled={!jumisEnabled}
                />
              </div>
            </div>

            {str(settings, 'b3construction.jumis.lastSyncAt') && (
              <p className="text-xs text-muted-foreground">
                Pēdējā veiksmīgā sinhronizācija:{' '}
                <strong>
                  {new Date(str(settings, 'b3construction.jumis.lastSyncAt')).toLocaleString('lv-LV')}
                </strong>
              </p>
            )}

            <SaveRow
              saveState={saveState}
              onSave={() =>
                save([
                  'b3construction.jumis.enabled',
                  'b3construction.jumis.journalSales',
                  'b3construction.jumis.journalPurchase',
                  'b3construction.jumis.journalBank',
                ])
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
