'use client';

import { useEffect, useState, useCallback } from 'react';
import { Percent, Building2, Save, Search, CheckCircle2, Info } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminGetCompanies, adminUpdateCompany, type AdminCompany } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  CONSTRUCTION: 'Būvniecība',
  SUPPLIER: 'Piegādātājs',
  RECYCLER: 'Recycler',
  CARRIER: 'Pārvadātājs',
  HYBRID: 'Hybrid',
};

// ─── Row ──────────────────────────────────────────────────────────────────────

function CompanyRow({
  company,
  token,
  onSaved,
}: {
  company: AdminCompany;
  token: string;
  onSaved: (id: string, newRate: number) => void;
}) {
  const defaultRate = company.commissionRate ?? 10;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(defaultRate));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    const rate = parseFloat(draft);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    setBusy(true);
    try {
      await adminUpdateCompany(company.id, { commissionRate: rate }, token);
      onSaved(company.id, rate);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDraft(String(defaultRate));
    setEditing(false);
  }

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{company.name}</p>
          {company.legalName && company.legalName !== company.name && (
            <p className="text-xs text-muted-foreground">{company.legalName}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        {company.companyType && (
          <Badge variant="outline" className="text-xs">
            {TYPE_LABEL[company.companyType] ?? company.companyType}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            company.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {company.verified ? 'Verificēts' : 'Nepārbaudīts'}
        </span>
      </TableCell>
      <TableCell className="w-40">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-7 w-20 text-sm"
              autoFocus
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        ) : (
          <span className="tabular-nums font-semibold text-sm">{defaultRate}%</span>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" className="h-7 text-xs" disabled={busy} onClick={save}>
              <Save className="h-3 w-3 mr-1" />
              Saglabāt
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={busy}
              onClick={cancel}
            >
              Atcelt
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setEditing(true)}
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                <span className="text-emerald-600">Saglabāts</span>
              </>
            ) : (
              'Rediģēt'
            )}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFeeConfigPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetCompanies(token);
      setCompanies(data);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) load();
  }, [authLoading, token, load]);

  function handleSaved(id: string, newRate: number) {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, commissionRate: newRate } : c)));
  }

  const visible = search.trim()
    ? companies.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.legalName?.toLowerCase().includes(search.toLowerCase()),
      )
    : companies;

  // Stats
  const avgRate =
    companies.length > 0
      ? companies.reduce((s, c) => s + (c.commissionRate ?? 10), 0) / companies.length
      : 0;
  const nonDefault = companies.filter(
    (c) => c.commissionRate !== null && c.commissionRate !== 10,
  ).length;

  if (authLoading) return null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Komisijas likmes"
        description="Platformas komisijas likmes katram uzņēmumam"
      />

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Kā darbojas komisija</p>
              <p className="mt-1 text-blue-700">
                Noklusējuma likme: <strong>10%</strong>. Transporta pasūtījumiem (bez piegādātāja)
                tiek piemērots <strong>15%</strong>. Individuālās likmes tiek piemērotas katram
                uzņēmumam atsevišķi un aizstāj noklusējumu.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Uzņēmumu skaits
            </p>
            <p className="mt-1 text-2xl font-bold">{companies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vidējā likme
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{avgRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Individuālas likmes
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{nonDefault}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">atšķiras no noklusējuma</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Meklēt uzņēmumu..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Uzņēmumu komisijas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-px">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-none" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nav uzņēmumu"
              description="Neviens uzņēmums neatbilst meklēšanas kritērijiem."
              className="py-16"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uzņēmums</TableHead>
                  <TableHead>Tips</TableHead>
                  <TableHead>Verifikācija</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" />
                      Komisija
                    </div>
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    token={token}
                    onSaved={handleSaved}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
