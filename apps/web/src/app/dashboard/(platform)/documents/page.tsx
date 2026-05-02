/**
 * Documents page — /dashboard/documents
 * Upload and manage compliance documents (licenses, certificates).
 * Shows document status (pending/approved/rejected) and expiry dates.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Weight,
  ClipboardCheck,
  Recycle,
  Truck,
  ScrollText,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import { useAuth } from '@/lib/auth-context';
import {
  getMyDocuments,
  getDocumentSummary,
  type Document,
  type DocumentType,
  type DocumentSummary,
} from '@/lib/api';

// ── Filter tabs ──────────────────────────────────────────────

type FilterTab = 'ALL' | DocumentType;

const TABS: { id: FilterTab; label: string; icon: React.ElementType }[] = [
  { id: 'ALL', label: 'Visi', icon: FolderOpen },
  { id: 'WEIGHING_SLIP', label: 'Svēršanas Lapas', icon: Weight },
  { id: 'DELIVERY_PROOF', label: 'Piegādes Apstiprinājumi', icon: ClipboardCheck },
  { id: 'WASTE_CERTIFICATE', label: 'Sertifikāti', icon: Recycle },
  { id: 'DELIVERY_NOTE', label: 'Piegādes Pavadzīmes', icon: Truck },
  { id: 'CONTRACT', label: 'Līgumi', icon: ScrollText },
  { id: 'INVOICE', label: 'Rēķini', icon: ScrollText },
];

// ── Page ─────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [docs, setDocs] = useState<Document[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authed
  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  // Fetch documents
  const fetchDocs = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const [result, sum] = await Promise.all([
        getMyDocuments(token, {
          type: activeTab !== 'ALL' ? (activeTab as DocumentType) : undefined,
          search: search || undefined,
        }),
        getDocumentSummary(token),
      ]);
      setError(null);
      setDocs(result.documents);
      setSummary(sum);
    } catch {
      // API not reachable — show error
      setError('Neizdevās ielādēt dokumentus. Pārbaudiet savienojumu un mēģiniet vēlreiz.');
      setDocs([]);
      setSummary(null);
    } finally {
      setFetching(false);
    }
  }, [token, activeTab, search]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  const thisMonth = docs.filter((d) => {
    const created = new Date(d.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="w-full h-full pb-20 space-y-10">
      <PageHeader
        title="Mani Dokumenti"
        description="Visi jūsu rēķini, svēršanas lapas, piegādes apstiprinājumi un sertifikāti — bez papīra, vienā vietā."
        action={
          <Button variant="outline" onClick={fetchDocs} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
            Atjaunot sarakstu
          </Button>
        }
      />

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Header stats (Uber-like flat stats) ── */}
      <div className="flex flex-wrap gap-x-10 gap-y-4 pb-6 border-b border-border/30">
        {[
          { label: 'Kopā Dokumenti', value: summary?.total ?? 0 },
          { label: 'Šajā mēnesī', value: thisMonth },
          {
            label: 'Piegādes Apstiprinājumi',
            value: summary?.byType?.DELIVERY_PROOF ?? 0,
          },
          {
            label: 'Svēršanas Lapas',
            value: summary?.byType?.WEIGHING_SLIP ?? 0,
          },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5">
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-widest">
              {stat.label}
            </span>
            <span className="text-3xl font-medium tracking-tight text-foreground">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 pb-2 mt-4">
        {/* Tab pills — flat text style */}
        <div className="w-full overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          <div className="flex items-center gap-6 min-w-max border-b border-border/30">
            {TABS.map((tab) => {
              const count =
                tab.id === 'ALL' ? summary?.total : summary?.byType?.[tab.id as DocumentType];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center justify-center h-10 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-foreground border-b-2 border-foreground'
                      : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
                  }`}
                >
                  {tab.label}
                  {count != null && count > 0 && (
                    <span
                      className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                        isActive
                          ? 'bg-foreground text-background'
                          : 'bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full xl:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Meklēt dokumentos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted/20 border-transparent rounded-lg focus:outline-none focus:bg-muted/40 focus:ring-0 transition-colors placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* ── Document list ── */}
      {fetching ? (
        <PageSpinner className="py-20" />
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 px-4 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center mb-2">
            <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-medium text-foreground tracking-tight">
            Nav atrasts neviens dokuments
          </h3>
          <p className="text-[13px] text-muted-foreground max-w-sm">
            {search
              ? `Nav rezultātu meklējumam "${search}". Mēģiniet citu meklēšanas frazi.`
              : 'Dokumenti parādīsīsies šeit automātiski, tīklīdz jūsu pasūtījumi tiks apstiprināti un piegādes pabeigtas.'}
          </p>
          {search && (
            <Button
              variant="outline"
              onClick={() => setSearch('')}
              className="mt-4 rounded-xl text-xs font-medium border-border/60"
            >
              Notīrīt meklēšanu
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col border-t border-border/30">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onView={setViewerDoc} />
          ))}
        </div>
      )}

      {/* ── Inline document viewer ── */}
      <DocumentViewer document={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}
