/**
 * Admin Audit Logs — /dashboard/admin/audit-logs
 * Immutable log of every admin mutation. Filterable by action type and entity type.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminGetAuditLogs, type AdminAuditLog } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, ChevronDown, ChevronRight, ScrollText } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Map action strings to human-readable Latvian labels
const ACTION_LABELS: Record<string, string> = {
  UPDATE_USER: 'Lietotāja izmaiņas',
  UPDATE_COMPANY: 'Uzņēmuma izmaiņas',
  UPDATE_JOB_RATE: 'Darba likmes korekcija',
  APPROVE_APPLICATION: 'Pieteikums apstiprināts',
  REJECT_APPLICATION: 'Pieteikums noraidīts',
  FORCE_ASSIGN_JOB: 'Piespiedu darba piešķiršana',
};

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  UPDATE_USER: 'secondary',
  UPDATE_COMPANY: 'secondary',
  UPDATE_JOB_RATE: 'outline',
  APPROVE_APPLICATION: 'default',
  REJECT_APPLICATION: 'destructive',
  FORCE_ASSIGN_JOB: 'outline',
};

const ENTITY_COLORS: Record<string, string> = {
  User: 'text-blue-700 bg-blue-50',
  Company: 'text-indigo-700 bg-indigo-50',
  TransportJob: 'text-amber-700 bg-amber-50',
  Order: 'text-purple-700 bg-purple-50',
  ProviderApplication: 'text-emerald-700 bg-emerald-50',
};

// ─── diff renderer ───────────────────────────────────────────────────────────

function DiffView({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 overflow-hidden text-xs font-mono">
      <div className="grid grid-cols-[1fr_1fr] divide-x divide-border">
        <div className="px-3 py-1.5 text-[10px] font-sans font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
          Pirms
        </div>
        <div className="px-3 py-1.5 text-[10px] font-sans font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
          Pēc
        </div>
      </div>
      {keys.map((key) => {
        const bv = before?.[key];
        const av = after?.[key];
        const changed = JSON.stringify(bv) !== JSON.stringify(av);
        return (
          <div
            key={key}
            className={`grid grid-cols-[1fr_1fr] divide-x divide-border border-t border-border ${changed ? 'bg-amber-50/50' : ''}`}
          >
            <div className="px-3 py-1 truncate text-muted-foreground">
              <span className="text-foreground/60 mr-1">{key}:</span>
              {bv === undefined ? (
                <span className="italic text-muted-foreground/50">—</span>
              ) : (
                <span className={changed ? 'text-red-600' : ''}>{String(bv)}</span>
              )}
            </div>
            <div className="px-3 py-1 truncate">
              <span className="text-foreground/60 mr-1">{key}:</span>
              {av === undefined ? (
                <span className="italic text-muted-foreground/50">—</span>
              ) : (
                <span className={changed ? 'text-emerald-700 font-semibold' : ''}>
                  {String(av)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── log row ──────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AdminAuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = !!(log.before || log.after);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => hasDiff && setExpanded((p) => !p)}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 ${hasDiff ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default'} transition-colors`}
      >
        {/* expand toggle */}
        <div className="mt-0.5 w-4 shrink-0">
          {hasDiff ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : null}
        </div>

        {/* action badge */}
        <div className="shrink-0 pt-0.5">
          <Badge variant={ACTION_VARIANT[log.action] ?? 'outline'} className="text-xs">
            {ACTION_LABELS[log.action] ?? log.action}
          </Badge>
        </div>

        {/* entity */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${ENTITY_COLORS[log.entityType] ?? 'text-foreground bg-muted'}`}
            >
              {log.entityType}
            </span>
            <span className="text-xs text-muted-foreground font-mono truncate">{log.entityId}</span>
          </div>
          {log.note && (
            <p className="text-xs text-muted-foreground italic truncate">"{log.note}"</p>
          )}
        </div>

        {/* admin + time */}
        <div className="shrink-0 text-right space-y-0.5">
          <p className="text-xs font-medium text-foreground">
            {log.admin.firstName} {log.admin.lastName}
          </p>
          <p className="text-[11px] text-muted-foreground">{formatTime(log.createdAt)}</p>
        </div>
      </button>

      {expanded && hasDiff && (
        <div className="px-4 pb-4">
          <DiffView before={log.before} after={log.after} />
        </div>
      )}
    </div>
  );
}

// ─── filters ─────────────────────────────────────────────────────────────────

const ALL = 'ALL';

// ─── main page ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>(ALL);
  const [entityFilter, setEntityFilter] = useState<string>(ALL);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetAuditLogs(token, 200);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) load();
  }, [isLoading, token, load]);

  // Build filter options from actual data
  const allActions = Array.from(new Set(logs.map((l) => l.action)));
  const allEntities = Array.from(new Set(logs.map((l) => l.entityType)));

  const filtered = logs.filter((l) => {
    if (actionFilter !== ALL && l.action !== actionFilter) return false;
    if (entityFilter !== ALL && l.entityType !== entityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audita žurnāls"
        description="Visu administratora darbību nemainīgais ieraksts"
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold block mb-1">
            Darbība
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={ALL}>Visas</option>
            {allActions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold block mb-1">
            Entitāte
          </label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={ALL}>Visas</option>
            {allEntities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <span className="text-sm text-muted-foreground pb-1">{filtered.length} ieraksti</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-r-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nav ierakstu"
          description="Neviens administratora ieraksts netika atrasts ar šiem filtriem."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {filtered.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
