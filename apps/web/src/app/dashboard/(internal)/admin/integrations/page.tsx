'use client';

/**
 * /dashboard/admin/integrations
 *
 * Platform Integration Hub — all external services wired into the B3Hub marketplace.
 *
 * ── OWNERSHIP RULE ────────────────────────────────────────────────────────────
 * This section is for integrations that serve the MARKETPLACE and its users
 * (buyers, sellers, carriers). If an integration serves B3 Group's internal
 * business operations (B3 Construction, B3 Recycling), it lives under that BU's
 * own admin section (/dashboard/b3-construction/*, /dashboard/b3-recycling/*).
 *
 * Decision rule: "Who is the end user of this integration's data?"
 *   → Marketplace users (auto-fill, risk signals, payments, notifications) = here
 *   → B3 Construction internal staff (BIS, Jumis)         = /dashboard/b3-construction
 *   → B3 Recycling internal staff                         = /dashboard/b3-recycling
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  HardHat,
  Mail,
  MapPin,
  MessageSquare,
  Receipt,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getLursoftSettings } from '@/lib/api/lursoft';
import { getBisSettings } from '@/lib/api/bis';
import { adminGetSettings } from '@/lib/api/admin';

// ─── Integration registry ────────────────────────────────────────────────────
// Add every new platform integration here. Each entry drives the hub card.

type IntegrationStatus = 'connected' | 'disconnected' | 'partial' | 'unknown';

type PlatformIntegration = {
  id: string;
  label: string;
  /** Short context label shown on the card, e.g. "Tirgus" | "B3 Construction" */
  scopeLabel?: string;
  description: string;
  href: string;
  icon: React.ElementType;
  category: 'data' | 'accounting' | 'payments' | 'comms' | 'maps';
  /** 'marketplace' items group by category. 'internal' items appear in a separate B3 Construction section. */
  scope: 'marketplace' | 'internal';
  /** Resolved at runtime — true if admin has saved credentials */
  status?: IntegrationStatus;
  /** If no backend config page exists yet, mark as planned */
  planned?: boolean;
};

