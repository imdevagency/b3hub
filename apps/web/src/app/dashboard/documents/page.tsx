'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  LogOut,
  User,
  FolderOpen,
  FileText,
  Weight,
  ClipboardCheck,
  Recycle,
  Truck,
  ScrollText,
  Search,
  ChevronLeft,
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

const USER_TYPE_LABEL: Record<string, string> = {
  BUYER: 'Darbuzņēmējs',
  SUPPLIER: 'Pārdevējs',
  CARRIER: 'Pārvadātājs',
  PRIVATE: 'Privātpersona',
  ADMIN: 'Administrators',
};

// ── Page ─────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user, token, logout, isLoading } = useAuth();
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  const thisMonth = docs.filter((d) => {
    const created = new Date(d.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-red-600" />
          <span className="font-bold text-gray-900">B3Hub</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <span>
              {user.firstName} {user.lastName}
            </span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {USER_TYPE_LABEL[user.userType] ?? user.userType}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="text-gray-600 hover:text-red-600"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Iziet
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* ── Breadcrumb + heading ── */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/dashboard" className="hover:text-red-600 flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Informācijas Panelis
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Dokumenti</span>
        </div>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FolderOpen className="h-7 w-7 text-red-600" />
              Mani Dokumenti
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Visi jūsu rēķini, svēršanas lapas, piegādes apstiprinājumi un sertifikāti — bez
              papīra, vienā vietā.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocs}
            disabled={fetching}
            className="text-gray-600 hover:text-red-600"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${fetching ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Kopā dokumenti', value: summary?.total ?? 0, color: 'text-gray-900' },
            {
              label: 'Šajā mēnesī',
              value: thisMonth,
              color: 'text-blue-600',
            },
            {
              label: 'Rēķini',
              value: summary?.byType?.INVOICE ?? 0,
              color: 'text-blue-600',
            },
            {
              label: 'Svēršanas lapas',
              value: summary?.byType?.WEIGHING_SLIP ?? 0,
              color: 'text-amber-600',
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {useDemoData && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            <span>
              ❆ Priekšskatījuma režīms — rāda piemēra dokumentus. Įsti dokumenti parādīsīsies šeit,
              tīklīdz jūsu pasūtījumi tiks apstrādāti.
            </span>
          </div>
        )}

        {/* ── Filters + Search ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          {/* Tab pills */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const count =
                tab.id === 'ALL' ? summary?.total : summary?.byType?.[tab.id as DocumentType];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {count != null && count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-500'
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
          <div className="relative sm:ml-auto w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Meklēt dokumentus…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* ── Document list ── */}
        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <FolderOpen className="h-14 w-14 text-gray-200" />
            <p className="font-medium text-gray-500">Nav atrasts neviens dokuments</p>
            <p className="text-sm text-center max-w-xs">
              {search
                ? `Nav rezultātu meklējumam "${search}". Mēģiniet citu meklēšanas frazi.`
                : 'Dokumenti parādīsīsies šeit automātiski, tīklīdz jūsu pasūtījumi tiks apstiprintī un piegādes pabeigtas.'}
            </p>
            {search && (
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                Notītīt meklēšanu
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {docs.map((doc) => (
              <DocumentCard key={doc.id} document={doc} onView={setViewerDoc} />
            ))}
          </div>
        )}
      </main>

      {/* ── Inline document viewer ── */}
      <DocumentViewer document={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}
