/**
 * Construction — Client Invoices
 * /dashboard/construction/invoices
 */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getClientInvoices,
  createClientInvoice,
  updateClientInvoice,
  deleteClientInvoice,
  getConstructionProjects,
  type ClientInvoice,
  type ClientInvoiceStatus,
  type ConstructionProject,
} from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Receipt, Plus, RefreshCw, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS: Record<ClientInvoiceStatus, string> = {
  DRAFT: 'Melnraksts',
  ISSUED: 'Izrakstīts',
  PARTIALLY_PAID: 'Daļēji apmaksāts',
  PAID: 'Apmaksāts',
  OVERDUE: 'Nokavēts',
  CANCELLED: 'Atcelts',
};

const STATUS_VARIANTS: Record<
  ClientInvoiceStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'secondary',
  ISSUED: 'default',
  PARTIALLY_PAID: 'secondary',
  PAID: 'outline',
  OVERDUE: 'destructive',
  CANCELLED: 'destructive',
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n);
}

function InvoicesContent() {
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = session?.access_token ?? '';

  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    projectId: searchParams.get('projectId') ?? '',
    invoiceNo: '',
    issueDate: '',
    dueDate: '',
    amount: '',
    vatAmount: '',
    description: '',
    status: 'DRAFT' as ClientInvoiceStatus,
    notes: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [res, proj] = await Promise.all([
        getClientInvoices(token, {
          projectId: projectFilter || undefined,
          status: statusFilter || undefined,
        }),
        projects.length === 0
          ? getConstructionProjects(token, { limit: 200 })
          : Promise.resolve({ data: projects }),
      ]);
      setInvoices(res.data);
      if (projects.length === 0) setProjects((proj as any).data);
    } finally {
      setLoading(false);
    }
  }, [token, projectFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.projectId || !form.invoiceNo || !form.amount || !form.issueDate) return;
    setSaving(true);
    try {
      await createClientInvoice(
        form.projectId,
        {
          invoiceNo: form.invoiceNo,
          issueDate: form.issueDate,
          dueDate: form.dueDate || undefined,
          amount: Number(form.amount),
          vatAmount: form.vatAmount ? Number(form.vatAmount) : undefined,
          description: form.description || undefined,
          status: form.status,
          notes: form.notes || undefined,
        },
        token,
      );
      setCreateOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: ClientInvoiceStatus) => {
    await updateClientInvoice(id, { status }, token);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteClientInvoice(id, token);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((s, i) => s + (i.paidAmount ?? i.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Izrakstītie rēķini"
        description="Klientu rēķini pa projektiem"
        icon={Receipt}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={projectFilter || 'all'}
              onValueChange={(v) => setProjectFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-50">
                <SelectValue placeholder="Visi projekti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi projekti</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statuss" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi</SelectItem>
                {(Object.keys(STATUS_LABELS) as ClientInvoiceStatus[]).map((s) => (
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
              Jauns rēķins
            </Button>
          </div>
        }
      />

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Kopā izrakstīts</p>
            <p className="text-xl font-bold">{fmtEur(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Saņemts</p>
            <p className="text-xl font-bold text-green-600">{fmtEur(paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Nesamaksāts</p>
            <p className="text-xl font-bold text-destructive">{fmtEur(total - paid)}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nav rēķinu"
          description="Izveidojiet pirmo klientu rēķinu."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Jauns rēķins
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Projekts</TableHead>
                  <TableHead>Datums</TableHead>
                  <TableHead>Termiņš</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono">{inv.invoiceNo}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.project?.name ?? '—'}
                    </TableCell>
                    <TableCell>{format(new Date(inv.issueDate), 'dd.MM.yyyy')}</TableCell>
                    <TableCell>
                      {inv.dueDate ? format(new Date(inv.dueDate), 'dd.MM.yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[inv.status]}>
                        {STATUS_LABELS[inv.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtEur(inv.amount)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {inv.status === 'DRAFT' && (
                            <DropdownMenuItem onClick={() => handleStatusUpdate(inv.id, 'ISSUED')}>
                              Atzīmēt kā izrakstītu
                            </DropdownMenuItem>
                          )}
                          {(inv.status === 'ISSUED' ||
                            inv.status === 'PARTIALLY_PAID' ||
                            inv.status === 'OVERDUE') && (
                            <DropdownMenuItem onClick={() => handleStatusUpdate(inv.id, 'PAID')}>
                              Atzīmēt kā apmaksātu
                            </DropdownMenuItem>
                          )}
                          {inv.status === 'DRAFT' && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(inv.id)}
                            >
                              Dzēst
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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
            <DialogTitle>Jauns rēķins</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Projekts *</Label>
              <Select
                value={form.projectId}
                onValueChange={(v) => setForm({ ...form, projectId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izvēlieties projektu" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Rēķina nr. *</Label>
                <Input
                  value={form.invoiceNo}
                  onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                  placeholder="2024-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Statuss</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as ClientInvoiceStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as ClientInvoiceStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Izrakstīšanas datums *</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Apmaksas termiņš</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Summa (€) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>PVN (€)</Label>
                <Input
                  type="number"
                  value={form.vatAmount}
                  onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Apraksts</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Atcelt
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                saving || !form.projectId || !form.invoiceNo || !form.amount || !form.issueDate
              }
            >
              {saving ? 'Saglabā...' : 'Izveidot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesContent />
    </Suspense>
  );
}
