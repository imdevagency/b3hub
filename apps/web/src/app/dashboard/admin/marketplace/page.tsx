/**
 * Admin Marketplace Engine — /dashboard/admin/marketplace
 *
 * Tabbed overview of the skip hire comparison engine:
 *   Tab 1 "matrix"     — carrier × size pricing grid with filters
 *   Tab 2 "floor"      — CMS platform floor prices per skip size
 *   Tab 3 "commission" — carrier commission rates
 */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetMarketplace,
  type AdminMarketplaceData,
  type MarketplaceCarrier,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCw,
  Store,
  MapPin,
  Radius,
  Globe,
  CheckCircle2,
  XCircle,
  Info,
  Star,
  ExternalLink,
  Search,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function euro(v: number) {
  return v.toLocaleString('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(s));
}

// ─── Coverage badge ────────────────────────────────────────────────────────────

function CoverageBadge({ carrier }: { carrier: MarketplaceCarrier }) {
  if (carrier.coverageType === 'zones') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium cursor-default">
              <MapPin className="h-3 w-3" />
              {carrier.serviceZones.length} zona{carrier.serviceZones.length !== 1 ? 's' : ''}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-55">
            <p className="font-semibold mb-1">Apkalpojamās zonas</p>
            <ul className="text-xs space-y-0.5">
              {carrier.serviceZones.map((z) => (
                <li key={z.id}>
                  {z.city}
                  {z.postcode ? ` (${z.postcode})` : ''}
                  {z.surcharge > 0 ? (
                    <span className="text-amber-600 ml-1">+{euro(z.surcharge)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (carrier.coverageType === 'radius') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 text-xs font-medium">
        <Radius className="h-3 w-3" />
        {carrier.serviceRadiusKm} km
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-medium">
      <Globe className="h-3 w-3" />
      Nacionāls
    </span>
  );
}

// ─── Price cell ────────────────────────────────────────────────────────────────

function PriceCell({
  carrier,
  sizeCode,
  floorPrice,
}: {
  carrier: MarketplaceCarrier;
  sizeCode: string;
  floorPrice: number | null;
}) {
  const custom = carrier.pricingBySizeCode[sizeCode];

  if (!custom) {
    if (floorPrice == null) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-amber-600 text-xs cursor-default">
              <Info className="h-3 w-3 shrink-0" />
              {euro(floorPrice)}
            </span>
          </TooltipTrigger>
          <TooltipContent>CMS pamata cena — nav individuālas cenas</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isAboveFloor = floorPrice != null && custom.price > floorPrice;
  const isBelowFloor = floorPrice != null && custom.price < floorPrice;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 font-semibold text-sm cursor-default',
              isBelowFloor && 'text-emerald-700',
              isAboveFloor && 'text-rose-700',
              !isAboveFloor && !isBelowFloor && 'text-foreground',
            )}
          >
            {isBelowFloor && <TrendingDown className="h-3 w-3 shrink-0" />}
            {isAboveFloor && <TrendingUp className="h-3 w-3 shrink-0" />}
            {!isAboveFloor && !isBelowFloor && (
              <Minus className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {euro(custom.price)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Individuāla cena · {fmtDate(custom.updatedAt)}</p>
          {floorPrice != null && (
            <p className="text-xs mt-0.5 text-muted-foreground">
              CMS pamata: {euro(floorPrice)}
              {isBelowFloor && ' · zemāka par CMS'}
              {isAboveFloor && ' · augstāka par CMS'}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({ data }: { data: AdminMarketplaceData }) {
  const total = data.carriers.length;
  const verified = data.carriers.filter((c) => c.verified).length;
  const blocked = data.carriers.filter((c) => c.blockedToday).length;
  const withCustomPricing = data.carriers.filter((c) => c.carrierPricing.length > 0).length;
  const national = data.carriers.filter((c) => c.coverageType === 'national').length;

  const stats: { label: string; value: number; sub: string; color?: string }[] = [
    { label: 'Pārvadātāji', value: total, sub: 'reģistrēti' },
    { label: 'Verificēti', value: verified, sub: `no ${total}`, color: 'text-emerald-700' },
    {
      label: 'Bloķēti šodien',
      value: blocked,
      sub: 'nav pieejami',
      color: blocked > 0 ? 'text-rose-600' : undefined,
    },
    { label: 'Ar individuālām cenām', value: withCustomPricing, sub: 'pārvadātāji' },
    { label: 'Nacionālie', value: national, sub: 'visa Latvija' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4">
          <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
          <p className="text-xs font-semibold mt-0.5">{s.label}</p>
          <p className="text-xs text-muted-foreground">{s.sub}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── Legend strip ──────────────────────────────────────────────────────────────

function LegendStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground py-2.5 px-1 border-y border-border">
      <span className="inline-flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 text-amber-500" />
        CMS pamata cena
      </span>
      <span className="inline-flex items-center gap-1.5">
        <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
        Zemāka par CMS
      </span>
      <span className="inline-flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-rose-500" />
        Augstāka par CMS
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        Vienāda ar CMS
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-blue-600" />
        Zonas
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Radius className="h-3.5 w-3.5 text-violet-600" />
        Rādiuss
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5 text-emerald-600" />
        Nacionāls
      </span>
    </div>
  );
}

// ─── Tab: Pricing matrix ───────────────────────────────────────────────────────

function PricingMatrixTab({ data }: { data: AdminMarketplaceData }) {
  const [showUnverified, setShowUnverified] = useState(false);
  const [hideBlocked, setHideBlocked] = useState(false);
  const [search, setSearch] = useState('');

  const activeSizes = data.sizes.filter((s) => s.isActive);
  const visible = data.carriers.filter((c) => {
    if (!showUnverified && !c.verified) return false;
    if (hideBlocked && c.blockedToday) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-45 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Meklēt pārvadātāju..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-unverified"
            checked={showUnverified}
            onCheckedChange={setShowUnverified}
          />
          <Label htmlFor="show-unverified" className="text-sm cursor-pointer">
            Neverificētie
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="hide-blocked" checked={hideBlocked} onCheckedChange={setHideBlocked} />
          <Label htmlFor="hide-blocked" className="text-sm cursor-pointer">
            Slēpt bloķētos
          </Label>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} / {data.carriers.length} pārvadātāji
        </span>
      </div>

      <LegendStrip />

      {visible.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nav pārvadātāju"
          description="Pielāgojiet filtrus, lai redzētu pārvadātājus"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="min-w-50 sticky left-0 bg-muted/40 z-10">
                  Pārvadātājs
                </TableHead>
                <TableHead className="w-28">Pārklājums</TableHead>
                <TableHead className="w-24">Statuss</TableHead>
                {activeSizes.map((size) => (
                  <TableHead key={size.code} className="text-center min-w-27.5">
                    <div className="font-semibold">{size.labelLv ?? size.label}</div>
                    <div className="text-[11px] font-normal text-muted-foreground">
                      {size.volumeM3} m³
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((carrier) => (
                <TableRow
                  key={carrier.id}
                  className={cn(
                    !carrier.verified && 'opacity-50',
                    carrier.blockedToday && 'bg-rose-50/50',
                  )}
                >
                  <TableCell className="sticky left-0 bg-background z-10">
                    <div className="flex items-start gap-2.5">
                      {carrier.logo ? (
                        <img
                          src={carrier.logo}
                          alt={carrier.name}
                          className="h-8 w-8 rounded object-contain shrink-0 border"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Store className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/admin/companies/${carrier.id}`}
                          className="font-medium text-sm hover:underline flex items-center gap-1 leading-tight"
                        >
                          {carrier.name}
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        </Link>
                        <p className="text-xs text-muted-foreground">{carrier.companyType}</p>
                        {carrier.rating != null && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600">
                            <Star className="h-2.5 w-2.5 fill-amber-500 stroke-none" />
                            {carrier.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CoverageBadge carrier={carrier} />
                  </TableCell>
                  <TableCell>
                    {!carrier.verified ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />
                        Nav verif.
                      </span>
                    ) : carrier.blockedToday ? (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                        <XCircle className="h-3.5 w-3.5" />
                        Bloķēts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Pieejams
                      </span>
                    )}
                  </TableCell>
                  {activeSizes.map((size) => (
                    <TableCell key={size.code} className="text-center">
                      <PriceCell
                        carrier={carrier}
                        sizeCode={size.code}
                        floorPrice={size.basePrice}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Platform floor prices ────────────────────────────────────────────────

function FloorPricesTab({ data }: { data: AdminMarketplaceData }) {
  const active = data.sizes.filter((s) => s.isActive);
  const inactive = data.sizes.filter((s) => !s.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-prose">
          Platformas grīdas cenas — pārvadātāji var uzstādīt savas individuālās cenas, bet nevar iet
          zemāk par šīm.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/admin/catalog?tab=skip-sizes">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Rediģēt izmērus
          </Link>
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Aktīvie izmēri ({active.length})</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {active.map((size) => (
            <Card key={size.code} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge variant="secondary" className="text-xs font-mono">
                  {size.code}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50"
                >
                  Aktīvs
                </Badge>
              </div>
              <p className="font-semibold text-base leading-tight">{size.labelLv ?? size.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{size.volumeM3} m³</p>
              <p className="text-2xl font-bold mt-3 tabular-nums">
                {size.basePrice != null ? (
                  euro(size.basePrice)
                ) : (
                  <span className="text-sm font-normal text-muted-foreground italic">
                    Nav iestatīta
                  </span>
                )}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {inactive.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
            Neaktīvie izmēri ({inactive.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {inactive.map((size) => (
              <Card key={size.code} className="p-4 opacity-50">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    {size.code}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Neaktīvs
                  </Badge>
                </div>
                <p className="font-semibold text-base leading-tight">
                  {size.labelLv ?? size.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{size.volumeM3} m³</p>
                <p className="text-2xl font-bold mt-3 tabular-nums">
                  {size.basePrice != null ? (
                    euro(size.basePrice)
                  ) : (
                    <span className="text-sm font-normal text-muted-foreground italic">
                      Nav iestatīta
                    </span>
                  )}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Commission rates ─────────────────────────────────────────────────────

function CommissionsTab({ data }: { data: AdminMarketplaceData }) {
  const [search, setSearch] = useState('');
  const visible = data.carriers.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-45 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Meklēt pārvadātāju..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{visible.length} pārvadātāji</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-50">Pārvadātājs</TableHead>
              <TableHead>Tips</TableHead>
              <TableHead>Statuss</TableHead>
              <TableHead className="text-right">Piegādātāja komisija</TableHead>
              <TableHead className="text-right">Pārvadātāja komisija</TableHead>
              <TableHead className="text-right">Individuālas cenas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((carrier) => (
              <TableRow key={carrier.id} className={cn(!carrier.verified && 'opacity-50')}>
                <TableCell>
                  <Link
                    href={`/dashboard/admin/companies/${carrier.id}`}
                    className="font-medium text-sm hover:underline flex items-center gap-1"
                  >
                    {carrier.name}
                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  </Link>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {carrier.companyType}
                </TableCell>
                <TableCell>
                  {carrier.verified ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Verificēts
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3" />
                      Nepieteikts
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm">{carrier.commissionRate}%</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm font-semibold">
                    {carrier.carrierCommissionRate}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {carrier.carrierPricing.length > 0 ? (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {carrier.carrierPricing.length} izmēri
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Inner page (needs useSearchParams → Suspense boundary) ───────────────────

function MarketplaceContent() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = (searchParams.get('tab') ?? 'matrix') as 'matrix' | 'floor' | 'commission';

  const [data, setData] = useState<AdminMarketplaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminGetMarketplace(token));
    } catch {
      setError('Neizdevās ielādēt tirgus datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Tirgus dzinējs" description="Cenu salīdzināšanas motora pārskats" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Tirgus dzinējs" />
        <EmptyState
          icon={Store}
          title="Kļūda"
          description={error ?? 'Nav datu'}
          action={
            <Button onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Mēģināt vēlreiz
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Tirgus dzinējs"
        description={`${data.carriers.filter((c) => c.verified).length} verificēti pārvadātāji · ${data.sizes.filter((s) => s.isActive).length} aktīvi izmēri`}
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
            Atjaunināt
          </Button>
        }
      />

      <StatsRow data={data} />

      <Tabs value={tab} onValueChange={(t) => router.push(`?tab=${t}`)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="matrix">Cenu matrica</TabsTrigger>
          <TabsTrigger value="floor">Platformas cenas</TabsTrigger>
          <TabsTrigger value="commission">Komisijas</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          <PricingMatrixTab data={data} />
        </TabsContent>
        <TabsContent value="floor" className="mt-4">
          <FloorPricesTab data={data} />
        </TabsContent>
        <TabsContent value="commission" className="mt-4">
          <CommissionsTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Page (Suspense required for useSearchParams) ─────────────────────────────

export default function MarketplacePage() {
  return (
    <Suspense>
      <MarketplaceContent />
    </Suspense>
  );
}
