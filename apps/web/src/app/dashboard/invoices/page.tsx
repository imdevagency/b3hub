/**
 * Invoices page — /dashboard/invoices
 * Lists all invoices for the current user (buyer / supplier / carrier).
 * Allows marking invoices as paid.
 */
'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getMyInvoices,
  markInvoicePaid,
  getProjects,
  type ApiInvoice,
  type ApiProject,
} from '@/lib/api';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Ticket,
} from 'lucide-react';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { fmtDate } from '@/lib/format';
import { InvoiceStatusBadge } from '@/lib/status-config';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Invoices page ─────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <InvoicesPageInner />
    </Suspense>
  );
}

function InvoicesPageInner() {
  const { token } = useRequireAuth();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') ?? '';

  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>(initialProjectId);
  const [projects, setProjects] = useState<ApiProject[]>([]);

  async function handleExportCsv() {
    if (!token) return;
    setCsvLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetch(`${API_URL}/invoices/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Neizdevās eksportēt CSV.');
    } finally {
      setCsvLoading(false);
    }
  }

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await getMyInvoices(
        token,
        page,
        statusFilter === 'ALL' ? undefined : statusFilter,
        projectFilter || undefined,
      );
      setInvoices(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Neizdevās ielādēt rēķinus.');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, projectFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Load projects for filter dropdown
  useEffect(() => {
    if (!token) return;
    getProjects(token)
      .then(setProjects)
      .catch(() => {});
  }, [token]);

  // Reset to page 1 whenever the filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, projectFilter]);

  async function handlePay(invoiceId: string) {
    if (!token) return;
    setPaying(invoiceId);
    try {
      const updated = await markInvoicePaid(invoiceId, token);
      setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
    } catch {
      setError('Neizdevās atzīmēt rēķinu kā apmaksātu.');
    } finally {
      setPaying(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  // invoices is already filtered server-side
  const filteredInvoices = invoices;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="Rēķini"
        description="Jūsu pasūtījumu rēķini un maksājumu statuss"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={csvLoading}>
              {csvLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4 mr-1.5" />
              )}
              Eksportēt CSV
            </Button>
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit overflow-x-auto">
        {(
          [
            { key: 'ALL', label: 'Visi' },
            { key: 'PENDING', label: 'Neapmaksāti' },
            { key: 'PAID', label: 'Apmaksāti' },
            { key: 'OVERDUE', label: 'Kavēti' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === key
                ? 'bg-background shadow-xs text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {label}
            {key !== 'ALL' && statusFilter === key && total > 0 && (
              <span className="ml-1.5 tabular-nums">({total})</span>
            )}
          </button>
        ))}
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            value={projectFilter || 'ALL'}
            onValueChange={(v) => setProjectFilter(v === 'ALL' ? '' : v)}
          >
            <SelectTrigger className="w-60 h-9 rounded-xl border-0 bg-muted/50 text-sm shadow-none">
              <SelectValue placeholder="Visi projekti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Visi projekti</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {projectFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProjectFilter('')}
              className="text-muted-foreground"
            >
              Notīrīt
            </Button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <PageSpinner className="py-24" />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nav rēķinu"
          description="Rēķini parādīsies pēc pasūtījumu iesniegšanas"
          action={
            <Link
              href="/dashboard/catalog"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Apskatīt katalogu
            </Link>
          }
        />
      ) : filteredInvoices.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Receipt className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nav rēķinu šajā kategorijā</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Rēķins</th>
                  <th className="text-left px-5 py-3 font-medium">Pasūtījums</th>
                  <th className="text-left px-5 py-3 font-medium">Apmaksas termiņš</th>
                  <th className="text-right px-5 py-3 font-medium">Summa</th>
                  <th className="text-center px-5 py-3 font-medium">Statuss</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Izveidots {fmtDate(inv.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      {inv.advanceForContract ? (
                        <div>
                          <Link
                            href={`/dashboard/framework-contracts/${inv.advanceForContract.id}`}
                            className="font-medium text-amber-600 hover:underline flex items-center gap-1.5"
                          >
                            <Ticket className="size-3.5" />
                            {inv.advanceForContract.contractNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">Avansa rēķins</p>
                        </div>
                      ) : (
                        <div>
                          <Link
                            href={`/dashboard/orders/${inv.orderId}`}
                            className="font-medium text-red-600 hover:underline flex items-center gap-1"
                          >
                            {inv.order?.orderNumber ?? '—'}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {inv.order?.status}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={
                          inv.paymentStatus === 'OVERDUE' ? 'text-red-600 font-medium' : ''
                        }
                      >
                        {fmtDate(inv.dueDate)}
                      </span>
                      {inv.paidDate && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Apmaksāts {fmtDate(inv.paidDate)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold">€{inv.total.toFixed(2)}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        PVN €{inv.tax.toFixed(2)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <InvoiceStatusBadge status={inv.paymentStatus} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.paymentStatus === 'PENDING' && (
                        <button
                          onClick={() => handlePay(inv.id)}
                          disabled={paying === inv.id}
                          className="flex items-center gap-1.5 rounded-xl bg-green-600 text-white text-xs font-bold px-3 py-1.5 hover:bg-green-700 disabled:opacity-50 transition-colors ml-auto"
                        >
                          {paying === inv.id ? <Loader2 className="size-3 animate-spin" /> : null}
                          Atzīmēt apmaksātu
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(inv.createdAt)}</p>
                  </div>
                  <InvoiceStatusBadge status={inv.paymentStatus} />
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pasūtījums</span>
                    {inv.advanceForContract ? (
                      <Link
                        href={`/dashboard/framework-contracts/${inv.advanceForContract.id}`}
                        className="text-amber-600 font-medium hover:underline flex items-center gap-1"
                      >
                        <Ticket className="size-3" />
                        {inv.advanceForContract.contractNumber}
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/orders/${inv.orderId}`}
                        className="text-red-600 font-medium hover:underline"
                      >
                        {inv.order?.orderNumber ?? '—'}
                      </Link>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Termiņš</span>
                    <span
                      className={inv.paymentStatus === 'OVERDUE' ? 'text-red-600 font-medium' : ''}
                    >
                      {fmtDate(inv.dueDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Summa</span>
                    <span className="font-bold">€{inv.total.toFixed(2)}</span>
                  </div>
                </div>
                {inv.paymentStatus === 'PENDING' && (
                  <button
                    onClick={() => handlePay(inv.id)}
                    disabled={paying === inv.id}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-green-600 text-white text-sm font-bold px-3 py-2 hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {paying === inv.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    Atzīmēt kā apmaksātu
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Rāda {(page - 1) * limit + 1}–{Math.min(page * limit, total)} no {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-xl border p-2 hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-xl border p-2 hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
