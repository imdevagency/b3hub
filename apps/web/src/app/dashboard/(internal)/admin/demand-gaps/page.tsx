/**
 * Demand Gaps — /dashboard/admin/demand-gaps
 *
 * Two panels:
 *  1. Neapmierināts pieprasījums — RFQs that expired/cancelled without a supplier match
 *  2. Atbirums brīdinājums — suppliers & carriers that were active 30–90 days ago
 *     but have had no activity in the last 30 days (churn early warning)
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetDemandGaps,
  adminBroadcastNotification,
  type AdminDemandGaps,
} from '@/lib/api/admin';
import { CATEGORY_LABELS } from '@b3hub/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── helpers ──────────────────────────────────────────────────────────────────

function catLabel(c: string) {
  return (CATEGORY_LABELS as Record<string, string>)[c] ?? c;
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemandGapsPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [data, setData] = useState<AdminDemandGaps | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notify state
  const [notifying, setNotifying] = useState<'suppliers' | 'carriers' | null>(null);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminGetDemandGaps(token));
    } catch {
      setError('Neizdevās ielādēt datus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function notifyGroup(audience: 'SELLERS' | 'CARRIERS', label: string) {
    const which = audience === 'SELLERS' ? 'suppliers' : 'carriers';
    setNotifying(which);
    setNotifyResult(null);
    try {
      const res = await adminBroadcastNotification(
        'B3Hub — atgriezieties platformā',
        `Jūsu uzņēmuma darbība platformā ir samazinājusies. Piesakieties, lai pārskatītu jaunus pasūtījumus un iespējas.`,
        audience,
        token,
      );
      setNotifyResult(`Paziņojums nosūtīts ${res.sent} ${label}.`);
    } catch {
      setNotifyResult('Nosūtīšana neizdevās.');
    } finally {
      setNotifying(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive flex items-center gap-2">
        <XCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Pieprasījuma trūkumi"
          description="Neapmierināts pieprasījums un piegādātāju/pārvadātāju atbiruma brīdinājums"
        />
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Neapmierināti RFQ"
            value={summary.unfulfilledRfqCount}
            icon={<ShoppingBag className="h-5 w-5 text-orange-500" />}
            color="bg-orange-50 border-orange-200"
          />
          <SummaryCard
            label="Neaktīvi piegādātāji"
            value={summary.dormantSupplierCount}
            icon={<Building2 className="h-5 w-5 text-amber-500" />}
            color="bg-amber-50 border-amber-200"
          />
          <SummaryCard
            label="Neaktīvi pārvadātāji"
            value={summary.dormantCarrierCount}
            icon={<Truck className="h-5 w-5 text-blue-500" />}
            color="bg-blue-50 border-blue-200"
          />
        </div>
      )}

      {notifyResult && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notifyResult}
        </div>
      )}

      <Tabs defaultValue="rfqs">
        <TabsList>
          <TabsTrigger value="rfqs">
            Neapmierināts pieprasījums{' '}
            {summary && summary.unfulfilledRfqCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {summary.unfulfilledRfqCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="churn">
            Atbiruma brīdinājums{' '}
            {summary && summary.dormantSupplierCount + summary.dormantCarrierCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {summary.dormantSupplierCount + summary.dormantCarrierCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Unfulfilled RFQs ─────────────────────────────────────── */}
        <TabsContent value="rfqs" className="pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                RFQ bez atbildes (pēdējie 90 dienas) — beidzies derīguma termiņš vai atcelts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!data || data.unfulfilledRfqs.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nav neapmierinātu RFQ pēdējo 90 dienu laikā.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2.5">RFQ #</th>
                        <th className="px-4 py-2.5">Materiāls</th>
                        <th className="px-4 py-2.5">Kategorija</th>
                        <th className="px-4 py-2.5">Daudzums</th>
                        <th className="px-4 py-2.5">Pilsēta</th>
                        <th className="px-4 py-2.5">Pircējs</th>
                        <th className="px-4 py-2.5">Statuss</th>
                        <th className="px-4 py-2.5">Datums</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.unfulfilledRfqs.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {r.requestNumber}
                          </td>
                          <td className="px-4 py-2.5 font-medium">{r.materialName}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {catLabel(r.materialCategory)}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {r.quantity} {r.unit}
                          </td>
                          <td className="px-4 py-2.5">{r.deliveryCity}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.buyerName}</td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant={r.status === 'EXPIRED' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {r.status === 'EXPIRED' ? 'Beidzies' : 'Atcelts'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {relativeDate(r.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data && data.unfulfilledRfqs.length > 0 && (
                <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                  {data.unfulfilledRfqs.length} neapmierināts pieprasījums pēdējo 90 dienu laikā
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Churn early warning ─────────────────────────────────── */}
        <TabsContent value="churn" className="pt-4 space-y-6">
          {/* Dormant suppliers */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-500" />
                Neaktīvi piegādātāji (aktīvi pirms 30–90 dienām, nav aktivitātes pēdējās 30 dienās)
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={notifying === 'suppliers' || !data || data.dormantSuppliers.length === 0}
                onClick={() => notifyGroup('SELLERS', 'piegādātājiem')}
              >
                {notifying === 'suppliers' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
                Paziņot visiem piegādātājiem
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!data || data.dormantSuppliers.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nav neaktīvu piegādātāju. Visi piegādātāji ir aktīvi.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2.5">Uzņēmums</th>
                        <th className="px-4 py-2.5">Aktīvie sludinājumi</th>
                        <th className="px-4 py-2.5">Pēdējais pasūtījums</th>
                        <th className="px-4 py-2.5">Neaktīvs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.dormantSuppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{s.name}</td>
                          <td className="px-4 py-2.5 tabular-nums">{s.activeListings}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {s.lastOrderAt ? relativeDate(s.lastOrderAt) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant={
                                (s.daysSinceLastOrder ?? 0) > 60 ? 'destructive' : 'secondary'
                              }
                              className="text-xs"
                            >
                              {s.daysSinceLastOrder != null ? `${s.daysSinceLastOrder} d.` : '—'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data && data.dormantSuppliers.length > 0 && (
                <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                  {data.dormantSuppliers.length} neaktīvi piegādātāji
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dormant carriers */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                Neaktīvi pārvadātāji (aktīvi pirms 30–90 dienām, nav aktivitātes pēdējās 30 dienās)
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={notifying === 'carriers' || !data || data.dormantCarriers.length === 0}
                onClick={() => notifyGroup('CARRIERS', 'pārvadātājiem')}
              >
                {notifying === 'carriers' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
                Paziņot visiem pārvadātājiem
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!data || data.dormantCarriers.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nav neaktīvu pārvadātāju. Visi pārvadātāji ir aktīvi.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2.5">Uzņēmums</th>
                        <th className="px-4 py-2.5">Pēdējais darbs</th>
                        <th className="px-4 py-2.5">Neaktīvs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.dormantCarriers.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{c.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {c.lastJobAt ? relativeDate(c.lastJobAt) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant={(c.daysSinceLastJob ?? 0) > 60 ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {c.daysSinceLastJob != null ? `${c.daysSinceLastJob} d.` : '—'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data && data.dormantCarriers.length > 0 && (
                <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                  {data.dormantCarriers.length} neaktīvi pārvadātāji
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${color}`}>
      <div className="p-2 rounded-lg bg-white/60">{icon}</div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
