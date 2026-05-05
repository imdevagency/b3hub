/**
 * Grupas mārketings — /dashboard/group/marketing
 *
 * Brand-level social media management for B3 Group.
 * One Instagram, one Facebook, one LinkedIn for all 3 business units.
 *
 * Separate from in-app marketing (/dashboard/admin/marketing) which handles
 * posts, banners and push notifications inside the B3Hub marketplace app.
 *
 * Social connections stored in localStorage ('b3-social-connections') until
 * the SocialModule backend is wired (endpoints exist at /api/v1/social/*).
 */
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Globe, Link2, Share2, Unlink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type SocialPlatform = 'META' | 'LINKEDIN' | 'GOOGLE' | 'TIKTOK';

interface SocialConnection {
  connected: boolean;
  accountName?: string;
  connectedAt?: string;
}

type SocialConnections = Record<SocialPlatform, SocialConnection>;

interface SocialPlatformMeta {
  name: string;
  tagline: string;
  logoColor: string;
  bgColor: string;
  available: boolean;
  features: string[];
  setupSteps: string[];
  callbackUrl: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_SOCIAL_KEY = 'b3-social-connections';

const DEFAULT_SOCIAL: SocialConnections = {
  META: { connected: false },
  LINKEDIN: { connected: false },
  GOOGLE: { connected: false },
  TIKTOK: { connected: false },
};

const SOCIAL_PLATFORM_META: Record<SocialPlatform, SocialPlatformMeta> = {
  META: {
    name: 'Meta Business Suite',
    tagline: 'Facebook lapa + Instagram biznesa profils',
    logoColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    available: true,
    features: ['Facebook lapas ieraksti', 'Instagram biznesa ieraksti', 'Akciju publicēšana'],
    setupSteps: [
      'Atveriet Meta for Developers un izveidojiet jaunu lietotni.',
      'Pievienojiet "Facebook Login" produktu un iestatiet OAuth redirect URI.',
      'Pieprasiet tiesības: pages_manage_posts, instagram_content_publish.',
      'Nokopējiet App ID un App Secret uz backend .env (META_APP_ID, META_APP_SECRET).',
      'Noklikšķiniet "Savienot" un autorizējiet piekļuvi jūsu Facebook lapai.',
    ],
    callbackUrl: '/api/v1/social/oauth/meta/callback',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    tagline: 'Uzņēmuma lapa — B2B auditorija',
    logoColor: 'text-sky-700',
    bgColor: 'bg-sky-50',
    available: true,
    features: ['Uzņēmuma lapas ieraksti', 'Dokumentu un attēlu publicēšana'],
    setupSteps: [
      'Atveriet LinkedIn Developers un izveidojiet jaunu lietotni.',
      'Saistiet lietotni ar B3 Group uzņēmuma lapu.',
      'Pieprasiet tiesības: w_organization_social, r_organization_social.',
      'Nokopējiet Client ID un Secret uz backend .env (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET).',
      'Noklikšķiniet "Savienot" un autorizējiet piekļuvi.',
    ],
    callbackUrl: '/api/v1/social/oauth/linkedin/callback',
  },
  GOOGLE: {
    name: 'Google Business Profile',
    tagline: 'Jaunumi Google meklēšanas rezultātos un Maps',
    logoColor: 'text-red-600',
    bgColor: 'bg-red-50',
    available: true,
    features: ['Google Maps jaunumi', 'Akcijas un piedāvājumi', 'Pasākumu publicēšana'],
    setupSteps: [
      'Google Cloud Console → iespējojiet My Business API.',
      'Izveidojiet OAuth 2.0 klientu (web application) ar pareizo redirect URI.',
      'Nokopējiet Client ID un Secret uz backend .env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).',
      'Noklikšķiniet "Savienot" un piešķiriet piekļuvi jūsu Google Business profila atrašanās vietai.',
    ],
    callbackUrl: '/api/v1/social/oauth/google/callback',
  },
  TIKTOK: {
    name: 'TikTok Business',
    tagline: 'Video saturs — drīzumā pieejams',
    logoColor: 'text-gray-800',
    bgColor: 'bg-gray-50',
    available: false,
    features: ['Video publicēšana', 'TikTok biznesa analītika'],
    setupSteps: [],
    callbackUrl: '/api/v1/social/oauth/tiktok/callback',
  },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GroupMarketingPage() {
  const [socialConnections, setSocialConnections] = useState<SocialConnections>(DEFAULT_SOCIAL);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [connectAccountName, setConnectAccountName] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SOCIAL_KEY);
      if (raw) setSocialConnections((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);

  function handleConnectSocial(platform: SocialPlatform) {
    if (!connectAccountName.trim()) return;
    const next: SocialConnections = {
      ...socialConnections,
      [platform]: {
        connected: true,
        accountName: connectAccountName.trim(),
        connectedAt: new Date().toISOString(),
      },
    };
    setSocialConnections(next);
    localStorage.setItem(LS_SOCIAL_KEY, JSON.stringify(next));
    setConnectingPlatform(null);
    setConnectAccountName('');
  }

  function handleDisconnectSocial(platform: SocialPlatform) {
    const next: SocialConnections = {
      ...socialConnections,
      [platform]: { connected: false },
    };
    setSocialConnections(next);
    localStorage.setItem(LS_SOCIAL_KEY, JSON.stringify(next));
  }

  const connectedCount = Object.values(socialConnections).filter((c) => c.connected).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mārketings"
        description="Sociālo tīklu pārvaldība visam B3 Group — viena Instagram, Facebook un LinkedIn visiem 3 biznesa virzieniem."
      />

      {/* Status banner */}
      <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Share2 className="h-4 w-4 shrink-0" />
        <span>
          <strong>{connectedCount}</strong> no {Object.keys(SOCIAL_PLATFORM_META).length} platformām
          savienotas.
          {connectedCount === 0 && ' Savienojiet pirmo platformu, lai sāktu publicēt.'}
        </span>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.entries(SOCIAL_PLATFORM_META) as [SocialPlatform, SocialPlatformMeta][]).map(
          ([key, meta]) => {
            const conn = socialConnections[key];
            return (
              <Card key={key} className={!meta.available ? 'opacity-60' : ''}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className={`h-10 w-10 rounded-xl ${meta.bgColor} flex items-center justify-center shrink-0`}
                    >
                      <Globe className={`h-5 w-5 ${meta.logoColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{meta.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.tagline}</p>
                    </div>
                    {!meta.available ? (
                      <span className="shrink-0 text-[10px] rounded-full px-2 py-0.5 bg-gray-100 text-gray-500 font-semibold border">
                        Drīzumā
                      </span>
                    ) : conn.connected ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Savienots
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] rounded-full px-2 py-0.5 bg-gray-50 text-gray-500 font-semibold border">
                        Nav savienots
                      </span>
                    )}
                  </div>

                  {conn.connected && conn.accountName && (
                    <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-800">{conn.accountName}</p>
                      {conn.connectedAt && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          Savienots {fmt(conn.connectedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  <ul className="space-y-1 mb-4">
                    {meta.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="flex gap-2">
                    {meta.available && !conn.connected && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setConnectAccountName('');
                          setConnectingPlatform(key);
                        }}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1.5" />
                        Savienot
                      </Button>
                    )}
                    {conn.connected && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 text-xs" disabled>
                          <Share2 className="h-3.5 w-3.5 mr-1.5" />
                          Testēt publicēšanu
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 border-red-200 hover:bg-red-50"
                          onClick={() => handleDisconnectSocial(key)}
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          },
        )}
      </div>

      {/* Backend integration info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Backend integrācija — SocialModule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Reālai OAuth plūsmai nepieciešams{' '}
            <code className="text-xs bg-muted px-1 rounded">SocialModule</code> backend ar šiem
            endpointiem:
          </p>
          <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5 font-mono text-xs">
            {[
              'GET    /api/v1/social/connections',
              'GET    /api/v1/social/oauth/:platform',
              'GET    /api/v1/social/oauth/:platform/callback',
              'DELETE /api/v1/social/connections/:platform',
              'POST   /api/v1/social/publish',
            ].map((ep) => (
              <div key={ep} className="text-foreground">
                {ep}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Savienojumu stāvoklis pašlaik glabājas localStorage. Pēc SocialModule ieviešanas
            pārvieto uz datābāzi.
          </p>
        </CardContent>
      </Card>

      {/* Connect dialog */}
      <Dialog
        open={connectingPlatform !== null}
        onOpenChange={(v) => !v && setConnectingPlatform(null)}
      >
        <DialogContent className="max-w-lg">
          {connectingPlatform && (
            <>
              <DialogHeader>
                <DialogTitle>Savienot: {SOCIAL_PLATFORM_META[connectingPlatform].name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div
                  className={`rounded-xl ${SOCIAL_PLATFORM_META[connectingPlatform].bgColor} p-4 space-y-2`}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Iestatīšanas soļi
                  </p>
                  <ol className="space-y-2">
                    {SOCIAL_PLATFORM_META[connectingPlatform].setupSteps.map((step, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="font-semibold shrink-0 text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      OAuth Callback URL
                    </p>
                    <code className="text-xs font-mono text-foreground break-all">
                      {'https://yourdomain.com'}
                      {SOCIAL_PLATFORM_META[connectingPlatform].callbackUrl}
                    </code>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        'https://yourdomain.com' +
                          SOCIAL_PLATFORM_META[connectingPlatform!].callbackUrl,
                      )
                    }
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div>
                  <Label htmlFor="social-account">Konta / lapas nosaukums</Label>
                  <Input
                    id="social-account"
                    value={connectAccountName}
                    onChange={(e) => setConnectAccountName(e.target.value)}
                    placeholder="B3 Group Latvia"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Reālā OAuth plūsmā šo aizpildīs automātiski. Pagaidām ievadiet manuāli
                    testēšanai.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConnectingPlatform(null)}>
                  Atcelt
                </Button>
                <Button
                  onClick={() => handleConnectSocial(connectingPlatform)}
                  disabled={!connectAccountName.trim()}
                >
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Savienot
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
