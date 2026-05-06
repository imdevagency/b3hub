/**
 * Admin companies page — /dashboard/admin/companies
 * Platform-wide company view with verification, payout toggle, and commission rate editing.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetCompanies,
  adminUpdateCompany,
  adminCreateCompany,
  type AdminCompany,
  type AdminCreateCompanyPayload,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  RefreshCw,
  Building2,
  Search,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Shield,
  Plus,
} from 'lucide-react';
import { COMPANY_TYPE_CONFIG, StatusBadgeTw } from '@/lib/status-config';

// ── Toggle button ─────────────────────────────────────────────────────────────

function ToggleBtn({
  value,
  disabled,
  onToggle,
}: {
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
        value ? 'bg-green-500' : 'bg-gray-300'
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type TypeFilter = 'ALL' | AdminCompany['companyType'] | 'FIRST_PARTY';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'FIRST_PARTY', label: 'B3 Grupa' },
  { value: 'SUPPLIER', label: 'Piegādātāji' },
  { value: 'CARRIER', label: 'Pārvadātāji' },
  { value: 'CONSTRUCTION', label: 'Būvniecība' },
  { value: 'RECYCLER', label: 'Pārstrāde' },
  { value: 'HYBRID', label: 'Hibrīds' },
];

export default function AdminCompaniesPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedCommission, setExpandedCommission] = useState<Set<string>>(new Set());
  const [commissionEdits, setCommissionEdits] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<AdminCreateCompanyPayload>({
    name: '',
    legalName: '',
    companyType: 'CONSTRUCTION',
    email: '',
    phone: '',
    registrationNum: '',
    city: '',
    street: '',
    postalCode: '',
    country: 'LV',
    verified: false,
    features: [],
  });
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateCompany() {
    if (!token || !createForm.name || !createForm.email || !createForm.phone) return;
    setCreating(true);
    setCreateError(null);
    try {
      await adminCreateCompany(createForm, token);
      setCreateOpen(false);
      setCreateForm({
        name: '',
        legalName: '',
        companyType: 'CONSTRUCTION',
        email: '',
        phone: '',
        registrationNum: '',
        city: '',
        street: '',
        postalCode: '',
        country: 'LV',
        verified: false,
        features: [],
      });
      fetchCompanies();
    } catch {
      setCreateError('Neizdevās izveidot uzņēmumu.');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchCompanies = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetCompanies(token);
      setCompanies(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchCompanies();
  }, [isLoading, token, fetchCompanies]);

  const toggleVerified = async (c: AdminCompany) => {
    if (!token) return;
    setUpdating(c.id + 'verified');
    try {
      const updated = await adminUpdateCompany(c.id, { verified: !c.verified }, token);
      setCompanies((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās atjaunināt');
    } finally {
      setUpdating(null);
    }
  };

  const togglePayout = async (c: AdminCompany) => {
    if (!token) return;
    setUpdating(c.id + 'payout');
    try {
      const updated = await adminUpdateCompany(c.id, { payoutEnabled: !c.payoutEnabled }, token);
      setCompanies((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās atjaunināt');
    } finally {
      setUpdating(null);
    }
  };

  const toggleCommissionPanel = (id: string, c: AdminCompany) => {
    setExpandedCommission((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (commissionEdits[id] === undefined) {
          setCommissionEdits((e) => ({ ...e, [id]: String(c.commissionRate) }));
        }
      }
      return next;
    });
  };

  const saveCommission = async (id: string) => {
    if (!token) return;
    const val = commissionEdits[id];
    if (val === undefined) return;
    setUpdating(id + 'commission');
    try {
      const updated = await adminUpdateCompany(id, { commissionRate: parseFloat(val) }, token);
      setCompanies((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setExpandedCommission((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās saglabāt');
    } finally {
      setUpdating(null);
    }
  };

  const filtered = companies.filter((c) => {
    if (typeFilter === 'FIRST_PARTY' && !c.isFirstParty) return false;
    if (typeFilter !== 'ALL' && typeFilter !== 'FIRST_PARTY' && c.companyType !== typeFilter)
      return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.legalName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uzņēmumi"
        description={`${companies.length} uzņēmumi platformā`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchCompanies}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Atjaunot
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Pievienot uzņēmumu
            </Button>
          </div>
        }
      />

      {/* Create company dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Jauns uzņēmums</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Nosaukums *</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="SIA Piemērs"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Juridiskais nosaukums *</Label>
                <Input
                  value={createForm.legalName}
                  onChange={(e) => setCreateForm({ ...createForm, legalName: e.target.value })}
                  placeholder={'SIA "Piemērs"'}
                />
              </div>
              <div className="space-y-1">
                <Label>Tips *</Label>
                <Select
                  value={createForm.companyType}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, companyType: v, features: [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONSTRUCTION">Celtniecība</SelectItem>
                    <SelectItem value="SUPPLIER">Piegādātājs</SelectItem>
                    <SelectItem value="CARRIER">Pārvadātājs</SelectItem>
                    <SelectItem value="RECYCLER">Pārstrādātājs</SelectItem>
                    <SelectItem value="HYBRID">Hibrīds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reģ. nr.</Label>
                <Input
                  value={createForm.registrationNum ?? ''}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, registrationNum: e.target.value })
                  }
                  placeholder="40000000000"
                />
              </div>
              <div className="space-y-1">
                <Label>E-pasts *</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tālrunis *</Label>
                <Input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Pilsēta</Label>
                <Input
                  value={createForm.city ?? ''}
                  onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Pasta indekss</Label>
                <Input
                  value={createForm.postalCode ?? ''}
                  onChange={(e) => setCreateForm({ ...createForm, postalCode: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Verificēts</p>
                <p className="text-xs text-muted-foreground">
                  Uzreiz atzīmē uzņēmumu kā pārbaudītu
                </p>
              </div>
              <Switch
                checked={createForm.verified ?? false}
                onCheckedChange={(v) => setCreateForm({ ...createForm, verified: v })}
              />
            </div>

            {createForm.companyType === 'CONSTRUCTION' && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Celtniecības vadība (ERP)</p>
                  <p className="text-xs text-muted-foreground">
                    Piešķir piekļuvi projektu, DPR un apakšuzņēmēju modulim
                  </p>
                </div>
                <Switch
                  checked={(createForm.features ?? []).includes('CONSTRUCTION_MANAGEMENT')}
                  onCheckedChange={(v) =>
                    setCreateForm({
                      ...createForm,
                      features: v
                        ? [...(createForm.features ?? []), 'CONSTRUCTION_MANAGEMENT']
                        : (createForm.features ?? []).filter(
                            (f) => f !== 'CONSTRUCTION_MANAGEMENT',
                          ),
                    })
                  }
                />
              </div>
            )}

            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Atcelt
            </Button>
            <Button
              onClick={handleCreateCompany}
              disabled={creating || !createForm.name || !createForm.email || !createForm.phone}
            >
              {creating ? 'Izveido...' : 'Izveidot uzņēmumu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Meklēt pēc nosaukuma, e-pasta, pilsētas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
        />
      </div>

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTypeFilter(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              typeFilter === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nav uzņēmumu"
          description="Nekas neatbilst meklēšanas kritērijiem."
        />
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Uzņēmums
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Tips
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Pilsēta
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Lietotāji
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Pasūtījumi
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Verificēts
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Izmaksa
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Komisija
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Pievienots
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{c.name}</p>
                            {c.isFirstParty && (
                              <Badge className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-xs">
                                <Shield className="h-3 w-3" /> B3 Grupa
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeTw cfg={COMPANY_TYPE_CONFIG[c.companyType]} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.city}</td>
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold">
                        {c._count.users}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold">
                        {c._count.orders}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ToggleBtn
                          value={c.verified}
                          disabled={updating === c.id + 'verified'}
                          onToggle={() => toggleVerified(c)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ToggleBtn
                          value={c.payoutEnabled}
                          disabled={updating === c.id + 'payout'}
                          onToggle={() => togglePayout(c)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleCommissionPanel(c.id, c)}
                          className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <DollarSign className="h-3 w-3" />
                          {c.commissionRate}%
                          {expandedCommission.has(c.id) ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString('lv-LV')}
                      </td>
                    </tr>
                    {expandedCommission.has(c.id) && (
                      <tr key={c.id + '-commission'} className="bg-blue-50/50">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="flex items-end gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-600">
                                Komisijas likme (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                value={commissionEdits[c.id] ?? ''}
                                onChange={(e) =>
                                  setCommissionEdits((prev) => ({
                                    ...prev,
                                    [c.id]: e.target.value,
                                  }))
                                }
                                className="w-28 px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                            <Button
                              size="sm"
                              disabled={updating === c.id + 'commission'}
                              onClick={() => saveCommission(c.id)}
                            >
                              {updating === c.id + 'commission' ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                'Saglabāt'
                              )}
                            </Button>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline"
                              onClick={() => toggleCommissionPanel(c.id, c)}
                            >
                              Atcelt
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
