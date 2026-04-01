/**
 * Project detail page — /dashboard/projects/[id]
 * Shows P&L stat cards, tagged orders, and order assignment panel.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Euro,
  Package,
  Clock,
  CheckCircle2,
  Pencil,
  X,
  Building2,
  Leaf,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageSpinner } from '@/components/ui/page-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmtDate, fmtMoney } from '@/lib/format';
import {
  getProject,
  updateProject,
  assignOrders,
  unassignOrder,
  getMyOrders,
  type ApiProjectDetail,
  type ApiProjectOrder,
  type ProjectStatus,
  type ApiOrder,
} from '@/lib/api';

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_META: Record<
  ProjectStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PLANNING: { label: 'Plānošana', variant: 'outline' },
  ACTIVE: { label: 'Aktīvs', variant: 'default' },
  COMPLETED: { label: 'Pabeigts', variant: 'secondary' },
  ON_HOLD: { label: 'Apturēts', variant: 'destructive' },
};

const ORDER_STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDING: { label: 'Gaida', variant: 'outline' },
  CONFIRMED: { label: 'Apstiprināts', variant: 'default' },
  IN_PROGRESS: { label: 'Procesā', variant: 'default' },
  DELIVERED: { label: 'Piegādāts', variant: 'secondary' },
  COMPLETED: { label: 'Pabeigts', variant: 'secondary' },
  CANCELLED: { label: 'Atcelts', variant: 'destructive' },
  DRAFT: { label: 'Melnraksts', variant: 'outline' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  positive?: boolean;
}) {
  return (
    <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p
              className={`text-2xl font-bold ${
                positive === false
                  ? 'text-destructive'
                  : positive === true
                    ? 'text-emerald-600'
                    : ''
              }`}
            >
              {value}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2.5 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpendBar({
  materialCosts,
  contractValue,
}: {
  materialCosts: number;
  contractValue: number;
}) {
  if (contractValue <= 0) return null;
  const pct = Math.min(100, (materialCosts / contractValue) * 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Materiālu izdevumi</span>
        <span className="font-semibold">{pct.toFixed(1)}% no līguma</span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{fmtMoney(materialCosts)} apstiprināts</span>
        <span>{fmtMoney(contractValue)} kopā</span>
      </div>
    </div>
  );
}

// ─── Edit project sheet ───────────────────────────────────────────────────────

function EditProjectSheet({
  project,
  open,
  onClose,
  onSave,
}: {
  project: ApiProjectDetail;
  open: boolean;
  onClose: () => void;
  onSave: (
    data: Partial<{
      name: string;
      clientName: string;
      siteAddress: string;
      contractValue: number;
      budgetAmount: number;
      startDate: string;
      endDate: string;
      status: ProjectStatus;
    }>,
  ) => Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.clientName ?? '');
  const [siteAddress, setSiteAddress] = useState(project.siteAddress ?? '');
  const [contractValue, setContractValue] = useState(String(project.contractValue));
  const [budgetAmount, setBudgetAmount] = useState(
    project.budgetAmount ? String(project.budgetAmount) : '',
  );
  const [startDate, setStartDate] = useState(
    project.startDate ? project.startDate.slice(0, 10) : '',
  );
  const [endDate, setEndDate] = useState(project.endDate ? project.endDate.slice(0, 10) : '');
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [saving, setSaving] = useState(false);

  const input =
    'mt-1.5 bg-muted/40 border-0 shadow-none h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-[15px]';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name || undefined,
        clientName: clientName || undefined,
        siteAddress: siteAddress || undefined,
        contractValue: contractValue ? parseFloat(contractValue) : undefined,
        budgetAmount: budgetAmount ? parseFloat(budgetAmount) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (!o && !saving ? onClose() : undefined)}>
      <SheetContent className="sm:max-w-lg w-full overflow-hidden p-0 flex flex-col border-l shadow-2xl">
        <div className="px-6 pt-8 pb-4">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold">Rediģēt projektu</SheetTitle>
          </SheetHeader>
        </div>
        <div className="flex-1 px-6 space-y-5 overflow-y-auto pb-32">
          <div>
            <Label className="text-sm font-medium ml-1">Nosaukums</Label>
            <Input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm font-medium ml-1">Statuss</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger className="mt-1.5 bg-muted/40 border-0 h-12 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANNING">Plānošana</SelectItem>
                <SelectItem value="ACTIVE">Aktīvs</SelectItem>
                <SelectItem value="COMPLETED">Pabeigts</SelectItem>
                <SelectItem value="ON_HOLD">Apturēts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium ml-1">Klients</Label>
            <Input
              className={input}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium ml-1">Objekta adrese</Label>
            <Input
              className={input}
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium ml-1">Līguma summa (€)</Label>
              <Input
                className={input}
                type="number"
                min="0"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium ml-1">Budžets (€)</Label>
              <Input
                className={input}
                type="number"
                min="0"
                placeholder="Nav"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium ml-1">Sākums</Label>
              <Input
                type="date"
                className={input}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium ml-1">Beigas</Label>
              <Input
                type="date"
                className={input}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
          <Button
            className="w-full h-12 rounded-xl text-base font-semibold"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Saglabā...' : 'Saglabāt izmaiņas'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Assign orders dialog ─────────────────────────────────────────────────────

function AssignOrdersDialog({
  open,
  onClose,
  token,
  projectId,
  alreadyAssigned,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  projectId: string;
  alreadyAssigned: Set<string>;
  onAssigned: () => void;
}) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getMyOrders(token)
      .then((data) => setOrders(data.filter((o) => !alreadyAssigned.has(o.id))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, token, alreadyAssigned]);

  const filtered = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.deliveryAddress ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await assignOrders(projectId, Array.from(selected), token);
      setSelected(new Set());
      onAssigned();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pievienot pasūtījumus projektam</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Meklēt pēc numura vai adreses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10"
          />
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {orders.length === 0 ? 'Nav nepiešķirtu pasūtījumu' : 'Nekas neatbilst meklēšanai'}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {filtered.map((order) => {
                const isSelected = selected.has(order.id);
                const statusMeta = ORDER_STATUS_LABELS[order.status] ?? {
                  label: order.status,
                  variant: 'outline' as const,
                };
                return (
                  <button
                    key={order.id}
                    onClick={() => toggle(order.id)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-primary/5 border-primary/30'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{order.orderNumber}</span>
                        <Badge
                          variant={statusMeta.variant}
                          className="text-[10px] h-4 px-1.5 rounded-full"
                        >
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {order.deliveryAddress}
                      </p>
                    </div>
                    <span className="text-sm font-bold shrink-0">{fmtMoney(order.total)}</span>
                  </button>
                );
              })}
            </div>
          )}
          <Button
            className="w-full h-11 rounded-xl font-semibold"
            disabled={selected.size === 0 || saving}
            onClick={handleAssign}
          >
            {saving ? 'Pievieno...' : `Pievienot ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onUnassign,
  unassigning,
}: {
  order: ApiProjectOrder;
  onUnassign: (id: string) => void;
  unassigning: boolean;
}) {
  const statusMeta = ORDER_STATUS_LABELS[order.status] ?? {
    label: order.status,
    variant: 'outline' as const,
  };
  const materialNames = order.items
    .map((i) => i.material?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  return (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-muted/30 rounded-xl transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold">{order.orderNumber}</span>
          <Badge variant={statusMeta.variant} className="text-[10px] h-4 px-1.5 rounded-full">
            {statusMeta.label}
          </Badge>
        </div>
        {materialNames && <p className="text-xs text-muted-foreground truncate">{materialNames}</p>}
        <p className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{fmtMoney(order.total)}</p>
      </div>
      <button
        onClick={() => onUnassign(order.id)}
        disabled={unassigning}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
        title="Noņemt no projekta"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [project, setProject] = useState<ApiProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const data = await getProject(id, token);
      setProject(data);
    } catch {
      router.push('/dashboard/projects');
    } finally {
      setLoading(false);
    }
  }, [token, id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEdit = async (data: Parameters<typeof updateProject>[1]) => {
    if (!token || !id) return;
    await updateProject(id, data, token);
    await load();
  };

  const handleUnassign = async (orderId: string) => {
    if (!token || !id) return;
    setUnassigningId(orderId);
    try {
      await unassignOrder(id, orderId, token);
      await load();
    } finally {
      setUnassigningId(null);
    }
  };

  if (loading || !project) return <PageSpinner />;

  const meta = STATUS_META[project.status];
  const alreadyAssigned = new Set(project.orders.map((o) => o.id));
  const isNegativeMargin = project.grossMargin < 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mt-0.5"
          onClick={() => router.push('/dashboard/projects')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={meta.variant} className="text-[10px] h-5 rounded-full px-2.5">
              {meta.label}
            </Badge>
            {project.clientName && (
              <span className="text-sm text-muted-foreground">{project.clientName}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.siteAddress && (
            <p className="text-sm text-muted-foreground mt-0.5">{project.siteAddress}</p>
          )}
          {(project.startDate || project.endDate) && (
            <p className="text-xs text-muted-foreground mt-1">
              {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Rediģēt
        </Button>
      </div>

      {/* P&L stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Līguma vērtība" value={fmtMoney(project.contractValue)} icon={Euro} />
        <StatCard
          label="Materiālu izmaksas"
          value={fmtMoney(project.materialCosts)}
          icon={Package}
        />
        <StatCard
          label="Bruto peļņa"
          value={fmtMoney(project.grossMargin)}
          icon={isNegativeMargin ? TrendingDown : TrendingUp}
          positive={!isNegativeMargin}
        />
        <StatCard label="Pasūtījumi" value={String(project.orderCount)} icon={CheckCircle2} />
        {project.co2Tonnes > 0 && (
          <StatCard label="CO₂ emisijas" value={`${project.co2Tonnes}t`} icon={Leaf} />
        )}
      </div>

      {/* Spend progress */}
      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
        <CardContent className="p-5">
          <SpendBar materialCosts={project.materialCosts} contractValue={project.contractValue} />
          {project.pendingCosts > 0 && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {fmtMoney(project.pendingCosts)} gaidīšanas izdevumi vēl nav apstiprināti
            </p>
          )}
          {project.budgetAmount && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
              Budžets:{' '}
              <span className="font-semibold text-foreground">
                {fmtMoney(project.budgetAmount)}
              </span>
              {project.budgetUsedPct !== null && <span>({project.budgetUsedPct}% izmantots)</span>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Orders section */}
      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Projekta pasūtījumi</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              + Pievienot
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {project.orders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nav pasūtījumu"
              description="Pievienojiet esošos pasūtījumus, lai izsekotu izmaksas"
              action={
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  + Pievienot pasūtījumus
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/50">
              {project.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onUnassign={handleUnassign}
                  unassigning={unassigningId === order.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheets / Dialogs */}
      {editOpen && (
        <EditProjectSheet
          project={project}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={handleEdit}
        />
      )}

      {token && (
        <AssignOrdersDialog
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          token={token}
          projectId={id}
          alreadyAssigned={alreadyAssigned}
          onAssigned={load}
        />
      )}
    </div>
  );
}