const INTEGRATIONS: PlatformIntegration[] = [
  // ─────────────────────────── MARKETPLACE ───────────────────────────────────
  // ── Data / Trust
  {
    id: 'lursoft',
    label: 'Lursoft',
    scopeLabel: 'Tirgus',
    description:
      'Latvijas uzņēmumu reģistrs — B2B reģistrācijas rekvizītu aizpilde, riska pārbaude (maksātnespēja, nodokļu parādi)',
    href: '/dashboard/admin/integrations/lursoft',
    icon: Building2,
    category: 'data',
    scope: 'marketplace',
  },
  {
    id: 'bis',
    label: 'BIS',
    scopeLabel: 'Tirgus',
    description:
      'Būvniecības informācijas sistēma — BIS projektu numuru validācija pasūtījumos, B3Construction projektu ātrās izvēles',
    href: '/dashboard/admin/integrations/bis',
    icon: HardHat,
    category: 'data',
    scope: 'marketplace',
  },
  // ── Accounting
  {
    id: 'jumis',
    label: 'Jumis',
    scopeLabel: 'Tirgus · B3Hub SIA',
    description:
      'B3Hub SIA grāmatvedības sistēma — tirgu rēķinu eksports, piegādātāju un pārvadātāju norēķinu reģistrācija',
    href: '/dashboard/admin/integrations/jumis',
    icon: Receipt,
    category: 'accounting',
    scope: 'marketplace',
  },
  // ── Payments
  {
    id: 'paysera',
    label: 'Paysera',
    scopeLabel: 'Tirgus',
    description: 'Maksājumu apstrāde — tirgus darījumi, izņemšana piegādātājiem un vadītājiem',
    href: '/dashboard/admin/integrations/paysera',
    icon: CreditCard,
    category: 'payments',
    scope: 'marketplace',
    planned: true,
  },
  // ── Communications
  {
    id: 'sms',
    label: 'SMS (Twilio / SMSAPI)',
    scopeLabel: 'Tirgus',
    description: 'Īsziņu paziņojumi pasūtītājiem un vadītājiem par pasūtījumu statusiem',
    href: '/dashboard/admin/integrations/sms',
    icon: MessageSquare,
    category: 'comms',
    scope: 'marketplace',
    planned: true,
  },
  {
    id: 'email',
    label: 'E-pasts (SMTP)',
    scopeLabel: 'Tirgus',
    description: 'Darījumu e-pasta sūtīšana — apstiprinājumi, rēķini, konta ziņojumi',
    href: '/dashboard/admin/integrations/email',
    icon: Mail,
    category: 'comms',
    scope: 'marketplace',
    planned: true,
  },
  // ── Maps / Location
  {
    id: 'maps',
    label: 'Google Maps',
    scopeLabel: 'Tirgus',
    description: 'Adrešu validācija, maršrutu aprēķins, piegādes izsekošana',
    href: '/dashboard/admin/integrations/maps',
    icon: MapPin,
    category: 'maps',
    scope: 'marketplace',
    planned: true,
  },
  // ─────────────────────────── B3 CONSTRUCTION INTERNAL ──────────────────────
  {
    id: 'internal-bis',
    label: 'BIS',
    scopeLabel: 'B3 Construction',
    description:
      'Reģistru meklētājs iekšējai lietošanai — būvkomersantu un speciālistu vetting. Izmanto kopīgo BIS OAuth2 savienojumu.',
    href: '/dashboard/b3-construction/bis',
    icon: HardHat,
    category: 'data',
    scope: 'internal',
  },
  {
    id: 'internal-jumis',
    label: 'Jumis',
    scopeLabel: 'B3 Construction SIA',
    description:
      'B3 Construction SIA atsevišķais Jumis grāmatvedības konts — darbu akti, iekšējie norēķini',
    href: '/dashboard/b3-construction/jumis',
    icon: Receipt,
    category: 'accounting',
    scope: 'internal',
  },
];

const CATEGORY_LABELS: Record<PlatformIntegration['category'], string> = {
  data: 'Dati un uzticismība',
  accounting: 'Grāmatvedība',
  payments: 'Maksājumi',
  comms: 'Komunikācija',
  maps: 'Ģeogrāfija',
};

