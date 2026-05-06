/**
 * Admin — User detail
 * /dashboard/admin/users/[id]
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Building2,
  ShieldCheck,
  Truck,
  Package,
  Recycle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetUserById,
  adminUpdateUser,
  adminGetCompanies,
  type AdminUserDetail,
  type AdminCompany,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fmtDate } from '@/lib/format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euro(v: number) {
  return v.toLocaleString('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

const STATUS_COLOURS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
};

const ORDER_STATUS_COLOURS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const COMPANY_TYPE_LABELS: Record<string, string> = {
  CONSTRUCTION: 'Celtniecība',
  SUPPLIER: 'Piegādātājs',
  RECYCLER: 'Pārstrādātājs',
  CARRIER: 'Pārvadātājs',
  HYBRID: 'Hibrid',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token: rawToken } = useAuth();
  const token = rawToken ?? '';

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [assignCompanyId, setAssignCompanyId] = useState<string>('');
  const [assignRole, setAssignRole] = useState<string>('OWNER');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [u, cos] = await Promise.all([adminGetUserById(id, token), adminGetCompanies(token)]);
      setUser(u);
      setAssignCompanyId(u.company?.id ?? '');
      setAssignRole(u.companyRole ?? 'OWNER');
      setCompanies(cos);
    } catch {
      setError('Neizdevās ielādēt lietotāja informāciju.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(field: 'canSell' | 'canTransport' | 'canSkipHire', value: boolean) {
    if (!token || !user) return;
    setSaving(true);
    try {
      await adminUpdateUser(user.id, { [field]: value }, token);
      await load();
    } catch {
      setError('Neizdevās saglabāt izmaiņas.');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: string) {
    if (!token || !user) return;
    setSaving(true);
    try {
      await adminUpdateUser(user.id, { status }, token);
      await load();
    } catch {
      setError('Neizdevās mainīt statusu.');
    } finally {
      setSaving(false);
    }
  }

  async function assignToCompany() {
    if (!token || !user) return;
    setAssigning(true);
    try {
      await adminUpdateUser(
        user.id,
        {
          companyId: assignCompanyId || null,
          companyRole: (assignCompanyId ? assignRole : null) as string | null,
        },
        token,
      );
      await load();
    } catch {
      setError('Neizdevās piešķirt uzņēmumu.');
    } finally {
      setAssigning(false);
    }
  }

  if (loading)
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (error || !user)
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Atpakaļ
        </Button>
        <p className="text-destructive">{error ?? 'Lietotājs nav atrasts.'}</p>
      </div>
    );

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/admin/users">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Lietotāji
          </Link>
        </Button>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      <PageHeader title={fullName} description={user.email ?? user.phone ?? user.id} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Identity & status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identitāte un statuss</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Statuss
            </p>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLOURS[user.status] ?? 'bg-muted text-foreground border-border'}`}
            >
              {user.status === 'ACTIVE' ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {user.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Loma
            </p>
            <Badge variant="secondary">{user.userType}</Badge>
            {user.companyRole && (
              <Badge variant="outline" className="ml-1">
                {user.companyRole}
              </Badge>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              E-pasts apstiprināts
            </p>
            {user.emailVerified ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Reģistrēts
            </p>
            {fmtDate(user.createdAt)}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Tālrunis
            </p>
            {user.phone ?? '—'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              ID
            </p>
            <code className="text-xs text-muted-foreground">{user.id.slice(0, 8)}…</code>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tiesības un iespējas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="canSell" className="font-medium">
                  Var pārdot (canSell)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apstiprināts publicēt materiālus un saņemt pasūtījumus
                </p>
              </div>
            </div>
            <Switch
              id="canSell"
              checked={user.canSell}
              onCheckedChange={(v) => toggle('canSell', v)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="canTransport" className="font-medium">
                  Var transportēt (canTransport)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apstiprināts pieņemt un izpildīt transporta darbus
                </p>
              </div>
            </div>
            <Switch
              id="canTransport"
              checked={user.canTransport}
              onCheckedChange={(v) => toggle('canTransport', v)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="canSkipHire" className="font-medium">
                  Skip hire (canSkipHire)
                </Label>
                <p className="text-xs text-muted-foreground">Pārvalda skip hire floti</p>
              </div>
            </div>
            <Switch
              id="canSkipHire"
              checked={user.canSkipHire}
              onCheckedChange={(v) => toggle('canSkipHire', v)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Recycle className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="canRecycle" className="font-medium">
                  Reciklēšana (canRecycle)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apstiprināts uzturēt atkritumu pieņemšanas/reciklēšanas centru
                </p>
              </div>
            </div>
            <Switch
              id="canRecycle"
              checked={user.canRecycle ?? false}
              onCheckedChange={(v) => toggle('canRecycle', v)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Company assignment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Piešķirt uzņēmumam
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Uzņēmums</Label>
              <Select value={assignCompanyId} onValueChange={setAssignCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nav piešķirta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nav piešķirta</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Loma uzņēmumā</Label>
              <Select value={assignRole} onValueChange={setAssignRole} disabled={!assignCompanyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Vlastnieks (OWNER)</SelectItem>
                  <SelectItem value="MANAGER">Vadītājs (MANAGER)</SelectItem>
                  <SelectItem value="DRIVER">Šoferis (DRIVER)</SelectItem>
                  <SelectItem value="MEMBER">Loceklis (MEMBER)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={assignToCompany} disabled={assigning}>
            {assigning ? 'Saglabā...' : 'Saglabāt piederību'}
          </Button>
        </CardContent>
      </Card>

      {/* Credit */}
      {user.buyerProfile && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pircēja profils</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Kredītlimits
              </p>
              <p className="font-semibold text-base">
                {user.buyerProfile.creditLimit != null ? euro(user.buyerProfile.creditLimit) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Izmantots
              </p>
              <p className="font-semibold text-base">{euro(user.buyerProfile.creditUsed)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Maksājuma termiņš
              </p>
              <p className="font-semibold">{user.buyerProfile.paymentTerms ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company */}
      {user.company && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Uzņēmums
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Nosaukums
              </p>
              <Link
                href={`/dashboard/admin/companies/${user.company.id}`}
                className="font-medium text-foreground hover:underline flex items-center gap-1"
              >
                {user.company.name}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Juridiskais nosaukums
              </p>
              {user.company.legalName}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Tips
              </p>
              {COMPANY_TYPE_LABELS[user.company.companyType] ?? user.company.companyType}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Verificēts
              </p>
              {user.company.verified ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Jā
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Nē
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Komisija
              </p>
              {user.company.commissionRate}%
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Izmaksa iespējota
              </p>
              {user.company.payoutEnabled ? (
                <span className="text-emerald-600 font-medium">Jā</span>
              ) : (
                <span className="text-muted-foreground">Nē</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Statusa izmaiņas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={user.status === 'ACTIVE' || saving}
            onClick={() => setStatus('ACTIVE')}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
            Aktivizēt
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={user.status === 'SUSPENDED' || saving}
            onClick={() => setStatus('SUSPENDED')}
            className="text-red-700 border-red-200 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            Apturēt
          </Button>
        </CardContent>
      </Card>

      {/* Recent orders */}
      {user.orders && user.orders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pēdējie pasūtījumi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {user.orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/admin/orders/${o.id}`}
                      className="font-mono text-sm font-medium text-foreground hover:underline flex items-center gap-1"
                    >
                      {o.orderNumber}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLOURS[o.status] ?? 'bg-muted text-foreground'}`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold tabular-nums">
                      {o.total.toLocaleString('lv-LV', { style: 'currency', currency: o.currency })}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
