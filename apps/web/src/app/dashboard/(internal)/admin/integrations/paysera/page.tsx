'use client';

/**
 * /dashboard/admin/integrations/paysera
 *
 * Paysera maksājumu integrācija — tirgus darījumu apstrāde, izņemšana
 * piegādātājiem (SupplierPayout) un pārvadātājiem (CarrierPayout).
 *
 * Docs: https://developers.paysera.com/en/checkout/basic
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Loader2,
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

export default function PayseraIntegrationPage() {
  const { token: authTok } = useAuth();
  const token = authTok ?? '';

  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credSave, setCredSave] = useState<SaveState>('idle');
  const [webhookSave, setWebhookSave] = useState<SaveState>('idle');
  const [payoutSave, setPayoutSave] = useState<SaveState>('idle');
  const [showSecret, setShowSecret] = useState(false);

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

  const enabled = bool(settings, 'paysera.enabled');
  const sandbox = bool(settings, 'paysera.sandbox');

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
        <PageHeader title="Paysera" description="Maksājumu integrācija" />
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
        title="Paysera"
        description="Tirgus darījumu apstrāde un izņemšana piegādātājiem un pārvadātājiem."
        action={
          <a
            href="https://developers.paysera.com/en/checkout/basic"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Paysera Docs <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          Paysera apstrādā visus B3Hub tirgus maksājumus. Piegādātāju un pārvadātāju izmaksas
          (SupplierPayout / CarrierPayout) tiek nosūtītas uz Paysera Transfer API.
        </div>
      </div>

      <div className="space-y-4">
        {/* Status toggle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Savienojuma statuss
                </CardTitle>
                <CardDescription className="mt-1">
                  Ieslēdzot, tirgus maksājumi tiek apstrādāti caur Paysera.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Badge
                  variant="outline"
                  className={
                    enabled
                      ? sandbox
                        ? 'text-amber-600 border-amber-300 bg-amber-50'
                        : 'text-emerald-600 border-emerald-300 bg-emerald-50'
                      : 'text-muted-foreground'
                  }
                >
                  {enabled ? (sandbox ? 'Sandbox' : 'Aktīvs') : 'Izslēgts'}
                </Badge>
                <Switch
                  id="paysera.enabled"
                  checked={enabled}
                  onCheckedChange={(v) => set('paysera.enabled', String(v))}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API akreditācijas dati</CardTitle>
            <CardDescription>
              Atrodami Paysera kontā: Mana konta informācija → Projekti → Skatīt projekta datus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Sandbox režīms</p>
                <p className="text-xs text-muted-foreground">
                  Izmantojiet sandbox testēšanai; izslēdziet ražošanā.
                </p>
              </div>
              <Switch
                id="paysera.sandbox"
                checked={sandbox}
                onCheckedChange={(v) => set('paysera.sandbox', String(v))}
                disabled={!enabled}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="paysera.projectId">Projekta ID</Label>
                <Input
                  id="paysera.projectId"
                  value={str(settings, 'paysera.projectId')}
                  onChange={(e) => set('paysera.projectId', e.target.value)}
                  placeholder="123456"
                  disabled={!enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paysera.projectSecret">Projekta parole (sign)</Label>
                <div className="relative">
                  <Input
                    id="paysera.projectSecret"
                    type={showSecret ? 'text' : 'password'}
                    value={str(settings, 'paysera.projectSecret')}
                    onChange={(e) => set('paysera.projectSecret', e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••••••••••"
                    disabled={!enabled}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSecret((v) => !v)}
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paysera.accountNumber">Maksājumu konta numurs (Paysera №)</Label>
                <Input
                  id="paysera.accountNumber"
                  value={str(settings, 'paysera.accountNumber')}
                  onChange={(e) => set('paysera.accountNumber', e.target.value)}
                  placeholder="EVP1234567890"
                  disabled={!enabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paysera.currency">Valūta</Label>
                <Input
                  id="paysera.currency"
                  value={str(settings, 'paysera.currency', 'EUR')}
                  onChange={(e) => set('paysera.currency', e.target.value)}
                  placeholder="EUR"
                  disabled={!enabled}
                />
              </div>
            </div>

            <SaveRow
              saveState={credSave}
              onSave={() =>
                save(
                  [
                    'paysera.enabled',
                    'paysera.sandbox',
                    'paysera.projectId',
                    'paysera.projectSecret',
                    'paysera.accountNumber',
                    'paysera.currency',
                  ],
                  setCredSave,
                )
              }
            />
          </CardContent>
        </Card>

        {/* Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook (IPN)</CardTitle>
            <CardDescription>
              Reģistrējiet šo URL Paysera projekta iestatījumos kā "Notify URL".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/60 border px-3 py-2 font-mono text-xs text-muted-foreground select-all">
              {str(settings, 'paysera.webhookBaseUrl', 'https://api.b3hub.lv')}
              /api/v1/payments/paysera/webhook
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paysera.webhookBaseUrl">API bāzes URL (webhook host)</Label>
              <Input
                id="paysera.webhookBaseUrl"
                value={str(settings, 'paysera.webhookBaseUrl', 'https://api.b3hub.lv')}
                onChange={(e) => set('paysera.webhookBaseUrl', e.target.value)}
                placeholder="https://api.b3hub.lv"
                disabled={!enabled}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Paysera paraksta katru IPN pieprasījumu. Backends validē parakstu pirms maksājuma
                apstiprināšanas.
              </span>
            </div>

            <SaveRow
              saveState={webhookSave}
              onSave={() => save(['paysera.webhookBaseUrl'], setWebhookSave)}
            />
          </CardContent>
        </Card>

        {/* Payout settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Izmaksu iestatījumi</CardTitle>
            <CardDescription>
              Automātisko SupplierPayout / CarrierPayout / RecyclerPayout izmaksu konfigurācija.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'paysera.autoPayoutSuppliers',
                label: 'Automātiski izmaksāt piegādātājiem',
                desc: 'SupplierPayout tiek nosūtīts uz Paysera Transfer API pēc pasūtījuma izpildes',
              },
              {
                key: 'paysera.autoPayoutCarriers',
                label: 'Automātiski izmaksāt pārvadātājiem',
                desc: 'CarrierPayout tiek nosūtīts uz Paysera Transfer API pēc piegādes apstiprināšanas',
              },
              {
                key: 'paysera.autoPayoutRecyclers',
                label: 'Automātiski izmaksāt pārstrādes centriem',
                desc: 'RecyclerPayout tiek nosūtīts uz Paysera Transfer API pēc atkritumu apstrādes',
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="paysera.payoutDelayDays">Izmaksu aizkave (dienas)</Label>
                <Input
                  id="paysera.payoutDelayDays"
                  type="number"
                  min={0}
                  max={90}
                  value={str(settings, 'paysera.payoutDelayDays', '7')}
                  onChange={(e) => set('paysera.payoutDelayDays', e.target.value)}
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Dienas pēc pasūtījuma pabeigšanas, pirms izmaksa tiek iniciēta.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paysera.platformFeePercent">Platformas komisija (%)</Label>
                <Input
                  id="paysera.platformFeePercent"
                  type="number"
                  min={0}
                  max={50}
                  step={0.1}
                  value={str(settings, 'paysera.platformFeePercent', '5')}
                  onChange={(e) => set('paysera.platformFeePercent', e.target.value)}
                  disabled={!enabled}
                />
              </div>
            </div>
            <SaveRow
              saveState={payoutSave}
              onSave={() =>
                save(
                  [
                    'paysera.autoPayoutSuppliers',
                    'paysera.autoPayoutCarriers',
                    'paysera.autoPayoutRecyclers',
                    'paysera.payoutDelayDays',
                    'paysera.platformFeePercent',
                  ],
                  setPayoutSave,
                )
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
