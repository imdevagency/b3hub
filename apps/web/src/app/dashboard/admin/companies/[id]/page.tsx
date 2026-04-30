/**
 * Admin — Company detail
 * /dashboard/admin/companies/[id]
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
  ExternalLink,
  Users,
  ShoppingBag,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { adminGetCompanyById, adminUpdateCompany, type AdminCompanyDetail } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtDate } from '@/lib/format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPANY_TYPE_LABELS: Record<string, string> = {
  CONSTRUCTION: 'Celtniecība',
  SUPPLIER: 'Piegādātājs',
  RECYCLER: 'Pārstrādātājs',
  CARRIER: 'Pārvadātājs',
  HYBRID: 'Hibrid',
};

const ORDER_STATUS_COLOURS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const ROLE_COLOURS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  DRIVER: 'bg-emerald-100 text-emerald-800',
  MEMBER: 'bg-gray-100 text-gray-700',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token: rawToken } = useAuth();
  const token = rawToken ?? '';

  const [company, setCompany] = useState<AdminCompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState('');
  const [commissionEditing, setCommissionEditing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const c = await adminGetCompanyById(id, token);
      setCompany(c);
      setCommissionInput(String(c.commissionRate));
    } catch {
      setError('Neizdevās ielādēt uzņēmuma informāciju.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFlag(field: 'verified' | 'payoutEnabled', value: boolean) {
    if (!token || !company) return;
    setSaving(true);
    try {
      const updated = await adminUpdateCompany(company.id, { [field]: value }, token);
      setCompany((c) => (c ? { ...c, ...updated } : c));
    } catch {
      setError('Neizdevās saglabāt izmaiņas.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCommission() {
    if (!token || !company) return;
    const rate = parseFloat(commissionInput);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setError('Komisijas likme jābūt skaitlim no 0 līdz 100.');
      return;
    }
    setSaving(true);
    try {
      const updated = await adminUpdateCompany(company.id, { commissionRate: rate }, token);
      setCompany((c) => (c ? { ...c, ...updated } : c));
      setCommissionEditing(false);
    } catch {
      setError('Neizdevās saglabāt komisiju.');
    } finally {
      setSaving(false);
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

  if (error || !company)
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Atpakaļ
        </Button>
        <p className="text-destructive">{error ?? 'Uzņēmums nav atrasts.'}</p>
      </div>
    );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/admin/companies">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Uzņēmumi
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

      <PageHeader title={company.name} description={company.legalName ?? company.id} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pamatinformācija</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Tips
            </p>
            <Badge variant="secondary">
              {COMPANY_TYPE_LABELS[company.companyType] ?? company.companyType}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              E-pasts
            </p>
            {company.email ?? '—'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Tālrunis
            </p>
            {company.phone ?? '—'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Pilsēta
            </p>
            {company.city ?? '—'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Valsts
            </p>
            {company.country ?? '—'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Reģistrēts
            </p>
            {fmtDate(company.createdAt)}
          </div>
          {company.registrationNumber && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Reģ. nr.
              </p>
              {company.registrationNumber}
            </div>
          )}
          {company.vatNumber && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                PVN nr.
              </p>
              {company.vatNumber}
            </div>
          )}
          {company.address && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Adrese
              </p>
              {company.address}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Statuss un tiesības</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="verified" className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Verificēts
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Uzņēmums ir pārbaudīts un apstiprināts
              </p>
            </div>
            <Switch
              id="verified"
              checked={company.verified}
              onCheckedChange={(v) => toggleFlag('verified', v)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="payoutEnabled" className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                Izmaksa iespējota
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atļauts veikt automatizētas izmaksas
              </p>
            </div>
            <Switch
              id="payoutEnabled"
              checked={company.payoutEnabled}
              onCheckedChange={(v) => toggleFlag('payoutEnabled', v)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Commission rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Komisijas likme</CardTitle>
        </CardHeader>
        <CardContent>
          {commissionEditing ? (
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button size="sm" onClick={saveCommission} disabled={saving}>
                Saglabāt
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCommissionEditing(false);
                  setCommissionInput(String(company.commissionRate));
                }}
              >
                Atcelt
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold tabular-nums">{company.commissionRate}%</span>
              <Button size="sm" variant="outline" onClick={() => setCommissionEditing(true)}>
                Mainīt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team */}
      {company.users && company.users.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Komanda ({company.users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {company.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/admin/users/${u.id}`}
                      className="font-medium text-sm hover:underline flex items-center gap-1"
                    >
                      {u.firstName} {u.lastName}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                    {u.companyRole && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOURS[u.companyRole] ?? 'bg-muted text-foreground'}`}
                      >
                        {u.companyRole}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {u.canSell && (
                      <Badge variant="outline" className="text-xs">
                        Pārdod
                      </Badge>
                    )}
                    {u.canTransport && (
                      <Badge variant="outline" className="text-xs">
                        Transportē
                      </Badge>
                    )}
                    <span>{u.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent orders */}
      {company.orders && company.orders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Pēdējie pasūtījumi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {company.orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/admin/orders/${o.id}`}
                      className="font-mono text-sm font-medium hover:underline flex items-center gap-1"
                    >
                      {o.orderNumber}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
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

      {/* Counts */}
      {company._count && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Statistika</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(company._count).map(([key, value]) => (
              <div key={key} className="text-center">
                <p className="text-2xl font-bold tabular-nums">{value as number}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
