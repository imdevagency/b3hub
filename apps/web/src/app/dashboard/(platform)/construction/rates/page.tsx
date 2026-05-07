/**
 * Construction — Rate library (izmaksu likmes)
 * /dashboard/construction/rates
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getRateEntries,
  createRateEntry,
  deleteRateEntry,
  type RateEntry,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Euro, Plus, RefreshCw, Trash2, Lock } from 'lucide-react';
import { useAuth as useAuthCtx } from '@/lib/auth-context';

const CATEGORIES = [
  'LABOUR',
  'MATERIALS',
  'TRANSPORT',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'OVERHEAD',
  'OTHER',
];
const CATEGORY_LABELS: Record<string, string> = {
  LABOUR: 'Darbaspēks',
  MATERIALS: 'Materiāli',
  TRANSPORT: 'Transports',
  EQUIPMENT: 'Tehnika',
  SUBCONTRACTOR: 'Apakšuzņēmējs',
  OVERHEAD: 'Vispārīgas izmaksas',
  OTHER: 'Cits',
};

const UNITS = ['H', 'M2', 'M3', 'M', 'KG', 'T', 'PCS', 'DAY', 'TRIP'];

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n);
}

export default function RatesPage() {
  const { token } = useAuth();
  const { user } = useAuthCtx();
  const companyId = user?.company?.id;

  const [rates, setRates] = useState<RateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    unit: 'H',
    category: 'LABOUR',
    supplierName: '',
    pricePerUnit: '',
    deliveryFee: '0',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getRateEntries(token, { category: categoryFilter || undefined });
      setRates(res.data);
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.pricePerUnit) return;
    setSaving(true);
    try {
      await createRateEntry(
        {
          name: form.name,
          unit: form.unit,
          category: form.category,
          supplierName: form.supplierName,
          pricePerUnit: Number(form.pricePerUnit),
          deliveryFee: Number(form.deliveryFee),
          notes: form.notes || undefined,
          effectiveTo: undefined,
        },
        token,
      );
      setCreateOpen(false);
      setForm({
        name: '',
        unit: 'H',
        category: 'LABOUR',
        supplierName: '',
        pricePerUnit: '',
        deliveryFee: '0',
        notes: '',
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteRateEntry(deleteId, token);
      setRates((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const isOwn = (rate: RateEntry) => rate.companyId === companyId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Izmaksu likmes"
        description="Darbu, materiālu un transporta likmju bibliotēka"
        icon={Euro}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={categoryFilter || 'all'}
              onValueChange={(v) => setCategoryFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Visas kategorijas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visas</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Jauna likme
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
      ) : rates.length === 0 ? (
        <EmptyState
          icon={Euro}
          title="Nav likmju"
          description="Pievienojiet darbu un materiālu likmes."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Jauna likme
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nosaukums</TableHead>
                  <TableHead>Kategorija</TableHead>
                  <TableHead>Piegādātājs</TableHead>
                  <TableHead>Vienība</TableHead>
                  <TableHead className="text-right">Cena/vienība</TableHead>
                  <TableHead className="text-right">Piegāde</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[rate.category] ?? rate.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rate.supplierName}</TableCell>
                    <TableCell className="font-mono text-sm">{rate.unit}</TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtEur(rate.pricePerUnit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtEur(rate.deliveryFee)}
                    </TableCell>
                    <TableCell>
                      {isOwn(rate) ? (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(rate.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground mx-2" />
                      )}
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
            <DialogTitle>Jauna izmaksu likme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nosaukums *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Piem. Mūrnieks, Smiltis 0/4..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Kategorija</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Vienība</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Piegādātājs / izmaksas avots</Label>
              <Input
                value={form.supplierName}
                onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                placeholder="Iekšēji, SIA Piemērs..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Cena par vienību (€) *</Label>
                <Input
                  type="number"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>Piegāde (€)</Label>
                <Input
                  type="number"
                  value={form.deliveryFee}
                  onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name || !form.pricePerUnit}>
              {saving ? 'Saglabā...' : 'Pievienot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dzēst likmi?</AlertDialogTitle>
            <AlertDialogDescription>Šī darbība ir neatgriezeniska.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Atcelt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Dzēš...' : 'Dzēst'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
