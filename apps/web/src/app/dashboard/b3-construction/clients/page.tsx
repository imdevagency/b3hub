/**
 * B3 Construction — Klienti (Clients)
 * /dashboard/b3-construction/clients
 *
 * Manage construction client companies (companyType: CONSTRUCTION).
 * Clients must exist here before they can be linked to a project.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetConstructionClients,
  adminCreateConstructionClient,
  type AdminConstructionClient,
  type CreateConstructionClientPayload,
} from '@/lib/api/admin';
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
import { Users, Plus, RefreshCw, Building2 } from 'lucide-react';
import { format } from 'date-fns';

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Create Client Dialog ─────────────────────────────────────────────────────

function CreateClientDialog({
  open,
  onClose,
  token,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  onCreated: (client: AdminConstructionClient) => void;
}) {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [registrationNum, setRegistrationNum] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim() && legalName.trim() && email.trim() && phone.trim();

  const reset = () => {
    setName('');
    setLegalName('');
    setRegistrationNum('');
    setTaxId('');
    setEmail('');
    setPhone('');
    setCity('');
    setStreet('');
    setPostalCode('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      const payload: CreateConstructionClientPayload = {
        name: name.trim(),
        legalName: legalName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        registrationNum: registrationNum.trim() || undefined,
        taxId: taxId.trim() || undefined,
        city: city.trim() || undefined,
        street: street.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      };
      const created = await adminCreateConstructionClient(payload, token);
      onCreated(created);
      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nezināma kļūda';
      setError(`Kļūda: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Jauns klients</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>
              Uzņēmuma nosaukums <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="piem. SIA Rīgas Būvnieks"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>
              Juridiskais nosaukums <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Pilns juridiskais nosaukums"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Reģ. numurs</Label>
              <Input
                placeholder="40103XXXXXX"
                value={registrationNum}
                onChange={(e) => setRegistrationNum(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>PVN numurs</Label>
              <Input
                placeholder="LV40103XXXXXX"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>
                E-pasts <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                placeholder="info@uznemums.lv"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>
                Tālrunis <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="+371 2X XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Adrese</Label>
            <Input
              placeholder="Iela, pilsēta"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Pilsēta</Label>
              <Input placeholder="Rīga" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Pasta indekss</Label>
              <Input
                placeholder="LV-1001"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving ? 'Saglabā...' : 'Izveidot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConstructionClientsPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState<AdminConstructionClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetConstructionClients(token);
      setClients(data);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClientCreated = (client: AdminConstructionClient) => {
    setClients((prev) => [client, ...prev]);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Klienti"
        description="Būvniecības uzņēmumi, kuri pasūta B3 Construction zemdarbu pakalpojumus"
        action={
          token ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atjaunot
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Jauns klients
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clients.length}</p>
              <p className="text-xs text-muted-foreground">Kopā klienti</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clients.filter((c) => c.verified).length}</p>
              <p className="text-xs text-muted-foreground">Verificēti</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {clients.reduce((acc, c) => acc + c._count.orders, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Kopā pasūtījumi</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Uzņēmums</TableHead>
                <TableHead>Reģ. nr.</TableHead>
                <TableHead>Kontakti</TableHead>
                <TableHead>Pilsēta</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">Pievienots</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <EmptyState
                      icon={Users}
                      title="Nav klientu"
                      description="Pievienojiet pirmo klientu, lai varētu izveidot projektus."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.legalName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {client.registrationNum ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{client.email}</p>
                        <p className="text-muted-foreground">{client.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{client.city || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={client.verified ? 'default' : 'secondary'}>
                        {client.verified ? 'Verificēts' : 'Nevifficēts'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(client.createdAt), 'dd.MM.yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {token && (
        <CreateClientDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          token={token}
          onCreated={handleClientCreated}
        />
      )}
    </div>
  );
}
