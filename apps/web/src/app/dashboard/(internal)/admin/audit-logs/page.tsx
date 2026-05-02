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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ChevronDown, ChevronRight, ScrollText, Search } from 'lucide-react';

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
  FORCE_JOB_STATUS: 'Piespiedu darba statuss',
  FORCE_ORDER_STATUS: 'Piespiedu pasūtījuma statuss',
};

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  UPDATE_USER: 'secondary',
  UPDATE_COMPANY: 'secondary',
  UPDATE_JOB_RATE: 'outline',
  APPROVE_APPLICATION: 'default',
  REJECT_APPLICATION: 'destructive',
  FORCE_ASSIGN_JOB: 'outline',
  FORCE_JOB_STATUS: 'destructive',
  FORCE_ORDER_STATUS: 'destructive',
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
            <div className="px-3 py-1.5 truncate text-muted-foreground">
              <span className="text-foreground/60 mr-1">{key}:</span>
              {bv === undefined ? (
                <span className="italic text-muted-foreground/50">—</span>
              ) : (
                <span className={changed ? 'text-red-700' : ''}>{String(bv)}</span>
              )}
            </div>
            <div className="px-3 py-1.5 truncate">
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
    <div className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
      <button
        onClick={() => hasDiff && setExpanded((p) => !p)}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 ${hasDiff ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* expand toggle */}
        <div className="mt-1 w-4 shrink-0 flex justify-center">
          {hasDiff ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : null}
        </div>

        {/* action badge */}
        <div className="shrink-0 pt-0.5 w-40">
          <Badge
            variant={ACTION_VARIANT[log.action] ?? 'outline'}
            className="text-[11px] truncate max-w-full"
          >
            {ACTION_LABELS[log.action] ?? log.action}
          </Badge>
        </div>

        {/* entity */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${ENTITY_COLORS[log.entityType] ?? 'text-foreground bg-muted'}`}
            >
              {log.entityType}
            </span>
            <span className="text-xs text-muted-foreground font-mono truncate">{log.entityId}</span>
          </div>
          {log.note && (
            <p className="text-xs text-foreground italic line-clamp-2">&ldquo;{log.note}&rdquo;</p>
          )}
        </div>

        {/* admin + time */}
        <div className="shrink-0 text-right space-y-0.5 min-w-30">
          <p className="text-xs font-semibold text-foreground">
            {log.admin.firstName} {log.admin.lastName}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">{formatTime(log.createdAt)}</p>
        </div>
      </button>

      {expanded && hasDiff && (
        <div className="pl-9 pr-4 pb-4">
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

  // Filters state
  const [search, setSearch] = useState('');
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
    if (search) {
      const q = search.toLowerCase();
      if (
        !l.entityId.toLowerCase().includes(q) &&
        !l.action.toLowerCase().includes(q) &&
        !(l.note && l.note.toLowerCase().includes(q)) &&
        !l.admin.firstName.toLowerCase().includes(q) &&
        !l.admin.lastName.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title="Audita žurnāls"
        description="Visu administratora darbību nemainīgais ieraksts"
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunināt
          </Button>
        }
      />

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-55 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Meklēt pēc ID, admina, piezīmes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="w-45">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Darbība" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Visas darbības</SelectItem>
              {allActions.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABELS[a] ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-45">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Entitāte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Visas entitātes</SelectItem>
              {allEntities.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          Caurlaikojumā {filtered.length} no {logs.length} ierakstiem
        </span>
      </div>

      {loading ? (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="p-12">
            <EmptyState
              icon={ScrollText}
              title="Nav ierakstu"
              description="Izvēlētajiem filtriem atbilstoši administratora ieraksti netika atrasti."
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
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
