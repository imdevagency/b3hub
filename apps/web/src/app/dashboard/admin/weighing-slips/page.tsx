/**
 * Admin — Weighing Slips
 * /dashboard/admin/weighing-slips
 *
 * Lists all recorded weighing slips. Operators can create new slips by
 * entering a pass number and weight readings.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Scale, Plus, XCircle, CheckCircle2, Loader2, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDate } from '@/lib/format';
import {
  getWeighingSlipsAdmin,
  createWeighingSlip,
  voidWeighingSlip,
  getFieldPassesAdmin,
  type ApiWeighingSlip,
  type ApiFieldPass,
} from '@/lib/api';

// ─── Slip row ─────────────────────────────────────────────────────────────────

function SlipRow({
  slip,
  onVoid,
}: {
  slip: ApiWeighingSlip;
  onVoid: (s: ApiWeighingSlip) => void;
}) {
  const voided = Boolean(slip.voidedAt);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                voided ? 'bg-red-50 text-red-400' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <Scale className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{slip.slipNumber}</span>
                {voided ? (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    Anulēts
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-xs bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Derīgs
                  </Badge>
                )}
              </div>
              {slip.fieldPass && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Caurlaide: {slip.fieldPass.passNumber} · {slip.fieldPass.vehiclePlate}
                  {slip.fieldPass.driverName ? ` · ${slip.fieldPass.driverName}` : ''}
                </p>
              )}
              {slip.operatorName && (
                <p className="text-xs text-muted-foreground">
                  Operators: {slip.operatorName}
                  {slip.operatorCompany ? ` (${slip.operatorCompany})` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!voided && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onVoid(slip)}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Anulēt
              </Button>
            )}
          </div>
        </div>

        {/* Weight breakdown */}
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div className="rounded bg-muted px-2 py-1.5">
            <p className="text-muted-foreground">Bruto</p>
            <p className="font-semibold text-sm">{slip.grossTonnes.toFixed(3)} t</p>
          </div>
          <div className="rounded bg-muted px-2 py-1.5">
            <p className="text-muted-foreground">Tara</p>
            <p className="font-semibold text-sm">{slip.tareTonnes.toFixed(3)} t</p>
          </div>
          <div className="rounded bg-emerald-50 px-2 py-1.5">
            <p className="text-emerald-600">Neto</p>
            <p className="font-semibold text-sm text-emerald-700">{slip.netTonnes.toFixed(3)} t</p>
          </div>
        </div>

        {/* Footer row */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>Reģistrēts: {fmtDate(slip.createdAt)}</span>
          {slip.voidedAt && (
            <span className="text-destructive">
              Anulēts: {fmtDate(slip.voidedAt)}
              {slip.voidedReason ? ` — ${slip.voidedReason}` : ''}
            </span>
          )}
          {slip.notes && <span>Piezīme: {slip.notes}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateDialog({
  open,
  passes,
  onClose,
  onCreated,
  token,
}: {
  open: boolean;
  passes: ApiFieldPass[];
  onClose: () => void;
  onCreated: () => void;
  token: string;
}) {
  const [passSearch, setPassSearch] = useState('');
  const [selectedPassId, setSelectedPassId] = useState('');
  const [grossTonnes, setGrossTonnes] = useState('');
  const [tareTonnes, setTareTonnes] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorCompany, setOperatorCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = passes.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      (p.passNumber.toLowerCase().includes(passSearch.toLowerCase()) ||
        p.vehiclePlate.toLowerCase().includes(passSearch.toLowerCase())),
  );

  const netTonnes = parseFloat(grossTonnes) - parseFloat(tareTonnes);

  const handleSubmit = async () => {
    setError('');
    if (!selectedPassId) return setError('Izvēlieties caurlaidi');
    const gross = parseFloat(grossTonnes);
    const tare = parseFloat(tareTonnes);
    if (isNaN(gross) || gross <= 0) return setError('Ievadiet derīgu bruto svaru');
    if (isNaN(tare) || tare < 0) return setError('Ievadiet derīgu tara svaru');
    if (tare >= gross) return setError('Tara nevar būt lielāka vai vienāda ar bruto');

    setSaving(true);
    try {
      await createWeighingSlip(
        {
          passId: selectedPassId,
          grossTonnes: gross,
          tareTonnes: tare,
          operatorName: operatorName.trim() || undefined,
          operatorCompany: operatorCompany.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        token,
      );
      onCreated();
      onClose();
      setSelectedPassId('');
      setGrossTonnes('');
      setTareTonnes('');
      setOperatorName('');
      setOperatorCompany('');
      setNotes('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Jauns svēršanas akts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pass search */}
          <div className="space-y-2">
            <Label>Caurlaide *</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Meklēt pēc numura vai auto..."
                value={passSearch}
                onChange={(e) => setPassSearch(e.target.value)}
              />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Nav aktīvu caurlaiž</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPassId(p.id)}
                    className={`w-full text-left rounded px-2 py-1.5 text-sm transition-colors ${
                      selectedPassId === p.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium">{p.passNumber}</span>
                    <span className="ml-2 text-xs opacity-70">{p.vehiclePlate}</span>
                    {p.driverName && (
                      <span className="ml-2 text-xs opacity-60">{p.driverName}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Weight inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bruto svars (t) *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                placeholder="28.540"
                value={grossTonnes}
                onChange={(e) => setGrossTonnes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tara svars (t) *</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                placeholder="14.200"
                value={tareTonnes}
                onChange={(e) => setTareTonnes(e.target.value)}
              />
            </div>
          </div>

          {/* Net display */}
          {grossTonnes && tareTonnes && !isNaN(netTonnes) && netTonnes > 0 && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm">
              <span className="text-emerald-700 font-medium">Neto svars: </span>
              <span className="text-emerald-800 font-bold">{netTonnes.toFixed(3)} t</span>
            </div>
          )}

          {/* Operator */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Operatora vārds</Label>
              <Input
                placeholder="Jānis Bērziņš"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Uzņēmums</Label>
              <Input
                placeholder="SIA Svari"
                value={operatorCompany}
                onChange={(e) => setOperatorCompany(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Piezīmes</Label>
            <Input
              placeholder="Papildu komentāri..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Saglabāt aktu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Void dialog ──────────────────────────────────────────────────────────────

function VoidDialog({
  slip,
  onClose,
  onVoided,
  token,
}: {
  slip: ApiWeighingSlip | null;
  onClose: () => void;
  onVoided: () => void;
  token: string;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!slip) return null;

  const handleVoid = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await voidWeighingSlip(slip.id, reason.trim(), token);
      onVoided();
      onClose();
      setReason('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(slip)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anulēt svēršanas aktu {slip.slipNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Anulēšana ir neatgriezeniska. Neto svars ({slip.netTonnes.toFixed(3)} t) tiks norakstīts
            no caurlaides patēriņa.
          </p>
          <div className="space-y-1.5">
            <Label>Anulēšanas iemesls *</Label>
            <Input
              placeholder="Piemērs: Svēršanas kļūda"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Atcelt
          </Button>
          <Button variant="destructive" onClick={handleVoid} disabled={saving || !reason.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Anulēt aktu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminWeighingSlipsPage() {
  const { token, user } = useAuth();
  const [slips, setSlips] = useState<ApiWeighingSlip[]>([]);
  const [passes, setPasses] = useState<ApiFieldPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [voidSlip, setVoidSlip] = useState<ApiWeighingSlip | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getWeighingSlipsAdmin(token), getFieldPassesAdmin(token)]);
      setSlips(s);
      setPasses(p);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.userType === 'ADMIN') load();
  }, [user, load]);

  if (!user || user.userType !== 'ADMIN') return null;

  const filtered = slips.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.slipNumber.toLowerCase().includes(q) ||
      s.fieldPass?.passNumber.toLowerCase().includes(q) ||
      s.fieldPass?.vehiclePlate.toLowerCase().includes(q) ||
      s.operatorName?.toLowerCase().includes(q)
    );
  });

  const totalNet = slips.filter((s) => !s.voidedAt).reduce((sum, s) => sum + s.netTonnes, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Svēršanas akti"
        description={`Kopā ${slips.filter((s) => !s.voidedAt).length} derīgi akti · ${totalNet.toFixed(2)} t`}
        action={
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Jauns akts
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Meklēt pēc numura, caurlaides, auto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nav svēršanas aktu"
          description="Reģistrējiet pirmo aktu, nospiežot pogu augšā."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SlipRow key={s.id} slip={s} onVoid={setVoidSlip} />
          ))}
        </div>
      )}

      <CreateDialog
        open={showCreate}
        passes={passes}
        onClose={() => setShowCreate(false)}
        onCreated={load}
        token={token ?? ''}
      />

      <VoidDialog
        slip={voidSlip}
        onClose={() => setVoidSlip(null)}
        onVoided={load}
        token={token ?? ''}
      />
    </div>
  );
}
