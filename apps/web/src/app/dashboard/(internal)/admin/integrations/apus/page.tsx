'use client';

/**
 * /dashboard/admin/integrations/apus
 *
 * APUS / VVD integrācija — Valsts vides dienesta elektroniskā atkritumu
 * pārvietošanas uzskaites sistēma. Obligāta pārstrādes centriem.
 *
 * Likumdošana: MK noteikumi Nr. 1032 "Atkritumu uzskaites kārtība"
 * Endpoint: https://apus.vvd.gov.lv/api/v1/waste-movements
 * Test env: https://apus-test.vvd.gov.lv/api/v1
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Info,
  Loader2,
  Recycle,
  RefreshCw,
  ShieldCheck,
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

// VVD Waste codes quick-reference (EWC / LV atkritumu katalogs)
const EWC_EXAMPLES = [
  { code: '17 01 01', name: 'Betons' },
  { code: '17 01 02', name: 'Ķieģeļi' },
  { code: '17 01 03', name: 'Flīzes un keramika' },
  { code: '17 02 01', name: 'Koks' },
  { code: '17 04 05', name: 'Dzelzs un tērauds' },
  { code: '17 05 04', name: 'Augsne un akmeņi' },
  { code: '17 09 04', name: 'Jaukti būvniecības atkritumi' },
  { code: '17 06 05*', name: 'Bīstami (azbests u.c.)' },
];

export default function ApusIntegrationPage() {
  const { token: authTok } = useAuth();
  const token = authTok ?? '';

  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credSave, setCredSave] = useState<SaveState>('idle');
  const [behaviorSave, setBehaviorSave] = useState<SaveState>('idle');
  const [showApiKey, setShowApiKey] = useState(false);

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

  const sandbox = bool(settings, 'apus.sandbox');
  const hasApiKey = !!str(settings, 'apus.apiKey');
  const mode = hasApiKey ? (sandbox ? 'sandbox' : 'live') : 'simulation';

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
        <PageHeader title="APUS / VVD" description="Atkritumu uzskaites integrācija" />
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
        title="APUS / VVD"
        description="Valsts vides dienesta elektroniskā atkritumu pārvietošanas uzskaites sistēma."
        action={
          <a
            href="https://apus.vvd.gov.lv"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            apus.vvd.gov.lv <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      {/* Legal notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <FileText className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Obligāta prasība.</strong> Saskaņā ar MK noteikumiem Nr. 1032 "Atkritumu uzskaites
          kārtība" katrs licencēts pārstrādes centrs ir obligāts elektroniski reģistrēt visas
          atkritumu kustības APUS sistēmā ne vēlāk kā 24h pēc pieņemšanas.
        </div>
      </div>

      {/* Mode indicator */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Pašreizējais režīms: </strong>
          {mode === 'simulation' && (
            <>
              <Badge variant="outline" className="ml-1 text-xs text-amber-600 border-amber-300">
                Simulācija
              </Badge>{' '}
              — APUS API atslēga nav konfigurēta. Backends reģistrē visas kustības, bet nenosūta uz
              VVD. Piešķirtie ID sākas ar <code>SIM-</code>. Iestatiet API atslēgu ražošanas
              darbībai.
            </>
          )}
          {mode === 'sandbox' && (
            <>
              <Badge variant="outline" className="ml-1 text-xs text-amber-600 border-amber-300">
                Sandbox
              </Badge>{' '}
              — Nosūta uz VVD testa vidi (<code>apus-test.vvd.gov.lv</code>).
            </>
          )}
          {mode === 'live' && (
            <>
              <Badge className="ml-1 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Ražošana
              </Badge>{' '}
              — Nosūta uz īsto VVD APUS sistēmu.
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Recycle className="h-4 w-4" />
              VVD APUS API akreditācijas dati
            </CardTitle>
            <CardDescription>
              API atslēgu izsniedz Valsts vides dienests pēc reģistrācijas APUS sistēmā. Sazinieties
              ar VVD pa tālr. 67084200 vai e-pastu{' '}
              <a href="mailto:vvd@vvd.gov.lv" className="underline">
                vvd@vvd.gov.lv
              </a>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Sandbox (testa vide)</p>
                <p className="text-xs text-muted-foreground">
                  Ieslēdziet, lai sūtītu uz <code>apus-test.vvd.gov.lv</code>. Izslēdziet ražošanā.
                </p>
              </div>
              <Switch
                id="apus.sandbox"
                checked={sandbox}
                onCheckedChange={(v) => set('apus.sandbox', String(v))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apus.apiKey">APUS API atslēga (Bearer token)</Label>
              <div className="relative">
                <Input
                  id="apus.apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={str(settings, 'apus.apiKey')}
                  onChange={(e) => set('apus.apiKey', e.target.value)}
                  autoComplete="new-password"
                  placeholder="Atstājiet tukšu simulācijas režīmam"
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

            <div className="space-y-1.5">
              <Label htmlFor="apus.facilityRegistrationId">
                Iekārtas reģistrācijas ID APUS sistēmā
              </Label>
              <Input
                id="apus.facilityRegistrationId"
                value={str(settings, 'apus.facilityRegistrationId')}
                onChange={(e) => set('apus.facilityRegistrationId', e.target.value)}
                placeholder="APUS-LV-0001"
              />
              <p className="text-xs text-muted-foreground">
                Noklusējuma iekārtas ID — var tikt pārrakstīts katra pārstrādes centra iestatījumos
                (RecyclingCenter.apusRegistrationId).
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                API atslēga tiek glabāta šifrētā veidā. Backends ielādē to tikai sūtīšanas brīdī —
                tā nekad netiek iekļauta API atbildēs vai žurnālos.
              </span>
            </div>

            <SaveRow
              saveState={credSave}
              onSave={() =>
                save(['apus.sandbox', 'apus.apiKey', 'apus.facilityRegistrationId'], setCredSave)
              }
            />
          </CardContent>
        </Card>

        {/* Submission behavior */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Automātiskā iesniegšana</CardTitle>
            <CardDescription>
              Kādos gadījumos backends automātiski iesniedz atkritumu kustību APUS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'apus.autoSubmitOnProcessed',
                label: 'Automātiski iesniegt pēc apstrādes',
                desc: 'Kad WasteRecord sasniedz stāvokli PROCESSED, iesniegšana notiek automātiski',
              },
              {
                key: 'apus.requireApusForLicensed',
                label: 'Licencētiem centriem obligāti',
                desc: 'Licencēti centri nevar pabeigt apstrādi bez sekmīgas APUS iesniegšanas',
              },
              {
                key: 'apus.retryOnFailure',
                label: 'Atkārtot sūtīšanu kļūdas gadījumā',
                desc: 'Sistēma automātiski atkārto nesekmīgus pieprasījumus (maks. 3 reizes)',
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
                />
              </div>
            ))}
            <Separator />
            <SaveRow
              saveState={behaviorSave}
              onSave={() =>
                save(
                  [
                    'apus.autoSubmitOnProcessed',
                    'apus.requireApusForLicensed',
                    'apus.retryOnFailure',
                  ],
                  setBehaviorSave,
                )
              }
            />
          </CardContent>
        </Card>

        {/* EWC waste codes reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atkritumu kodu uzziņa (EWC / LV katalogs)</CardTitle>
            <CardDescription>
              Eiropas atkritumu kataloga (EWC) kodi, ko lieto B3Hub pārstrādes centra ieraksti. MK
              noteikumi Nr. 1032, Pielikums Nr. 1.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border divide-y text-sm">
              {EWC_EXAMPLES.map(({ code, name }) => (
                <div key={code} className="flex items-center justify-between px-3 py-2">
                  <code className="font-mono text-xs text-muted-foreground">{code}</code>
                  <span className={code.endsWith('*') ? 'text-red-600 font-medium' : ''}>
                    {name}
                    {code.endsWith('*') && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] text-red-600 border-red-200"
                      >
                        Bīstams
                      </Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pilns saraksts:{' '}
              <a
                href="https://likumi.lv/ta/id/333454"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                MK noteikumi Nr. 1032 (likumi.lv)
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
