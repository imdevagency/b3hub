/**
 * B3 Construction — DPR Templates
 * /dashboard/b3-construction/dpr-templates
 *
 * Create recurring daily cost templates. When a foreman opens a new DPR,
 * they pick a template and all lines are pre-populated — no re-typing the
 * same 5-6 rows every day.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Globe,
  FolderKanban,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHelp } from '@/components/ui/page-help';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  adminGetDprTemplates,
  adminCreateDprTemplate,
  adminUpdateDprTemplate,
  adminDeleteDprTemplate,
  adminGetConstructionProjects,
  adminGetRateEntries,
  adminGetEmployees,
  type DprTemplate,
  type CreateDprTemplatePayload,
  type AdminConstructionProject,
  type MaterialRateEntry,
  type ConstructionEmployee,
  CostCode,
  UnitOfMeasure,
} from '@/lib/api/admin';

// ── Cost code labels ──────────────────────────────────────────────────────────
const COST_CODE_LABELS: Record<CostCode, string> = {
  MATERIAL: 'Materiāls',
  TRANSPORT: 'Transports',
  LABOUR: 'Darbaspēks',
  EQUIPMENT: 'Tehnika',
  SUBCONTRACTOR: 'Apakšuzņēmējs',
  OTHER: 'Cits',
};

const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  T: 't',
  M3: 'm³',
  M2: 'm²',
  M: 'm',
  H: 'h',
  DAY: 'diena',
  KM: 'km',
  LOAD: 'reiss',
  PC: 'gab',
};

// ── Empty line factory ────────────────────────────────────────────────────────
interface NewLine {
  costCode: CostCode | '';
  description: string;
  quantity: string;
  unit: UnitOfMeasure | '';
  unitRate: string;
  rateEntryId: string;
  employeeId: string;
  notes: string;
  sortOrder: number;
}

const emptyLine = (idx: number): NewLine => ({
  costCode: '',
  description: '',
  quantity: '1',
  unit: '',
  unitRate: '0',
  rateEntryId: '',
  employeeId: '',
  notes: '',
  sortOrder: idx,
});

// ── Form state ────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  description: string;
  projectId: string;
  lines: NewLine[];
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  projectId: '',
  lines: [emptyLine(0)],
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function DprTemplatesPage() {
  const { token } = useAuth();

  const [templates, setTemplates] = useState<DprTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Ref data for dropdowns
  const [projects, setProjects] = useState<AdminConstructionProject[]>([]);
  const [rateEntries, setRateEntries] = useState<MaterialRateEntry[]>([]);
  const [employees, setEmployees] = useState<ConstructionEmployee[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DprTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<DprTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [tpls, proj, rates, emps] = await Promise.all([
        adminGetDprTemplates(token),
        adminGetConstructionProjects(token, { page: 1, limit: 200 }),
        adminGetRateEntries(token, { limit: 500 }),
        adminGetEmployees(token, { activeOnly: true, limit: 500 }),
      ]);
      setTemplates(tpls);
      setProjects(proj.data ?? []);
      setRateEntries(rates.data ?? []);
      setEmployees(emps.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Toggle expand ───────────────────────────────────────────────────────────
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Dialog helpers ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(tpl: DprTemplate) {
    setEditTarget(tpl);
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      projectId: tpl.projectId ?? '',
      lines: tpl.lines.map((l) => ({
        costCode: l.costCode,
        description: l.description,
        quantity: String(l.quantity),
        unit: l.unit,
        unitRate: String(l.unitRate),
        rateEntryId: l.rateEntryId ?? '',
        employeeId: l.employeeId ?? '',
        notes: l.notes ?? '',
        sortOrder: l.sortOrder,
      })),
    });
    setDialogOpen(true);
  }

  function openDuplicate(tpl: DprTemplate) {
    setEditTarget(null);
    setForm({
      name: `${tpl.name} (kopija)`,
      description: tpl.description ?? '',
      projectId: tpl.projectId ?? '',
      lines: tpl.lines.map((l) => ({
        costCode: l.costCode,
        description: l.description,
        quantity: String(l.quantity),
        unit: l.unit,
        unitRate: String(l.unitRate),
        rateEntryId: l.rateEntryId ?? '',
        employeeId: l.employeeId ?? '',
        notes: l.notes ?? '',
        sortOrder: l.sortOrder,
      })),
    });
    setDialogOpen(true);
  }

  // ── Line helpers ────────────────────────────────────────────────────────────
  function updateLine(idx: number, field: keyof NewLine, value: string | number) {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...prev, lines };
    });
  }

  function onRateEntryChange(idx: number, rateEntryId: string) {
    const entry = rateEntries.find((r) => r.id === rateEntryId);
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[idx] = {
        ...lines[idx],
        rateEntryId,
        unit: entry ? entry.unit : lines[idx].unit,
        unitRate: entry ? String(entry.pricePerUnit) : lines[idx].unitRate,
        description: lines[idx].description || (entry ? entry.name : ''),
      };
      return { ...prev, lines };
    });
  }

  function onEmployeeChange(idx: number, employeeId: string) {
    const emp = employees.find((e) => e.id === employeeId);
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[idx] = {
        ...lines[idx],
        employeeId,
        description: lines[idx].description || (emp ? `${emp.firstName} ${emp.lastName}` : ''),
      };
      return { ...prev, lines };
    });
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine(prev.lines.length)] }));
  }

  function removeLine(idx: number) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }));
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload: CreateDprTemplatePayload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        projectId: form.projectId || undefined,
        lines: form.lines
          .filter((l) => l.costCode && l.description && l.unit)
          .map((l, idx) => ({
            costCode: l.costCode as CostCode,
            description: l.description,
            quantity: parseFloat(l.quantity) || 1,
            unit: l.unit as UnitOfMeasure,
            unitRate: parseFloat(l.unitRate) || 0,
            rateEntryId: l.rateEntryId || undefined,
            employeeId: l.employeeId || undefined,
            notes: l.notes || undefined,
            sortOrder: idx,
          })),
      };

      if (editTarget) {
        await adminUpdateDprTemplate(token, editTarget.id, payload);
      } else {
        await adminCreateDprTemplate(token, payload);
      }
      setDialogOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteDprTemplate(token, deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } finally {
      setDeleting(false);
    }
  }

  // ── Group by project ────────────────────────────────────────────────────────
  const globalTemplates = templates.filter((t) => !t.projectId);
  const projectTemplates = templates.filter((t) => !!t.projectId);
  const projectGroups = new Map<string, DprTemplate[]>();
  for (const t of projectTemplates) {
    const key = t.projectId!;
    if (!projectGroups.has(key)) projectGroups.set(key, []);
    projectGroups.get(key)!.push(t);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="DPR Veidnes"
        description="Ikdienas izmaksu veidnes — formanis izvēlas veidni un visas rindas tiek automātiski aizpildītas"
        action={
          <div className="flex items-center gap-2">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauna veidne
            </Button>
            <PageHelp
              title="DPR Veidnes — standarta dienas konfigurācija"
              sections={[
                {
                  heading: 'Kas ir DPR veidne?',
                  body: 'DPR veidne ir „standarta dienas“ konfigurācija — tipiskais brigādes sastāvs un izmaksu rindas konkrētam objektam. Piemēram: „1 ekskavātors 8h + 2 strādnieki 8h + degaļviela 40L“.',
                },
                {
                  heading: 'Kāpēc to izmantot?',
                  steps: [
                    'Ātrāka DPR aizpildīšana: formanis izvēlas veidni un visi pamatie raksti parādās uzreiz. Maina tikai reālos daudzumus.',
                    'Tāmes kalkulators: projektu Budžeta cilnē var izvēlēties veidni un dienu skaitu — sistēma aprēķina projekta pašizmaksu un maržu.',
                  ],
                  tip: 'Izveidojiet vismaz vienu veidni pirms pirmās DPR — tā ievērojami paātrinās ikdienas darbu.',
                },
                {
                  heading: 'Globālas vs projekta veidnes',
                  body: 'Veidne var būt globāla (pieejama visiem projektiem) vai piesa istīta konkrētam projektam (rāda ✦ simbolu sarakstā). Globālās ir ērtākais sākums.',
                },
                {
                  heading: 'Kā izstrādāt labu veidni?',
                  body: 'Iekļaujiet visas rindas, kas parādās gandrīz katru dienu: galvenie darbinieki, galvenā tehnika, degaļviela. Retāk izmantotos elementus (piem., betonu) pievienojiet manuāli izpildes laikā.',
                },
              ]}
            />
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Ielādē...</p>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nav veidņu"
          description="Izveidojiet pirmo veidni, lai paātrinātu DPR aizpildīšanu"
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauna veidne
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Global templates */}
          {globalTemplates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Globe className="h-4 w-4" />
                Globālās veidnes (pieejamas visiem projektiem)
              </div>
              {globalTemplates.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  tpl={tpl}
                  expanded={expanded.has(tpl.id)}
                  onToggle={() => toggleExpand(tpl.id)}
                  onEdit={() => openEdit(tpl)}
                  onDuplicate={() => openDuplicate(tpl)}
                  onDelete={() => setDeleteTarget(tpl)}
                />
              ))}
            </div>
          )}

          {/* Per-project templates */}
          {projectGroups.size > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FolderKanban className="h-4 w-4" />
                Projektu veidnes
              </div>
              {Array.from(projectGroups.entries()).map(([, tpls]) => (
                <div key={tpls[0].projectId!} className="space-y-3">
                  <p className="text-sm font-medium">
                    {tpls[0].project?.name ?? tpls[0].projectId}
                  </p>
                  {tpls.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
                      expanded={expanded.has(tpl.id)}
                      onToggle={() => toggleExpand(tpl.id)}
                      onEdit={() => openEdit(tpl)}
                      onDuplicate={() => openDuplicate(tpl)}
                      onDelete={() => setDeleteTarget(tpl)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Rediģēt veidni' : 'Jauna veidne'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="flex flex-col gap-1.5">
                <Label>Nosaukums *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Piem. Daugmale — standarta diena"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Projekts (neobligāts)</Label>
                <Select
                  value={form.projectId || 'global'}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, projectId: v === 'global' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Globāla (visi projekti)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Globāla (visi projekti)</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Apraksts</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Piem. Ikdienas ekspluatācija ar 2 strādniekiem"
                />
              </div>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Rindas</p>
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Rinda
                </Button>
              </div>
              <div className="space-y-3">
                {form.lines.map((line, idx) => (
                  <TemplateLineEditor
                    key={idx}
                    idx={idx}
                    line={line}
                    rateEntries={rateEntries}
                    employees={employees}
                    onUpdate={updateLine}
                    onRateEntry={onRateEntryChange}
                    onEmployee={onEmployeeChange}
                    onRemove={() => removeLine(idx)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saglabā...' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dzēst veidni?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Veidne <span className="font-medium text-foreground">"{deleteTarget?.name}"</span> tiks
            deaktivizēta. Esošie DPR netiks ietekmēti.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Dzēš...' : 'Dzēst'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({
  tpl,
  expanded,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  tpl: DprTemplate;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const totalCost = tpl.lines.reduce((s, l) => s + l.quantity * l.unitRate, 0);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 text-left flex-1 min-w-0" onClick={onToggle}>
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <span className="font-medium truncate block">{tpl.name}</span>
              {tpl.description && (
                <span className="text-xs text-muted-foreground truncate block">
                  {tpl.description}
                </span>
              )}
            </div>
          </button>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <Badge variant="secondary">{tpl.lines.length} rindas</Badge>
            <span className="text-sm text-muted-foreground">
              €
              {totalCost.toLocaleString('lv-LV', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onDuplicate}
              title="Dublēt"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pt-0 pb-3">
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Apraksts</th>
                  <th className="text-left px-3 py-2 font-medium">Kategorija</th>
                  <th className="text-right px-3 py-2 font-medium">Daudzums</th>
                  <th className="text-right px-3 py-2 font-medium">Likme</th>
                  <th className="text-right px-3 py-2 font-medium">Summa</th>
                </tr>
              </thead>
              <tbody>
                {tpl.lines.map((line) => (
                  <tr key={line.id} className="border-t">
                    <td className="px-3 py-2">{line.description}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {COST_CODE_LABELS[line.costCode] ?? line.costCode}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {line.quantity} {UNIT_LABELS[line.unit] ?? line.unit}
                    </td>
                    <td className="px-3 py-2 text-right">€{line.unitRate.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      €
                      {(line.quantity * line.unitRate).toLocaleString('lv-LV', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Template line editor ──────────────────────────────────────────────────────
function TemplateLineEditor({
  idx,
  line,
  rateEntries,
  employees,
  onUpdate,
  onRateEntry,
  onEmployee,
  onRemove,
}: {
  idx: number;
  line: {
    costCode: CostCode | '';
    description: string;
    quantity: string;
    unit: UnitOfMeasure | '';
    unitRate: string;
    rateEntryId: string;
    employeeId: string;
    notes: string;
  };
  rateEntries: MaterialRateEntry[];
  employees: ConstructionEmployee[];
  onUpdate: (idx: number, field: keyof NewLine, value: string | number) => void;
  onRateEntry: (idx: number, id: string) => void;
  onEmployee: (idx: number, id: string) => void;
  onRemove: () => void;
}) {
  const isLabour = line.costCode === 'LABOUR';

  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/20">
      <div className="grid grid-cols-12 gap-2">
        {/* Cost code */}
        <div className="col-span-3">
          <Select value={line.costCode || ''} onValueChange={(v) => onUpdate(idx, 'costCode', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Kategorija" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COST_CODE_LABELS) as CostCode[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {COST_CODE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rate entry or employee picker */}
        <div className="col-span-4">
          {isLabour ? (
            <Select
              value={line.employeeId || '__none__'}
              onValueChange={(v) => onEmployee(idx, v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Darbinieks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nav norādīts —</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={line.rateEntryId || '__none__'}
              onValueChange={(v) => onRateEntry(idx, v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="No kataloga..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Manuāli —</SelectItem>
                {rateEntries
                  .filter((r) => !line.costCode || r.category === line.costCode)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Quantity */}
        <div className="col-span-2">
          <Input
            className="h-8 text-xs"
            type="number"
            value={line.quantity}
            onChange={(e) => onUpdate(idx, 'quantity', e.target.value)}
            placeholder="Daudzums"
          />
        </div>

        {/* Unit */}
        <div className="col-span-2">
          <Select value={line.unit || ''} onValueChange={(v) => onUpdate(idx, 'unit', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Vienība" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(UNIT_LABELS) as [UnitOfMeasure, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Remove */}
        <div className="col-span-1 flex items-center justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Description + rate row */}
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-8">
          <Input
            className="h-8 text-xs"
            value={line.description}
            onChange={(e) => onUpdate(idx, 'description', e.target.value)}
            placeholder="Apraksts *"
          />
        </div>
        <div className="col-span-3">
          <Input
            className="h-8 text-xs"
            type="number"
            value={line.unitRate}
            onChange={(e) => onUpdate(idx, 'unitRate', e.target.value)}
            placeholder="Likme €"
          />
        </div>
        <div className="col-span-1 flex items-center justify-end">
          <span className="text-xs text-muted-foreground">
            €{((parseFloat(line.quantity) || 0) * (parseFloat(line.unitRate) || 0)).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
