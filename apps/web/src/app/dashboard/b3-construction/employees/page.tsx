/**
 * B3 Construction — Employee Roster
 * /dashboard/b3-construction/employees
 *
 * Define workers once. Pick them in Daily Production Reports.
 * Auto-fills unit rate from the rate library when selected in a DPR line.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, UserX, UserCheck, Search, Phone, Mail } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  adminGetEmployees,
  adminCreateEmployee,
  adminUpdateEmployee,
  adminDeactivateEmployee,
  adminGetRateEntries,
  type ConstructionEmployee,
  type CreateEmployeePayload,
  type MaterialRateEntry,
} from '@/lib/api/admin';

const EMPTY_FORM: CreateEmployeePayload = {
  firstName: '',
  lastName: '',
  role: '',
  personalCode: '',
  phone: '',
  email: '',
  notes: '',
  defaultRateEntryId: '',
};

export default function EmployeesPage() {
  const { token } = useAuth();

  const [employees, setEmployees] = useState<ConstructionEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference data for default rate picker
  const [rateEntries, setRateEntries] = useState<MaterialRateEntry[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<ConstructionEmployee | null>(null);
  const [form, setForm] = useState<CreateEmployeePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<ConstructionEmployee | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [empRes, rateRes] = await Promise.all([
        adminGetEmployees(token, { limit: 500 }),
        adminGetRateEntries(token, { activeOnly: true, limit: 500 }),
      ]);
      setEmployees(empRes.data);
      setTotal(empRes.total);
      setRateEntries(rateRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditEmployee(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(emp: ConstructionEmployee) {
    setEditEmployee(emp);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      role: emp.role,
      personalCode: emp.personalCode ?? '',
      phone: emp.phone ?? '',
      email: emp.email ?? '',
      notes: emp.notes ?? '',
      defaultRateEntryId: emp.defaultRateEntryId ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.role.trim()) {
      setFormError('Vārds, uzvārds un amats ir obligāti.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        defaultRateEntryId: form.defaultRateEntryId || undefined,
      };
      if (editEmployee) {
        await adminUpdateEmployee(editEmployee.id, payload, token);
      } else {
        await adminCreateEmployee(payload, token);
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Saglabāšanas kļūda');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!token || !deactivateTarget) return;
    setDeactivating(true);
    try {
      await adminDeactivateEmployee(deactivateTarget.id, token);
      setDeactivateTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda deaktivizējot');
    } finally {
      setDeactivating(false);
    }
  }

  async function handleReactivate(emp: ConstructionEmployee) {
    if (!token) return;
    try {
      await adminUpdateEmployee(emp.id, { active: true }, token);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda aktivizējot');
    }
  }

  const filtered = employees.filter((e) => {
    if (!showInactive && !e.active) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      (e.phone ?? '').includes(q)
    );
  });

  const activeCount = employees.filter((e) => e.active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Darbinieki"
        description={`${activeCount} aktīvi darbinieki`}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Pievienot darbinieku
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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Meklēt pēc vārda, amata, telefona…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Rādīt neaktīvos
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {filtered.length} / {total}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vārds uzvārds</TableHead>
              <TableHead>Amats</TableHead>
              <TableHead>Kontakti</TableHead>
              <TableHead>Noklusējuma likme</TableHead>
              <TableHead>Statuss</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                  Ielādē…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                  Nav darbinieku
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((emp) => (
                <TableRow key={emp.id} className={!emp.active ? 'opacity-50' : undefined}>
                  <TableCell>
                    <div className="font-medium">
                      {emp.firstName} {emp.lastName}
                    </div>
                    {emp.personalCode && (
                      <div className="text-xs text-gray-400">{emp.personalCode}</div>
                    )}
                  </TableCell>
                  <TableCell>{emp.role}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-sm">
                      {emp.phone && (
                        <a
                          href={`tel:${emp.phone}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {emp.phone}
                        </a>
                      )}
                      {emp.email && (
                        <a
                          href={`mailto:${emp.email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {emp.email}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {emp.defaultRateEntry ? (
                      <div className="text-sm">
                        <div>{emp.defaultRateEntry.name}</div>
                        <div className="text-gray-400 text-xs">
                          €{Number(emp.defaultRateEntry.pricePerUnit).toFixed(2)} /{' '}
                          {emp.defaultRateEntry.unit}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        emp.active
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                      }
                    >
                      {emp.active ? 'Aktīvs' : 'Neaktīvs'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {emp.active ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-orange-600 hover:text-orange-700"
                          onClick={() => setDeactivateTarget(emp)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleReactivate(emp)}
                        >
                          <UserCheck className="h-4 w-4" />
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEmployee ? 'Rediģēt darbinieku' : 'Jauns darbinieks'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>Vārds *</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Jānis"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Uzvārds *</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Bērziņš"
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Amats *</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Ekskavātora operators, Strādnieks, Šoferis…"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Telefons</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+371 2X XXX XXX"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>E-pasts</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="janis@example.com"
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Personas kods</Label>
              <Input
                value={form.personalCode}
                onChange={(e) => setForm((f) => ({ ...f, personalCode: e.target.value }))}
                placeholder="XXXXXX-XXXXX"
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Noklusējuma likme (no cenu kataloga)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.defaultRateEntryId ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultRateEntryId: e.target.value || '' }))
                }
              >
                <option value="">— nav noklusējuma —</option>
                {rateEntries
                  .filter((r) => r.category === 'LABOUR')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — €{Number(r.pricePerUnit).toFixed(2)}/{r.unit}
                    </option>
                  ))}
                {rateEntries.filter((r) => r.category !== 'LABOUR').length > 0 && (
                  <>
                    <option disabled>── Citi ──</option>
                    {rateEntries
                      .filter((r) => r.category !== 'LABOUR')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — €{Number(r.pricePerUnit).toFixed(2)}/{r.unit}
                        </option>
                      ))}
                  </>
                )}
              </select>
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Piezīmes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Braukšanas tiesības B, C1…"
              />
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saglabā…' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm Dialog */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deaktivizēt darbinieku?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {deactivateTarget?.firstName} {deactivateTarget?.lastName} tiks noņemts no aktīvā
            saraksta, bet visi iepriekšējie DPR ieraksti tiks saglabāti.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? 'Deaktivizē…' : 'Deaktivizēt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
