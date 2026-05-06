/**
 * Construction — Daily Report Detail / New
 * /dashboard/construction/daily-reports/[id]
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getDailyReportById,
  updateDailyReport,
  deleteDailyReport,
  type DailyReportDetail,
  type DailyReportStatus,
} from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ClipboardList, Trash2 } from 'lucide-react';
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
    maximumFractionDigits: 2,
  }).format(n);
}

export default function DailyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  const [report, setReport] = useState<DailyReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      setReport(await getDailyReportById(id, token));
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!report) return;
    setUpdatingStatus(true);
    try {
      await updateDailyReport(id, { status }, token);
      setReport({ ...report, status: status as DailyReportStatus });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDailyReport(id, token);
      router.push('/dashboard/construction/daily-reports');
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (!report) return null;

  const total = report.lines.reduce((s, l) => s + l.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`DPR — ${format(new Date(report.reportDate), 'dd.MM.yyyy')}`}
        description={report.project?.name ?? ''}
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Atpakaļ
            </Button>
            <Select
              value={report.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as DailyReportStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {report.status === 'DRAFT' && (
              <Button variant="destructive" size="icon" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      {/* Meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Statuss</p>
            <Badge variant={STATUS_VARIANTS[report.status]}>{STATUS_LABELS[report.status]}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Projekts</p>
            <p className="font-medium text-sm">{report.project?.name ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Vieta</p>
            <p className="font-medium text-sm">{report.siteLabel ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Kopā</p>
            <p className="font-semibold text-lg">{fmtEur(total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lines */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Darbu rindas ({report.lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apraksts</TableHead>
                <TableHead>Izmaksu kods</TableHead>
                <TableHead>Darbinieks</TableHead>
                <TableHead className="text-right">Daudz.</TableHead>
                <TableHead>Vienība</TableHead>
                <TableHead className="text-right">Likme</TableHead>
                <TableHead className="text-right">Kopā</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{l.costCode}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : '—'}
                  </TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell>{l.unit}</TableCell>
                  <TableCell className="text-right font-mono">{fmtEur(l.unitRate)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {fmtEur(l.total)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell colSpan={6} className="text-right">
                  Kopā:
                </TableCell>
                <TableCell className="text-right font-mono">{fmtEur(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {report.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Piezīmes</p>
            <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dzēst atskaiti?</AlertDialogTitle>
            <AlertDialogDescription>Šī darbība ir neatgriezeniska.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Atcelt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Dzēš...' : 'Dzēst'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
