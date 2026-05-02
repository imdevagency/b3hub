'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminGetSettings, adminUpdateSettings } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// ─── Flag definitions ─────────────────────────────────────────────────────────

type FlagDef = {
  key: string;
  label: string;
  description: string;
  danger?: boolean; // affects live orders / payments
};

type FlagGroup = {
  id: string;
  label: string;
  flags: FlagDef[];
};

const FLAG_GROUPS: FlagGroup[] = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    flags: [
      {
        key: 'feature.materialOrders.enabled',
        label: 'Materiālu pasūtījumi',
        description: 'Ļauj pircējiem izveidot materiālu pasūtījumus no kataloga.',
      },
      {
        key: 'feature.transport.enabled',
        label: 'Transporta pasūtījumi',
        description: 'Ļauj pasūtīt pārvadājumus (bez materiālu pirkšanas).',
      },
      {
        key: 'feature.skipHire.enabled',
        label: 'Skip noma',
        description: 'Skip konteineru nomas modulis pircējiem un operatoriem.',
      },
      {
        key: 'feature.recycling.enabled',
        label: 'Utilizācija / Pieņemšana',
        description: 'Atkritumu un grunts utilizācijas plūsma recycler uzņēmumiem.',
      },
      {
        key: 'feature.rfq.enabled',
        label: 'Cenu pieprasījumi (RFQ)',
        description: 'Pircēji var nosūtīt cenu pieprasījumus piegādātājiem.',
      },
      {
        key: 'feature.guestCheckout.enabled',
        label: 'Guest checkout',
        description: 'Atļauj pasūtīt bez reģistrācijas (B2C homeowner plūsma).',
      },
    ],
  },
  {
    id: 'b2b',
    label: 'B2B funkcijas',
    flags: [
      {
        key: 'feature.frameworkContracts.enabled',
        label: 'Ietvarlīgumi',
        description: 'Uzņēmumi var noslēgt ietvarlīgumus ar piegādātājiem.',
      },
      {
        key: 'feature.projectTracking.enabled',
        label: 'Projektu izmaksu uzskaite',
        description: 'Pasūtījumi var tikt saistīti ar projektiem un budžeta uzskaiti.',
      },
      {
        key: 'feature.teamManagement.enabled',
        label: 'Komandas pārvaldība',
        description: 'Uzņēmumu OWNER var pievienot darbiniekus un piešķirt tiesības.',
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platforma',
    flags: [
      {
        key: 'feature.sellerApplications.enabled',
        label: 'Piegādātāju pieteikumi',
        description: 'Jauni piegādātāji var iesniegt pieteikumu platformā.',
      },
      {
        key: 'feature.carrierApplications.enabled',
        label: 'Pārvadātāju pieteikumi',
        description: 'Jauni pārvadātāji var iesniegt pieteikumu platformā.',
      },
      {
        key: 'feature.newRegistration.enabled',
        label: 'Jauna reģistrācija',
        description: 'Atļauj jauniem lietotājiem reģistrēties platformā.',
        danger: true,
      },
      {
        key: 'feature.b3Fields.enabled',
        label: 'B3 Fields (lauku punkti)',
        description: 'B3 lauku punktu modulis un svēršanas taloni.',
      },
      {
        key: 'feature.maintenance.enabled',
        label: 'Tehniskā apkope (maintenance mode)',
        description:
          'Rāda apkopes ekrānu visiem lietotājiem. Atslēdz tikai tad, kad apkope ir pabeigta.',
        danger: true,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bool(s: Record<string, string>, key: string): boolean {
  // Default all feature flags to true (enabled) if not explicitly set
  if (!(key in s)) return key !== 'feature.maintenance.enabled';
  return s[key] === 'true';
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFeatureFlagsPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

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

  function toggle(key: string, value: boolean) {
    setSettings((prev) => ({ ...prev, [key]: String(value) }));
    setPendingKeys((prev) => new Set(prev).add(key));
  }

  async function saveAll() {
    if (pendingKeys.size === 0) return;
    setSaveState('saving');
    const patch: Record<string, string> = {};
    for (const k of pendingKeys) patch[k] = settings[k] ?? 'false';
    try {
      const updated = await adminUpdateSettings(patch, token);
      setSettings(updated);
      setPendingKeys(new Set());
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

  const hasPending = pendingKeys.size > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funkciju karodziņi"
        description="Ieslēdz vai atslēdz platformas funkcijas bez koda izmaiņām."
        action={
          <div className="flex items-center gap-3">
            {hasPending && (
              <span className="text-sm text-amber-600 font-medium">
                {pendingKeys.size} nesaglabātas izmaiņas
              </span>
            )}
            {saveState === 'saved' && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Saglabāts
              </span>
            )}
            {saveState === 'error' && (
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> Kļūda
              </span>
            )}
            <Button onClick={saveAll} disabled={!hasPending || saveState === 'saving'} size="sm">
              {saveState === 'saving' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Saglabāt izmaiņas
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {FLAG_GROUPS.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-0">
              {group.flags.map((flag, idx) => {
                const enabled = bool(settings, flag.key);
                const isDirty = pendingKeys.has(flag.key);
                return (
                  <div key={flag.key}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="flex items-start justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{flag.label}</span>
                          {flag.danger && (
                            <Badge variant="destructive" className="text-xs py-0 px-1.5">
                              Uzmanību
                            </Badge>
                          )}
                          {isDirty && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 px-1.5 text-amber-600 border-amber-300"
                            >
                              Nesaglabāts
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{flag.description}</p>
                        <p className="text-[11px] text-muted-foreground/60 font-mono">{flag.key}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <span
                          className={`text-xs font-medium ${enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}
                        >
                          {enabled ? 'Ieslēgts' : 'Atslēgts'}
                        </span>
                        <Switch checked={enabled} onCheckedChange={(v) => toggle(flag.key, v)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
