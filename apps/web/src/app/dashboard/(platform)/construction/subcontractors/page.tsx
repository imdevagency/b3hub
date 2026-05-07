/**
 * Construction — Subcontractors register
 * /dashboard/construction/subcontractors
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getConstructionSubcontractors,
  createConstructionSubcontractor,
  updateConstructionSubcontractor,
  deleteConstructionSubcontractor,
  type ConstructionSubcontractor,
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
import { Switch } from '@/components/ui/switch';
import { Briefcase, Plus, RefreshCw, MoreHorizontal } from 'lucide-react';

export default function SubcontractorsPage() {
  const { token } = useAuth();

  const [subs, setSubs] = useState<ConstructionSubcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    registrationNo: '',
    contactPerson: '',
    phone: '',
    email: '',
    speciality: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getConstructionSubcontractors(token, {
        active: activeOnly ? true : undefined,
      });
      setSubs(res.data);
    } finally {
      setLoading(false);
    }
  }, [token, activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await createConstructionSubcontractor(
        {
          name: form.name,
          registrationNo: form.registrationNo || undefined,
          contactPerson: form.contactPerson || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          speciality: form.speciality || undefined,
          notes: form.notes || undefined,
          active: true,
        },
        token,
      );
      setCreateOpen(false);
      setForm({
        name: '',
        registrationNo: '',
        contactPerson: '',
        phone: '',
        email: '',
        speciality: '',
        notes: '',
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await updateConstructionSubcontractor(id, { active }, token);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteConstructionSubcontractor(id, token);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apakšuzņēmēji"
        description="Sadarbības uzņēmumu reģistrs"
        icon={Briefcase}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
              <span className="text-muted-foreground">Tikai aktīvie</span>
            </div>
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Pievienot
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
      ) : subs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nav apakšuzņēmēju"
          description="Pievienojiet sadarbības uzņēmumus."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Pievienot
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uzņēmums</TableHead>
                  <TableHead>Reg. nr.</TableHead>
                  <TableHead>Specialitāte</TableHead>
                  <TableHead>Kontaktpersona</TableHead>
                  <TableHead>Tālrunis</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Līgumi</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {sub.registrationNo ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sub.speciality ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.contactPerson ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sub.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={sub.active ? 'default' : 'secondary'}>
                        {sub.active ? 'Aktīvs' : 'Neaktīvs'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{sub._count?.engagements ?? 0}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggleActive(sub.id, !sub.active)}>
                            {sub.active ? 'Deaktivēt' : 'Aktivēt'}
                          </DropdownMenuItem>
                          {!sub.active && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(sub.id)}
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
            <DialogTitle>Jauns apakšuzņēmējs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Uzņēmuma nosaukums *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Reģistrācijas nr.</Label>
                <Input
                  value={form.registrationNo}
                  onChange={(e) => setForm({ ...form, registrationNo: e.target.value })}
                  placeholder="40000000000"
                />
              </div>
              <div className="space-y-1">
                <Label>Specialitāte</Label>
                <Input
                  value={form.speciality}
                  onChange={(e) => setForm({ ...form, speciality: e.target.value })}
                  placeholder="Elektriķi, Santehniķi..."
                />
              </div>
              <div className="space-y-1">
                <Label>Kontaktpersona</Label>
                <Input
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tālrunis</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>E-pasts</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Piezīmes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.name}>
              {saving ? 'Saglabā...' : 'Pievienot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
