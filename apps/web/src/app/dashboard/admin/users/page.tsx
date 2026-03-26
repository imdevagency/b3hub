/**
 * Admin users page — /dashboard/admin/users
 * Lists all registered users with filters; approve, suspend, or change user roles.
 */
'use client';

import { useCallback, useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminGetUsers, adminUpdateUser, type AdminUser } from '@/lib/api';
import {
  RefreshCw,
  Users,
  Search,
  Truck,
  Package,
  SkipForward,
  CheckCircle,
  XCircle,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

// ── Capability badge ──────────────────────────────────────────────────────────

function CapBadge({
  active,
  label,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 ${
        active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedCredit, setExpandedCredit] = useState<Set<string>>(new Set());
  const [creditEdits, setCreditEdits] = useState<
    Record<string, { creditLimit: string; paymentTerms: string }>
  >({});

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminGetUsers(token);
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchUsers();
  }, [isLoading, token, fetchUsers]);

  const toggle = async (
    userId: string,
    field: 'canSell' | 'canTransport' | 'canSkipHire',
    currentValue: boolean,
  ) => {
    if (!token) return;
    setUpdating(userId + field);
    try {
      const updated = await adminUpdateUser(userId, { [field]: !currentValue }, token);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās atjaunināt');
    } finally {
      setUpdating(null);
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    if (!token) return;
    const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setUpdating(u.id + 'status');
    try {
      const updated = await adminUpdateUser(u.id, { status: next }, token);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās atjaunināt');
    } finally {
      setUpdating(null);
    }
  };

  const toggleCreditPanel = (userId: string, u: AdminUser) => {
    setExpandedCredit((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
        // initialise edit state from current profile if not already set
        if (!creditEdits[userId]) {
          setCreditEdits((e) => ({
            ...e,
            [userId]: {
              creditLimit:
                u.buyerProfile?.creditLimit != null ? String(u.buyerProfile.creditLimit) : '',
              paymentTerms: u.buyerProfile?.paymentTerms ?? '',
            },
          }));
        }
      }
      return next;
    });
  };

  const saveCreditLimit = async (userId: string) => {
    if (!token) return;
    const edit = creditEdits[userId];
    if (!edit) return;
    setUpdating(userId + 'credit');
    try {
      const creditLimit = edit.creditLimit !== '' ? parseFloat(edit.creditLimit) : null;
      const paymentTerms = edit.paymentTerms || null;
      const updated = await adminUpdateUser(userId, { creditLimit, paymentTerms }, token);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās saglabāt kredītlimitu');
    } finally {
      setUpdating(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.company?.name ?? '').toLowerCase().includes(q)
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
      {/* Header */}
      <PageHeader
        title="Lietotāji"
        description={`${users.length} reģistrēti lietotāji`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchUsers();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunot
          </Button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Meklēt pēc vārda, e-pasta, uzņēmuma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-gray-50 border rounded-xl px-4 py-3">
        <span className="font-semibold text-gray-700">Atļaujas:</span>
        <CapBadge active icon={Package} label="Sell" />
        <span>= var pārdot materiālus</span>
        <CapBadge active icon={Truck} label="Carrier" />
        <span>= var piedāvāt transportu</span>
        <CapBadge active icon={SkipForward} label="Skip" />
        <span>= var pārvaldīt konteineru parku</span>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="text-sm">Nav atrasto lietotāju</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Lietotājs
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Uzņēmums
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Tips
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Sell
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Carrier
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Skip
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Kredīts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.email ?? u.phone ?? '—'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">
                          {u.company?.name ?? <span className="text-gray-300">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 ${
                            u.userType === 'ADMIN'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {u.userType === 'ADMIN' ? 'ADMIN' : 'BUYER'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ToggleBtn
                          value={u.canSell}
                          disabled={updating === u.id + 'canSell'}
                          onToggle={() => toggle(u.id, 'canSell', u.canSell)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ToggleBtn
                          value={u.canTransport}
                          disabled={updating === u.id + 'canTransport'}
                          onToggle={() => toggle(u.id, 'canTransport', u.canTransport)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ToggleBtn
                          value={u.canSkipHire}
                          disabled={updating === u.id + 'canSkipHire'}
                          onToggle={() => toggle(u.id, 'canSkipHire', u.canSkipHire)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleStatus(u)}
                          disabled={updating === u.id + 'status' || u.userType === 'ADMIN'}
                          title={u.userType === 'ADMIN' ? 'Nevar deaktivizēt adminu' : undefined}
                          className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 transition-colors ${
                            u.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {u.status === 'ACTIVE' ? (
                            <>
                              <CheckCircle className="h-3 w-3" /> Aktīvs
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" /> {u.status}
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleCreditPanel(u.id, u)}
                          className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <DollarSign className="h-3 w-3" />
                          {u.buyerProfile?.creditLimit != null
                            ? `€${u.buyerProfile.creditLimit.toLocaleString()}`
                            : '—'}
                          {expandedCredit.has(u.id) ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedCredit.has(u.id) && (
                      <tr className="bg-blue-50/50">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-600">
                                Kredīts izlietots
                              </label>
                              <div className="text-sm font-semibold text-gray-800">
                                €{(u.buyerProfile?.creditUsed ?? 0).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-600">
                                Kredītlimits (€)
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={100}
                                placeholder="Nav limits"
                                value={creditEdits[u.id]?.creditLimit ?? ''}
                                onChange={(e) =>
                                  setCreditEdits((prev) => ({
                                    ...prev,
                                    [u.id]: { ...prev[u.id], creditLimit: e.target.value },
                                  }))
                                }
                                className="w-36 px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-600">
                                Maksājumu termiņš
                              </label>
                              <select
                                value={creditEdits[u.id]?.paymentTerms ?? ''}
                                onChange={(e) =>
                                  setCreditEdits((prev) => ({
                                    ...prev,
                                    [u.id]: { ...prev[u.id], paymentTerms: e.target.value },
                                  }))
                                }
                                className="px-3 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              >
                                <option value="">— Nav iestatīts —</option>
                                <option value="NET30">NET 30</option>
                                <option value="NET60">NET 60</option>
                                <option value="COD">COD</option>
                              </select>
                            </div>
                            <button
                              onClick={() => saveCreditLimit(u.id)}
                              disabled={updating === u.id + 'credit'}
                              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {updating === u.id + 'credit' ? 'Saglabā...' : 'Saglabāt'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
