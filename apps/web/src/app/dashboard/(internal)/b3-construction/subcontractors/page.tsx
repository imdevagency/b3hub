/**
 * B3 Construction — Subcontractor Register
 * /dashboard/b3-construction/subcontractors
 *
 * Lists and manages external subcontractors (companies / sole traders) used by
 * B3 Construction.  Replaces the spreadsheet list of "who do we call for X".
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminGetSubcontractorRegister,
  adminCreateSubcontractorRecord,
  adminUpdateSubcontractorRecord,
  adminDeleteSubcontractorRecord,
  type ConstructionSubcontractor,
  type SubcontractorEngagement,
} from '@/lib/api/admin';

type FormState = {
  name: string;
  registrationNo: string;
  contactPerson: string;
  phone: string;
  email: string;
  speciality: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  registrationNo: '',
  contactPerson: '',
  phone: '',
  email: '',
  speciality: '',
  notes: '',
};

function fmtEur(n: number) {
  return `€${n.toLocaleString('lv-LV', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function engagementBadge(status: SubcontractorEngagement['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-800';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}

function engagementLabel(status: SubcontractorEngagement['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'Aktīvs';
    case 'COMPLETED':
      return 'Pabeigts';
    case 'CANCELLED':
      return 'Atcelts';
    default:
      return status;
  }
}

export default function SubcontractorsPage() {
  const { token } = useAuth();

  const [subs, setSubs] = useState<ConstructionSubcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ConstructionSubcontractor | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<ConstructionSubcontractor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetSubcontractorRegister(token, { limit: 200 });
      setSubs(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(sub: ConstructionSubcontractor) {
    setEditTarget(sub);
    setForm({
      name: sub.name,
      registrationNo: sub.registrationNo ?? '',
      contactPerson: sub.contactPerson ?? '',
      phone: sub.phone ?? '',
      email: sub.email ?? '',
      speciality: sub.speciality ?? '',
      notes: sub.notes ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!token || !form.name.trim()) {
      setFormError('Nosaukums ir obligāts');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        registrationNo: form.registrationNo.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        speciality: form.speciality.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editTarget) {
        await adminUpdateSubcontractorRecord(token, editTarget.id, payload);
      } else {
        await adminCreateSubcontractorRecord(token, payload);
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kļūda saglabājot');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sub: ConstructionSubcontractor) {
    if (!token) return;
    setDeleting(true);
    try {
      await adminDeleteSubcontractorRecord(token, sub.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda dzēšot');
    } finally {
      setDeleting(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = subs.filter((s) => {
    if (!showInactive && !s.active) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.speciality ?? '').toLowerCase().includes(q) ||
      (s.contactPerson ?? '').toLowerCase().includes(q)
    );
  });

  const activeCount = subs.filter((s) => s.active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apakšuzņēmēji"
        description="Ārējo uzņēmumu un pašnodarbināto reģistrs"
        action={
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Pievienot
          </Button>
        }
      />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Meklēt pēc nosaukuma, specialitātes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Rādīt neaktīvos
        </label>
        <span className="text-sm text-gray-400 ml-auto">
          {activeCount} aktīvi no {subs.length}
        </span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Ielādē…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-white py-16 text-center text-sm text-gray-400">
          Nav apakšuzņēmēju
        </div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Nosaukums</TableHead>
                <TableHead>Specialitāte</TableHead>
                <TableHead>Kontaktpersona</TableHead>
                <TableHead>Tālrunis</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead>Līgumi</TableHead>
                <TableHead className="text-right">Kopā saskaņots</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => {
                const engs = sub.engagements ?? [];
                const isExpanded = expanded.has(sub.id);
                const totalAgreed = engs.reduce((s, e) => s + (e.agreedAmount ?? 0), 0);

                return (
                  <>
                    <TableRow
                      key={sub.id}
                      className={engs.length > 0 ? 'cursor-pointer hover:bg-gray-50' : undefined}
                      onClick={() => engs.length > 0 && toggleExpand(sub.id)}
                    >
                      <TableCell className="text-gray-400">
                        {engs.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{sub.name}</div>
                        {sub.registrationNo && (
                          <div className="text-xs text-gray-400">{sub.registrationNo}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {sub.speciality ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{sub.contactPerson ?? '—'}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {sub.phone ? (
                          <a
                            href={`tel:${sub.phone}`}
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sub.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            sub.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                          }
                        >
                          {sub.active ? 'Aktīvs' : 'Neaktīvs'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {engs.length > 0 ? engs.length : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {totalAgreed > 0 ? fmtEur(totalAgreed) : '—'}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(sub)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(sub)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded &&
                      engs.map((eng) => (
                        <TableRow key={eng.id} className="bg-gray-50 text-sm">
                          <TableCell />
                          <TableCell colSpan={2} className="pl-8 text-gray-600">
                            ↳ {eng.description}
                          </TableCell>
                          <TableCell colSpan={2} className="text-gray-500">
                            {eng.project?.name}
                          </TableCell>
                          <TableCell>
                            <Badge className={engagementBadge(eng.status)}>
                              {engagementLabel(eng.status)}
                            </Badge>
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right font-mono text-gray-600">
                            {fmtEur(eng.agreedAmount)}
                            {eng.invoicedAmount != null && (
                              <div className="text-xs text-gray-400">
                                rēķināts: {fmtEur(eng.invoicedAmount)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Labot apakšuzņēmēju' : 'Jauns apakšuzņēmējs'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sub-name">Nosaukums *</Label>
              <Input
                id="sub-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="SIA / fiziskās personas vārds"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sub-reg">Reģistrācijas numurs</Label>
                <Input
                  id="sub-reg"
                  value={form.registrationNo}
                  onChange={(e) => setForm((p) => ({ ...p, registrationNo: e.target.value }))}
                  placeholder="40XXXXXXXXX"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sub-spec">Specialitāte</Label>
                <Input
                  id="sub-spec"
                  value={form.speciality}
                  onChange={(e) => setForm((p) => ({ ...p, speciality: e.target.value }))}
                  placeholder="Ekskavācija, Betona darbi…"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sub-contact">Kontaktpersona</Label>
                <Input
                  id="sub-contact"
                  value={form.contactPerson}
                  onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sub-phone">Tālrunis</Label>
                <Input
                  id="sub-phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+371 2X XXX XXX"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-email">E-pasts</Label>
              <Input
                id="sub-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-notes">Piezīmes</Label>
              <Textarea
                id="sub-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saglabā…' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deaktivizēt apakšuzņēmēju?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteTarget?.name}</strong> tiks atzīmēts kā neaktīvs. Esošie līgumi paliks
            saglabāti.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={deleting}
            >
              {deleting ? 'Dzēš…' : 'Deaktivizēt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
