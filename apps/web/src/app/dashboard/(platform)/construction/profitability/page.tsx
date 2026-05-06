/**
 * Construction — Profitability Dashboard
 * /dashboard/construction/profitability
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getConstructionProfitability, type ProfitabilityProject } from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n}%`;
}

export default function ProfitabilityPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  const [projects, setProjects] = useState<ProfitabilityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getConstructionProfitability(token, {
        from: from || undefined,
        to: to || undefined,
      });
      setProjects(res.projects);
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue = projects.reduce((s, p) => s + p.contractValue, 0);
  const totalCost = projects.reduce((s, p) => s + p.dprCost, 0);
  const totalMargin = totalRevenue - totalCost;
  const totalMarginPct = totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rentabilitāte"
        description="Projektu ieņēmumi pret izmaksām no dienas atskaitēm"
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">No</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Līdz</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Projekti</p>
            <p className="text-2xl font-bold">{projects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Kopējie ieņēmumi</p>
            <p className="text-2xl font-bold">{fmtEur(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">DPR izmaksas</p>
            <p className="text-2xl font-bold">{fmtEur(totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Peļņa</p>
            <div className="flex items-center gap-2">
              <p
                className={`text-2xl font-bold ${totalMargin >= 0 ? 'text-green-600' : 'text-destructive'}`}
              >
                {fmtEur(totalMargin)}
              </p>
              {totalMargin >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )}
            </div>
            <p className={`text-sm ${totalMarginPct >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {fmtPct(totalMarginPct)}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekts</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Līguma vērtība</TableHead>
                  <TableHead className="text-right">DPR izmaksas</TableHead>
                  <TableHead className="text-right">Peļņa</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtEur(p.contractValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtEur(p.dprCost)}</TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${p.margin >= 0 ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {fmtEur(p.margin)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${p.marginPct >= 0 ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {fmtPct(p.marginPct)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/30">
                  <TableCell>Kopā</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono">{fmtEur(totalRevenue)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEur(totalCost)}</TableCell>
                  <TableCell
                    className={`text-right font-mono ${totalMargin >= 0 ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {fmtEur(totalMargin)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${totalMarginPct >= 0 ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {fmtPct(totalMarginPct)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
