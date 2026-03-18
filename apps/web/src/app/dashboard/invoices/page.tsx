/**
 * Invoices page — /dashboard/invoices
 * Lists all invoices for the current user (buyer / supplier / carrier).
 * Allows marking invoices as paid.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getMyInvoices, markInvoicePaid, type ApiInvoice, type PaymentStatus } from '@/lib/api';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Gaida apmaksu',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  PAID: {
    label: 'Apmaksāts',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  OVERDUE: {
    label: 'Kavēts',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

// ── Invoices page ─────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !token) router.push('/');
  }, [token, isLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await getMyInvoices(token, page);
      setInvoices(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Neizdevās ielādēt rēķinus.');
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="size-6 text-red-600" />
            Rēķini
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Jūsu pasūtījumu rēķini un maksājumu statuss
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-24 text-center flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ielādē rēķinus...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <FileText className="mx-auto size-12 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">Nav rēķinu</p>
          <p className="text-sm text-muted-foreground">
            Rēķini parādīsies pēc pasūtījumu iesniegšanas
          </p>
          <Link
            href="/dashboard/catalog"
            className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"
          >
            Apskatīt katalogu
          </Link>
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
                {invoices.map((inv) => (
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
                        Izveidots {fmt(inv.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/orders/${inv.orderId}`}
                        className="font-medium text-red-600 hover:underline flex items-center gap-1"
                      >
                        {inv.order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{inv.order.status}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={
                          inv.paymentStatus === 'OVERDUE' ? 'text-red-600 font-medium' : ''
                        }
                      >
                        {fmt(inv.dueDate)}
                      </span>
                      {inv.paidDate && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Apmaksāts {fmt(inv.paidDate)}
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
                      <StatusBadge status={inv.paymentStatus} />
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
            {invoices.map((inv) => (
              <div key={inv.id} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{fmt(inv.createdAt)}</p>
                  </div>
                  <StatusBadge status={inv.paymentStatus} />
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pasūtījums</span>
                    <Link
                      href={`/dashboard/orders/${inv.orderId}`}
                      className="text-red-600 font-medium hover:underline"
                    >
                      {inv.order.orderNumber}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Termiņš</span>
                    <span
                      className={inv.paymentStatus === 'OVERDUE' ? 'text-red-600 font-medium' : ''}
                    >
                      {fmt(inv.dueDate)}
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
