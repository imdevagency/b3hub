/**
 * Construction — Employees roster
 * /dashboard/construction/employees
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getConstructionEmployees,
  createConstructionEmployee,
  updateConstructionEmployee,
  deleteConstructionEmployee,
  type ConstructionEmployee,
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
import { Users, Plus, RefreshCw, MoreHorizontal } from 'lucide-react';

export default function EmployeesPage() {
  const { token } = useAuth();

  const [employees, setEmployees] = useState<ConstructionEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    role: '',
    phone: '',
    email: '',
    personalCode: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getConstructionEmployees(token, { activeOnly });
      setEmployees(res.data);
    } finally {
      setLoading(false);
    }
  }, [token, activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName || !form.role) return;
    setSaving(true);
    try {
      await createConstructionEmployee(
        {
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          phone: form.phone || undefined,
          email: form.email || undefined,
          personalCode: form.personalCode || undefined,
          notes: form.notes || undefined,
          active: true,
        },
        token,
      );
      setCreateOpen(false);
      setForm({
        firstName: '',
        lastName: '',
        role: '',
        phone: '',
        email: '',
        personalCode: '',
        notes: '',
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await updateConstructionEmployee(id, { active }, token);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteConstructionEmployee(id, token);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Darbinieki"
        description="Celtniecības darbinieku reģistrs"
        icon={Users}
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
              Jauns darbinieks
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
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nav darbinieku"
          description="Pievienojiet pirmo darbinieku."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Jauns darbinieks
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vārds, uzvārds</TableHead>
                  <TableHead>Loma</TableHead>
                  <TableHead>Tālrunis</TableHead>
                  <TableHead>E-pasts</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      {emp.firstName} {emp.lastName}
                    </TableCell>
                    <TableCell>{emp.role}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.phone ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={emp.active ? 'default' : 'secondary'}>
                        {emp.active ? 'Aktīvs' : 'Neaktīvs'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggleActive(emp.id, !emp.active)}>
                            {emp.active ? 'Deaktivēt' : 'Aktivēt'}
                          </DropdownMenuItem>
                          {!emp.active && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(emp.id)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Jauns darbinieks</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vārds *</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Uzvārds *</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Loma / amats *</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Mūrnieks, Elektriķis..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tālrunis</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>E-pasts</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Personas kods</Label>
              <Input
                value={form.personalCode}
                onChange={(e) => setForm({ ...form, personalCode: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Atcelt
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.firstName || !form.lastName || !form.role}
            >
              {saving ? 'Saglabā...' : 'Pievienot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
