/**
 * B3 Construction — Daily Production Reports
 * /dashboard/b3-construction/daily-reports
 *
 * Log and review daily site reports across all construction projects.
 * Each report has line items by cost code (Labour, Equipment, Material, etc.)
 * with quantities and unit rates that auto-calculate totals.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Eye, Trash2, Search, ChevronDown, X, LayoutTemplate } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  adminGetDailyReports,
  adminGetDailyReportById,
  adminCreateDailyReport,
  adminUpdateDailyReport,
  adminDeleteDailyReport,
  adminGetRateEntries,
  adminGetConstructionProjects,
  adminGetEmployees,
  adminGetDprTemplates,
  type DprTemplate,
  type DailyReport,
  type DailyReportLine,
  type DailyReportStatus,
  type MaterialRateEntry,
  type AdminConstructionProject,
  type CostCode,
  type CreateDailyReportPayload,
  type UnitOfMeasure,
  type ConstructionEmployee,
} from '@/lib/api/admin';

const COST_CODES: CostCode[] = [
  'LABOUR',
  'EQUIPMENT',
  'MATERIAL',
  'TRANSPORT',
  'SUBCONTRACTOR',
  'OTHER',
];
const COST_CODE_LABELS: Record<CostCode, string> = {
  LABOUR: 'Darbs',
  EQUIPMENT: 'Tehnika',
  MATERIAL: 'Materiāls',
  TRANSPORT: 'Transports',
  SUBCONTRACTOR: 'Apakšuzņēmējs',
  OTHER: 'Cits',
};

const UNITS: UnitOfMeasure[] = ['T', 'M3', 'M2', 'M', 'H', 'DAY', 'KM', 'LOAD', 'PC'];
const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  T: 't',
  M3: 'm³',
  M2: 'm²',
  M: 'm',
  H: 'h',
  DAY: 'diena',
  KM: 'km',
  LOAD: 'kravas',
  PC: 'gab.',
};

const STATUS_LABELS: Record<DailyReportStatus, string> = {
  DRAFT: 'Melnraksts',
  SUBMITTED: 'Iesniegts',
  APPROVED: 'Apstiprināts',
};
const STATUS_COLORS: Record<DailyReportStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
};

type NewLine = {
  costCode: CostCode;
  description: string;
  personName: string;
  quantity: number;
  unit: UnitOfMeasure;
  unitRate: number;
  rateEntryId: string;
  employeeId: string;
  notes: string;
};

const EMPTY_LINE: NewLine = {
  costCode: 'LABOUR',
  description: '',
  personName: '',
  quantity: 1,
  unit: 'H',
  unitRate: 0,
  rateEntryId: '',
  employeeId: '',
  notes: '',
};

export default function DailyReportsPage() {
  const { token } = useAuth();

  // List state
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // Reference data
  const [projects, setProjects] = useState<AdminConstructionProject[]>([]);
  const [rateEntries, setRateEntries] = useState<MaterialRateEntry[]>([]);
  const [employees, setEmployees] = useState<ConstructionEmployee[]>([]);
  const [templates, setTemplates] = useState<DprTemplate[]>([]);

  // Detail view
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailReport, setDetailReport] = useState<DailyReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState('');
  const [createDate, setCreateDate] = useState(new Date().toISOString().slice(0, 10));
  const [createSiteLabel, setCreateSiteLabel] = useState('');
  const [createWeather, setCreateWeather] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createLines, setCreateLines] = useState<NewLine[]>([{ ...EMPTY_LINE }]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Status update
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetDailyReports(token, {
        projectId: filterProject || undefined,
        status: filterStatus || undefined,
        limit: 200,
      });
      setReports(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token, filterProject, filterStatus]);

  const loadRefData = useCallback(async () => {
    if (!token) return;
    try {
      const [projRes, ratesRes, empRes, tplRes] = await Promise.all([
        adminGetConstructionProjects(token, { limit: 200 }),
        adminGetRateEntries(token, { limit: 500 }),
        adminGetEmployees(token, { activeOnly: true, limit: 500 }),
        adminGetDprTemplates(token),
      ]);
      setProjects(projRes.data);
      setRateEntries(ratesRes.data);
      setEmployees(empRes.data);
      setTemplates(tplRes);
    } catch {
      // non-fatal
    }
  }, [token]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    loadRefData();
  }, [loadRefData]);

  async function openDetail(id: string) {
    if (!token) return;
    setDetailId(id);
    setDetailReport(null);
    setDetailLoading(true);
    try {
      const r = await adminGetDailyReportById(id, token);
      setDetailReport(r);
    } catch {
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreate() {
    if (!token) return;
    if (!createProjectId) {
      setCreateError('Izvēlieties projektu');
      return;
    }
    if (createLines.some((l) => !l.description.trim())) {
      setCreateError('Visām rindām jābūt aprakstam');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: CreateDailyReportPayload = {
        projectId: createProjectId,
        reportDate: createDate,
        siteLabel: createSiteLabel || undefined,
        weatherNote: createWeather || undefined,
        notes: createNotes || undefined,
        lines: createLines.map((l) => ({
          costCode: l.costCode,
          description: l.description,
          personName: l.personName || undefined,
          quantity: l.quantity,
          unit: l.unit,
          unitRate: l.unitRate,
          rateEntryId: l.rateEntryId || undefined,
          employeeId: l.employeeId || undefined,
          notes: l.notes || undefined,
        })),
      };
      await adminCreateDailyReport(payload, token);
      setCreateOpen(false);
      resetCreateForm();
      await loadReports();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Kļūda saglabājot');
    } finally {
      setCreating(false);
    }
  }

  function resetCreateForm() {
    setCreateProjectId('');
    setCreateDate(new Date().toISOString().slice(0, 10));
    setCreateSiteLabel('');
    setCreateWeather('');
    setCreateNotes('');
    setCreateLines([{ ...EMPTY_LINE }]);
    setCreateError(null);
  }

  async function handleStatusUpdate(id: string, status: DailyReportStatus) {
    if (!token) return;
    setStatusUpdating(id);
    try {
      await adminUpdateDailyReport(id, { status }, token);
      await loadReports();
      if (detailReport?.id === id) {
        await openDetail(id);
      }
    } catch {
      // ignore
    } finally {
      setStatusUpdating(null);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeleting(true);
    try {
      await adminDeleteDailyReport(id, token);
      setDeleteId(null);
      if (detailId === id) setDetailId(null);
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dzēšanas kļūda');
    } finally {
      setDeleting(false);
    }
  }

  function updateLine(idx: number, patch: Partial<NewLine>) {
    setCreateLines((lines) => lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setCreateLines((lines) => [...lines, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    setCreateLines((lines) => lines.filter((_, i) => i !== idx));
  }

  function applyTemplate(tpl: DprTemplate) {
    if (tpl.lines.length === 0) return;
    setCreateLines(
      tpl.lines.map((l) => ({
        costCode: l.costCode,
        description: l.description,
        personName: l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : '',
        quantity: l.quantity,
        unit: l.unit,
        unitRate: l.unitRate,
        rateEntryId: l.rateEntryId ?? '',
        employeeId: l.employeeId ?? '',
        notes: l.notes ?? '',
      })),
    );
  }

  const lineTotal = (l: NewLine) => (l.quantity * l.unitRate).toFixed(2);

  const filtered = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.project?.name ?? '').toLowerCase().includes(q) ||
      (r.siteLabel ?? '').toLowerCase().includes(q) ||
      new Date(r.reportDate).toLocaleDateString('lv-LV').includes(q)
    );
  });

  const reportTotalCost = (lines: DailyReportLine[]) =>
    lines.reduce((s, l) => s + Number(l.total), 0).toFixed(2);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dienas atskaites"
        description={`${total} atskaites — ikdienas izmaksu uzskaite pa projektiem`}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Meklēt pēc projekta, objekta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1">
              {filterProject
                ? (projects.find((p) => p.id === filterProject)?.name ?? 'Projekts')
                : 'Visi projekti'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterProject('')}>Visi projekti</DropdownMenuItem>
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setFilterProject(p.id)}>
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1">
              {filterStatus ? STATUS_LABELS[filterStatus as DailyReportStatus] : 'Visi statusi'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterStatus('')}>Visi statusi</DropdownMenuItem>
            {(['DRAFT', 'SUBMITTED', 'APPROVED'] as DailyReportStatus[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setFilterStatus(s)}>
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={() => setCreateOpen(true)} className="gap-1 ml-auto">
          <Plus className="h-4 w-4" /> Jauna atskaite
        </Button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datums</TableHead>
              <TableHead>Projekts</TableHead>
              <TableHead>Objekts</TableHead>
              <TableHead>Rindas</TableHead>
              <TableHead className="text-right">Kopsumma</TableHead>
              <TableHead>Statuss</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-gray-500">
                  Ielādē…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-gray-500">
                  Nav atskaišu
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.reportDate).toLocaleDateString('lv-LV')}</TableCell>
                  <TableCell>{r.project?.name ?? '—'}</TableCell>
                  <TableCell>{r.siteLabel ?? '—'}</TableCell>
                  <TableCell>{r._count?.lines ?? 0}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.totalCost != null ? `€${Number(r.totalCost).toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[r.status]
                      }`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(r.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {r.status === 'DRAFT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) resetCreateForm();
          setCreateOpen(o);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Jauna dienas atskaite</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {createError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projekts *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createProjectId}
                  onChange={(e) => setCreateProjectId(e.target.value)}
                >
                  <option value="">Izvēlieties projektu…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Datums *</Label>
                <Input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Objekts / būvlaukums</Label>
                <Input
                  value={createSiteLabel}
                  onChange={(e) => setCreateSiteLabel(e.target.value)}
                  placeholder="Objekta nosaukums"
                />
              </div>

              <div>
                <Label>Laika apstākļi</Label>
                <Input
                  value={createWeather}
                  onChange={(e) => setCreateWeather(e.target.value)}
                  placeholder="Sauss, +18°C"
                />
              </div>

              <div className="col-span-2">
                <Label>Piezīmes</Label>
                <Input
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder="Vispārīgas atskaites piezīmes…"
                />
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Izmaksu rindas</Label>
                <div className="flex items-center gap-2">
                  {templates.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <LayoutTemplate className="h-3.5 w-3.5" /> Veidne
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {templates
                          .filter((t) => !t.projectId || t.projectId === createProjectId)
                          .map((t) => (
                            <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)}>
                              {t.name}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Pievienot
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {createLines.map((line, idx) => (
                  <div key={idx} className="rounded-md border p-3 bg-gray-50 relative">
                    {createLines.length > 1 && (
                      <button
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        onClick={() => removeLine(idx)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Izmaksu kods</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                          value={line.costCode}
                          onChange={(e) =>
                            updateLine(idx, { costCode: e.target.value as CostCode })
                          }
                        >
                          {COST_CODES.map((c) => (
                            <option key={c} value={c}>
                              {COST_CODE_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Apraksts *</Label>
                        <Input
                          className="h-9"
                          value={line.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                          placeholder="Ko darīja / kas piegādāts"
                        />
                      </div>
                      {line.costCode === 'LABOUR' && employees.length > 0 ? (
                        <div>
                          <Label className="text-xs">Darbinieks</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            value={line.employeeId}
                            onChange={(e) => {
                              const emp = employees.find((em) => em.id === e.target.value);
                              const patch: Partial<NewLine> = { employeeId: e.target.value };
                              if (emp) {
                                patch.personName = `${emp.firstName} ${emp.lastName}`;
                                if (!line.description) patch.description = emp.role;
                                if (emp.defaultRateEntry) {
                                  patch.rateEntryId = emp.defaultRateEntry.id;
                                  patch.unit = emp.defaultRateEntry.unit;
                                  patch.unitRate = emp.defaultRateEntry.pricePerUnit;
                                }
                              } else {
                                patch.personName = '';
                              }
                              updateLine(idx, patch);
                            }}
                          >
                            <option value="">— izvēlieties darbinieku —</option>
                            {employees.map((em) => (
                              <option key={em.id} value={em.id}>
                                {em.firstName} {em.lastName} ({em.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <Label className="text-xs">Persona / resurss</Label>
                          <Input
                            className="h-9"
                            value={line.personName}
                            onChange={(e) => updateLine(idx, { personName: e.target.value })}
                            placeholder="Vārds uzvārds vai ID"
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Cenu katalogs</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                          value={line.rateEntryId}
                          onChange={(e) => {
                            const rate = rateEntries.find((r) => r.id === e.target.value);
                            updateLine(idx, {
                              rateEntryId: e.target.value,
                              ...(rate ? { unit: rate.unit, unitRate: rate.pricePerUnit } : {}),
                            });
                          }}
                        >
                          <option value="">— manuāli —</option>
                          {rateEntries.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({UNIT_LABELS[r.unit]}) — €
                              {Number(r.pricePerUnit).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Piezīmes</Label>
                        <Input
                          className="h-9"
                          value={line.notes}
                          onChange={(e) => updateLine(idx, { notes: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Daudzums</Label>
                        <Input
                          className="h-9"
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Mērvienība</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          value={line.unit}
                          onChange={(e) =>
                            updateLine(idx, { unit: e.target.value as UnitOfMeasure })
                          }
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {UNIT_LABELS[u]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Vienības cena (€)</Label>
                        <Input
                          className="h-9"
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.unitRate}
                          onChange={(e) =>
                            updateLine(idx, { unitRate: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-right text-sm font-semibold text-gray-700">
                      Kopsumma: €{lineTotal(line)}
                    </div>
                  </div>
                ))}
              </div>

              {createLines.length > 0 && (
                <div className="mt-3 text-right text-base font-bold">
                  Kopā: €{createLines.reduce((s, l) => s + l.quantity * l.unitRate, 0).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetCreateForm();
                setCreateOpen(false);
              }}
            >
              Atcelt
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Saglabā…' : 'Izveidot atskaiti'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dienas atskaite</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Ielādē…</div>
          ) : detailReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Projekts</span>
                  <div className="font-medium">{detailReport.project?.name ?? '—'}</div>
                </div>
                <div>
                  <span className="text-gray-500">Datums</span>
                  <div className="font-medium">
                    {new Date(detailReport.reportDate).toLocaleDateString('lv-LV')}
                  </div>
                </div>
                {detailReport.siteLabel && (
                  <div>
                    <span className="text-gray-500">Objekts</span>
                    <div className="font-medium">{detailReport.siteLabel}</div>
                  </div>
                )}
                {detailReport.weatherNote && (
                  <div>
                    <span className="text-gray-500">Laiks</span>
                    <div className="font-medium">{detailReport.weatherNote}</div>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Statuss</span>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailReport.status]}`}
                    >
                      {STATUS_LABELS[detailReport.status]}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Autors</span>
                  <div className="font-medium">
                    {detailReport.createdBy
                      ? `${detailReport.createdBy.firstName} ${detailReport.createdBy.lastName}`
                      : '—'}
                  </div>
                </div>
              </div>

              {detailReport.notes && (
                <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">{detailReport.notes}</div>
              )}

              {/* Lines table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kods</TableHead>
                      <TableHead>Apraksts</TableHead>
                      <TableHead>Daudzums</TableHead>
                      <TableHead>Mērvienība</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead className="text-right">Kopsumma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailReport.lines ?? []).map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <span className="text-xs font-medium">
                            {COST_CODE_LABELS[line.costCode]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>{line.description}</div>
                          {line.personName && (
                            <div className="text-xs text-gray-400">{line.personName}</div>
                          )}
                          {line.rateEntry && (
                            <div className="text-xs text-blue-600">{line.rateEntry.name}</div>
                          )}
                        </TableCell>
                        <TableCell>{Number(line.quantity)}</TableCell>
                        <TableCell>{UNIT_LABELS[line.unit] ?? line.unit}</TableCell>
                        <TableCell className="text-right font-mono">
                          €{Number(line.unitRate).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          €{Number(line.total).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {detailReport.lines && (
                <div className="text-right text-lg font-bold">
                  Kopā: €{reportTotalCost(detailReport.lines)}
                </div>
              )}

              {/* Status actions */}
              <div className="flex gap-2 justify-end pt-2 border-t">
                {detailReport.status === 'DRAFT' && (
                  <Button
                    variant="outline"
                    disabled={statusUpdating === detailReport.id}
                    onClick={() => handleStatusUpdate(detailReport.id, 'SUBMITTED')}
                  >
                    Iesniegt
                  </Button>
                )}
                {detailReport.status === 'SUBMITTED' && (
                  <Button
                    disabled={statusUpdating === detailReport.id}
                    onClick={() => handleStatusUpdate(detailReport.id, 'APPROVED')}
                  >
                    Apstiprināt
                  </Button>
                )}
                {detailReport.status === 'DRAFT' && (
                  <Button
                    variant="destructive"
                    disabled={statusUpdating === detailReport.id}
                    onClick={() => {
                      setDeleteId(detailReport.id);
                      setDetailId(null);
                    }}
                  >
                    Dzēst
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst atskaiti?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Var dzēst tikai melnraksta statusā esošas atskaites. Darbība ir neatgriezeniska.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {deleting ? 'Dzēš…' : 'Dzēst'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
