'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings2,
  Plug,
  Building2,
  RefreshCw,
  ExternalLink,
  FileText,
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
  const [companySave, setCompanySave] = useState<SaveState>('idle');

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

  // ─── Derived local values (must be before any early return) ──────────────

  const jumisEnabled = bool(settings, 'jumis.enabled');
  const bisEnabled = bool(settings, 'bis.enabled');

  // ─── Live invoice preview HTML ────────────────────────────────────────────

  const invoicePreviewHtml = useMemo(() => {
    const name = str(settings, 'company.legalName', 'B3Hub SIA');
    const regNo = str(settings, 'company.regNo', '40003000000');
    const vatNo = str(settings, 'company.vatNo', 'LV40003000000');
    const address = str(settings, 'company.address', 'Rīga, Latvija');
    const iban = str(settings, 'company.iban', 'LV00BANK0000000000000');
    const swift = str(settings, 'company.swift', 'BANKL V2X');
    const bank = str(settings, 'company.bankName', 'SEB banka');
    const email = str(settings, 'company.email', 'support@b3hub.lv');
    const website = str(settings, 'company.website', 'b3hub.lv');
    const today = new Date().toLocaleDateString('lv-LV');
    const dueDate = new Date(Date.now() + 14 * 86400000).toLocaleDateString('lv-LV');
    return { name, regNo, vatNo, address, iban, swift, bank, email, website, today, dueDate };
  }, [settings]);

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

  // ─── Build invoice preview HTML from pre-computed fields ──────────────────

  const { name, regNo, vatNo, address, iban, swift, bank, email, website, today, dueDate } =
    invoicePreviewHtml;

  const invoiceHtml = `<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; background: #e2e5e9; padding: 24px 16px 32px; }
  .page { max-width: 794px; margin: 0 auto; background: #fff; padding: 52px 64px 60px; box-shadow: 0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08); border-radius: 1px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 700; color: #111827; }
  .brand-sub { font-size: 10px; color: #6b7280; margin-top: 4px; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 26px; font-weight: 700; color: #111827; }
  .invoice-title .num { font-size: 11px; color: #6b7280; margin-top: 2px; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  .meta-grid { display: grid; grid-template-columns: 160px 1fr; gap: 4px 8px; margin-bottom: 16px; }
  .meta-grid .label { color: #6b7280; }
  .meta-grid .value { font-weight: 500; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
  .party-box { background: #f9fafb; border-radius: 8px; padding: 12px; }
  .party-box .role { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 6px; }
  .party-box .company { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
  .party-box .detail { color: #6b7280; font-size: 11px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table thead th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
  table tbody td { padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
  table tbody td:last-child { text-align: right; }
  table thead th:last-child { text-align: right; }
  .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-bottom: 24px; }
  .totals .row { display: flex; gap: 48px; font-size: 12px; }
  .totals .row .lbl { color: #6b7280; width: 120px; text-align: right; }
  .totals .row .val { width: 80px; text-align: right; font-weight: 500; }
  .totals .total-row { display: flex; gap: 48px; font-size: 14px; font-weight: 700; border-top: 2px solid #111827; padding-top: 8px; }
  .totals .total-row .lbl { width: 120px; text-align: right; }
  .totals .total-row .val { width: 80px; text-align: right; }
  .footer { font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; background: #dcfce7; color: #16a34a; margin-bottom: 8px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">${name.replace(/</g, '&lt;')}</div>
      <div class="brand-sub">${email.replace(/</g, '&lt;')} &nbsp;|&nbsp; ${website.replace(/</g, '&lt;')}</div>
    </div>
    <div class="invoice-title">
      <span class="badge">PARAUGS</span>
      <h1>R&#274;&#310;INS</h1>
      <div class="num">#RK-2026-0042</div>
    </div>
  </div>
  <hr/>
  <div class="meta-grid">
    <span class="label">Izrakst&#299;ts:</span><span class="value">${today}</span>
    <span class="label">Apmaks&#257;s ter&#7751;&#353;:</span><span class="value">${dueDate}</span>
    <span class="label">Pas&#363;t&#299;jums:</span><span class="value">#ORD-2026-0117</span>
    <span class="label">Pieg&#257;des adrese:</span><span class="value">Br&#299;v&#299;bas iela 12, R&#299;ga</span>
  </div>
  <hr/>
  <div class="parties">
    <div class="party-box">
      <div class="role">P&#257;rdev&#275;js</div>
      <div class="company">${name.replace(/</g, '&lt;')}</div>
      <div class="detail">
        Re&#291;. nr.: ${regNo.replace(/</g, '&lt;')}<br/>
        PVN nr.: ${vatNo.replace(/</g, '&lt;')}<br/>
        ${address.replace(/</g, '&lt;')}<br/>
        ${email.replace(/</g, '&lt;')}
      </div>
    </div>
    <div class="party-box">
      <div class="role">Pircējs</div>
      <div class="company">Celtniec&#299;bas Firma ABC SIA</div>
      <div class="detail">
        Re&#291;. nr.: 40004123456<br/>
        PVN nr.: LV40004123456<br/>
        Daugavpils iela 5, R&#299;ga<br/>
        info@firma-abc.lv
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Apraksts</th><th>Daudz.</th><th>Vien&#299;ba</th><th>Cena</th><th>Summa</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Grants 0&#8211;32mm pieg&#257;de uz objektu</td>
        <td>25</td><td>t</td><td>18.00 EUR</td><td>450.00 EUR</td>
      </tr>
      <tr>
        <td>Pieg&#257;des pakalpojums (8t kravas auto)</td>
        <td>1</td><td>reise</td><td>85.00 EUR</td><td>85.00 EUR</td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span class="lbl">Starpsumma:</span><span class="val">535.00 EUR</span></div>
    <div class="row"><span class="lbl">PVN (21%):</span><span class="val">112.35 EUR</span></div>
    <div class="total-row"><span class="lbl">KOP&#256;:</span><span class="val">647.35 EUR</span></div>
  </div>
  <div class="footer">
    ${name.replace(/</g, '&lt;')} &nbsp;|&nbsp; Re&#291;. nr.: ${regNo.replace(/</g, '&lt;')} &nbsp;|&nbsp; PVN: ${vatNo.replace(/</g, '&lt;')}<br/>
    ${bank.replace(/</g, '&lt;')} &nbsp;|&nbsp; IBAN: ${iban.replace(/</g, '&lt;')} &nbsp;|&nbsp; SWIFT: ${swift.replace(/</g, '&lt;')}<br/>
    ${address.replace(/</g, '&lt;')} &nbsp;|&nbsp; ${email.replace(/</g, '&lt;')} &nbsp;|&nbsp; ${website.replace(/</g, '&lt;')}
  </div>
</div>
</body>
</html>`;

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
          <TabsTrigger value="company" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Dokumenti
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

        {/* ── Dokumenti (company branding on PDFs) tab ───────────────────── */}
        <TabsContent value="company" className="mt-5">
          <div className="grid xl:grid-cols-[400px_1fr] gap-6 items-start">
            {/* Left: fields */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Uzņēmuma rekvizīti dokumentos</CardTitle>
                  <CardDescription>
                    Šie dati parādās visos automātiski ģenerētos dokumentos — rēķinos, pavadzīmēs un
                    svara zīmēs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Legal identity */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Juridiskā identitāte
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="company.legalName">
                        Juridiskais nosaukums
                      </label>
                      <input
                        id="company.legalName"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={str(settings, 'company.legalName', 'B3Hub SIA')}
                        onChange={(e) => set('company.legalName', e.target.value)}
                        placeholder="B3Hub SIA"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="company.regNo">
                          Reģistrācijas numurs
                        </label>
                        <input
                          id="company.regNo"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={str(settings, 'company.regNo')}
                          onChange={(e) => set('company.regNo', e.target.value)}
                          placeholder="40003000000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="company.vatNo">
                          PVN reģistrācijas nr.
                        </label>
                        <input
                          id="company.vatNo"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={str(settings, 'company.vatNo')}
                          onChange={(e) => set('company.vatNo', e.target.value)}
                          placeholder="LV40003000000"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="company.address">
                        Juridiskā adrese
                      </label>
                      <input
                        id="company.address"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={str(settings, 'company.address')}
                        onChange={(e) => set('company.address', e.target.value)}
                        placeholder="Rīga, Latvija"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Contact */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Kontaktinformācija
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="company.email">
                          E-pasta adrese
                        </label>
                        <input
                          id="company.email"
                          type="email"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={str(settings, 'company.email')}
                          onChange={(e) => set('company.email', e.target.value)}
                          placeholder="support@b3hub.lv"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="company.website">
                          Tīmekļa vietne
                        </label>
                        <input
                          id="company.website"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={str(settings, 'company.website')}
                          onChange={(e) => set('company.website', e.target.value)}
                          placeholder="b3hub.lv"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Banking */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Bankas rekvizīti
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="company.bankName">
                        Bankas nosaukums
                      </label>
                      <input
                        id="company.bankName"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={str(settings, 'company.bankName')}
                        onChange={(e) => set('company.bankName', e.target.value)}
                        placeholder="SEB banka"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="company.iban">
                          IBAN
                        </label>
                        <input
                          id="company.iban"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring uppercase"
                          value={str(settings, 'company.iban')}
                          onChange={(e) => set('company.iban', e.target.value.toUpperCase())}
                          placeholder="LV00BANK0000000000000"
                          maxLength={34}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="company.swift">
                          SWIFT / BIC
                        </label>
                        <input
                          id="company.swift"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring uppercase"
                          value={str(settings, 'company.swift')}
                          onChange={(e) => set('company.swift', e.target.value.toUpperCase())}
                          placeholder="UNLALV2X"
                          maxLength={11}
                        />
                      </div>
                    </div>
                  </div>

                  <SaveRow
                    saveState={companySave}
                    onSave={() =>
                      save(
                        [
                          'company.legalName',
                          'company.regNo',
                          'company.vatNo',
                          'company.address',
                          'company.email',
                          'company.website',
                          'company.bankName',
                          'company.iban',
                          'company.swift',
                        ],
                        setCompanySave,
                      )
                    }
                  />
                </CardContent>
              </Card>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <strong>Svarīgi:</strong> Pēc saglabāšanas jaunie rekvizīti parādīsies tikai
                jaunizveidotos dokumentos. Jau ģenerēti PDF netiek atjaunoti.
              </div>
            </div>

            {/* Right: live preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Priekšskatījums — Rēķins</p>
                <Badge
                  variant="outline"
                  className="text-xs text-amber-700 border-amber-300 bg-amber-50"
                >
                  Paraugs ar fiktīviem datiem
                </Badge>
              </div>
              <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                <iframe
                  srcDoc={invoiceHtml}
                  className="w-full"
                  style={{ height: '860px', border: 'none' }}
                  title="Rēķina priekšskatījums"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
