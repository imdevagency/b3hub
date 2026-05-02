/**
 * Admin exceptions page — /dashboard/admin/exceptions
 * Platform-wide view of TransportJobException records with resolve capability.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminGetExceptions, adminResolveException, type AdminException } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { RefreshCw, AlertTriangle, CheckCircle2, Search } from 'lucide-react';

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

function StatusBadge({ value }: { value: string }) {
  const cls = STATUS_COLORS[value] ?? 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}

// ── Filters ────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Visi' },
  { value: 'OPEN', label: '🔴 Atvērti' },
  { value: 'IN_REVIEW', label: '🟡 Izskatīšanā' },
  { value: 'RESOLVED', label: '✅ Atrisināti' },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminExceptionsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [exceptions, setExceptions] = useState<AdminException[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [resolveTarget, setResolveTarget] = useState<AdminException | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchExceptions = useCallback(
    async (status?: string) => {
      if (!token) return;
      setLoading(true);
      try {
        const filter = status && status !== 'ALL' ? status : undefined;
        const data = await adminGetExceptions(token, filter);
        setExceptions(data);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isLoading && token) fetchExceptions(statusFilter);
  }, [isLoading, token, fetchExceptions, statusFilter]);

  const filtered = exceptions.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      e.type.toLowerCase().includes(q) ||
      (e.notes ?? '').toLowerCase().includes(q) ||
      (e.transportJob?.jobNumber ?? '').toLowerCase().includes(q) ||
      (e.reportedBy
        ? `${e.reportedBy.firstName} ${e.reportedBy.lastName}`.toLowerCase().includes(q)
        : false)
    );
  });

  const openCount = exceptions.filter((e) => e.status === 'OPEN').length;

  async function handleResolve() {
    if (!resolveTarget || !token || !resolution.trim()) return;
    setResolving(true);
    try {
      const updated = await adminResolveException(resolveTarget.id, resolution.trim(), token);
      setExceptions((prev) =>
        prev.map((e) =>
          e.id === resolveTarget.id
            ? { ...e, status: updated.status, resolution: updated.resolution }
            : e,
        ),
      );
      setResolveTarget(null);
      setResolution('');
    } catch (err) {
      alert((err as Error).message || 'Atrisināšana neizdevās');
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidenti"
        description={`${openCount} atvērts incidents`}
        action={
          <Button variant="outline" size="sm" onClick={() => fetchExceptions(statusFilter)}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunot
          </Button>
        }
      />

      {/* Open alert banner */}
      {openCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            {openCount} neapstrādāt{openCount === 1 ? 's' : 'i'} incident
            {openCount === 1 ? 's' : 'i'}.
          </span>
          <button
            type="button"
            className="ml-auto text-xs underline underline-offset-2"
            onClick={() => setStatusFilter('OPEN')}
          >
            Skatīt
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Meklēt pēc tipa, darba nr., šofera..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              statusFilter === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nav incidentu"
          description="Nav atrasts neviens incidents ar šiem filtriem."
        />
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Tips
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Darbs
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Ziņotājs
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Apraksts
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Datums
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className={`hover:bg-gray-50 transition-colors ${e.status === 'OPEN' ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-xs text-gray-800">
                        {e.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.transportJob ? (
                        <div className="text-xs">
                          <p className="font-mono text-gray-500">{e.transportJob.jobNumber}</p>
                          {e.transportJob.order && (
                            <p className="text-muted-foreground">
                              {e.transportJob.order.orderNumber}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {e.reportedBy ? (
                        `${e.reportedBy.firstName} ${e.reportedBy.lastName}`
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-48 truncate">
                      {e.notes ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={e.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString('lv-LV')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.status !== 'RESOLVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolveTarget(e);
                            setResolution('');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Atrisināt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolve dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Atrisināt incidentu — {resolveTarget?.type.replace(/_/g, ' ')}
            </DialogTitle>
            <DialogDescription>
              {resolveTarget?.transportJob && (
                <>
                  Darbs: <strong>{resolveTarget.transportJob.jobNumber}</strong>.{' '}
                </>
              )}
              Ievadiet atrisināšanas aprakstu, kas tiks saglabāts incidentā.
            </DialogDescription>
          </DialogHeader>
          {resolveTarget?.notes && (
            <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Ziņotais apraksts:</p>
              <p>{resolveTarget.notes}</p>
            </div>
          )}
          <Textarea
            placeholder="Atrisināšanas apraksts (obligāts)..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)} disabled={resolving}>
              Atcelt
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolving || !resolution.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {resolving ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Atzīmēt kā atrisinātu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
