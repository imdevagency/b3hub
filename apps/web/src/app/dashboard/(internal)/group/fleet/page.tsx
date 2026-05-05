'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  HardHat,
  Loader2,
  Navigation,
  Package,
  RefreshCw,
  Recycle,
  Truck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { getFleetOverview, type FleetVehicle } from '@/lib/api/vehicle-assignments';

const BU_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MARKETPLACE: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  CONSTRUCTION: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  RECYCLING: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  UNASSIGNED: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

const BU_ICONS: Record<string, React.ElementType> = {
  MARKETPLACE: Package,
  CONSTRUCTION: HardHat,
  RECYCLING: Recycle,
  UNASSIGNED: Truck,
};

const BU_LABELS: Record<string, string> = {
  MARKETPLACE: 'B3Hub (piegāde)',
  CONSTRUCTION: 'B3 Būve',
  RECYCLING: 'B3 Recycle',
  UNASSIGNED: 'Brīvs',
};

export default function GroupFleetPage() {
  const { token, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getFleetOverview(token);
        setFleet(data);
      } catch {
        setError('Neizdevās ielādēt flotes datus.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isLoading && token) load();
  }, [isLoading, token, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const byBu = fleet.reduce<Record<string, number>>((acc, v) => {
    const key = v.currentAssignment?.buContext ?? 'UNASSIGNED';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Flote"
        description="Koplietojamie transportlīdzekļi visās 3 biznesa vienībās."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* BU utilization summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(BU_LABELS).map(([key, label]) => {
          const count = byBu[key] ?? 0;
          const colors = BU_COLORS[key];
          const Icon = BU_ICONS[key];
          return (
            <Card key={key}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-3xl font-bold mt-1">{count}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">transportlīdzekļi</p>
                  </div>
                  <div
                    className={`h-9 w-9 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`h-4 w-4 ${colors.text}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Fleet table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Navigation className="h-4 w-4 text-muted-foreground" />
            Transportlīdzekļi šodien
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {fleet.length} reģistrēti
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fleet.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Truck className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nav reģistrētu transportlīdzekļu</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Numurs
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Marka / Tips
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      BU
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Uzdevums
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Vadītājs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fleet.map((v) => {
                    const buKey = v.currentAssignment?.buContext ?? 'UNASSIGNED';
                    const colors = BU_COLORS[buKey];
                    return (
                      <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold">{v.licensePlate}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {v.make} {v.model}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            {BU_LABELS[buKey]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {v.currentAssignment?.description ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.currentAssignment?.driverName ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
