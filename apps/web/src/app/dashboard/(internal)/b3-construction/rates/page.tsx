/**
 * B3 Construction — Rate Library
 * /dashboard/b3-construction/rates
 *
 * Admin-managed price catalogue for materials, labour, transport, and equipment.
 * Used as the reference for costing daily production reports and project budgets.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronDown } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';
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
  adminGetRateEntries,
  adminCreateRateEntry,
  adminUpdateRateEntry,
  adminDeleteRateEntry,
  type MaterialRateEntry,
  type CreateRateEntryPayload,
  type RateCategory,
  type UnitOfMeasure,
} from '@/lib/api/admin';

const CATEGORIES: RateCategory[] = [
  'MATERIAL',
  'TRANSPORT',
  'LABOUR',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'OTHER',
];

const CATEGORY_LABELS: Record<RateCategory, string> = {
  MATERIAL: 'Materiāls',
  TRANSPORT: 'Transports',
  LABOUR: 'Darbs',
  EQUIPMENT: 'Tehnika',
  SUBCONTRACTOR: 'Apakšuzņēmējs',
  OTHER: 'Cits',
};

const CATEGORY_COLORS: Record<RateCategory, string> = {
  MATERIAL: 'bg-blue-100 text-blue-800',
  TRANSPORT: 'bg-orange-100 text-orange-800',
  LABOUR: 'bg-green-100 text-green-800',
  EQUIPMENT: 'bg-yellow-100 text-yellow-800',
  SUBCONTRACTOR: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

const UNITS: UnitOfMeasure[] = ['T', 'M3', 'M2', 'M', 'H', 'DAY', 'KM', 'LOAD', 'PC'];

const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  T: 't (tonna)',
  M3: 'm³ (kubikmetrs)',
  M2: 'm² (kvadrātmetrs)',
  M: 'm (lineārmetrs)',
  H: 'h (stunda)',
  DAY: 'diena',
  KM: 'km (kilometrs)',
  LOAD: 'kravas (load)',
  PC: 'gab. (vienība)',
};

const EMPTY_FORM: CreateRateEntryPayload = {
  name: '',
  unit: 'M3',
  category: 'MATERIAL',
  supplierName: '',
  supplierNote: '',
  pricePerUnit: 0,
  deliveryFee: 0,
  selfCostPerUnit: undefined,
  densityCoeff: undefined,
  truckConfig: '',
  zone: '',
  notes: '',
};

export default function RatesPage() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<MaterialRateEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<RateCategory | ''>('');
  const [activeOnly, setActiveOnly] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<MaterialRateEntry | null>(null);
  const [form, setForm] = useState<CreateRateEntryPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetRateEntries(token, {
        category: filterCategory || undefined,
        activeOnly,
        limit: 500,
      });
      setEntries(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token, filterCategory, activeOnly]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  function openCreate() {
    setEditEntry(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(entry: MaterialRateEntry) {
    setEditEntry(entry);
    setForm({
      name: entry.name,
      unit: entry.unit,
      category: entry.category,
      supplierName: entry.supplierName,
      supplierNote: entry.supplierNote ?? '',
      pricePerUnit: entry.pricePerUnit,
      deliveryFee: entry.deliveryFee,
      selfCostPerUnit: entry.selfCostPerUnit ?? undefined,
      densityCoeff: entry.densityCoeff ?? undefined,
      truckConfig: entry.truckConfig ?? '',
      zone: entry.zone ?? '',
      notes: entry.notes ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    if (!form.name.trim() || !form.supplierName.trim()) {
      setFormError('Nosaukums un piegādātājs ir obligāti.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editEntry) {
        await adminUpdateRateEntry(editEntry.id, form, token);
      } else {
        await adminCreateRateEntry(form, token);
      }
      setDialogOpen(false);
      await loadEntries();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Saglabāšanas kļūda');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeleting(true);
    try {
      await adminDeleteRateEntry(id, token);
      setDeleteId(null);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dzēšanas kļūda');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.supplierName.toLowerCase().includes(q) ||
      UNIT_LABELS[e.unit].toLowerCase().includes(q) ||
      (e.zone ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Izmaksu likmes"
        description={`${total} ieraksti — atsauces likmes DPR izmaksu rindām (materiāli, darbs, transports, tehnika)`}
        action={
          <PageHelp
            title="Izmaksu likmes — kopīgā cenu bibliotēka"
            sections={[
              {
                heading: 'Kāpēc to vajag?',
                body: 'Katram darbiniekam, mašīnai un materiālam ir likme (cena par vienību). Norādot to šeit — vienu reizi visai sistēmai — DPR aizpildīšanas laikā cena parādās automātiski. Nav jāatceras vai jāmeklē aktuālie tarifi.',
              },
              {
                heading: 'Kategorijas',
                steps: [
                  'Darbs — darbinieku un operātoru stundas tarifi.',
                  'Tehnika — mašīnu un iekārtu stundas tarifi.',
                  'Materiāls — smilšu, granta, betona cenas par tonnu vai m³.',
                  'Transports — piegādes izmaksas par km vai kravu.',
                  'Cits — jebkuri citi atkārtojošie izmaksu elementi.',
                ],
              },
              {
                heading: 'Kad mainīt?',
                body: 'Ja degaļviela sadārdzinās, atjauniniet cenu šeit. Vecie DPR netiks ietekmēti — tur cena ir „iesaldēta“ izpildes briždī. Jauniem DPR tiks lietota jaunā cena.',
              },
              {
                heading: 'Savienojums ar darbiniekiem',
                body: 'Katram darbiniekam (Darbinieki sadaļā) var piesa istīt noklusējuma likmi. DPR izvēloties darbinieku — stundas tarifs aizpildās automātiski.',
                tip: 'Pievienojiet likmes pirms darbiniekiem — tad piesaistīšana būs ātrāka.',
              },
            ]}
          />
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Meklēt pēc nosaukuma, piegādātāja…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1">
              {filterCategory ? CATEGORY_LABELS[filterCategory] : 'Visas kategorijas'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterCategory('')}>
              Visas kategorijas
            </DropdownMenuItem>
            {CATEGORIES.map((c) => (
              <DropdownMenuItem key={c} onClick={() => setFilterCategory(c)}>
                {CATEGORY_LABELS[c]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={activeOnly ? 'default' : 'outline'}
          onClick={() => setActiveOnly((v) => !v)}
        >
          Tikai aktīvie
        </Button>

        <Button onClick={openCreate} className="gap-1 ml-auto">
          <Plus className="h-4 w-4" /> Pievienot
        </Button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nosaukums</TableHead>
              <TableHead>Kategorija</TableHead>
              <TableHead>Piegādātājs</TableHead>
              <TableHead>Mērvienība</TableHead>
              <TableHead className="text-right">Cena / vienība</TableHead>
              <TableHead className="text-right">Piegāde</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Spēkā no</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-gray-500">
                  Ielādē…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-gray-500">
                  Nav ierakstu
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="font-medium">{entry.name}</div>
                    {entry.notes && (
                      <div className="text-xs text-gray-400 truncate max-w-50">{entry.notes}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        CATEGORY_COLORS[entry.category] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {CATEGORY_LABELS[entry.category] ?? entry.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>{entry.supplierName}</div>
                    {entry.supplierNote && (
                      <div className="text-xs text-gray-400">{entry.supplierNote}</div>
                    )}
                  </TableCell>
                  <TableCell>{UNIT_LABELS[entry.unit] ?? entry.unit}</TableCell>
                  <TableCell className="text-right font-mono">
                    €{Number(entry.pricePerUnit).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(entry.deliveryFee) > 0
                      ? `€${Number(entry.deliveryFee).toFixed(2)}`
                      : '—'}
                  </TableCell>
                  <TableCell>{entry.zone ?? '—'}</TableCell>
                  <TableCell>
                    {new Date(entry.effectiveFrom).toLocaleDateString('lv-LV')}
                    {entry.effectiveTo ? (
                      <span className="text-xs text-gray-400 block">
                        līdz {new Date(entry.effectiveTo).toLocaleDateString('lv-LV')}
                      </span>
                    ) : (
                      <Badge variant="outline" className="ml-1 text-xs py-0">
                        aktīvs
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeleteId(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Rediģēt ierakstu' : 'Jauns cenu ieraksts'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {formError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nosaukums *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="piem. Grants 0/16, Betona laušana…"
                />
              </div>

              <div>
                <Label>Kategorija</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as RateCategory }))
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Mērvienība *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.unit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unit: e.target.value as UnitOfMeasure }))
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
                <Label>Piegādātājs *</Label>
                <Input
                  value={form.supplierName}
                  onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))}
                  placeholder="Uzņēmuma nosaukums"
                />
              </div>

              <div>
                <Label>Piegādātāja piezīme</Label>
                <Input
                  value={form.supplierNote ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, supplierNote: e.target.value }))}
                  placeholder="Kontaktpersona, nosacījumi…"
                />
              </div>

              <div>
                <Label>Cena / vienība (€) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.pricePerUnit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pricePerUnit: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>

              <div>
                <Label>Piegādes maksa (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.deliveryFee ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deliveryFee: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>

              <div>
                <Label>Pašizmaksa / vienība (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.selfCostPerUnit ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      selfCostPerUnit: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                  placeholder="Neobligāts"
                />
              </div>

              <div>
                <Label>Blīvuma koeficients</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.densityCoeff ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      densityCoeff: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                  placeholder="t/m³ konversijai"
                />
              </div>

              <div>
                <Label>Kravas auto konfigurācija</Label>
                <Input
                  value={form.truckConfig ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, truckConfig: e.target.value }))}
                  placeholder="piem. 20t pašizgāzējs"
                />
              </div>

              <div>
                <Label>Zona / reģions</Label>
                <Input
                  value={form.zone ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                  placeholder="piem. Rīga, Vidzeme"
                />
              </div>

              <div className="col-span-2">
                <Label>Piezīmes</Label>
                <Input
                  value={form.notes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Papildinformācija…"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saglabā…' : editEntry ? 'Saglabāt' : 'Pievienot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst ierakstu?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Šī darbība ir neatgriezeniska. Ieraksts tiks noņemts no kataloga.
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
