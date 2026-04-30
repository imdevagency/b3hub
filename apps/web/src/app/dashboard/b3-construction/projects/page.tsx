/**
 * B3 Construction — Projekti (Projects list)
 * /dashboard/b3-construction/projects
 *
 * Platform-wide view of all construction projects.
 * Admins can filter by status, click through to project detail,
 * and create new projects on behalf of companies.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetConstructionProjects,
  adminCreateConstructionProject,
  adminGetConstructionClients,
  type AdminConstructionProject,
  type AdminConstructionClient,
  type ConstructionProjectStatus,
  type CreateConstructionProjectPayload,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { FolderKanban, RefreshCw, TrendingUp, Euro, Plus } from 'lucide-react';
import { format } from 'date-fns';

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

function formatEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function MarginBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = pct >= 20 ? 'bg-green-500' : pct >= 5 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Row skeleton ──────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Create Project Dialog ────────────────────────────────────────────────────

function CreateProjectDialog({
  open,
  onClose,
  companies,
  token,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  companies: AdminConstructionClient[];
  token: string;
  onCreated: (project: AdminConstructionProject) => void;
}) {
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [clientName, setClientName] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [startDate, setStartDate] = useState('');
  const [status, setStatus] = useState<ConstructionProjectStatus>('PLANNING');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim() && companyId && contractValue && parseFloat(contractValue) > 0;

  const reset = () => {
    setName('');
    setCompanyId('');
    setClientName('');
    setContractValue('');
    setBudgetAmount('');
    setSiteAddress('');
    setStartDate('');
    setStatus('PLANNING');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      const payload: CreateConstructionProjectPayload = {
        name: name.trim(),
        companyId,
        contractValue: parseFloat(contractValue),
        clientName: clientName.trim() || undefined,
        siteAddress: siteAddress.trim() || undefined,
        budgetAmount: budgetAmount ? parseFloat(budgetAmount) : undefined,
        startDate: startDate || undefined,
        status,
      };
      const created = await adminCreateConstructionProject(payload, token);
      // Build a minimal AdminConstructionProject shape so the list can show it immediately
      onCreated({
        id: created.id,
        name: created.name,
        status: created.status,
        contractValue: created.contractValue,
        clientName: clientName.trim() || undefined,
        siteAddress: siteAddress.trim() || undefined,
        materialCosts: 0,
        marginPct: 100,
        orderCount: 0,
        startDate: startDate || undefined,
        company: companies.find((c) => c.id === companyId) ?? { id: companyId, name: '' },
        createdAt: created.createdAt,
      } as AdminConstructionProject);
      reset();
      onClose();
    } catch {
      setError('Neizdevās izveidot projektu. Pārbaudiet ievadītos datus.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Jauns projekts</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>
              Projekta nosaukums <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="piem. Rīgas centrs — pazemes stāvvieta"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>
              Uzņēmums (pasūtītājs) <span className="text-destructive">*</span>
            </Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Izvēlieties uzņēmumu" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.city ? ` — ${c.city}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Galaklients (beiguzņēmuma klients)</Label>
            <Input
              placeholder="piem. SIA Rīgas Nami"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>
                Līguma summa (€) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Materiālu budžets (€)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Objekta adrese</Label>
            <Input
              placeholder="piem. Brīvības iela 40, Rīga"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Sākuma datums</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Statuss</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ConstructionProjectStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNING">Plānošana</SelectItem>
                  <SelectItem value="ACTIVE">Aktīvs</SelectItem>
                  <SelectItem value="ON_HOLD">Apturēts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving ? 'Izveido...' : 'Izveidot projektu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ConstructionProjectsPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<AdminConstructionProject[]>([]);
  const [companies, setCompanies] = useState<AdminConstructionClient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [res, companyList] = await Promise.all([
        adminGetConstructionProjects(token, {
          limit: 100,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        }),
        adminGetConstructionClients(token),
      ]);
      setProjects(res.data);
      setTotal(res.total);
      setCompanies(companyList);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleProjectCreated = (project: AdminConstructionProject) => {
    setProjects((prev) => [project, ...prev]);
    setTotal((prev) => prev + 1);
  };

  // Summary stats
  const totalContractValue = projects.reduce((s, p) => s + p.contractValue, 0);
  const totalMaterialCosts = projects.reduce((s, p) => s + p.materialCosts, 0);
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projekti"
        description={`${total} projekti kopā`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauns projekts
            </Button>
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                <FolderKanban className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aktīvie projekti</p>
                <p className="text-2xl font-semibold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <Euro className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kopējā līgumu vērtība</p>
                <p className="text-2xl font-semibold">{formatEur(totalContractValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Materiālu izmaksas</p>
                <p className="text-2xl font-semibold">{formatEur(totalMaterialCosts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi statusi</SelectItem>
            <SelectItem value="PLANNING">Plānošana</SelectItem>
            <SelectItem value="ACTIVE">Aktīvs</SelectItem>
            <SelectItem value="ON_HOLD">Apturēts</SelectItem>
            <SelectItem value="COMPLETED">Pabeigts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekts</TableHead>
                <TableHead>Klients</TableHead>
                <TableHead>Uzņēmums</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">Līg. vērtība</TableHead>
                <TableHead className="text-right">Materiāli</TableHead>
                <TableHead>Peļņas robeža</TableHead>
                <TableHead>Sākums</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12">
                    <EmptyState
                      icon={FolderKanban}
                      title="Nav projektu"
                      description="Projekti parādīsies šeit, kad uzņēmumi tos izveidos"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/b3-construction/projects/${p.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.siteAddress && (
                        <div className="text-xs text-muted-foreground">{p.siteAddress}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.clientName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{p.company.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(p.contractValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(p.materialCosts)}
                    </TableCell>
                    <TableCell>
                      <MarginBar pct={p.marginPct} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.startDate ? format(new Date(p.startDate), 'dd.MM.yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {token && (
        <CreateProjectDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          companies={companies}
          token={token}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
