/**
 * Construction — Daily Reports
 * /dashboard/construction/daily-reports
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getDailyReports,
  getConstructionProjects,
  type DailyReport,
  type DailyReportStatus,
  type ConstructionProject,
} from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipboardList, Plus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS: Record<DailyReportStatus, string> = {
  DRAFT: 'Melnraksts',
  SUBMITTED: 'Iesniegts',
  APPROVED: 'Apstiprināts',
  REJECTED: 'Noraidīts',
};

const STATUS_VARIANTS: Record<
  DailyReportStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  APPROVED: 'outline',
  REJECTED: 'destructive',
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function DailyReportsContent() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') ?? '');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [res, proj] = await Promise.all([
        getDailyReports(token, {
          projectId: projectFilter || undefined,
          status: statusFilter || undefined,
        }),
        projects.length === 0
          ? getConstructionProjects(token, { limit: 200 })
          : Promise.resolve({ data: projects }),
      ]);
      setReports(res.data);
      if (projects.length === 0) setProjects((proj as any).data);
    } finally {
      setLoading(false);
    }
  }, [token, projectFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dienas atskaites"
        description="Visas darbu dienas atskaites (DPR)"
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={projectFilter || 'all'}
              onValueChange={(v) => setProjectFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Visi projekti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi projekti</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Statuss" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi</SelectItem>
                {(Object.keys(STATUS_LABELS) as DailyReportStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => router.push('/dashboard/construction/daily-reports/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Jauna atskaite
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nav atskaitīšu"
          description="Pievienojiet pirmo dienas atskaiti."
          action={
            <Button onClick={() => router.push('/dashboard/construction/daily-reports/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Jauna atskaite
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datums</TableHead>
                  <TableHead>Projekts</TableHead>
                  <TableHead>Vieta</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Rindas</TableHead>
                  <TableHead className="text-right">Izmaksas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/construction/daily-reports/${r.id}`)}
                  >
                    <TableCell className="font-mono">
                      {format(new Date(r.reportDate), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell>{r.project?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.siteLabel ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r._count?.lines ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">{fmtEur(r.totalCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DailyReportsPage() {
  return (
    <Suspense>
      <DailyReportsContent />
    </Suspense>
  );
}
