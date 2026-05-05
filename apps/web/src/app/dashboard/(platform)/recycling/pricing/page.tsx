/**
 * Recycler portal — pricing rules
 * /dashboard/recycling/pricing
 *
 * Operators configure per-waste-type disposal fees for each of their centers.
 * These rates appear in the buyer's disposal wizard when comparing centers.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMyRecyclingCenters, type RecyclingCenter } from '@/lib/api/recycling-centers';
import {
  recyclerGetPricingRules,
  recyclerUpsertPricingRule,
  recyclerDeletePricingRule,
  type PricingRule,
  type UpsertPricingRulePayload,
} from '@/lib/api/recycling';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Euro, Pencil, Plus, RefreshCw, Trash2, Weight } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const WASTE_TYPES = [
  'CONCRETE',
  'SOIL',
  'BRICK',
  'WOOD',
  'METAL',
  'PLASTIC',
  'MIXED',
  'ASPHALT',
  'GLASS',
  'ORGANIC',
  'HAZARDOUS',
] as const;

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  SOIL: 'Augsne / Grunts',
  BRICK: 'Ķieģeļi / Mūris',
  WOOD: 'Koksne',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  MIXED: 'Jaukti celtniecības',
  ASPHALT: 'Asfaltbetona',
  GLASS: 'Stikls',
  ORGANIC: 'Organika',
  HAZARDOUS: 'Bīstami atkritumi',
};

// ─── Rule form dialog ─────────────────────────────────────────────────────────

interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: UpsertPricingRulePayload) => Promise<void>;
  initial?: PricingRule | null;
  existingWasteTypes: string[];
}

function RuleDialog({ open, onClose, onSave, initial, existingWasteTypes }: RuleFormProps) {
  const isEdit = !!initial;
  const [wasteType, setWasteType] = useState(initial?.wasteType ?? '');
  const [pricePerTonne, setPricePerTonne] = useState(String(initial?.pricePerTonne ?? ''));
  const [minimumWeight, setMinimumWeight] = useState(String(initial?.minimumWeight ?? ''));
  const [minimumFee, setMinimumFee] = useState(String(initial?.minimumFee ?? ''));
  const [maximumWeight, setMaximumWeight] = useState(String(initial?.maximumWeight ?? ''));
  const [accepted, setAccepted] = useState(initial?.accepted ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens for a new rule
  useEffect(() => {
    if (open) {
      setWasteType(initial?.wasteType ?? '');
      setPricePerTonne(String(initial?.pricePerTonne ?? ''));
      setMinimumWeight(String(initial?.minimumWeight ?? ''));
      setMinimumFee(String(initial?.minimumFee ?? ''));
      setMaximumWeight(String(initial?.maximumWeight ?? ''));
      setAccepted(initial?.accepted ?? true);
      setNotes(initial?.notes ?? '');
      setError('');
    }
  }, [open, initial]);

  const availableWasteTypes = WASTE_TYPES.filter(
    (wt) => !existingWasteTypes.includes(wt) || wt === initial?.wasteType,
  );

  async function handleSave() {
    if (!wasteType) {
      setError('Izvēlieties atkritumu veidu.');
      return;
    }
    const price = parseFloat(pricePerTonne);
    if (isNaN(price) || price < 0) {
      setError('Ievadiet derīgu cenu.');
      return;
    }

    const payload: UpsertPricingRulePayload = {
      wasteType,
      pricePerTonne: price,
      accepted,
      notes: notes.trim() || null,
      minimumWeight: minimumWeight ? parseFloat(minimumWeight) || null : null,
      minimumFee: minimumFee ? parseFloat(minimumFee) || null : null,
      maximumWeight: maximumWeight ? parseFloat(maximumWeight) || null : null,
    };

    setSaving(true);
    setError('');
    try {
      await onSave(payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kļūda saglabājot noteikumu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Rediģēt cenas noteikumu' : 'Pievienot cenas noteikumu'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Waste type */}
          <div className="space-y-1.5">
            <Label>Atkritumu veids *</Label>
            {isEdit ? (
              <p className="text-sm font-medium">{WASTE_LABELS[wasteType] ?? wasteType}</p>
            ) : (
              <Select value={wasteType} onValueChange={setWasteType}>
                <SelectTrigger>
                  <SelectValue placeholder="Izvēlieties veidu..." />
                </SelectTrigger>
                <SelectContent>
                  {availableWasteTypes.map((wt) => (
                    <SelectItem key={wt} value={wt}>
                      {WASTE_LABELS[wt] ?? wt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Price per tonne */}
          <div className="space-y-1.5">
            <Label>Cena par tonnu (EUR) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={pricePerTonne}
              onChange={(e) => setPricePerTonne(e.target.value)}
              placeholder="piem. 12.50"
            />
          </div>

          {/* Min/Max weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Minim. svars (t)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={minimumWeight}
                onChange={(e) => setMinimumWeight(e.target.value)}
                placeholder="nav"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Minim. maksa (EUR)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={minimumFee}
                onChange={(e) => setMinimumFee(e.target.value)}
                placeholder="nav"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Maksimālais svars uz reizi (t)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={maximumWeight}
              onChange={(e) => setMaximumWeight(e.target.value)}
              placeholder="nav ierobežojuma"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Piezīmes pircējam</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="piem. Nav keramikas vai flīžu sajaukumā"
            />
          </div>

          {/* Accepted toggle */}
          <div className="flex items-center gap-3">
            <Switch id="accepted" checked={accepted} onCheckedChange={setAccepted} />
            <Label htmlFor="accepted" className="cursor-pointer">
              Centrs pieņem šo atkritumu veidu
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saglabā...' : 'Saglabāt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Center pricing card ───────────────────────────────────────────────────────

function CenterPricingCard({ center, token }: { center: RecyclingCenter; token: string }) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recyclerGetPricingRules(token, center.id);
      setRules(data);
    } finally {
      setLoading(false);
    }
  }, [token, center.id]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  async function handleSave(payload: UpsertPricingRulePayload) {
    await recyclerUpsertPricingRule(token, center.id, payload);
    await loadRules();
  }

  async function handleDelete(rule: PricingRule) {
    setDeletingId(rule.id);
    try {
      await recyclerDeletePricingRule(token, center.id, rule.wasteType);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } finally {
      setDeletingId(null);
    }
  }

  const existingWasteTypes = rules.map((r) => r.wasteType);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">{center.name}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {center.address}, {center.city}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Pievienot
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={Euro}
            title="Nav cenas noteikumu"
            description="Pievieno noteikumu katram atkritumu veidam, ko centrs pieņem."
            className="py-6"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atkritumu veids</TableHead>
                <TableHead className="text-right">EUR/t</TableHead>
                <TableHead className="text-right">Min. svars</TableHead>
                <TableHead className="text-right">Max. svars</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-sm">
                    {WASTE_LABELS[rule.wasteType] ?? rule.wasteType}
                    {rule.notes && (
                      <p className="text-xs text-muted-foreground font-normal mt-0.5 max-w-48 truncate">
                        {rule.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    €{rule.pricePerTonne.toFixed(2)}
                    {rule.minimumFee != null && (
                      <p className="text-xs text-muted-foreground font-normal">
                        min €{rule.minimumFee.toFixed(2)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {rule.minimumWeight != null ? `${rule.minimumWeight} t` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {rule.maximumWeight != null ? `${rule.maximumWeight} t` : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.accepted ? 'default' : 'destructive'} className="text-xs">
                      {rule.accepted ? 'Pieņem' : 'Nepieņem'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditing(rule);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={deletingId === rule.id}
                        onClick={() => handleDelete(rule)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <RuleDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initial={editing}
        existingWasteTypes={existingWasteTypes}
      />
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecyclingPricingPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [centers, setCenters] = useState<RecyclingCenter[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMyRecyclingCenters(token);
      setCenters(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cenas noteikumi"
        description="Konfigurē utilizācijas maksu katram atkritumu veidam. Šīs cenas tiek rādītas pircējiem utilizācijas vedņa salīdzinājuma skatā."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* Info callout */}
      <div className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <Weight className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
        <div>
          <p className="font-medium">Kā cenas tiek izmantotas</p>
          <p className="text-blue-700 mt-1">
            Kad pircējs pasūta atkritumu izvešanu, viņam tiek rādīts centru salīdzinājums ar
            aprēķināto utilizācijas maksu. Cena = cena/t × svars. Minimālā maksa tiek piemērota, ja
            krava ir mazāka par minimālo svaru.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : centers.length === 0 ? (
        <EmptyState
          icon={Weight}
          title="Nav reģistrētu centru"
          description="Reģistrē utilizācijas centru savā profilā, lai varētu pievienot cenas noteikumus."
        />
      ) : (
        <div className="space-y-4">
          {centers.map((center) => (
            <CenterPricingCard key={center.id} center={center} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
