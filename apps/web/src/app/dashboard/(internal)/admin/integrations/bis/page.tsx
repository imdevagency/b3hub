'use client';

/**
 * /dashboard/admin/integrations/bis
 *
 * BIS (Būvniecības informācijas sistēma) — Platformas integrācija
 * https://bis.gov.lv
 *
 * Pārvalda BIS OAuth2 savienojumu, ko izmanto B3Hub platforma:
 *   • Tirgus pasūtījumos — BIS projektu numuru validācija
 *   • Lursoft/BIS apvienota pārbaude B2B reģistrācijai
 *
 * Savienojums ir kopīgs — viena OAuth2 klienta atslēga.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Wifi,
  WifiOff,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getBisSettings,
  updateBisSettings,
  bisTestConnection,
  type BisSettings,
} from '@/lib/api/bis';
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

export default function PlatformBisPage() {
  const { token: authTok } = useAuth();
  const token = authTok ?? '';

  // BIS OAuth2 connection
  const [bisSettings, setBisSettings] = useState<BisSettings | null>(null);
  const [bisLoading, setBisLoading] = useState(true);
  const [connSave, setConnSave] = useState<SaveState>('idle');
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Local form values for credentials
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [enabled, setEnabled] = useState(false);

  // Marketplace usage settings (flat PlatformSetting)
  const [usageSettings, setUsageSettings] = useState<Record<string, string> | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageSave, setUsageSave] = useState<SaveState>('idle');

  // ─── load ────────────────────────────────────────────────────────────────

  const loadBis = useCallback(async () => {
    if (!token) return;
    setBisLoading(true);
    try {
      const s = await getBisSettings(token);
      setBisSettings(s);
      setClientId(s.clientId);
      setClientSecret('');
      setApiBaseUrl(s.apiBaseUrl);
      setEnabled(s.enabled);
    } catch {
      /* silently fail — handled below */
    } finally {
      setBisLoading(false);
    }
  }, [token]);

  const loadUsage = useCallback(async () => {
    if (!token) return;
    setUsageLoading(true);
    try {
      setUsageSettings(await adminGetSettings(token));
    } finally {
      setUsageLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBis();
    loadUsage();
  }, [loadBis, loadUsage]);

  // ─── save connection ─────────────────────────────────────────────────────

  async function saveConn() {
    if (!token) return;
    setConnSave('saving');
    try {
      await updateBisSettings(token, {
        clientId,
        clientSecret,
        apiBaseUrl: apiBaseUrl || undefined,
        enabled,
      });
      await loadBis();
      setClientSecret('');
      setConnSave('saved');
      setTimeout(() => setConnSave('idle'), 2500);
    } catch {
      setConnSave('error');
    }
  }

  // ─── test connection ─────────────────────────────────────────────────────

  async function testConn() {
    if (!token) return;
    setTestState('testing');
    try {
      const res = await bisTestConnection(token);
      setTestState(res.ok ? 'ok' : 'fail');
      setTestMsg(res.message);
    } catch {
      setTestState('fail');
      setTestMsg('Savienojuma tests neizdevās.');
    }
  }

  // ─── save usage settings ─────────────────────────────────────────────────

  async function saveUsage(keys: string[]) {
    if (!token || !usageSettings) return;
    setUsageSave('saving');
    try {
      await adminUpdateSettings(
        Object.fromEntries(keys.map((k) => [k, usageSettings[k] ?? ''])),
        token,
      );
      setUsageSave('saved');
      setTimeout(() => setUsageSave('idle'), 2500);
    } catch {
      setUsageSave('error');
    }
  }

  function setUsage(key: string, value: string) {
    setUsageSettings((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  // ─── render ──────────────────────────────────────────────────────────────

  const isConnected = bisSettings?.enabled && bisSettings?.hasClientSecret;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="BIS — Platforma"
        description="Būvniecības informācijas sistēmas integrācija — BIS OAuth2 savienojums un tirgu izmantojums."
        action={
          <a
            href="https://bis.gov.lv"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            bis.gov.lv <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      {/* Scope notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          BIS OAuth2 savienojums ir vienots visai platformai — to izmanto gan tirgus pasūtījumu
          validācijai, gan B2B reģistrācijas pārbaudei.
        </div>
      </div>

      <Tabs defaultValue="marketplace">
        <TabsList>
          <TabsTrigger value="marketplace" className="gap-1.5">
            <Info className="h-3.5 w-3.5" /> Tirgus izmantojums
          </TabsTrigger>
          <TabsTrigger value="connection" className="gap-1.5">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}{' '}
            Savienojums
            {isConnected && (
              <Badge
                variant="outline"
                className="ml-1 text-xs py-0 px-1.5 text-emerald-600 border-emerald-300"
              >
                Aktīvs
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Marketplace usage tab ───────────────────────────────────────── */}
        <TabsContent value="marketplace" className="mt-5 space-y-4">
          {usageLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">BIS pasūtījumos</CardTitle>
                <CardDescription>Kā BIS tiek izmantots tirgus pasūtījumu plūsmā.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Validēt BIS numurus pasūtījumos</p>
                    <p className="text-xs text-muted-foreground">
                      Pasūtījuma veidlapā pircēji var norādīt BIS projekta numuru — sistēma to
                      validē pret BIS reģistru
                    </p>
                  </div>
                  <Switch
                    id="bis.validateOnOrder"
                    checked={bool(usageSettings, 'bis.validateOnOrder')}
                    onCheckedChange={(v) => setUsage('bis.validateOnOrder', String(v))}
                    disabled={!isConnected}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Ielādēt B3Construction aktīvos projektus</p>
                    <p className="text-xs text-muted-foreground">
                      Pasūtījuma veidlapā piedāvā aktīvos B3Construction BIS projektus kā ātrās
                      izvēles opciju
                    </p>
                  </div>
                  <Switch
                    id="bis.loadB3Projects"
                    checked={bool(usageSettings, 'bis.loadB3Projects')}
                    onCheckedChange={(v) => setUsage('bis.loadB3Projects', String(v))}
                    disabled={!isConnected}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bis.b3ConstructionRegNum">
                    B3Construction reģistrācijas numurs BIS
                  </Label>
                  <Input
                    id="bis.b3ConstructionRegNum"
                    value={str(usageSettings, 'bis.b3ConstructionRegNum')}
                    onChange={(e) => setUsage('bis.b3ConstructionRegNum', e.target.value)}
                    placeholder="40003XXXXXX"
                    disabled={!isConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    Izmanto, lai filtrētu B3Construction aktīvos projektus no BIS
                  </p>
                </div>

                {!isConnected && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Konfigurējiet BIS savienojumu cilnē "Savienojums", lai iespējotu šīs opcijas.
                  </div>
                )}

                <SaveRow
                  saveState={usageSave}
                  onSave={() =>
                    saveUsage([
                      'bis.validateOnOrder',
                      'bis.loadB3Projects',
                      'bis.b3ConstructionRegNum',
                    ])
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Connection tab ───────────────────────────────────────────────── */}
        <TabsContent value="connection" className="mt-5 space-y-4">
          {bisLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Status */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">BIS OAuth2 savienojums</CardTitle>
                      <CardDescription className="mt-1">
                        BIS izmanto OAuth2 client credentials grant. Klienta ID un noslēpums
                        saņemami no bis.gov.lv portāla.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          isConnected
                            ? 'text-emerald-600 border-emerald-300 bg-emerald-50'
                            : 'text-muted-foreground'
                        }
                      >
                        {isConnected ? 'Aktīvs' : 'Nav konfigurēts'}
                      </Badge>
                      <Switch id="bis.enabled" checked={enabled} onCheckedChange={setEnabled} />
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Credentials */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">OAuth2 akreditācijas dati</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="bis.clientId">Klienta ID (client_id)</Label>
                      <Input
                        id="bis.clientId"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        autoComplete="off"
                        placeholder="b3hub-marketplace"
                        disabled={!enabled}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bis.clientSecret">Klienta noslēpums (client_secret)</Label>
                      <div className="relative">
                        <Input
                          id="bis.clientSecret"
                          type={showSecret ? 'text' : 'password'}
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                          autoComplete="new-password"
                          placeholder={
                            bisSettings?.hasClientSecret ? '••••••••  (saglabāts)' : '••••••••'
                          }
                          disabled={!enabled}
                          className="pr-9"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowSecret((v) => !v)}
                          tabIndex={-1}
                        >
                          {showSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {bisSettings?.hasClientSecret && (
                        <p className="text-xs text-muted-foreground">
                          Atstājiet tukšu, lai saglabātu esošo noslēpumu.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bis.apiBaseUrl">BIS API bāzes adrese</Label>
                    <Input
                      id="bis.apiBaseUrl"
                      value={apiBaseUrl}
                      onChange={(e) => setApiBaseUrl(e.target.value)}
                      placeholder="https://bis.gov.lv/bisp"
                      disabled={!enabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      Standarta: <code>https://bis.gov.lv/bisp</code>. Mainiet tikai ja BVKB norāda
                      citu.
                    </p>
                  </div>

                  <Separator />

                  {/* Test connection */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={testConn}
                      disabled={testState === 'testing' || !enabled}
                    >
                      {testState === 'testing' ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Testēt savienojumu
                    </Button>
                    {testState === 'ok' && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {testMsg || 'Savienojums veiksmīgs'}
                      </span>
                    )}
                    {testState === 'fail' && (
                      <span className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {testMsg || 'Savienojums neizdevās'}
                      </span>
                    )}
                  </div>

                  <SaveRow saveState={connSave} onSave={saveConn} />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
