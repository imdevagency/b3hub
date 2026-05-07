/**
 * Construction — Project Detail
 * /dashboard/construction/projects/[id]
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getConstructionProjectById,
  updateConstructionProject,
  getProjectBudgetLines,
  getDailyReports,
  getClientInvoices,
  getSubcontractorEngagements,
  getProjectSites,
  createProjectSite,
  deleteProjectSite,
  type ConstructionProject,
  type ProjectStatus,
  type DailyReport,
  type ClientInvoice,
  type ProjectBudgetLine,
  type ProjectSite,
  type ProjectSiteType,
} from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FolderKanban,
  ArrowLeft,
  ClipboardList,
  Receipt,
  TrendingUp,
  MapPin,
  ShoppingCart,
  Plus,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Plānošana',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  ON_HOLD: 'Apturēts',
  CANCELLED: 'Atcelts',
};

const STATUS_VARIANTS: Record<ProjectStatus, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    PLANNING: 'secondary',
    ACTIVE: 'default',
    COMPLETED: 'outline',
    ON_HOLD: 'destructive',
    CANCELLED: 'destructive',
  };

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [project, setProject] = useState<ConstructionProject | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [budgetLines, setBudgetLines] = useState<ProjectBudgetLine[]>([]);
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [siteForm, setSiteForm] = useState({
    label: '',
    address: '',
    type: 'BOTH' as ProjectSiteType,
  });

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [proj, reps, invs, bLines, projSites] = await Promise.all([
        getConstructionProjectById(id, token),
        getDailyReports(token, { projectId: id, limit: 10 }),
        getClientInvoices(token, { projectId: id }),
        getProjectBudgetLines(id, token),
        getProjectSites(id, token),
      ]);
      setProject(proj);
      setReports(reps.data);
      setInvoices(invs.data);
      setBudgetLines(bLines);
      setSites(projSites);
    } catch {
      router.replace('/dashboard/construction/projects');
    } finally {
      setLoading(false);
    }
  }, [token, id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!project) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateConstructionProject(
        id,
        { status: status as ProjectStatus },
        token,
      );
      setProject(updated);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddSite = async () => {
    if (!siteForm.label || !siteForm.address) return;
    setSavingSite(true);
    try {
      const site = await createProjectSite(id, siteForm, token);
      setSites((prev) => [...prev, site]);
      setAddSiteOpen(false);
      setSiteForm({ label: '', address: '', type: 'BOTH' });
    } finally {
      setSavingSite(false);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    await deleteProjectSite(id, siteId, token);
    setSites((prev) => prev.filter((s) => s.id !== siteId));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!project) return null;

  const totalInvoiced = invoices.reduce((s, inv) => s + inv.amount, 0);
  const totalPaid = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((s, i) => s + (i.paidAmount ?? i.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.siteAddress ?? project.clientName ?? ''}
        icon={FolderKanban}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/catalog?projectId=${id}`)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Pasūtīt materiālus
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Atpakaļ
            </Button>
            <Select
              value={project.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Statuss</p>
            <Badge variant={STATUS_VARIANTS[project.status]}>{STATUS_LABELS[project.status]}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Līguma vērtība</p>
            <p className="font-semibold text-lg">{fmtEur(project.contractValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Izrakstīti rēķini</p>
            <p className="font-semibold text-lg">{fmtEur(totalInvoiced)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Saņemts</p>
            <p className="font-semibold text-lg">{fmtEur(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">
            <ClipboardList className="h-4 w-4 mr-2" />
            Dienas atskaites ({reports.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="h-4 w-4 mr-2" />
            Rēķini ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="budget">
            <TrendingUp className="h-4 w-4 mr-2" />
            Budžets ({budgetLines.length})
          </TabsTrigger>
          <TabsTrigger value="sites">
            <MapPin className="h-4 w-4 mr-2" />
            Vietas ({sites.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Pēdējās dienas atskaites</CardTitle>
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/construction/daily-reports?projectId=${id}`)}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Visas atskaites
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {reports.length === 0 ? (
                <p className="text-muted-foreground text-sm p-6">Nav dienas atskaitīšu.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Datums</th>
                      <th className="text-left p-3 font-medium">Statuss</th>
                      <th className="text-left p-3 font-medium">Rindas</th>
                      <th className="text-right p-3 font-medium">Izmaksas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/dashboard/construction/daily-reports/${r.id}`)}
                      >
                        <td className="p-3">{format(new Date(r.reportDate), 'dd.MM.yyyy')}</td>
                        <td className="p-3">{r.status}</td>
                        <td className="p-3">{r._count?.lines ?? 0}</td>
                        <td className="p-3 text-right font-mono">{fmtEur(r.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Klientu rēķini</CardTitle>
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/construction/invoices?projectId=${id}`)}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Pārvaldīt
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="text-muted-foreground text-sm p-6">Nav rēķinu.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Nr.</th>
                      <th className="text-left p-3 font-medium">Datums</th>
                      <th className="text-left p-3 font-medium">Statuss</th>
                      <th className="text-right p-3 font-medium">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b">
                        <td className="p-3 font-mono">{inv.invoiceNo}</td>
                        <td className="p-3">{format(new Date(inv.issueDate), 'dd.MM.yyyy')}</td>
                        <td className="p-3">{inv.status}</td>
                        <td className="p-3 text-right font-mono">{fmtEur(inv.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Budžeta rindas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {budgetLines.length === 0 ? (
                <p className="text-muted-foreground text-sm p-6">Nav budžeta rindu.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Izmaksu kods</th>
                      <th className="text-right p-3 font-medium">Budžets</th>
                      <th className="text-left p-3 font-medium">Piezīmes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetLines.map((bl) => (
                      <tr key={bl.id} className="border-b">
                        <td className="p-3 font-mono">{bl.costCode}</td>
                        <td className="p-3 text-right font-mono">{fmtEur(bl.budgetAmount)}</td>
                        <td className="p-3 text-muted-foreground">{bl.notes ?? '—'}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="p-3">Kopā</td>
                      <td className="p-3 text-right font-mono">
                        {fmtEur(budgetLines.reduce((s, l) => s + l.budgetAmount, 0))}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Piegādes vietas</CardTitle>
              <Button size="sm" onClick={() => setAddSiteOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Pievienot vietu
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {sites.length === 0 ? (
                <p className="text-muted-foreground text-sm p-6">Nav pievienotu vietu.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Nosaukums</th>
                      <th className="text-left p-3 font-medium">Adrese</th>
                      <th className="text-left p-3 font-medium">Tips</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => (
                      <tr key={site.id} className="border-b">
                        <td className="p-3 font-medium">
                          {site.label}
                          {site.isDefault && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Noklusējuma
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{site.address}</td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {site.type === 'LOADING'
                              ? 'Iekraušana'
                              : site.type === 'UNLOADING'
                                ? 'Izkraušana'
                                : 'Abas'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSite(site.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add site dialog */}
      <Dialog open={addSiteOpen} onOpenChange={setAddSiteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pievienot piegādes vietu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nosaukums *</Label>
              <Input
                value={siteForm.label}
                onChange={(e) => setSiteForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Objekts A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Adrese *</Label>
              <Input
                value={siteForm.address}
                onChange={(e) => setSiteForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Iela 1, Rīga"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tips</Label>
              <Select
                value={siteForm.type}
                onValueChange={(v) => setSiteForm((f) => ({ ...f, type: v as ProjectSiteType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOADING">Iekraušana</SelectItem>
                  <SelectItem value="UNLOADING">Izkraušana</SelectItem>
                  <SelectItem value="BOTH">Abas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSiteOpen(false)}>
              Atcelt
            </Button>
            <Button
              onClick={handleAddSite}
              disabled={savingSite || !siteForm.label || !siteForm.address}
            >
              {savingSite ? 'Saglabā...' : 'Pievienot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
