'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings2,
  Plug,
  Building2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminGetSettings, adminUpdateSettings } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ─── Helper: read/write typed values from the flat settings map ──────────────

function str(s: Record<string, string>, key: string, fallback = '') {
  return s[key] ?? fallback;
}
function bool(s: Record<string, string>, key: string, fallback = false) {
  if (!(key in s)) return fallback;
  return s[key] === 'true';
}

// ─── Section: save button row ─────────────────────────────────────────────────

function SaveRow({
  saveState,
  onSave,
  disabled,
}: {
  saveState: SaveState;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button onClick={onSave} disabled={saveState === 'saving' || disabled} size="sm">
        {saveState === 'saving' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
        )}
        Saglabāt
      </Button>
      {saveState === 'saved' && (
        <span className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> Saglabāts
        </span>
      )}
      {saveState === 'error' && (
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> Kļūda saglabājot
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-tab save state
  const [platformSave, setPlatformSave] = useState<SaveState>('idle');
  const [jumisSave, setJumisSave] = useState<SaveState>('idle');
  const [bisSave, setBisSave] = useState<SaveState>('idle');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await adminGetSettings(token);
      setSettings(s);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kļūda ielādējot iestatījumus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) load();
  }, [authLoading, token, load]);

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save(keys: string[], setSaveState: (s: SaveState) => void) {
    setSaveState('saving');
    const patch: Record<string, string> = {};
    for (const k of keys) patch[k] = settings[k] ?? '';
    try {
      const updated = await adminUpdateSettings(patch, token);
      setSettings(updated);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>{loadError}</span>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Mēģināt vēlreiz
        </Button>
      </div>
    );
  }

  // ─── Derived local values ──────────────────────────────────────────────────

  const jumisEnabled = bool(settings, 'jumis.enabled');
  const bisEnabled = bool(settings, 'bis.enabled');

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Platformas iestatījumi"
        description="Globāla konfigurācija — Jumis integrācija, BIS, platformas parametri"
      />

      <Tabs defaultValue="platform">
        <TabsList>
          <TabsTrigger value="platform" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" /> Platforma
          </TabsTrigger>
          <TabsTrigger value="jumis" className="gap-1.5">
            <Plug className="h-3.5 w-3.5" /> Jumis
            {jumisEnabled && (
              <Badge
                variant="outline"
                className="ml-1 text-xs py-0 px-1.5 text-emerald-600 border-emerald-300"
              >
                Aktīvs
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bis" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> BIS
            {bisEnabled && (
              <Badge
                variant="outline"
                className="ml-1 text-xs py-0 px-1.5 text-emerald-600 border-emerald-300"
              >
                Aktīvs
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Platform tab ───────────────────────────────────────────────── */}
        <TabsContent value="platform" className="mt-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vispārīgie parametri</CardTitle>
              <CardDescription>Noklusējuma vērtības visai platformai</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="platform.name">Platformas nosaukums</Label>
                  <Input
                    id="platform.name"
                    value={str(settings, 'platform.name', 'B3Hub')}
                    onChange={(e) => set('platform.name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="platform.supportEmail">Atbalsta e-pasts</Label>
                  <Input
                    id="platform.supportEmail"
                    type="email"
                    value={str(settings, 'platform.supportEmail')}
                    onChange={(e) => set('platform.supportEmail', e.target.value)}
                    placeholder="support@b3hub.lv"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="platform.defaultCurrency">Noklusējuma valūta</Label>
                  <Input
                    id="platform.defaultCurrency"
                    value={str(settings, 'platform.defaultCurrency', 'EUR')}
                    onChange={(e) => set('platform.defaultCurrency', e.target.value)}
                    maxLength={3}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="platform.vatRate">PVN likme (%)</Label>
                  <Input
                    id="platform.vatRate"
                    type="number"
                    min={0}
                    max={100}
                    value={str(settings, 'platform.vatRate', '21')}
                    onChange={(e) => set('platform.vatRate', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Noklusējuma komisijas likmes</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="platform.defaultSupplierCommission">Piegādātājiem (%)</Label>
                    <Input
                      id="platform.defaultSupplierCommission"
                      type="number"
                      min={0}
                      max={100}
                      value={str(settings, 'platform.defaultSupplierCommission', '6')}
                      onChange={(e) => set('platform.defaultSupplierCommission', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="platform.defaultCarrierCommission">Pārvadātājiem (%)</Label>
                    <Input
                      id="platform.defaultCarrierCommission"
                      type="number"
                      min={0}
                      max={100}
                      value={str(settings, 'platform.defaultCarrierCommission', '8')}
                      onChange={(e) => set('platform.defaultCarrierCommission', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <SaveRow
                saveState={platformSave}
                onSave={() =>
                  save(
                    [
                      'platform.name',
                      'platform.supportEmail',
                      'platform.defaultCurrency',
                      'platform.vatRate',
                      'platform.defaultSupplierCommission',
                      'platform.defaultCarrierCommission',
                    ],
                    setPlatformSave,
                  )
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Jumis tab ──────────────────────────────────────────────────── */}
        <TabsContent value="jumis" className="mt-5 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Jumis grāmatvedības integrācija</CardTitle>
                  <CardDescription className="mt-1">
                    Savienojums ar Jumis (jumis.lv) — rēķinu un norēķinu eksports.{' '}
                    <a
                      href="https://www.jumis.lv"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline"
                    >
                      jumis.lv <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    id="jumis.enabled"
                    checked={jumisEnabled}
                    onCheckedChange={(v) => set('jumis.enabled', String(v))}
                  />
                  <Label htmlFor="jumis.enabled" className="text-sm">
                    {jumisEnabled ? 'Ieslēgts' : 'Izslēgts'}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Connection settings */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Savienojuma dati
                </p>
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
                      placeholder="B3GROUP"
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
                    <Input
                      id="jumis.apiKey"
                      type="password"
                      value={str(settings, 'jumis.apiKey')}
                      onChange={(e) => set('jumis.apiKey', e.target.value)}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      disabled={!jumisEnabled}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sync options */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Eksporta opcijas
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Automātiski eksportēt rēķinus</p>
                      <p className="text-xs text-muted-foreground">
                        Katrs jaunais rēķins tiek nosūtīts uz Jumis uzreiz pēc izrakstīšanas
                      </p>
                    </div>
                    <Switch
                      id="jumis.autoExportInvoices"
                      checked={bool(settings, 'jumis.autoExportInvoices')}
                      onCheckedChange={(v) => set('jumis.autoExportInvoices', String(v))}
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
                      id="jumis.exportSupplierPayouts"
                      checked={bool(settings, 'jumis.exportSupplierPayouts')}
                      onCheckedChange={(v) => set('jumis.exportSupplierPayouts', String(v))}
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
                      id="jumis.exportCarrierPayouts"
                      checked={bool(settings, 'jumis.exportCarrierPayouts')}
                      onCheckedChange={(v) => set('jumis.exportCarrierPayouts', String(v))}
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
                      id="jumis.exportFrameworkAdvances"
                      checked={bool(settings, 'jumis.exportFrameworkAdvances')}
                      onCheckedChange={(v) => set('jumis.exportFrameworkAdvances', String(v))}
                      disabled={!jumisEnabled}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Journal codes */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Jumis žurnālu kodi
                </p>
                <p className="text-xs text-muted-foreground">
                  Norādiet Jumis grāmatvedības žurnālu kodus, kuros jāiegrāmato attiecīgās
                  operācijas. Atstājiet tukšu, ja nav vajadzīgs atsevišķs žurnāls.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="jumis.journalSales">Pārdošanas žurnāls</Label>
                    <Input
                      id="jumis.journalSales"
                      value={str(settings, 'jumis.journalSales')}
                      onChange={(e) => set('jumis.journalSales', e.target.value)}
                      placeholder="PARDSALES"
                      disabled={!jumisEnabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="jumis.journalPurchase">Pirkumu žurnāls</Label>
                    <Input
                      id="jumis.journalPurchase"
                      value={str(settings, 'jumis.journalPurchase')}
                      onChange={(e) => set('jumis.journalPurchase', e.target.value)}
                      placeholder="PURCHASE"
                      disabled={!jumisEnabled}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="jumis.journalBank">Bankas žurnāls</Label>
                    <Input
                      id="jumis.journalBank"
                      value={str(settings, 'jumis.journalBank')}
                      onChange={(e) => set('jumis.journalBank', e.target.value)}
                      placeholder="BANK"
                      disabled={!jumisEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Last sync info */}
              {str(settings, 'jumis.lastSyncAt') && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Pēdējā veiksmīgā sinhronizācija:{' '}
                    <strong>
                      {new Date(str(settings, 'jumis.lastSyncAt')).toLocaleString('lv-LV')}
                    </strong>
                  </p>
                </>
              )}

              <SaveRow
                saveState={jumisSave}
                onSave={() =>
                  save(
                    [
                      'jumis.enabled',
                      'jumis.apiUrl',
                      'jumis.companyCode',
                      'jumis.username',
                      'jumis.apiKey',
                      'jumis.autoExportInvoices',
                      'jumis.exportSupplierPayouts',
                      'jumis.exportCarrierPayouts',
                      'jumis.exportFrameworkAdvances',
                      'jumis.journalSales',
                      'jumis.journalPurchase',
                      'jumis.journalBank',
                    ],
                    setJumisSave,
                  )
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BIS tab ────────────────────────────────────────────────────── */}
        <TabsContent value="bis" className="mt-5 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    BIS — Būvniecības informācijas sistēma
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Integrācija ar bis.gov.lv — būvprojektu numuru validācija un piesaiste
                    pasūtījumiem.{' '}
                    <a
                      href="https://www.bis.gov.lv"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline"
                    >
                      bis.gov.lv <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    id="bis.enabled"
                    checked={bisEnabled}
                    onCheckedChange={(v) => set('bis.enabled', String(v))}
                  />
                  <Label htmlFor="bis.enabled" className="text-sm">
                    {bisEnabled ? 'Ieslēgts' : 'Izslēgts'}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bis.apiKey">BIS API atslēga</Label>
                  <Input
                    id="bis.apiKey"
                    type="password"
                    value={str(settings, 'bis.apiKey')}
                    onChange={(e) => set('bis.apiKey', e.target.value)}
                    placeholder="••••••••"
                    disabled={!bisEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Saņemama no bis.gov.lv portāla API pārvaldes sadaļas
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bis.apiUrl">BIS API bāzes adrese</Label>
                  <Input
                    id="bis.apiUrl"
                    value={str(settings, 'bis.apiUrl', 'https://api.bis.gov.lv/v1')}
                    onChange={(e) => set('bis.apiUrl', e.target.value)}
                    disabled={!bisEnabled}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
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
                    checked={bool(settings, 'bis.validateOnOrder')}
                    onCheckedChange={(v) => set('bis.validateOnOrder', String(v))}
                    disabled={!bisEnabled}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Ielādēt B3Construction projektus</p>
                    <p className="text-xs text-muted-foreground">
                      Pasūtījuma veidlapā parāda aktīvos B3Construction BIS projektus kā ātrās
                      izvēles opciju
                    </p>
                  </div>
                  <Switch
                    id="bis.loadB3Projects"
                    checked={bool(settings, 'bis.loadB3Projects')}
                    onCheckedChange={(v) => set('bis.loadB3Projects', String(v))}
                    disabled={!bisEnabled}
                  />
                </div>
              </div>

              {/* B3Construction BIS company code */}
              <div className="space-y-1.5">
                <Label htmlFor="bis.b3ConstructionRegNum">
                  B3Construction reģistrācijas numurs BIS
                </Label>
                <Input
                  id="bis.b3ConstructionRegNum"
                  value={str(settings, 'bis.b3ConstructionRegNum')}
                  onChange={(e) => set('bis.b3ConstructionRegNum', e.target.value)}
                  placeholder="40003XXXXXX"
                  disabled={!bisEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Izmanto, lai filtrētu B3Construction aktīvos projektus no BIS
                </p>
              </div>

              <SaveRow
                saveState={bisSave}
                onSave={() =>
                  save(
                    [
                      'bis.enabled',
                      'bis.apiKey',
                      'bis.apiUrl',
                      'bis.validateOnOrder',
                      'bis.loadB3Projects',
                      'bis.b3ConstructionRegNum',
                    ],
                    setBisSave,
                  )
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