const CATEGORY_ORDER: PlatformIntegration['category'][] = [
  'data',
  'accounting',
  'payments',
  'comms',
  'maps',
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, planned }: { status?: IntegrationStatus; planned?: boolean }) {
  if (planned)
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
        <Clock className="h-3 w-3" />
        Plānots
      </Badge>
    );
  if (!status || status === 'unknown')
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground text-xs">
        <AlertCircle className="h-3 w-3" />
        Nav konfigurēts
      </Badge>
    );
  if (status === 'connected')
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        Savienots
      </Badge>
    );
  if (status === 'partial')
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
        <AlertCircle className="h-3 w-3" />
        Daļēji
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-red-500 border-red-200 text-xs">
      <WifiOff className="h-3 w-3" />
      Nav savienots
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsHubPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});

  // Resolve connection status for configured integrations
  useEffect(() => {
    if (!token) return;

    // Lursoft
    getLursoftSettings(token)
      .then((s) => {
        setStatuses((prev) => ({
          ...prev,
          lursoft:
            s.enabled && s.hasPassword ? 'connected' : s.username ? 'partial' : 'disconnected',
        }));
      })
      .catch(() => setStatuses((prev) => ({ ...prev, lursoft: 'unknown' })));

    // BIS
    getBisSettings(token)
      .then((s) => {
        setStatuses((prev) => ({
          ...prev,
          bis:
            s.enabled && s.hasClientSecret ? 'connected' : s.clientId ? 'partial' : 'disconnected',
        }));
      })
      .catch(() => setStatuses((prev) => ({ ...prev, bis: 'unknown' })));

    // Jumis marketplace (flat settings, jumis.* keys = B3Hub SIA)
    adminGetSettings(token)
      .then((s) => {
        const jumisEnabled = s['jumis.enabled'] === 'true';
        const jumisHasUrl = !!s['jumis.apiUrl'];
        setStatuses((prev) => ({
          ...prev,
          jumis:
            jumisEnabled && jumisHasUrl ? 'connected' : jumisHasUrl ? 'partial' : 'disconnected',
        }));

        // Jumis internal (b3construction.jumis.* keys = B3 Construction SIA)
        const internalEnabled = s['b3construction.jumis.enabled'] === 'true';
        const internalHasUrl = !!s['b3construction.jumis.apiUrl'];
        setStatuses((prev) => ({
          ...prev,
          'internal-jumis':
            internalEnabled && internalHasUrl
              ? 'connected'
              : internalHasUrl
                ? 'partial'
                : 'disconnected',
        }));
      })
      .catch(() =>
        setStatuses((prev) => ({ ...prev, jumis: 'unknown', 'internal-jumis': 'unknown' })),
      );

    // BIS internal — reuses shared OAuth2 connection status
    // The internal-bis card shows whether B3 Construction can use the BIS lookup.
    // Status mirrors the shared BIS connection (same clientId/secret).
    getBisSettings(token)
      .then((s) => {
        setStatuses((prev) => ({
          ...prev,
          'internal-bis':
            s.enabled && s.hasClientSecret ? 'connected' : s.clientId ? 'partial' : 'disconnected',
        }));
      })
      .catch(() => setStatuses((prev) => ({ ...prev, 'internal-bis': 'unknown' })));
  }, [token]);

  const withStatuses = (items: PlatformIntegration[]) =>
    items.map((i) => ({ ...i, status: statuses[i.id] as IntegrationStatus | undefined }));

  const marketplaceIntegrations = INTEGRATIONS.filter((i) => i.scope === 'marketplace');
  const internalIntegrations = INTEGRATIONS.filter((i) => i.scope === 'internal');

  const marketplaceGrouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: withStatuses(marketplaceIntegrations.filter((i) => i.category === cat)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platformas integrācijas"
        description="Ārējie pakalpojumi, kas nodrošina B3Hub tirgu — uzticamības pārbaudes, maksājumi, komunikācija, ģeogrāfija"
      />

      {/* ── Marketplace integrations ───────────────────────────────────────── */}
      {marketplaceGrouped.map(({ category, label, items }) => (
        <section key={category}>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
            {label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>
      ))}

      {/* ── B3 Construction cross-scope visibility ────────────────────────── */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
          B3 Construction — iekšējās integrācijas
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Šīs integrācijas pieder B3 Construction darbības jomai. Konfigurācija notiek B3
          Construction admin sadaļā.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withStatuses(internalIntegrations).map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} crossScope />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Integration card ─────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  crossScope = false,
}: {
  integration: PlatformIntegration & { status?: IntegrationStatus };
  crossScope?: boolean;
}) {
  const Icon = integration.icon;
  const isPlanned = integration.planned;

  const card = (
    <Card
      className={`group transition-colors h-full ${
        isPlanned ? 'opacity-60 cursor-default' : 'hover:border-primary/50 cursor-pointer'
      } ${crossScope ? 'border-dashed' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">{integration.label}</CardTitle>
              {integration.scopeLabel && (
                <span className="text-[11px] text-muted-foreground">{integration.scopeLabel}</span>
              )}
            </div>
          </div>
          <StatusBadge status={integration.status} planned={isPlanned} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-sm leading-relaxed">
          {integration.description}
        </CardDescription>
        {!isPlanned && (
          <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:underline">
            {crossScope ? 'Atvērt B3 Construction' : 'Konfigurēt'}
            <ArrowRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return isPlanned ? (
    <div key={integration.id}>{card}</div>
  ) : (
    <Link key={integration.id} href={integration.href}>
      {card}
    </Link>
  );
}
