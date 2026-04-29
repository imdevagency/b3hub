/**
 * Admin Marketplace Engine Overview — /dashboard/admin/marketplace
 *
 * Centralised view of the skip hire comparison engine:
 *   - CMS floor prices per skip size (set by admin via /admin/skip-sizes)
 *   - Each verified carrier's custom rate per size (or "floor" if none set)
 *   - Coverage type: service zones / radius / national
 *   - Today's availability status
 *
 * This page is read-only — prices are edited in /admin/skip-sizes (floor)
 * or by the carrier in their own seller portal (custom rates).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCw,
  Store,
  MapPin,
  Radius,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Star,
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
          <TooltipContent side="right" className="max-w-[220px]">
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
    if (floorPrice == null) {
      return <span className="text-muted-foreground text-xs italic">Nav cenas</span>;
    }
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-amber-700 text-xs cursor-default">
              <Info className="h-3 w-3 shrink-0" />
              {euro(floorPrice)}
            </span>
          </TooltipTrigger>
          <TooltipContent>Izmanto CMS pamata cenu — nav individuālas cenas</TooltipContent>
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
              'font-semibold text-sm cursor-default',
              isBelowFloor && 'text-emerald-700',
              isAboveFloor && 'text-rose-700',
              !isAboveFloor && !isBelowFloor && 'text-foreground',
            )}
          >
            {euro(custom.price)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Individuāla cena · atjaunots {fmtDate(custom.updatedAt)}</p>
          {floorPrice != null && (
            <p className="text-xs mt-0.5 text-muted-foreground">
              CMS pamata: {euro(floorPrice)}
              {isBelowFloor && ' · zemāka'}
              {isAboveFloor && ' · augstāka'}
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {[
        { label: 'Pārvadātāji', value: total, sub: 'kopā' },
        { label: 'Verificēti', value: verified, sub: `no ${total}` },
        { label: 'Bloķēti šodien', value: blocked, sub: 'nav pieejami' },
        { label: 'Ar individuālām cenām', value: withCustomPricing, sub: 'pārvadātāji' },
        { label: 'Nacionālie', value: national, sub: 'visas Latvijas' },
      ].map((s) => (
        <Card key={s.label} className="p-3">
          <p className="text-2xl font-bold">{s.value}</p>
          <p className="text-xs font-medium mt-0.5">{s.label}</p>
          <p className="text-xs text-muted-foreground">{s.sub}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [data, setData] = useState<AdminMarketplaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter: verified only toggle
  const [showUnverified, setShowUnverified] = useState(false);
  // Filter: show blocked
  const [hideBlocked, setHideBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminGetMarketplace(token);
      setData(result);
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
      <div className="space-y-4 p-4">
        <PageHeader title="Tirgus dzinējs" description="Cenu salīdzināšanas motora pārskats" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <PageHeader title="Tirgus dzinējs" />
        <EmptyState
          icon={AlertTriangle}
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

  const visibleCarriers = data.carriers.filter((c) => {
    if (!showUnverified && !c.verified) return false;
    if (hideBlocked && c.blockedToday) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title="Tirgus dzinējs"
        description="Cenu salīdzināšanas motora pilnais pārskats — CMS pamata cenas, pārvadātāju individuālās cenas un pārklājums"
        action={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunināt
          </Button>
        }
      />

      <StatsRow data={data} />

      {/* Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Leģenda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-amber-600" />
            Izmanto CMS pamata cenu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-emerald-700">€x.xx</span>
            Individuāla cena zemāka par CMS pamatu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-rose-700">€x.xx</span>
            Individuāla cena augstāka par CMS pamatu
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            Pārklājums ar zonām
          </span>
          <span className="flex items-center gap-1.5">
            <Radius className="h-3.5 w-3.5 text-violet-600" />
            Pārklājums ar rādiusu
          </span>
          <span className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-emerald-600" />
            Nacionāls pārklājums
          </span>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowUnverified((v) => !v)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border transition-colors',
            showUnverified
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {showUnverified ? 'Rādīt visus' : 'Tikai verificētie'}
        </button>
        <button
          onClick={() => setHideBlocked((v) => !v)}
          className={cn(
            'text-xs px-3 py-1.5 rounded-full border transition-colors',
            hideBlocked
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-muted-foreground hover:text-foreground',
          )}
        >
          {hideBlocked ? 'Rādīt bloķētos' : 'Slēpt šodienas bloķētos'}
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          {visibleCarriers.length} pārvadātāj{visibleCarriers.length === 1 ? 's' : 'i'} redzami
        </span>
      </div>

      {/* CMS floor prices summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Store className="h-4 w-4" />
            CMS pamata cenas (platformas grīda)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {data.sizes.map((size) => (
              <div
                key={size.code}
                className={cn(
                  'border rounded-lg px-3 py-2 text-sm',
                  !size.isActive && 'opacity-40',
                )}
              >
                <p className="font-semibold">{size.labelLv ?? size.label}</p>
                <p className="text-xs text-muted-foreground">
                  {size.code} · {size.volumeM3} m³
                </p>
                <p className="text-base font-bold mt-1">
                  {size.basePrice != null ? (
                    euro(size.basePrice)
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Nav iestatīta</span>
                  )}
                </p>
                {!size.isActive && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Neaktīvs
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main pricing matrix */}
      {visibleCarriers.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nav pārvadātāju"
          description="Pielāgojiet filtrus, lai redzētu pārvadātājus"
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cenu matrica — pārvadātāji × izmēri</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px] sticky left-0 bg-background z-10">
                    Pārvadātājs
                  </TableHead>
                  <TableHead className="w-28">Pārklājums</TableHead>
                  <TableHead className="w-24">Statuss</TableHead>
                  {data.sizes
                    .filter((s) => s.isActive)
                    .map((size) => (
                      <TableHead key={size.code} className="text-center min-w-[110px]">
                        <div className="font-semibold">{size.labelLv ?? size.label}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {size.volumeM3} m³
                        </div>
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleCarriers.map((carrier) => (
                  <TableRow
                    key={carrier.id}
                    className={cn(
                      !carrier.verified && 'opacity-50',
                      carrier.blockedToday && 'bg-rose-50/40',
                    )}
                  >
                    {/* Carrier name */}
                    <TableCell className="sticky left-0 bg-background z-10">
                      <div className="flex items-start gap-2">
                        {carrier.logo ? (
                          <img
                            src={carrier.logo}
                            alt={carrier.name}
                            className="h-8 w-8 rounded object-contain shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                            <Store className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm leading-tight">{carrier.name}</p>
                          <p className="text-xs text-muted-foreground">{carrier.companyType}</p>
                          {carrier.rating != null && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                              <Star className="h-3 w-3 fill-amber-500 stroke-none" />
                              {carrier.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Coverage */}
                    <TableCell>
                      <CoverageBadge carrier={carrier} />
                    </TableCell>

                    {/* Availability */}
                    <TableCell>
                      {!carrier.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" />
                          Nepieteikt
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

                    {/* Price per active size */}
                    {data.sizes
                      .filter((s) => s.isActive)
                      .map((size) => (
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
          </CardContent>
        </Card>
      )}

      {/* Commission rates summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Komisijas likmes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pārvadātājs</TableHead>
                <TableHead className="text-right">Piegādātāja komisija %</TableHead>
                <TableHead className="text-right">Pārvadātāja komisija %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCarriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium text-sm">{carrier.name}</TableCell>
                  <TableCell className="text-right text-sm">{carrier.commissionRate}%</TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {carrier.carrierCommissionRate}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
