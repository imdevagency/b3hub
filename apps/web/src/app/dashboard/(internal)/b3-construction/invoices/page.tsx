/**
 * B3 Construction — Nosūtītie rēķini (Client Invoices)
 * /dashboard/b3-construction/invoices
 *
 * Cross-project view of all invoices sent to clients.
 * Per-project billing is managed inside the project detail "Rēķini klientam" tab.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  adminGetClientInvoices,
  type ConstructionClientInvoice,
  type ClientInvoiceStatus,
} from '@/lib/api/admin';

const STATUS_LABELS: Record<ClientInvoiceStatus, string> = {
  DRAFT: 'Melnraksts',
  ISSUED: 'Izsniegts',
  PARTIALLY_PAID: 'Daļēji apmaksāts',
  PAID: 'Apmaksāts',
  OVERDUE: 'Kavēts',
  CANCELLED: 'Atcelts',
};

const STATUS_STYLE: Record<ClientInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-100 text-blue-800',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

function fmtEur(n: number) {
  return `€${n.toLocaleString('lv-LV', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function InvoicesPage() {
  const { token } = useAuth();

  const [invoices, setInvoices] = useState<ConstructionClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetClientInvoices(token, { limit: 200 });
      setInvoices(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    statusFilter === 'ALL' ? invoices : invoices.filter((inv) => inv.status === statusFilter);

  const totalInvoiced = filtered.reduce((s, inv) => s + inv.amount, 0);
  const totalPaid = filtered.reduce((s, inv) => s + (inv.paidAmount ?? 0), 0);
  const totalOutstanding = totalInvoiced - totalPaid;
  const overdueCount = filtered.filter((inv) => inv.status === 'OVERDUE').length;

  function exportCsv() {
    const rows: string[][] = [
      [
        'Rēķina nr.',
        'Projekts',
        'Klients',
        'Datums',
        'Apmaksas termiņš',
        'Statuss',
        'Summa (€)',
        'PVN (€)',
        'Saņemts (€)',
      ],
    ];
    for (const inv of filtered) {
      rows.push([
        inv.invoiceNo,
        inv.project?.name ?? '',
        inv.project?.clientName ?? '',
        format(new Date(inv.issueDate), 'dd.MM.yyyy'),
        inv.dueDate ? format(new Date(inv.dueDate), 'dd.MM.yyyy') : '',
        STATUS_LABELS[inv.status],
        inv.amount.toFixed(2),
        inv.vatAmount != null ? inv.vatAmount.toFixed(2) : '',
        inv.paidAmount != null ? inv.paidAmount.toFixed(2) : '',
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekini_klientam_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nosūtītie rēķini"
        description="Visi klientiem nosūtītie rēķini visos projektos"
        action={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Visi statusi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Visi statusi</SelectItem>
                {(Object.keys(STATUS_LABELS) as ClientInvoiceStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Kopā izrakstīts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtEur(totalInvoiced)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Saņemts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{fmtEur(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Nesamaksāts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-amber-700' : 'text-gray-400'}`}
            >
              {fmtEur(totalOutstanding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Kavētie rēķini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-700' : 'text-gray-400'}`}
            >
              {overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Ielādē…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nav rēķinu"
          description={
            statusFilter === 'ALL'
              ? 'Rēķini tiks parādīti šeit, kad tie tiks pievienoti projektos.'
              : 'Nav rēķinu ar izvēlēto statusu.'
          }
        />
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rēķina nr.</TableHead>
                <TableHead>Projekts</TableHead>
                <TableHead>Klients</TableHead>
                <TableHead>Izrakstīts</TableHead>
                <TableHead>Termiņš</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="text-right">Saņemts</TableHead>
                <TableHead className="text-right">Atlikums</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const outstanding = inv.amount - (inv.paidAmount ?? 0);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium font-mono text-sm">{inv.invoiceNo}</TableCell>
                    <TableCell className="text-sm">{inv.project?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {inv.project?.clientName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(inv.issueDate), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {inv.dueDate ? format(new Date(inv.dueDate), 'dd.MM.yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[inv.status]}>
                        {STATUS_LABELS[inv.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmtEur(inv.amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-700">
                      {inv.paidAmount != null ? fmtEur(inv.paidAmount) : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${outstanding > 0 ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}
                    >
                      {outstanding > 0 ? fmtEur(outstanding) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Totals row */}
              <TableRow className="bg-gray-50 font-semibold border-t-2">
                <TableCell colSpan={6}>Kopā ({filtered.length} rēķini)</TableCell>
                <TableCell className="text-right font-mono">{fmtEur(totalInvoiced)}</TableCell>
                <TableCell className="text-right font-mono text-green-700">
                  {fmtEur(totalPaid)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono ${totalOutstanding > 0 ? 'text-amber-700' : 'text-gray-400'}`}
                >
                  {fmtEur(totalOutstanding)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
