/**
 * Construction — Projects list
 * /dashboard/construction/projects
 * Company-scoped: shows only the current company's projects.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getConstructionProjects,
  createConstructionProject,
  type ConstructionProject,
  type ProjectStatus,
} from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FolderKanban, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Plānošana',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  ON_HOLD: 'Apturēts',
  CANCELLED: 'Atcelts',
};

const STATUS_VARIANTS: Record<ProjectStatus, 'default' | 'secondary' | 'outline' | 'destructive'> =
  {
    PLANNING: 'secondary',
    ACTIVE: 'default',
    COMPLETED: 'outline',
    ON_HOLD: 'destructive',
    CANCELLED: 'destructive',
  };

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ConstructionProjectsPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    siteAddress: '',
    contractValue: '',
    status: 'PLANNING' as ProjectStatus,
    startDate: '',
    endDate: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getConstructionProjects(token, { status: statusFilter || undefined });
      setProjects(res.data);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.contractValue) return;
    setSaving(true);
    try {
      await createConstructionProject(
        {
          name: form.name,
          clientName: form.clientName || undefined,
          siteAddress: form.siteAddress || undefined,
          contractValue: Number(form.contractValue),
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
        },
        token,
      );
      setCreateOpen(false);
      setForm({
        name: '',
        clientName: '',
        siteAddress: '',
        contractValue: '',
        status: 'PLANNING',
        startDate: '',
        endDate: '',
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projekti"
        description="Visu celtniecības projektu pārskats"
        icon={FolderKanban}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statuss" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi statusi</SelectItem>
                {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Jauns projekts
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nav projektu"
          description="Izveidojiet pirmo projektu, lai sāktu."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Jauns projekts
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekts</TableHead>
                  <TableHead>Klients</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Līguma vērtība</TableHead>
                  <TableHead>Sākums</TableHead>
                  <TableHead>Beigas</TableHead>
                  <TableHead>Pasūt.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/construction/projects/${p.id}`)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.clientName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtEur(p.contractValue)}
                    </TableCell>
                    <TableCell>
                      {p.startDate ? format(new Date(p.startDate), 'dd.MM.yy') : '—'}
                    </TableCell>
                    <TableCell>
                      {p.endDate ? format(new Date(p.endDate), 'dd.MM.yy') : '—'}
                    </TableCell>
                    <TableCell>{p._count?.orders ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Jauns projekts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nosaukums *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Projekta nosaukums"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Klients</Label>
                <Input
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Klienta nosaukums"
                />
              </div>
              <div className="space-y-1">
                <Label>Līguma vērtība (€) *</Label>
                <Input
                  type="number"
                  value={form.contractValue}
                  onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Objekta adrese</Label>
              <Input
                value={form.siteAddress}
                onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
                placeholder="Adrese"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Statuss</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Sākuma datums</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Beigu datums</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.contractValue}>
              {saving ? 'Saglabā...' : 'Izveidot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
