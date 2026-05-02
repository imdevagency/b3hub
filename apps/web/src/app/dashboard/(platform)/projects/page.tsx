/**
 * Projects list page — /dashboard/projects
 * Construction project management: create projects, track material spend vs. contract value.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Building2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageSpinner } from '@/components/ui/page-spinner';
import { fmtDate, fmtMoney } from '@/lib/format';
import { getProjects, createProject, type ApiProject, type ProjectStatus } from '@/lib/api';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ProjectStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PLANNING: { label: 'Plānošana', variant: 'outline' },
  ACTIVE: { label: 'Aktīvs', variant: 'default' },
  COMPLETED: { label: 'Pabeigts', variant: 'secondary' },
  ON_HOLD: { label: 'Apturēts', variant: 'destructive' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MarginBar({
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
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ProjectCard({ project }: { project: ApiProject }) {
  const meta = STATUS_META[project.status];
  const spendPct =
    project.contractValue > 0
      ? Math.min(100, (project.materialCosts / project.contractValue) * 100)
      : 0;

  return (
    <Link href={`/dashboard/projects/${project.id}`}>
      <Card className="group cursor-pointer rounded-2xl border-0 shadow-sm ring-1 ring-black/5 hover:ring-black/10 hover:shadow-md transition-all bg-white hover:bg-slate-50/50 h-full">
        <CardContent className="p-5 flex flex-col h-full justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                {project.clientName && (
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                    {project.clientName}
                  </p>
                )}
                <p className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {project.name}
                </p>
                {project.siteAddress && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {project.siteAddress}
                  </p>
                )}
              </div>
              <Badge
                variant={meta.variant}
                className="text-[10px] h-5 rounded-full px-2.5 font-medium shrink-0"
              >
                {meta.label}
              </Badge>
            </div>

            {/* P&L summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">
                  Līguma vērtība
                </p>
                <p className="text-sm font-bold">{fmtMoney(project.contractValue)}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">
                  Bruto peļņa
                </p>
                <p
                  className={`text-sm font-bold ${project.grossMargin < 0 ? 'text-destructive' : 'text-emerald-600'}`}
                >
                  {fmtMoney(project.grossMargin)}
                </p>
              </div>
            </div>

            {/* Spend progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Izdevumi</span>
                <span className="font-semibold text-foreground">{spendPct.toFixed(0)}%</span>
              </div>
              <MarginBar
                materialCosts={project.materialCosts}
                contractValue={project.contractValue}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{fmtMoney(project.materialCosts)} apstiprināts</span>
                <span>{project.orderCount} pasūtījumi</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-slate-50/80 -mx-5 -mb-5 px-5 py-3 mt-4 border-t border-black/5">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 opacity-70" />
              {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
            </span>
            {project.marginPct !== null && (
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 opacity-70" />
                {project.marginPct.toFixed(1)}% peļņa
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Create project sheet ─────────────────────────────────────────────────────

interface CreateProjectSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    clientName: string;
    siteAddress: string;
    contractValue: string;
    budgetAmount: string;
    startDate: string;
    endDate: string;
    description: string;
  }) => Promise<void>;
}

function CreateProjectSheet({ open, onClose, onCreate }: CreateProjectSheetProps) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setClientName('');
    setSiteAddress('');
    setContractValue('');
    setBudgetAmount('');
    setStartDate('');
    setEndDate('');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!name.trim() || !contractValue) return;
    setSaving(true);
    try {
      await onCreate({
        name,
        clientName,
        siteAddress,
        contractValue,
        budgetAmount,
        startDate,
        endDate,
        description,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const input =
    'mt-1.5 bg-muted/40 border-0 shadow-none h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-[15px] transition-colors';

  return (
    <Sheet open={open} onOpenChange={(o) => (!o && !saving ? onClose() : undefined)}>
      <SheetContent className="sm:max-w-lg w-full overflow-hidden p-0 flex flex-col border-l shadow-2xl">
        <div className="px-6 pt-8 pb-4">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold tracking-tight">Jauns projekts</SheetTitle>
            <p className="text-[15px] text-muted-foreground leading-relaxed pt-1">
              Iestatiet līguma vērtību un sekojiet materiālu izdevumiem.
            </p>
          </SheetHeader>
        </div>

        <div className="flex-1 px-6 space-y-5 overflow-y-auto pb-32">
          <div>
            <Label className="text-sm font-medium ml-1">Projekta nosaukums *</Label>
            <Input
              className={input}
              placeholder="piem. Dzīvojamā ēka Rīgā"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium ml-1">Klients</Label>
            <Input
              className={input}
              placeholder="Klienta vai pasūtītāja nosaukums"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm font-medium ml-1">Objekt adrese</Label>
            <Input
              className={input}
              placeholder="Celtniecības objekta adrese"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium ml-1">Līguma summa (€) *</Label>
              <Input
                className={input}
                type="number"
                min="0"
                placeholder="0"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium ml-1">Materiālu budžets (€)</Label>
              <Input
                className={input}
                type="number"
                min="0"
                placeholder="Nav noteikts"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium ml-1">Sākuma datums</Label>
              <Input
                type="date"
                className={input}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium ml-1">Beigu datums</Label>
              <Input
                type="date"
                className={input}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium ml-1">Apraksts</Label>
            <Textarea
              className="mt-1.5 bg-muted/40 border-0 shadow-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 p-4 text-[15px] min-h-20 resize-none"
              placeholder="Papildu informācija..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
          <Button
            className="w-full h-12 rounded-xl text-base font-semibold"
            disabled={!name.trim() || !contractValue || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Saglabā...' : 'Izveidot projektu'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getProjects(token);
      setProjects(data);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (form: {
    name: string;
    clientName: string;
    siteAddress: string;
    contractValue: string;
    budgetAmount: string;
    startDate: string;
    endDate: string;
    description: string;
  }) => {
    if (!token) return;
    await createProject(
      {
        name: form.name,
        clientName: form.clientName || undefined,
        siteAddress: form.siteAddress || undefined,
        contractValue: parseFloat(form.contractValue),
        budgetAmount: form.budgetAmount ? parseFloat(form.budgetAmount) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        description: form.description || undefined,
      },
      token,
    );
    await load();
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projekti"
        description="Izsekojiet materiālu izmaksas salīdzinājumā ar līguma vērtību"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Jauns projekts
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nav projektu"
          description="Izveidojiet pirmo projektu, lai izsekotu materiālu izmaksas un peļņu"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Jauns projekts
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <CreateProjectSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
