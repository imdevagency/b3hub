/**
 * B3 Construction — Projekta detaļas
 * /dashboard/b3-construction/projects/[id]
 *
 * Tabbed hub for a single project:
 *  Pārskats | DPR | Budžets | Dokumenti | Pasūtījumi | Ietvarlīgumi
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetConstructionProjectById,
  adminUpdateConstructionProject,
  adminGetProjectBudgetLines,
  adminCreateBudgetLine,
  adminUpdateBudgetLine,
  adminDeleteBudgetLine,
  adminSetProjectBudgetLines,
  adminGetDailyReports,
  adminGetConstructionProfitability,
  adminGetProjectDocuments,
  adminCreateProjectDocument,
  adminDeleteProjectDocument,
  adminGetDprTemplates,
  adminGetClientInvoices,
  adminCreateClientInvoice,
  adminUpdateClientInvoice,
  adminDeleteClientInvoice,
  type AdminConstructionProjectDetail,
  type DprTemplate,
  type ConstructionProjectStatus,
  type ProjectBudgetLine,
  type CreateBudgetLinePayload,
  type CostCode,
  type DailyReport,
  type ProjectProfitabilitySummary,
  type ProjectDocument,
  type ProjectDocumentType,
  type ProjectDocumentStatus,
  type CreateProjectDocumentPayload,
  type ConstructionClientInvoice,
  type ClientInvoiceStatus,
} from '@/lib/api/admin';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  BarChart2,
  Building2,
  Calendar,
  Calculator,
  ClipboardList,
  Euro,
  FileText,
  FolderKanban,
  MapPin,
  Package,
  Pencil,
  Plus,
  Receipt,
  TrendingUp,
  Truck,
  Upload,
  Trash2,
  ExternalLink,
  FilePlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { StatCard } from '@/components/ui/stat-card';
import { PageHelp } from '@/components/ui/page-help';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ConstructionProjectStatus, string> = {
  PLANNING: 'Plānošana',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  ON_HOLD: 'Apturēts',
};

const STATUS_VARIANTS: Record<
  ConstructionProjectStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  PLANNING: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
  ON_HOLD: 'destructive',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Procesā',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const ORDER_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  DELIVERED: 'outline',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Melnraksts',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  SUSPENDED: 'Apturēts',
  CANCELLED: 'Atcelts',
};

const TRANSPORT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Pieejams',
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Apstiprināts',
  EN_ROUTE_PICKUP: 'Brauc uz iekr.',
  AT_PICKUP: 'Iekraušanā',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Brauc uz izkr.',
  AT_DELIVERY: 'Izkraušanā',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
  DELIVERY_REFUSED: 'Atteikts',
};

const TRANSPORT_STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  AVAILABLE: 'secondary',
  ASSIGNED: 'secondary',
  ACCEPTED: 'default',
  EN_ROUTE_PICKUP: 'default',
  AT_PICKUP: 'default',
  LOADED: 'default',
  EN_ROUTE_DELIVERY: 'default',
  AT_DELIVERY: 'default',
  DELIVERED: 'outline',
  CANCELLED: 'destructive',
  DELIVERY_REFUSED: 'destructive',
};

const DPR_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Melnraksts',
  SUBMITTED: 'Iesniegts',
  APPROVED: 'Apstiprināts',
};

const DPR_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  APPROVED: 'outline',
};

const COST_CODE_LABELS: Record<CostCode, string> = {
  LABOUR: 'Darbaspēks',
  EQUIPMENT: 'Tehnika',
  MATERIAL: 'Materiāls',
  TRANSPORT: 'Transports',
  SUBCONTRACTOR: 'Apakšuzņēmējs',
  OTHER: 'Cits',
};

const COST_CODES: CostCode[] = [
  'LABOUR',
  'EQUIPMENT',
  'MATERIAL',
  'TRANSPORT',
  'SUBCONTRACTOR',
  'OTHER',
];

function formatEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function parseWasteTypes(raw: string | null): string {
  if (!raw) return '—';
  try {
    const arr: string[] = JSON.parse(raw);
    const labels: Record<string, string> = {
      CONCRETE: 'Betons',
      BRICK: 'Ķieģeļi',
      WOOD: 'Koksne',
      METAL: 'Metāls',
      PLASTIC: 'Plastmasa',
      SOIL: 'Grunts',
      MIXED: 'Jaukti',
      HAZARDOUS: 'Bīstami',
    };
    return arr.map((t) => labels[t] ?? t).join(', ');
  } catch {
    return raw;
  }
}

function BudgetCodeBar({
  label,
  spent,
  budget,
}: {
  label: string;
  spent: number;
  budget: number | undefined;
}) {
  const pct = budget && budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over = budget != null && spent > budget;
  const warn = pct >= 80;
  return (
    <div className="py-2">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-3 tabular-nums">
          <span className={over ? 'text-red-600' : 'text-foreground'}>{formatEur(spent)}</span>
          {budget != null && (
            <span className="text-muted-foreground text-xs">/ {formatEur(budget)}</span>
          )}
        </div>
      </div>
      {budget != null && budget > 0 && (
        <Progress
          value={pct}
          className={`h-1.5 ${over ? '[&>div]:bg-red-500' : warn ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
        />
      )}
      {budget == null && <div className="h-1.5 w-full rounded-full bg-muted" />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConstructionProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [project, setProject] = useState<AdminConstructionProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Budget lines
  const [budgetLines, setBudgetLines] = useState<ProjectBudgetLine[]>([]);
  // Line add / edit dialog
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [lineEditTarget, setLineEditTarget] = useState<ProjectBudgetLine | null>(null);
  const [lineForm, setLineForm] = useState<{
    costCode: CostCode;
    description: string;
    quantity: string;
    unit: string;
    unitRate: string;
    notes: string;
  }>({ costCode: 'LABOUR', description: '', quantity: '1', unit: 'H', unitRate: '', notes: '' });
  const [savingLine, setSavingLine] = useState(false);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);

  // Edit project
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    clientName: string;
    contractValue: string;
    siteAddress: string;
    startDate: string;
    endDate: string;
    description: string;
    budgetAmount: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // DPRs
  const [projectDprs, setProjectDprs] = useState<DailyReport[]>([]);

  // Documents
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docForm, setDocForm] = useState<CreateProjectDocumentPayload>({
    title: '',
    type: 'CONTRACT',
    status: 'DRAFT',
    fileUrl: '',
    notes: '',
    issuedBy: '',
    expiresAt: '',
  });
  const [savingDoc, setSavingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Estimate calculator
  const [templates, setTemplates] = useState<DprTemplate[]>([]);
  const [estimateTemplateId, setEstimateTemplateId] = useState('');
  const [estimateDays, setEstimateDays] = useState('');

  // ── Client invoices ────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<ConstructionClientInvoice[]>([]);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceEditTarget, setInvoiceEditTarget] = useState<ConstructionClientInvoice | null>(
    null,
  );
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNo: '',
    issueDate: '',
    dueDate: '',
    amount: '',
    vatAmount: '',
    description: '',
    status: 'ISSUED' as ClientInvoiceStatus,
    notes: '',
  });
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceFormError, setInvoiceFormError] = useState<string | null>(null);

  // Profitability / calculations
  const [profitability, setProfitability] = useState<ProjectProfitabilitySummary | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [data, lines, dprs, prof] = await Promise.all([
        adminGetConstructionProjectById(id, token),
        adminGetProjectBudgetLines(token, id),
        adminGetDailyReports(token, { projectId: id, limit: 50 }),
        adminGetConstructionProfitability(token, { projectId: id }),
      ]);
      setProject(data);
      setBudgetLines(lines);
      setProjectDprs(dprs.data);
      setProfitability(prof.projects[0] ?? null);
      // Documents fetch is non-fatal — endpoint may not be live yet
      adminGetProjectDocuments(token, id)
        .then(setDocuments)
        .catch(() => setDocuments([]));
      // Client invoices — non-fatal
      adminGetClientInvoices(token, { projectId: id })
        .then((r) => setInvoices(r.data))
        .catch(() => {});
      // Templates for estimate calculator — non-fatal
      adminGetDprTemplates(token)
        .then((t) => setTemplates(t.filter((tmpl) => tmpl.active)))
        .catch(() => {});
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!token || !project) return;
    setUpdatingStatus(true);
    try {
      await adminUpdateConstructionProject(
        id,
        { status: status as ConstructionProjectStatus },
        token,
      );
      setProject((prev) =>
        prev ? { ...prev, status: status as ConstructionProjectStatus } : prev,
      );
    } catch {
      // silently revert
    } finally {
      setUpdatingStatus(false);
    }
  };

  function openLineAdd() {
    setLineEditTarget(null);
    setLineForm({
      costCode: 'LABOUR',
      description: '',
      quantity: '1',
      unit: 'H',
      unitRate: '',
      notes: '',
    });
    setLineFormOpen(true);
  }

  function openLineEdit(line: ProjectBudgetLine) {
    setLineEditTarget(line);
    setLineForm({
      costCode: line.costCode,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      unitRate: String(line.unitRate),
      notes: line.notes ?? '',
    });
    setLineFormOpen(true);
  }

  async function saveLine() {
    if (!token || !lineForm.description.trim() || !lineForm.unitRate) return;
    setSavingLine(true);
    try {
      const payload: CreateBudgetLinePayload = {
        costCode: lineForm.costCode,
        description: lineForm.description.trim(),
        quantity: parseFloat(lineForm.quantity) || 1,
        unit: lineForm.unit,
        unitRate: parseFloat(lineForm.unitRate) || 0,
        notes: lineForm.notes.trim() || undefined,
      };
      if (lineEditTarget) {
        const updated = await adminUpdateBudgetLine(token, lineEditTarget.id, payload);
        setBudgetLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      } else {
        const created = await adminCreateBudgetLine(token, id, payload);
        setBudgetLines((prev) => [...prev, created]);
      }
      setLineFormOpen(false);
    } finally {
      setSavingLine(false);
    }
  }

  async function deleteLine(lineId: string) {
    if (!token) return;
    setDeletingLineId(lineId);
    try {
      await adminDeleteBudgetLine(token, lineId);
      setBudgetLines((prev) => prev.filter((l) => l.id !== lineId));
    } finally {
      setDeletingLineId(null);
    }
  }

  function openEditProject() {
    if (!project) return;
    setEditDraft({
      name: project.name,
      clientName: project.clientName ?? '',
      contractValue: String(project.contractValue),
      siteAddress: project.siteAddress ?? '',
      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
      endDate: project.endDate ? project.endDate.slice(0, 10) : '',
      description: project.description ?? '',
      budgetAmount: project.budgetAmount != null ? String(project.budgetAmount) : '',
    });
    setEditOpen(true);
  }

  async function saveEditProject() {
    if (!token || !editDraft) return;
    setSavingEdit(true);
    try {
      await adminUpdateConstructionProject(
        id,
        {
          name: editDraft.name,
          clientName: editDraft.clientName || undefined,
          contractValue: parseFloat(editDraft.contractValue) || 0,
          siteAddress: editDraft.siteAddress || undefined,
          startDate: editDraft.startDate || null,
          endDate: editDraft.endDate || null,
          description: editDraft.description || undefined,
          budgetAmount: editDraft.budgetAmount ? parseFloat(editDraft.budgetAmount) : undefined,
        },
        token,
      );
      await load();
      setEditOpen(false);
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveDocument() {
    if (!token || !docForm.title.trim()) return;
    setSavingDoc(true);
    try {
      await adminCreateProjectDocument(token, id, {
        ...docForm,
        fileUrl: docForm.fileUrl?.trim() || undefined,
        notes: docForm.notes?.trim() || undefined,
        issuedBy: docForm.issuedBy?.trim() || undefined,
        expiresAt: docForm.expiresAt?.trim() || undefined,
      });
      await load();
      setDocDialogOpen(false);
      setDocForm({
        title: '',
        type: 'CONTRACT',
        status: 'DRAFT',
        fileUrl: '',
        notes: '',
        issuedBy: '',
        expiresAt: '',
      });
    } finally {
      setSavingDoc(false);
    }
  }

  async function deleteDocument(docId: string) {
    if (!token) return;
    setDeletingDocId(docId);
    try {
      await adminDeleteProjectDocument(token, id, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } finally {
      setDeletingDocId(null);
    }
  }

  // ── Invoice helpers (component scope so dialog can call saveInvoice) ────────

  function openInvoiceCreate() {
    setInvoiceEditTarget(null);
    setInvoiceForm({
      invoiceNo: '',
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      amount: '',
      vatAmount: '',
      description: '',
      status: 'ISSUED',
      notes: '',
    });
    setInvoiceFormError(null);
    setInvoiceDialogOpen(true);
  }

  function openInvoiceEdit(inv: ConstructionClientInvoice) {
    setInvoiceEditTarget(inv);
    setInvoiceForm({
      invoiceNo: inv.invoiceNo,
      issueDate: inv.issueDate.slice(0, 10),
      dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : '',
      amount: String(inv.amount),
      vatAmount: inv.vatAmount != null ? String(inv.vatAmount) : '',
      description: inv.description ?? '',
      status: inv.status,
      notes: inv.notes ?? '',
    });
    setInvoiceFormError(null);
    setInvoiceDialogOpen(true);
  }

  async function saveInvoice() {
    if (!token || !invoiceForm.invoiceNo.trim() || !invoiceForm.issueDate || !invoiceForm.amount) {
      setInvoiceFormError('Rēķina nr., datums un summa ir obligāti');
      return;
    }
    setSavingInvoice(true);
    setInvoiceFormError(null);
    try {
      const payload = {
        invoiceNo: invoiceForm.invoiceNo.trim(),
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate || undefined,
        amount: parseFloat(invoiceForm.amount),
        vatAmount: invoiceForm.vatAmount ? parseFloat(invoiceForm.vatAmount) : undefined,
        description: invoiceForm.description.trim() || undefined,
        status: invoiceForm.status,
        notes: invoiceForm.notes.trim() || undefined,
      };
      if (invoiceEditTarget) {
        const updated = await adminUpdateClientInvoice(token, invoiceEditTarget.id, payload);
        setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
      } else {
        const created = await adminCreateClientInvoice(token, id, payload);
        setInvoices((prev) => [...prev, created]);
      }
      setInvoiceDialogOpen(false);
    } catch (err) {
      setInvoiceFormError(err instanceof Error ? err.message : 'Kļūda saglabājot');
    } finally {
      setSavingInvoice(false);
    }
  }

  async function deleteInvoice(invId: string) {
    if (!token) return;
    await adminDeleteClientInvoice(token, invId);
    setInvoices((prev) => prev.filter((inv) => inv.id !== invId));
  }

  if (loading) return <PageSpinner />;

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Projekts" />
        <EmptyState icon={FolderKanban} title="Projekts nav atrasts" />
      </div>
    );
  }

  const disposalOrders = project.orders.filter((o) => o.category === 'DISPOSAL');
  const materialOrders = project.orders.filter((o) => o.category !== 'DISPOSAL');

  // ─── Estimate calculator derived state ────────────────────────────────────
  const selectedTemplate = templates.find((t) => t.id === estimateTemplateId) ?? null;
  const estimateDaysNum = parseFloat(estimateDays) || 0;
  const templateDailyCost: Partial<Record<CostCode, number>> = {};
  if (selectedTemplate) {
    for (const line of selectedTemplate.lines) {
      templateDailyCost[line.costCode] =
        (templateDailyCost[line.costCode] ?? 0) + line.quantity * line.unitRate;
    }
  }
  const estimatedCostByCode: Partial<Record<CostCode, number>> = {};
  if (estimateDaysNum > 0) {
    for (const [cc, daily] of Object.entries(templateDailyCost)) {
      const v = (daily as number) * estimateDaysNum;
      if (v > 0) estimatedCostByCode[cc as CostCode] = v;
    }
  }
  const estimatedTotal = Object.values(estimatedCostByCode).reduce((s, v) => s + v, 0);
  const estimatedMarginPct =
    project.contractValue > 0
      ? ((project.contractValue - estimatedTotal) / project.contractValue) * 100
      : 0;

  async function applyEstimateToBudget() {
    if (!token || !selectedTemplate || estimateDaysNum <= 0) return;
    const lines: CreateBudgetLinePayload[] = COST_CODES.filter(
      (cc) => (estimatedCostByCode[cc] ?? 0) > 0,
    ).map((cc) => ({
      costCode: cc,
      description: `${selectedTemplate.name} × ${estimateDaysNum}d`,
      quantity: estimateDaysNum,
      unit: 'DAY',
      unitRate: Math.round((templateDailyCost[cc] ?? 0) * 100) / 100,
      notes: 'Ģenerēts no brigādes veidnes',
    }));
    const updated = await adminSetProjectBudgetLines(token, id, lines);
    setBudgetLines(updated);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.name}
        description={
          [project.clientName, project.siteAddress].filter(Boolean).join(' · ') || undefined
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/b3-construction/projects')}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Atpakaļ
            </Button>
            <Button variant="outline" size="sm" onClick={openEditProject}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Rediģēt
            </Button>
            <Select
              value={project.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANNING">Plānošana</SelectItem>
                <SelectItem value="ACTIVE">Aktīvs</SelectItem>
                <SelectItem value="ON_HOLD">Apturēts</SelectItem>
                <SelectItem value="COMPLETED">Pabeigts</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant={STATUS_VARIANTS[project.status]}>{STATUS_LABELS[project.status]}</Badge>
            <PageHelp
              title="Projekta detaļas — ceļvedis"
              sections={[
                {
                  heading: 'Sešas cilnes',
                  steps: [
                    'Pārskats — galvenie rādītāji un projekta info. DPR pašizmaksa nāk no apstiprinātajām dienas atskaitēm.',
                    'DPR — visas dienas atskaites. Meistars iesniedz, jūs apstiprinat.',
                    'Budžets — planētās izmaksas vs faktiskais izlietojums pa kategorijām.',
                    'Dokumenti — līgumi, rēķini, atļaujas.',
                    'Pasūtījumi — materiālu vai atkritumu pasūtījumi caur B3Hub platformu.',
                    'Ietvarlīgumi — iepriekš saskaņoti piegādātāju vai transporta līgumi.',
                  ],
                },
                {
                  heading: 'DPR apstiprināšana',
                  body: 'Kad meistars iesniedz DPR (statuss: Iesniegts), jūms tas jāapstiprina. Tikai Apstiprinātas atskaites tiek ieskaitytas rentabilitātē. Melnraksts un Iesniegts statusā atskaites nav iekļautas.',
                  tip: 'Apstipriniet DPR vēlākais nākamajā dienā — tā saglabājat aktuālu finanšu ainu.',
                },
                {
                  heading: 'Tāmes kalkulators (Budžeta cilne)',
                  body: 'Cilnē Budžets atradīsiet Tāmes kalkulatoru. Izvēlieties brigādes veidni (standarta dienas konfigurācija) un ievadiet plānoto darba dienu skaitu — sistēma aprēķinās pašizmaksu pa kategorijām un maržu. Klikšķis „Piemērot kā budžetu“ aizpildīs budžeta aiļes.',
                },
                {
                  heading: 'Pašizmaksa vs Materiālu izmaksas',
                  body: 'Pašizmaksa (DPR) = reāli iztérētā nauda no dienas atskaitēm — darbs, tehnika, transports, materiāli. Materiālu izmaksas = tikai B3Hub platformas pasūtījumi. Pilnā finanšu aina ir Rentabilitātes sadaļā.',
                },
              ]}
            />
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">
            <FolderKanban className="h-4 w-4" />
            Pārskats
          </TabsTrigger>
          <TabsTrigger value="dprs">
            <ClipboardList className="h-4 w-4" />
            DPR
            {projectDprs.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {projectDprs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="costs">
            <BarChart2 className="h-4 w-4" />
            Budžets
          </TabsTrigger>
          <TabsTrigger value="documents">
            <Upload className="h-4 w-4" />
            Dokumenti
            {documents.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Package className="h-4 w-4" />
            Pasūtījumi
            {project.orderCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {project.orderCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contracts">
            <FileText className="h-4 w-4" />
            Ietvarlīgumi
            {project.frameworkContracts.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {project.frameworkContracts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="h-4 w-4" />
            Rēķini klientam
            {invoices.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {invoices.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Pārskats ────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={Euro}
              label="Līguma vērtība"
              value={formatEur(project.contractValue)}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              icon={Package}
              label="DPR pašizmaksa"
              value={profitability != null ? formatEur(profitability.dprCost) : '—'}
              sub={
                profitability != null && project.budgetAmount != null && project.budgetAmount > 0
                  ? `${((profitability.dprCost / project.budgetAmount) * 100).toFixed(0)}% no budžeta`
                  : profitability == null
                    ? 'Nav DPR datu'
                    : undefined
              }
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Bruto peļņa"
              value={profitability != null ? formatEur(profitability.grossMargin) : '—'}
              sub={
                profitability != null
                  ? `${profitability.marginPct.toFixed(1)}% marža (DPR)`
                  : 'Nav DPR datu'
              }
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <StatCard
              icon={FolderKanban}
              label="Pasūtījumi / Transports"
              value={String(project.orderCount)}
              sub={`${project.transportJobCount} transporta darbi`}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </div>

          {/* Meta */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{project.company.name}</span>
                </div>
                {project.siteAddress && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{project.siteAddress}</span>
                  </div>
                )}
                {project.startDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(project.startDate), 'dd.MM.yyyy')}
                      {project.endDate
                        ? ` – ${format(new Date(project.endDate), 'dd.MM.yyyy')}`
                        : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    Izv.: {project.createdBy.firstName} {project.createdBy.lastName}
                  </span>
                </div>
              </div>
              {project.description && (
                <>
                  <Separator className="my-3" />
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Budget summary (links to costs tab) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Euro className="h-4 w-4 text-muted-foreground" />
                Tāmes budžets
                <Button size="sm" variant="outline" className="ml-auto gap-1" onClick={openLineAdd}>
                  <Plus className="h-3.5 w-3.5" />
                  Pievienot
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {budgetLines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Tāme nav ievadīta.{' '}
                  <button className="underline text-foreground" onClick={openLineAdd}>
                    Pievienot rindu
                  </button>
                </p>
              ) : (
                <div className="space-y-2">
                  {COST_CODES.map((cc) => {
                    const total = budgetLines
                      .filter((l) => l.costCode === cc)
                      .reduce((s, l) => s + l.amount, 0);
                    if (total === 0) return null;
                    return (
                      <div key={cc} className="flex items-center justify-between py-1">
                        <span className="text-sm">{COST_CODE_LABELS[cc]}</span>
                        <span className="text-sm font-medium tabular-nums">{formatEur(total)}</span>
                      </div>
                    );
                  })}
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Kopā</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatEur(budgetLines.reduce((s, l) => s + l.amount, 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sites */}
          {project.sites.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Objekta vietas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {project.sites.map((site) => (
                    <div
                      key={site.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{site.label}</span>
                        <span className="ml-2 text-muted-foreground">{site.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {site.type === 'LOADING'
                            ? 'Iekraušana'
                            : site.type === 'UNLOADING'
                              ? 'Izkraušana'
                              : 'Abi'}
                        </Badge>
                        {site.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Galvenais
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Budžets ─────────────────────────────────────────────── */}
        <TabsContent value="costs" className="mt-4 flex flex-col gap-4">
          {/* ── Tāmes kalkulators ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                Tāmes kalkulators
              </CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Izvēlieties brigādes veidni un plānoto dienu skaitu — pašizmaksa aprēķinās
                automātiski. Nospiediet &quot;Piemērot kā budžetu&quot;, lai aizstātu tāmes rindas.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Brigādes veidne</p>
                  <Select value={estimateTemplateId} onValueChange={setEstimateTemplateId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          templates.length === 0 ? 'Nav pievienotu veidņu' : 'Izvēlieties veidni...'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.projectId === id ? ' ✦' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templates.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      <a
                        href="/dashboard/b3-construction/dpr-templates"
                        className="underline hover:text-foreground"
                      >
                        Pievienot veidni →
                      </a>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Plānotās dienas uz objekta</p>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="piem. 45"
                    value={estimateDays}
                    onChange={(e) => setEstimateDays(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {selectedTemplate && estimateDaysNum > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="space-y-2">
                    {COST_CODES.map((cc) => {
                      const dailyCost = templateDailyCost[cc] ?? 0;
                      if (dailyCost === 0) return null;
                      return (
                        <div key={cc} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{COST_CODE_LABELS[cc]}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {estimateDaysNum}d × {formatEur(dailyCost)}/d
                            </span>
                            <span className="w-24 text-right font-medium tabular-nums">
                              {formatEur(dailyCost * estimateDaysNum)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Aplēstā pašizmaksa</span>
                      <span className="tabular-nums">{formatEur(estimatedTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Līguma vērtība</span>
                      <span className="tabular-nums">{formatEur(project.contractValue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Aplēstā marža</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          estimatedMarginPct >= 15
                            ? 'text-green-600'
                            : estimatedMarginPct >= 5
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {estimatedMarginPct >= 0 ? '+' : ''}
                        {estimatedMarginPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={applyEstimateToBudget}>
                    Piemērot kā budžetu →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Tāmes rindas ──────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Euro className="h-4 w-4 text-muted-foreground" />
                Tāmes rindas
                {project.status !== 'COMPLETED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto gap-1"
                    onClick={openLineAdd}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Pievienot rindu
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {budgetLines.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nav tāmes rindu.{' '}
                  {project.status !== 'COMPLETED' && (
                    <button className="underline text-foreground" onClick={openLineAdd}>
                      Pievienot pirmo rindu
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategorija</TableHead>
                        <TableHead>Apraksts</TableHead>
                        <TableHead className="text-right">Daudzums</TableHead>
                        <TableHead>Vienība</TableHead>
                        <TableHead className="text-right">Likme (€)</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                        {project.status !== 'COMPLETED' && <TableHead className="w-16" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {COST_CODES.flatMap((cc) => {
                        const lines = budgetLines.filter((l) => l.costCode === cc);
                        return lines.map((line, idx) => (
                          <TableRow key={line.id}>
                            {idx === 0 && (
                              <TableCell
                                className="text-sm font-medium align-top"
                                rowSpan={lines.length}
                              >
                                {COST_CODE_LABELS[cc]}
                              </TableCell>
                            )}
                            <TableCell className="text-sm">
                              {line.description}
                              {line.notes && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({line.notes})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {line.quantity}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {line.unit}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatEur(line.unitRate)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm font-medium">
                              {formatEur(line.amount)}
                            </TableCell>
                            {project.status !== 'COMPLETED' && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => openLineEdit(line)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => deleteLine(line.id)}
                                    disabled={deletingLineId === line.id}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ));
                      })}
                    </TableBody>
                  </Table>
                  {/* Subtotals per code + grand total */}
                  <div className="border-t px-4 py-3 space-y-1">
                    {COST_CODES.map((cc) => {
                      const subtotal = budgetLines
                        .filter((l) => l.costCode === cc)
                        .reduce((s, l) => s + l.amount, 0);
                      if (subtotal === 0) return null;
                      return (
                        <div
                          key={cc}
                          className="flex items-center justify-between text-sm text-muted-foreground"
                        >
                          <span>{COST_CODE_LABELS[cc]}</span>
                          <span className="tabular-nums">{formatEur(subtotal)}</span>
                        </div>
                      );
                    })}
                    <Separator className="my-1.5" />
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Tāmes kopsumma</span>
                      <span className="tabular-nums">
                        {formatEur(budgetLines.reduce((s, l) => s + l.amount, 0))}
                      </span>
                    </div>
                    {project.contractValue > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Plānotā marža</span>
                        <span
                          className={`tabular-nums font-medium ${(() => {
                            const budgetTotal = budgetLines.reduce((s, l) => s + l.amount, 0);
                            const margin =
                              project.contractValue > 0
                                ? ((project.contractValue - budgetTotal) / project.contractValue) *
                                  100
                                : 0;
                            return margin >= 15
                              ? 'text-green-600'
                              : margin >= 5
                                ? 'text-amber-600'
                                : 'text-red-600';
                          })()}`}
                        >
                          {(() => {
                            const budgetTotal = budgetLines.reduce((s, l) => s + l.amount, 0);
                            const margin =
                              project.contractValue > 0
                                ? ((project.contractValue - budgetTotal) / project.contractValue) *
                                  100
                                : 0;
                            return `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Budget vs Actual ────────────────────────────────────────── */}
          {profitability == null ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nav DPR datu. Pievienojiet dienas atskaites, lai redzētu faktu vs budžetu.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  icon={Euro}
                  label="Līguma vērtība"
                  value={formatEur(profitability.contractValue)}
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                />
                <StatCard
                  icon={TrendingUp}
                  label="DPR pašizmaksa"
                  value={formatEur(profitability.dprCost)}
                  iconBg="bg-red-50"
                  iconColor="text-red-600"
                />
                <StatCard
                  icon={BarChart2}
                  label="Bruto peļņa"
                  value={formatEur(profitability.grossMargin)}
                  sub={`${profitability.marginPct >= 0 ? '+' : ''}${profitability.marginPct.toFixed(1)}%`}
                  iconBg={profitability.grossMargin >= 0 ? 'bg-green-50' : 'bg-red-50'}
                  iconColor={profitability.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}
                />
                <StatCard
                  icon={FolderKanban}
                  label="Tāmes izlietojums"
                  value={
                    budgetLines.length > 0
                      ? `${Math.round((profitability.dprCost / budgetLines.reduce((s, l) => s + l.amount, 0)) * 100)}%`
                      : '—'
                  }
                  sub={
                    budgetLines.length > 0
                      ? `Tāme: ${formatEur(budgetLines.reduce((s, l) => s + l.amount, 0))}`
                      : 'Tāme nav ievadīta'
                  }
                  iconBg="bg-purple-50"
                  iconColor="text-purple-600"
                />
              </div>

              {/* Cost vs budget per code with variance alerts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Fakts vs tāme pa izmaksu kodiem</CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {COST_CODES.filter((cc) => {
                    const budgetForCode = budgetLines
                      .filter((l) => l.costCode === cc)
                      .reduce((s, l) => s + l.amount, 0);
                    return (profitability.costByCode[cc] ?? 0) > 0 || budgetForCode > 0;
                  }).length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      Nav DPR datu vai tāmes rindu.
                    </p>
                  ) : (
                    COST_CODES.map((cc) => {
                      const spent = profitability.costByCode[cc] ?? 0;
                      const budgetForCode = budgetLines
                        .filter((l) => l.costCode === cc)
                        .reduce((s, l) => s + l.amount, 0);
                      if (spent === 0 && budgetForCode === 0) return null;
                      const variance =
                        budgetForCode > 0 ? ((spent - budgetForCode) / budgetForCode) * 100 : null;
                      return (
                        <div key={cc}>
                          <BudgetCodeBar
                            label={COST_CODE_LABELS[cc]}
                            spent={spent}
                            budget={budgetForCode > 0 ? budgetForCode : undefined}
                          />
                          {variance !== null && Math.abs(variance) >= 10 && (
                            <p
                              className={`text-xs font-medium mb-1 ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}
                            >
                              {variance > 0
                                ? `⚠ Pārtērēts par ${variance.toFixed(0)}% (${formatEur(spent - budgetForCode)})`
                                : `✓ Ietaupīts ${Math.abs(variance).toFixed(0)}%`}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                  {profitability.dprCost > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="flex items-center justify-between py-2 text-sm font-semibold">
                        <span>Kopā DPR izmaksas</span>
                        <span className="tabular-nums">{formatEur(profitability.dprCost)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Overall budget bar */}
              {budgetLines.length > 0 &&
                (() => {
                  const budgetTotal = budgetLines.reduce((s, l) => s + l.amount, 0);
                  const usedPct = budgetTotal > 0 ? (profitability.dprCost / budgetTotal) * 100 : 0;
                  return (
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center justify-between text-sm font-medium mb-2">
                          <span>Kopējais budžets</span>
                          <span className="tabular-nums">
                            {formatEur(profitability.dprCost)} / {formatEur(budgetTotal)}
                            <span className="ml-2 text-muted-foreground text-xs">
                              ({usedPct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <Progress
                          value={Math.min(usedPct, 100)}
                          className={`h-2 ${
                            usedPct > 100
                              ? '[&>div]:bg-red-500'
                              : usedPct > 80
                                ? '[&>div]:bg-amber-500'
                                : '[&>div]:bg-emerald-500'
                          }`}
                        />
                        {usedPct > 100 && (
                          <p className="mt-1 text-xs font-medium text-red-600">
                            ⚠ Tāme pārtērēta par {formatEur(profitability.dprCost - budgetTotal)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
            </>
          )}
        </TabsContent>

        {/* ── Tab: DPR ────────────────────────────────────────────────── */}
        <TabsContent value="dprs" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Dienas atskaites
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() =>
                    router.push(`/dashboard/b3-construction/daily-reports?projectId=${id}`)
                  }
                >
                  Atvērt DPR sadaļu
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {projectDprs.length === 0 ? (
                <div className="py-10">
                  <EmptyState icon={ClipboardList} title="Nav dienas atskaišu" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datums</TableHead>
                      <TableHead>Objekts</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead>Rindas</TableHead>
                      <TableHead className="text-right">Kopā</TableHead>
                      <TableHead>Izveidoja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectDprs.map((dpr) => (
                      <TableRow key={dpr.id}>
                        <TableCell className="text-sm">
                          {format(new Date(dpr.reportDate), 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {dpr.siteLabel ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={DPR_STATUS_VARIANT[dpr.status] ?? 'secondary'}>
                            {DPR_STATUS_LABEL[dpr.status] ?? dpr.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {dpr._count?.lines ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {dpr.totalCost !== undefined ? formatEur(dpr.totalCost) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {dpr.createdBy
                            ? `${dpr.createdBy.firstName} ${dpr.createdBy.lastName}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Pasūtījumi ──────────────────────────────────────────── */}
        <TabsContent value="orders" className="mt-4 flex flex-col gap-4">
          {/* Material orders */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-muted-foreground" />
                Materiālu pasūtījumi
                <Badge variant="secondary" className="ml-auto">
                  {materialOrders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {materialOrders.length === 0 ? (
                <div className="py-8">
                  <EmptyState icon={Package} title="Nav materiālu pasūtījumu" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Materiāls</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Piegādes datums</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                        <TableCell className="text-sm">
                          {o.items.length > 0
                            ? o.items.map((i) => i.material?.name ?? '—').join(', ')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ORDER_STATUS_VARIANTS[o.status] ?? 'secondary'}>
                            {ORDER_STATUS_LABELS[o.status] ?? o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatEur(o.total)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {o.deliveryDate ? format(new Date(o.deliveryDate), 'dd.MM.yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Disposal orders */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Atkritumu izvešana
                <Badge variant="secondary" className="ml-auto">
                  {disposalOrders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {disposalOrders.length === 0 ? (
                <div className="py-8">
                  <EmptyState icon={Truck} title="Nav atkritumu izvešanas" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Atkritumu veids</TableHead>
                      <TableHead>Apjoms</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Datums</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disposalOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                        <TableCell className="text-sm">{parseWasteTypes(o.wasteTypes)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {o.disposalVolume ? `${o.disposalVolume} m³` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ORDER_STATUS_VARIANTS[o.status] ?? 'secondary'}>
                            {ORDER_STATUS_LABELS[o.status] ?? o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatEur(o.total)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {o.deliveryDate ? format(new Date(o.deliveryDate), 'dd.MM.yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Transport jobs */}
          {project.transportJobs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  Transporta darbi
                  <Badge variant="secondary" className="ml-auto">
                    {project.transportJobs.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Krava</TableHead>
                      <TableHead>Maršruts</TableHead>
                      <TableHead>Vadītājs</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead className="text-right">Likme</TableHead>
                      <TableHead>Datums</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.transportJobs.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="font-mono text-sm">{j.jobNumber}</TableCell>
                        <TableCell className="text-sm">
                          {j.cargoType}
                          {j.cargoWeight != null && (
                            <span className="ml-1 text-muted-foreground">· {j.cargoWeight} t</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {j.pickupCity} → {j.deliveryCity}
                        </TableCell>
                        <TableCell className="text-sm">
                          {j.driver ? (
                            `${j.driver.firstName} ${j.driver.lastName}`
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={TRANSPORT_STATUS_VARIANTS[j.status] ?? 'secondary'}>
                            {TRANSPORT_STATUS_LABELS[j.status] ?? j.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatEur(j.rate)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(j.pickupDate), 'dd.MM.yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Ietvarlīgumi ────────────────────────────────────────── */}
        <TabsContent value="contracts" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Ietvarlīgumi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {project.frameworkContracts.length === 0 ? (
                <div className="py-10">
                  <EmptyState icon={FileText} title="Nav ietvarlīgumu" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Virsraksts</TableHead>
                      <TableHead>Piegādātājs</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead className="text-right">Vērtība</TableHead>
                      <TableHead>Beigu datums</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.frameworkContracts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.contractNumber}</TableCell>
                        <TableCell className="text-sm font-medium">{c.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.supplier?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {c.totalValue != null ? formatEur(c.totalValue) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.endDate ? format(new Date(c.endDate), 'dd.MM.yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Dokumenti ─────────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4 flex flex-col gap-4">
          {(() => {
            const DOC_TYPE_LABELS: Record<ProjectDocumentType, string> = {
              CONTRACT: 'Līgums',
              INVOICE: 'Rēķins',
              WASTE_CERTIFICATE: 'Atkritumu sertifikāts',
              DELIVERY_NOTE: 'Piegādes zīme',
              WASTE_TRANSPORT_NOTE: 'Atkritumu pārvadājumu pavadzīme',
              DELIVERY_PROOF: 'Piegādes pierādījums',
              WEIGHING_SLIP: 'Svēršanas kvīts',
              OTHER: 'Cits',
            };
            const DOC_STATUS_LABELS: Record<ProjectDocumentStatus, string> = {
              DRAFT: 'Melnraksts',
              ISSUED: 'Izsniegts',
              SIGNED: 'Parakstīts',
              ARCHIVED: 'Arhivēts',
            };
            const DOC_STATUS_VARIANTS: Record<
              ProjectDocumentStatus,
              'default' | 'secondary' | 'outline' | 'destructive'
            > = {
              DRAFT: 'secondary',
              ISSUED: 'default',
              SIGNED: 'default',
              ARCHIVED: 'outline',
            };
            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-base">Projekta dokumenti</CardTitle>
                  <Button size="sm" onClick={() => setDocDialogOpen(true)}>
                    <FilePlus className="h-4 w-4 mr-1" />
                    Pievienot
                  </Button>
                </CardHeader>
                <CardContent>
                  {documents.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="Nav dokumentu"
                      description="Pievienojiet pirmo dokumentu šim projektam."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nosaukums</TableHead>
                          <TableHead>Tips</TableHead>
                          <TableHead>Statuss</TableHead>
                          <TableHead>Beigu datums</TableHead>
                          <TableHead>Izsniedza</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              {doc.fileUrl ? (
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 hover:underline"
                                >
                                  {doc.title}
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </a>
                              ) : (
                                doc.title
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {DOC_TYPE_LABELS[doc.type as ProjectDocumentType] ?? doc.type}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  DOC_STATUS_VARIANTS[doc.status as ProjectDocumentStatus] ??
                                  'secondary'
                                }
                              >
                                {DOC_STATUS_LABELS[doc.status as ProjectDocumentStatus] ??
                                  doc.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.expiresAt ? format(new Date(doc.expiresAt), 'dd.MM.yyyy') : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.issuedBy ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                disabled={deletingDocId === doc.id}
                                onClick={() => deleteDocument(doc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* ── Tab: Rēķini klientam ─────────────────────────────────────── */}
        <TabsContent value="invoices" className="mt-4 flex flex-col gap-4">
          {(() => {
            const INV_STATUS_LABELS: Record<ClientInvoiceStatus, string> = {
              DRAFT: 'Melnraksts',
              ISSUED: 'Izsniegts',
              PARTIALLY_PAID: 'Daļēji apmaksāts',
              PAID: 'Apmaksāts',
              OVERDUE: 'Kavēts',
              CANCELLED: 'Atcelts',
            };
            const INV_STATUS_STYLE: Record<ClientInvoiceStatus, string> = {
              DRAFT: 'bg-gray-100 text-gray-600',
              ISSUED: 'bg-blue-100 text-blue-800',
              PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
              PAID: 'bg-green-100 text-green-800',
              OVERDUE: 'bg-red-100 text-red-800',
              CANCELLED: 'bg-gray-100 text-gray-400',
            };

            const totalInvoiced = invoices.reduce((s, inv) => s + inv.amount, 0);
            const totalPaid = invoices.reduce((s, inv) => s + (inv.paidAmount ?? 0), 0);
            const totalOutstanding = totalInvoiced - totalPaid;

            return (
              <>
                {/* Summary KPIs */}
                {invoices.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-1">
                        <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Kopā izrakstīts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold">
                          €{totalInvoiced.toLocaleString('lv-LV', { minimumFractionDigits: 0 })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-1">
                        <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Saņemts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold text-green-700">
                          €{totalPaid.toLocaleString('lv-LV', { minimumFractionDigits: 0 })}
                        </div>
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
                          className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-amber-700' : 'text-gray-400'}`}
                        >
                          €{totalOutstanding.toLocaleString('lv-LV', { minimumFractionDigits: 0 })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-base">Rēķini klientam</CardTitle>
                    <Button size="sm" onClick={openInvoiceCreate}>
                      <FilePlus className="h-4 w-4 mr-1" />
                      Pievienot
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {invoices.length === 0 ? (
                      <EmptyState
                        icon={Receipt}
                        title="Nav rēķinu"
                        description="Pievienojiet pirmo rēķinu šim projektam."
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rēķina nr.</TableHead>
                            <TableHead>Datums</TableHead>
                            <TableHead>Apmaksas termiņš</TableHead>
                            <TableHead>Apraksts</TableHead>
                            <TableHead>Statuss</TableHead>
                            <TableHead className="text-right">Summa</TableHead>
                            <TableHead className="text-right">Saņemts</TableHead>
                            <TableHead className="w-20" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium font-mono text-sm">
                                {inv.invoiceNo}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(inv.issueDate), 'dd.MM.yyyy')}
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {inv.dueDate ? format(new Date(inv.dueDate), 'dd.MM.yyyy') : '—'}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                                {inv.description ?? '—'}
                              </TableCell>
                              <TableCell>
                                <Badge className={INV_STATUS_STYLE[inv.status]}>
                                  {INV_STATUS_LABELS[inv.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                €{inv.amount.toLocaleString('lv-LV', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-green-700">
                                {inv.paidAmount != null
                                  ? `€${inv.paidAmount.toLocaleString('lv-LV', { minimumFractionDigits: 2 })}`
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openInvoiceEdit(inv)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => deleteInvoice(inv.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* ── Client invoice dialog ───────────────────────────────────────── */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{invoiceEditTarget ? 'Labot rēķinu' : 'Jauns rēķins'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Rēķina nr. *</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={invoiceForm.invoiceNo}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNo: e.target.value }))}
                  placeholder="B3C-2026-001"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Statuss</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={invoiceForm.status}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, status: e.target.value as ClientInvoiceStatus }))
                  }
                >
                  <option value="DRAFT">Melnraksts</option>
                  <option value="ISSUED">Izsniegts</option>
                  <option value="PARTIALLY_PAID">Daļēji apmaksāts</option>
                  <option value="PAID">Apmaksāts</option>
                  <option value="OVERDUE">Kavēts</option>
                  <option value="CANCELLED">Atcelts</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Izrakstīšanas datums *</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={invoiceForm.issueDate}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, issueDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Apmaksas termiņš</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Summa (ar VAT) € *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">PVN summa €</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={invoiceForm.vatAmount}
                  onChange={(e) => setInvoiceForm((f) => ({ ...f, vatAmount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Apraksts</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Par kādiem darbiem"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Piezīmes</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {invoiceFormError && <p className="text-sm text-red-600">{invoiceFormError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInvoiceDialogOpen(false)}
              disabled={savingInvoice}
            >
              Atcelt
            </Button>
            <Button onClick={saveInvoice} disabled={savingInvoice}>
              {savingInvoice ? 'Saglabā…' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pievienot dokumentu</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Nosaukums *</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={docForm.title}
                onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Piemēram: Būvdarbu līgums Nr. 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Tips</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={docForm.type}
                  onChange={(e) =>
                    setDocForm((f) => ({ ...f, type: e.target.value as ProjectDocumentType }))
                  }
                >
                  <option value="CONTRACT">Līgums</option>
                  <option value="INVOICE">Rēķins</option>
                  <option value="WASTE_CERTIFICATE">Atkritumu sertifikāts</option>
                  <option value="DELIVERY_NOTE">Piegādes zīme</option>
                  <option value="WASTE_TRANSPORT_NOTE">Atkritumu pārvadājumu pavadzīme</option>
                  <option value="DELIVERY_PROOF">Piegādes pierādījums</option>
                  <option value="WEIGHING_SLIP">Svēršanas kvīts</option>
                  <option value="OTHER">Cits</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Statuss</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={docForm.status}
                  onChange={(e) =>
                    setDocForm((f) => ({ ...f, status: e.target.value as ProjectDocumentStatus }))
                  }
                >
                  <option value="DRAFT">Melnraksts</option>
                  <option value="ISSUED">Izsniegts</option>
                  <option value="SIGNED">Parakstīts</option>
                  <option value="ARCHIVED">Arhivēts</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Faila URL (neobligāts)</label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={docForm.fileUrl ?? ''}
                onChange={(e) => setDocForm((f) => ({ ...f, fileUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Beigu datums</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={docForm.expiresAt ?? ''}
                  onChange={(e) => setDocForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Izsniedza</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={docForm.issuedBy ?? ''}
                  onChange={(e) => setDocForm((f) => ({ ...f, issuedBy: e.target.value }))}
                  placeholder="Uzņēmuma nosaukums"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Piezīmes</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={docForm.notes ?? ''}
                onChange={(e) => setDocForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={saveDocument} disabled={savingDoc || !docForm.title.trim()}>
              {savingDoc ? 'Saglabā...' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit project modal ────────────────────────────────────────── */}
      {editOpen && editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold">Rediģēt projektu</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Nosaukums *</label>
                <input
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Klients</label>
                <input
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editDraft.clientName}
                  onChange={(e) => setEditDraft({ ...editDraft, clientName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Līguma vērtība (€)</label>
                <input
                  type="number"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editDraft.contractValue}
                  onChange={(e) => setEditDraft({ ...editDraft, contractValue: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Atrašanās vieta</label>
                <input
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editDraft.siteAddress}
                  onChange={(e) => setEditDraft({ ...editDraft, siteAddress: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sākuma datums</label>
                <input
                  type="date"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editDraft.startDate}
                  onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Beigu datums</label>
                <input
                  type="date"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editDraft.endDate}
                  onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kopējais budžets (€)</label>
                <input
                  type="number"
                  placeholder="Nav norādīts"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editDraft.budgetAmount}
                  onChange={(e) => setEditDraft({ ...editDraft, budgetAmount: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Apraksts</label>
                <textarea
                  rows={3}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Atcelt
              </Button>
              <Button onClick={saveEditProject} disabled={savingEdit || !editDraft.name.trim()}>
                {savingEdit ? 'Saglabā...' : 'Saglabāt'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Budget line add / edit dialog ────────────────────────── */}
      <Dialog open={lineFormOpen} onOpenChange={setLineFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lineEditTarget ? 'Rediģēt tāmes rindu' : 'Pievienot tāmes rindu'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Cost code */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Izmaksu kategorija</label>
              <Select
                value={lineForm.costCode}
                onValueChange={(v) => setLineForm((f) => ({ ...f, costCode: v as CostCode }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_CODES.map((cc) => (
                    <SelectItem key={cc} value={cc}>
                      {COST_CODE_LABELS[cc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Apraksts</label>
              <input
                type="text"
                placeholder="piem. Iekravējs"
                value={lineForm.description}
                onChange={(e) => setLineForm((f) => ({ ...f, description: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {/* Quantity + unit + unit rate */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Daudzums</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="1"
                  value={lineForm.quantity}
                  onChange={(e) => setLineForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Vienība</label>
                <Select
                  value={lineForm.unit}
                  onValueChange={(v) => setLineForm((f) => ({ ...f, unit: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="H">h (stunda)</SelectItem>
                    <SelectItem value="DAY">diena</SelectItem>
                    <SelectItem value="M3">m³</SelectItem>
                    <SelectItem value="M2">m²</SelectItem>
                    <SelectItem value="M">m</SelectItem>
                    <SelectItem value="T">t (tonne)</SelectItem>
                    <SelectItem value="PC">gab.</SelectItem>
                    <SelectItem value="LOAD">kraušana</SelectItem>
                    <SelectItem value="KM">km</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Likme (€)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={lineForm.unitRate}
                  onChange={(e) => setLineForm((f) => ({ ...f, unitRate: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            {/* Calculated total */}
            {lineForm.quantity && lineForm.unitRate && (
              <p className="text-sm text-muted-foreground">
                Summa:{' '}
                <span className="font-medium text-foreground">
                  {formatEur(
                    (parseFloat(lineForm.quantity) || 0) * (parseFloat(lineForm.unitRate) || 0),
                  )}
                </span>
              </p>
            )}
            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Piezīmes (neobligāti)</label>
              <input
                type="text"
                placeholder="piem. Subuzņēmējs X"
                value={lineForm.notes}
                onChange={(e) => setLineForm((f) => ({ ...f, notes: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineFormOpen(false)}>
              Atcelt
            </Button>
            <Button
              onClick={saveLine}
              disabled={savingLine || !lineForm.description.trim() || !lineForm.unitRate}
            >
              {savingLine ? 'Saglabā...' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
