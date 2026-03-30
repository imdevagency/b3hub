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
  FileText,
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
import { useAuth } from '@/lib/auth-context';
import {
  getMyDocuments,
  getDocumentSummary,
  type Document,
  type DocumentType,
  type DocumentSummary,
} from '@/lib/api';

// ── Demo seed (shown when API returns empty) ──────────────────
const DEMO_DOCS: Document[] = [
  {
    id: 'd1',
    title: 'Invoice #INV-2025-0042',
    type: 'INVOICE',
    status: 'ISSUED',
    mimeType: 'application/pdf',
    fileSize: 82400,
    orderId: 'ord-01',
    ownerId: 'demo',
    issuedBy: 'B3Hub Platform',
    isGenerated: true,
    notes: 'Order #ORD-2025-0042 — Sand delivery, 20 t',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd2',
    title: 'Weighing Slip — 18.4 t',
    type: 'WEIGHING_SLIP',
    status: 'SIGNED',
    mimeType: 'application/pdf',
    fileSize: 34100,
    orderId: 'ord-01',
    ownerId: 'demo',
    issuedBy: 'Riga Weigh Station',
    isGenerated: true,
    notes: 'Confirmed weight: 18.4 t (sand, order #ORD-2025-0042)',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd3',
    title: 'Delivery Proof — ORD-2025-0042',
    type: 'DELIVERY_PROOF',
    status: 'SIGNED',
    mimeType: 'image/jpeg',
    fileSize: 215000,
    orderId: 'ord-01',
    ownerId: 'demo',
    issuedBy: 'Driver: Pēteris Ozoliņš',
    isGenerated: false,
    notes: 'Recipient signature captured on site',
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd4',
    title: 'Waste Certificate #WC-2025-0011',
    type: 'WASTE_CERTIFICATE',
    status: 'ISSUED',
    mimeType: 'application/pdf',
    fileSize: 62000,
    orderId: 'ord-02',
    ownerId: 'demo',
    issuedBy: 'EcoCenter Rīga',
    isGenerated: true,
    notes: 'Concrete rubble — 6 t recycled',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd5',
    title: 'CMR Delivery Note — Job #TJ-2025-0088',
    type: 'DELIVERY_NOTE',
    status: 'SIGNED',
    mimeType: 'application/pdf',
    fileSize: 47500,
    transportJobId: 'tj-01',
    ownerId: 'demo',
    issuedBy: 'FastCarry OÜ',
    isGenerated: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd6',
    title: 'Skip Hire Invoice #SH-2025-0009',
    type: 'INVOICE',
    status: 'ISSUED',
    mimeType: 'application/pdf',
    fileSize: 71000,
    skipHireId: 'sh-01',
    ownerId: 'demo',
    issuedBy: 'B3Hub Platform',
    isGenerated: true,
    notes: 'Builders skip (6 m³) — 3-day hire',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Filter tabs ──────────────────────────────────────────────

type FilterTab = 'ALL' | DocumentType;

const TABS: { id: FilterTab; label: string; icon: React.ElementType }[] = [
  { id: 'ALL', label: 'Visi', icon: FolderOpen },
  { id: 'INVOICE', label: 'Rēķini', icon: FileText },
  { id: 'WEIGHING_SLIP', label: 'Svēršanas Lapas', icon: Weight },
  { id: 'DELIVERY_PROOF', label: 'Piegādes Apstiprinājumi', icon: ClipboardCheck },
  { id: 'WASTE_CERTIFICATE', label: 'Sertifikāti', icon: Recycle },
  { id: 'DELIVERY_NOTE', label: 'Piegādes Pavadzīmes', icon: Truck },
  { id: 'CONTRACT', label: 'Līgumi', icon: ScrollText },
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
  const [useDemoData, setUseDemoData] = useState(false);

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
      if (result.total === 0 && !search) {
        // No real docs yet → show demo data
        setUseDemoData(true);
        const filtered =
          activeTab === 'ALL' ? DEMO_DOCS : DEMO_DOCS.filter((d) => d.type === activeTab);
        setDocs(filtered);
        setSummary({
          total: DEMO_DOCS.length,
          byType: DEMO_DOCS.reduce(
            (acc, d) => ({ ...acc, [d.type]: (acc[d.type as DocumentType] ?? 0) + 1 }),
            {} as DocumentSummary['byType'],
          ),
        });
      } else {
        setUseDemoData(false);
        setDocs(result.documents);
        setSummary(sum);
      }
    } catch {
      // API not reachable – fall back to demo data
      setUseDemoData(true);
      const filtered =
        activeTab === 'ALL' ? DEMO_DOCS : DEMO_DOCS.filter((d) => d.type === activeTab);
      setDocs(
        search
          ? filtered.filter(
              (d) =>
                d.title.toLowerCase().includes(search.toLowerCase()) ||
                d.notes?.toLowerCase().includes(search.toLowerCase()),
            )
          : filtered,
      );
      setSummary({
        total: DEMO_DOCS.length,
        byType: DEMO_DOCS.reduce(
          (acc, d) => ({ ...acc, [d.type]: (acc[d.type as DocumentType] ?? 0) + 1 }),
          {} as DocumentSummary['byType'],
        ),
      });
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
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Mani Dokumenti
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
            Visi jūsu rēķini, svēršanas lapas, piegādes apstiprinājumi un sertifikāti — bez papīra,
            vienā vietā.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchDocs}
          disabled={fetching}
          className="rounded-full shadow-none bg-background border-border hover:bg-muted/60 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
          Atjaunot sarakstu
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Kopā dokumenti', value: summary?.total ?? 0, color: 'text-foreground' },
          { label: 'Šajā mēnesī', value: thisMonth, color: 'text-foreground' },
          { label: 'Rēķini', value: summary?.byType?.INVOICE ?? 0, color: 'text-foreground' },
          {
            label: 'Svēršanas lapas',
            value: summary?.byType?.WEIGHING_SLIP ?? 0,
            color: 'text-foreground',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-muted/30 rounded-2xl p-5 flex flex-col justify-center"
          >
            <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
              {stat.label}
            </p>
            <p className={`text-3xl font-medium tracking-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {useDemoData && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 px-5 py-4 text-sm text-amber-700/80">
          <div className="animate-pulse bg-amber-500/20 h-2 w-2 rounded-full shrink-0" />
          <span>
            <strong>Priekšskatījuma režīms</strong> — šie ir piemēra dokumenti. Jūsu ištie dokumenti
            tiks ģenerēti šeit.
          </span>
        </div>
      )}

      {/* ── Filters + Search ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 pb-2">
        {/* Tab pills */}
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => {
            const count =
              tab.id === 'ALL' ? summary?.total : summary?.byType?.[tab.id as DocumentType];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-foreground text-background shadow-md'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {tab.label}
                {count != null && count > 0 && (
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                      isActive
                        ? 'bg-background/20 text-background'
                        : 'bg-background text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full xl:w-72 shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Meklēt dokumentos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-muted/30 border-transparent rounded-full focus:outline-none focus:bg-background focus:ring-1 focus:ring-ring focus:border-border transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* ── Document list ── */}
      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/20 border-t-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 px-4 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
            <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">Nav atrasts neviens dokuments</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search
              ? `Nav rezultātu meklējumam "${search}". Mēģiniet citu meklēšanas frazi.`
              : 'Dokumenti parādīsīsies šeit automātiski, tīklīdz jūsu pasūtījumi tiks apstiprināti un piegādes pabeigtas.'}
          </p>
          {search && (
            <Button variant="outline" onClick={() => setSearch('')} className="mt-4 rounded-full">
              Kā atcelt meklēšanu
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
