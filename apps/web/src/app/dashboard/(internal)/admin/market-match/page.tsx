/**
 * Market Matching — /dashboard/admin/market-match
 *
 * For every option a buyer can select in a wizard (material category or
 * waste type), shows how many suppliers / recycling centers actually back it up.
 *
 * Status:  COVERED (≥2 providers)  THIN (1 provider)  GAP (0 providers — dead end)
 *
 * Lets ops see exactly which wizard choices are "empty promises" and act:
 * recruit a supplier, open an application, or temporarily hide the option.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetMarketMatch,
  type MarketMatchData,
  type MaterialMatchRow,
  type WasteMatchRow,
  type MatchStatus,
} from '@/lib/api/admin';
import { CATEGORY_LABELS } from '@b3hub/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Hammer,
  Loader2,
  Package,
  Recycle,
  RefreshCw,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WASTE_TYPE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  BRICK: 'Ķieģeļi / Būvgruži',
  WOOD: 'Koksne',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Zeme / Augsne',
  MIXED: 'Jaukti būvatkritumi',
  HAZARDOUS: 'Bīstami atkritumi',
};

function statusColor(s: MatchStatus) {
  return s === 'COVERED'
    ? 'text-green-700 bg-green-50 border-green-200'
    : s === 'THIN'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200';
}

function StatusBadge({ status }: { status: MatchStatus }) {
  const icon =
    status === 'COVERED' ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : status === 'THIN' ? (
      <AlertTriangle className="h-3.5 w-3.5" />
    ) : (
      <XCircle className="h-3.5 w-3.5" />
    );
  const label =
    status === 'COVERED'
      ? 'Nodrošināts'
      : status === 'THIN'
        ? 'Mazs piedāvājums'
        : 'Nav piedāvājuma';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
        statusColor(status),
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-green-700 bg-green-50 border-green-200'
      : score >= 55
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-red-700 bg-red-50 border-red-200';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full border',
        color,
      )}
    >
      {score}% atbilstība
    </span>
  );
}

// ─── Material table ────────────────────────────────────────────────────────────

function MaterialTable({ rows }: { rows: MaterialMatchRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const order = { GAP: 0, THIN: 1, COVERED: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
            <th className="py-2 px-3 text-left">Kategorija (pircējs redz)</th>
            <th className="py-2 px-3 text-center">Piegādātāji</th>
            <th className="py-2 px-3 text-center">Aktīvie saraksti</th>
            <th className="py-2 px-3 text-center">RFQ pieprasījumi</th>
            <th className="py-2 px-3 text-center">Neapstrādāti RFQ</th>
            <th className="py-2 px-3 text-center">Statuss</th>
            <th className="py-2 px-3 text-right">Darbība</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((row) => {
            const label =
              CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] ?? row.category;
            return (
              <tr
                key={row.category}
                className={cn(
                  'hover:bg-muted/40 transition-colors',
                  row.status === 'GAP' && 'bg-red-50/40',
                )}
              >
                <td className="py-2.5 px-3 font-medium">{label}</td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={cn(
                      'font-semibold',
                      row.supplierCount === 0
                        ? 'text-red-600'
                        : row.supplierCount === 1
                          ? 'text-amber-600'
                          : 'text-green-700',
                    )}
                  >
                    {row.supplierCount}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center text-muted-foreground">
                  {row.listingCount}
                </td>
                <td className="py-2.5 px-3 text-center text-muted-foreground">{row.rfqTotal}</td>
                <td className="py-2.5 px-3 text-center">
                  {row.rfqPending > 0 ? (
                    <span className="font-semibold text-amber-600">{row.rfqPending}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <StatusBadge status={row.status} />
                </td>
                <td className="py-2.5 px-3 text-right">
                  {row.status === 'GAP' ? (
                    <Link
                      href="/dashboard/admin/suppliers"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Piesaistīt piegādātāju →
                    </Link>
                  ) : row.status === 'THIN' ? (
                    <Link
                      href="/dashboard/admin/suppliers"
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Paplašināt →
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/admin/catalog"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Skatīt katalogā →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Waste type table ─────────────────────────────────────────────────────────

function WasteTable({ rows }: { rows: WasteMatchRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const order = { GAP: 0, THIN: 1, COVERED: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
            <th className="py-2 px-3 text-left">Atkritumu veids (pircējs redz)</th>
            <th className="py-2 px-3 text-center">Pieņemošie centri</th>
            <th className="py-2 px-3 text-center">Kopējā jauda (t/d)</th>
            <th className="py-2 px-3 text-center">Statuss</th>
            <th className="py-2 px-3 text-right">Darbība</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((row) => {
            const label = WASTE_TYPE_LABELS[row.wasteType] ?? row.wasteType;
            return (
              <tr
                key={row.wasteType}
                className={cn(
                  'hover:bg-muted/40 transition-colors',
                  row.status === 'GAP' && 'bg-red-50/40',
                )}
              >
                <td className="py-2.5 px-3 font-medium">{label}</td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={cn(
                      'font-semibold',
                      row.centerCount === 0
                        ? 'text-red-600'
                        : row.centerCount === 1
                          ? 'text-amber-600'
                          : 'text-green-700',
                    )}
                  >
                    {row.centerCount}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center text-muted-foreground">
                  {row.capacityTpd > 0 ? `${row.capacityTpd} t/d` : '—'}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <StatusBadge status={row.status} />
                </td>
                <td className="py-2.5 px-3 text-right">
                  {row.status === 'GAP' ? (
                    <Link
                      href="/dashboard/admin/recycling-centers"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Reģistrēt centru →
                    </Link>
                  ) : row.status === 'THIN' ? (
                    <Link
                      href="/dashboard/admin/recycling-centers"
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Paplašināt tīklu →
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/recycling"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Skatīt pārstrādi →
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketMatchPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MarketMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminGetMarketMatch(token);
      setData(result);
    } catch {
      setError('Neizdevās ielādēt atbilstības datus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.userType !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    load();
  }, [user, router, load]);

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Tirgus atbilstība"
          description="Katrai izvēlei pircēja vednī — cik piegādātāji/centri to faktiski nodrošina"
        />
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
          Atjaunināt
        </Button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Ielādē atbilstības matricu…
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {data && s && (
        <>
          {/* ── Summary strip ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Kopējais rādītājs</p>
                <ScoreBadge score={s.matchScore} />
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-0 shadow-sm',
                s.gapCategories > 0 && 'border-l-4 border-l-red-400',
              )}
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Materiālu trūkumi</p>
                <p className="text-2xl font-bold text-red-600">{s.gapCategories}</p>
                <p className="text-xs text-muted-foreground">
                  no {s.totalMaterialCategories} kategorijām
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-0 shadow-sm',
                s.gapWasteTypes > 0 && 'border-l-4 border-l-red-400',
              )}
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Atkritumu trūkumi</p>
                <p className="text-2xl font-bold text-red-600">{s.gapWasteTypes}</p>
                <p className="text-xs text-muted-foreground">no {s.totalWasteTypes} veidiem</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Nodrošināti</p>
                <p className="text-2xl font-bold text-green-700">
                  {s.coveredCategories + s.coveredWasteTypes}
                </p>
                <p className="text-xs text-muted-foreground">
                  no {s.totalMaterialCategories + s.totalWasteTypes} opcijām
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Alert: gaps present ───────────────────────────────────────── */}
          {(s.gapCategories > 0 || s.gapWasteTypes > 0) && (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Vednī ir mirušie ceļi.</span>{' '}
                {s.gapCategories > 0 && (
                  <>
                    {s.gapCategories} materiālu
                    {s.gapCategories === 1 ? 'a kategorij' : 'u kategorij'}
                    {s.gapCategories === 1 ? 'ai' : 'ām'} nav neviena piegādātāja.{' '}
                  </>
                )}
                {s.gapWasteTypes > 0 && (
                  <>
                    {s.gapWasteTypes} atkritumu veid{s.gapWasteTypes === 1 ? 'am' : 'iem'} nav
                    neviena pieņemošā centra.{' '}
                  </>
                )}
                Pircēji, kas izvēlas šīs opcijas vednī, nonāks strupceļā.
              </div>
            </div>
          )}

          {/* ── Material coverage ────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Materiālu kategorijas — vedņa opcijas vs. piegādes reālitāte
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pircēji var izvēlēties jebkuru no šīm {s.totalMaterialCategories} kategorijām
                materiālu pasūtīšanas vednī.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <MaterialTable rows={data.materialMatrix} />
            </CardContent>
          </Card>

          {/* ── Waste type coverage ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Recycle className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Atkritumu veidi — vedņa opcijas vs. pārstrādes centru pieņemšana
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pircēji var izvēlēties jebkuru no šiem {s.totalWasteTypes} atkritumu veidiem
                iznešanas vednī.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <WasteTable rows={data.wasteMatrix} />
            </CardContent>
          </Card>

          {/* ── Explanation strip ────────────────────────────────────────── */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Kā rīkoties ar atstarpēm
              </p>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">GAP — nav piedāvājuma</p>
                    <p className="text-xs text-muted-foreground">
                      Piesaistīt piegādātāju/centru vai īslaicīgi paslēpt opciju no vedņa, lai
                      izvairītos no neapmierinātiem pircējiem.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">THIN — viens piedāvātājs</p>
                    <p className="text-xs text-muted-foreground">
                      Riskants koncentrācijas punkts — ja viens piegādātājs pārtrauc darbu,
                      kategorija kļūst par GAP. Meklēt otro piedāvātāju.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">COVERED — ≥2 piedāvātāji</p>
                    <p className="text-xs text-muted-foreground">
                      Konkurence un rezerve ir nodrošināta. Uzmanība: augsts RFQ "neapstrādāts"
                      skaits var norādīt uz cenu vai ģeogrāfijas neatbilstību.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
