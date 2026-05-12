'use client';

/**
 * /dashboard/admin/integrations/maps
 *
 * Google Maps integrācija — adrešu validācija, maršrutu aprēķins,
 * piegādes izsekošana, attālumu un cenu kalkulācija.
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
  MapPin,
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

export default function GoogleMapsIntegrationPage() {
  const { token: authTok } = useAuth();
  const token = authTok ?? '';

  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keySave, setKeySave] = useState<SaveState>('idle');
  const [featureSave, setFeatureSave] = useState<SaveState>('idle');
  const [showKey, setShowKey] = useState(false);
  const [showMobileKey, setShowMobileKey] = useState(false);

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

  const enabled = bool(settings, 'maps.enabled');

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
        <PageHeader title="Google Maps" description="Ģeogrāfijas integrācija" />
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
        title="Google Maps"
        description="Adrešu validācija, maršrutu aprēķins un piegādes izsekošana."
        action={
          <a
            href="https://console.cloud.google.com/google/maps-apis/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Google Cloud Console <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          Nepieciešamas <strong>divas API atslēgas</strong>: viena serverim (backend — Places,
          Geocoding, Distance Matrix, Routes API) un viena mobilajai lietotnei (Android/iOS — Maps
          SDK). Abas ir ierobežotas pēc lietojuma veida Google Cloud Console.
        </div>
      </div>

      <div className="space-y-4">
        {/* Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Google Maps statuss
                </CardTitle>
                <CardDescription className="mt-1">
                  Ieslēdzot, adrešu meklēšana, maršruti un izsekošana izmanto Google Maps.
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
                  id="maps.enabled"
                  checked={enabled}
                  onCheckedChange={(v) => set('maps.enabled', String(v))}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* API keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API atslēgas</CardTitle>
            <CardDescription>
              Atrodamas Google Cloud Console → APIs &amp; Services → Credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="maps.serverApiKey">Backend API atslēga (serverim)</Label>
              <div className="relative">
                <Input
                  id="maps.serverApiKey"
                  type={showKey ? 'text' : 'password'}
                  value={str(settings, 'maps.serverApiKey')}
                  onChange={(e) => set('maps.serverApiKey', e.target.value)}
                  autoComplete="new-password"
                  placeholder="AIzaSy••••••••••••••••••••••••••••••••"
                  disabled={!enabled}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey((v) => !v)}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Iespējotie API: Places, Geocoding, Distance Matrix, Routes, Maps Static.
                Ierobežojiet pēc servera IP.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maps.mobileApiKey">Mobilās lietotnes API atslēga</Label>
              <div className="relative">
                <Input
                  id="maps.mobileApiKey"
                  type={showMobileKey ? 'text' : 'password'}
                  value={str(settings, 'maps.mobileApiKey')}
                  onChange={(e) => set('maps.mobileApiKey', e.target.value)}
                  autoComplete="new-password"
                  placeholder="AIzaSy••••••••••••••••••••••••••••••••"
                  disabled={!enabled}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowMobileKey((v) => !v)}
                  tabIndex={-1}
                >
                  {showMobileKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Iespējotie API: Maps SDK for Android/iOS. Ierobežojiet pēc App bundle ID / SHA-1.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Mobilās lietotnes atslēga ir iekļauta lietotnē un nav pilnībā slepena — ierobežojiet
                to Google Console pēc package name un SHA-1. Backend atslēga nekad nav publiska.
              </span>
            </div>

            <SaveRow
              saveState={keySave}
              onSave={() =>
                save(['maps.enabled', 'maps.serverApiKey', 'maps.mobileApiKey'], setKeySave)
              }
            />
          </CardContent>
        </Card>

        {/* Feature toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funkciju iestatījumi</CardTitle>
            <CardDescription>Kuras ģeogrāfiskās funkcijas ir aktīvas platformā.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'maps.addressAutocomplete',
                label: 'Adrešu automātiskā aizpilde',
                desc: 'Places Autocomplete API pasūtījuma formās un reģistrācijā',
              },
              {
                key: 'maps.routeCalculation',
                label: 'Maršrutu un attālumu aprēķins',
                desc: 'Distance Matrix / Routes API pārvadājumu cenu kalkulācijai',
              },
              {
                key: 'maps.liveTracking',
                label: 'Piegādes izsekošana reāllaikā',
                desc: 'Vadītāja GPS koordinātes tiek parādītas pircēja lietotnē',
              },
              {
                key: 'maps.geocoding',
                label: 'Adrešu ģeokodēšana',
                desc: 'Adrese → koordinātes pasūtījuma izveides brīdī',
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

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="maps.defaultRegion">Noklusējuma reģions (bias)</Label>
              <Input
                id="maps.defaultRegion"
                value={str(settings, 'maps.defaultRegion', 'lv')}
                onChange={(e) => set('maps.defaultRegion', e.target.value)}
                placeholder="lv"
                disabled={!enabled}
                className="max-w-20"
              />
              <p className="text-xs text-muted-foreground">
                ISO 3166-1 alpha-2 valsts kods. Ietekmē adrešu meklēšanas prioritāti.
              </p>
            </div>

            <SaveRow
              saveState={featureSave}
              onSave={() =>
                save(
                  [
                    'maps.addressAutocomplete',
                    'maps.routeCalculation',
                    'maps.liveTracking',
                    'maps.geocoding',
                    'maps.defaultRegion',
                  ],
                  setFeatureSave,
                )
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
