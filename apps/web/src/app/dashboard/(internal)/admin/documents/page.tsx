/**
 * Admin documents page — /dashboard/admin/documents
 * Platform-wide view of all system-generated and user-uploaded documents.
 * Admin can filter, search, view, and archive/restore any document.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetDocuments,
  adminUpdateDocumentStatus,
  type AdminDocument,
  type AdminDocumentType,
  type AdminDocumentStatus,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  FolderOpen,
  RefreshCw,
  Search,
  ExternalLink,
  Archive,
  RotateCcw,
  FileText,
  Weight,
  ClipboardCheck,
  ScrollText,
  Truck,
  Recycle,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { value: AdminDocumentType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'WEIGHING_SLIP', label: 'Svēršanas' },
  { value: 'DELIVERY_PROOF', label: 'Piegādes' },
  { value: 'DELIVERY_NOTE', label: 'CMR/Pavadzīmes' },
  { value: 'WASTE_TRANSPORT_NOTE', label: 'Atkritumu pārvadāj.' },
  { value: 'WASTE_CERTIFICATE', label: 'Sertifikāti' },
  { value: 'CONTRACT', label: 'Līgumi' },
  { value: 'INVOICE', label: 'Rēķini' },
  { value: 'OTHER', label: 'Citi' },
];

const STATUS_FILTERS: { value: AdminDocumentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Visi statusi' },
  { value: 'ISSUED', label: 'Izsniegts' },
  { value: 'SIGNED', label: 'Parakstīts' },
  { value: 'DRAFT', label: 'Melnraksts' },
  { value: 'ARCHIVED', label: 'Arhivēts' },
];

const SOURCE_FILTERS: { value: 'ALL' | 'system' | 'user'; label: string }[] = [
  { value: 'ALL', label: 'Visi avoti' },
  { value: 'system', label: 'Sistēma' },
  { value: 'user', label: 'Lietotājs' },
];

const STATUS_COLORS: Record<AdminDocumentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  ISSUED: 'bg-blue-100 text-blue-700',
  SIGNED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-orange-100 text-orange-600',
};

const STATUS_LABELS: Record<AdminDocumentStatus, string> = {
  DRAFT: 'Melnraksts',
  ISSUED: 'Izsniegts',
  SIGNED: 'Parakstīts',
  ARCHIVED: 'Arhivēts',
};

const TYPE_ICONS: Record<AdminDocumentType, React.ElementType> = {
  INVOICE: FileText,
  WEIGHING_SLIP: Weight,
  DELIVERY_PROOF: ClipboardCheck,
  WASTE_CERTIFICATE: Recycle,
  DELIVERY_NOTE: Truck,
  WASTE_TRANSPORT_NOTE: ScrollText,
  CONTRACT: FileCheck,
  OTHER: FileText,
};

const TYPE_LABELS: Record<AdminDocumentType, string> = {
  INVOICE: 'Rēķins',
  WEIGHING_SLIP: 'Svēršanas lapa',
  DELIVERY_PROOF: 'Piegādes apstiprin.',
  WASTE_CERTIFICATE: 'Atkritumu sertif.',
  DELIVERY_NOTE: 'CMR/Pavadzīme',
  WASTE_TRANSPORT_NOTE: 'Atkritumu pārvadāj.',
  CONTRACT: 'Līgums',
  OTHER: 'Cits',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AdminDocumentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onAction,
}: {
  doc: AdminDocument;
  onAction: (doc: AdminDocument) => void;
}) {
  const Icon = TYPE_ICONS[doc.type] ?? FileText;
  const ownerName = `${doc.owner.firstName} ${doc.owner.lastName}`.trim();

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate max-w-55">{doc.title}</p>
            <p className="text-xs text-muted-foreground">{TYPE_LABELS[doc.type]}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={doc.status} />
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
            doc.isGenerated ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700',
          )}
        >
          {doc.isGenerated ? 'Sistēma' : 'Lietotājs'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-foreground">{ownerName}</div>
        <div className="text-xs text-muted-foreground truncate max-w-40">{doc.owner.email}</div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{doc.issuedBy ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {doc.fileSize ? formatBytes(doc.fileSize) : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatDate(doc.createdAt)}
        {doc.expiresAt && (
          <div className="text-orange-600">Beidzas {formatDate(doc.expiresAt)}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {doc.fileUrl && (
            <Button variant="ghost" size="icon-xs" asChild title="Atvērt failu">
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            title={doc.status === 'ARCHIVED' ? 'Atjaunot' : 'Arhivēt'}
            onClick={() => onAction(doc)}
          >
            {doc.status === 'ARCHIVED' ? (
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDocumentsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [docs, setDocs] = useState<AdminDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AdminDocumentType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AdminDocumentStatus | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'system' | 'user'>('ALL');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Archive / restore dialog
  const [actionTarget, setActionTarget] = useState<AdminDocument | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const isGenerated =
        sourceFilter === 'system' ? true : sourceFilter === 'user' ? false : undefined;
      const res = await adminGetDocuments(token, {
        page,
        limit: LIMIT,
        type: typeFilter,
        status: statusFilter,
        search: search || undefined,
        isGenerated,
      });
      setDocs(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [token, page, typeFilter, statusFilter, sourceFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter, sourceFilter, search]);

  const handleAction = async () => {
    if (!actionTarget || !token) return;
    setActioning(true);
    try {
      const newStatus: AdminDocumentStatus =
        actionTarget.status === 'ARCHIVED' ? 'ISSUED' : 'ARCHIVED';
      await adminUpdateDocumentStatus(actionTarget.id, newStatus, actionNote || undefined, token);
      setActionTarget(null);
      setActionNote('');
      await load();
    } finally {
      setActioning(false);
    }
  };

  const pages = Math.ceil(total / LIMIT);

  // Summary counts
  const systemCount = docs.filter((d) => d.isGenerated).length;
  const userCount = docs.filter((d) => !d.isGenerated).length;
  const archivedCount = docs.filter((d) => d.status === 'ARCHIVED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dokumenti"
        description="Platformas dokumenti — sistēmas un lietotāju augšupielādētie"
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
            Atjaunot
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 pb-5 border-b border-border/40">
        {[
          { label: 'Kopā', value: total },
          { label: 'Sistēma', value: systemCount },
          { label: 'Lietotāji', value: userCount },
          { label: 'Arhivēti', value: archivedCount },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-50 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Meklēt pēc nosaukuma..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Type filter */}
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as AdminDocumentType | 'ALL')}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AdminDocumentStatus | 'ALL')}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source filter */}
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as 'ALL' | 'system' | 'user')}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Dokuments
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Statuss
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Avots
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Īpašnieks
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Izsniedzējs
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Izmērs
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Datums
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3" colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16">
                  <EmptyState
                    icon={FolderOpen}
                    title="Nav dokumentu"
                    description="Mēģiniet mainīt filtrus"
                  />
                </td>
              </tr>
            ) : (
              docs.map((doc) => <DocumentRow key={doc.id} doc={doc} onAction={setActionTarget} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {total} dokumenti · lapa {page} no {pages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Iepriekšējā
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
            >
              Nākamā
            </Button>
          </div>
        </div>
      )}

      {/* Archive / restore dialog */}
      <Dialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.status === 'ARCHIVED' ? 'Atjaunot dokumentu' : 'Arhivēt dokumentu'}
            </DialogTitle>
            <DialogDescription>
              {actionTarget?.status === 'ARCHIVED'
                ? `Dokuments "${actionTarget?.title}" tiks atjaunots uz statusu Izsniegts.`
                : `Dokuments "${actionTarget?.title}" tiks arhivēts. Tas paliks sistēmā, bet tiks atzīmēts kā neaktīvs.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Piezīme (neobligāti)</Label>
              <Textarea
                rows={3}
                placeholder="Iemesls vai papildu info..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)}>
              Atcelt
            </Button>
            <Button
              variant={actionTarget?.status === 'ARCHIVED' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={actioning}
            >
              {actioning
                ? 'Saglabā...'
                : actionTarget?.status === 'ARCHIVED'
                  ? 'Atjaunot'
                  : 'Arhivēt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
