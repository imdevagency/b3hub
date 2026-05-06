/**
 * Recycler waste records — /dashboard/recycling/waste-records
 * All waste intake records across this operator's recycling centers.
 * Eligible records (processed, recyclableWeight > 0, no listing yet) can be
 * converted to marketplace Material listings directly by the operator.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getRecyclerWasteRecords,
  recyclerCreateListing,
  recyclerUpdateWasteRecord,
} from '@/lib/api';
import type { RecyclerWasteRecord } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ClipboardList,
  ExternalLink,
  ArrowRightCircle,
  CheckCircle2,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { fmtDate } from '@/lib/format';

// ── Display maps ──────────────────────────────────────────────────────────────

const STAGE_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  RECEIVED: { label: 'Saņemts', variant: 'outline' },
  SORTED: { label: 'Šķirots', variant: 'outline' },
  PROCESSING: { label: 'Apstrādē', variant: 'default' },
  PROCESSED: { label: 'Apstrādāts', variant: 'secondary' },
  LISTED: { label: 'Tirgū', variant: 'secondary' },
  REJECTED: { label: 'Noraidīts', variant: 'destructive' },
};

const RC_GRADE_LABELS: Record<string, string> = {
  RC_A: 'RC-A',
  RC_B: 'RC-B',
  RC_C: 'RC-C',
  UNGRADED: '',
};

const STAGE_SEQUENCE: Record<string, string> = {
  RECEIVED: 'SORTED',
  SORTED: 'PROCESSING',
  PROCESSING: 'PROCESSED',
};

const APUS_OPTIONS = [
  { value: 'NOT_REQUIRED', label: 'Nav nepieciešams' },
  { value: 'PENDING', label: 'Gaidīšanas rindā' },
  { value: 'SUBMITTED', label: 'Iesniegts' },
  { value: 'ACCEPTED', label: 'Apstiprināts' },
  { value: 'REJECTED', label: 'Noraidīts' },
] as const;

function formatWeight(weightKg?: number | null): string {
  if (weightKg == null) return '—';
  if (weightKg >= 1000) return `${(weightKg / 1000).toFixed(2)} t`;
  return `${weightKg} kg`;
}

// ── Convert to listing dialog ─────────────────────────────────────────────────

function ConvertDialog({
  record,
  open,
  onClose,
  onSuccess,
}: {
  record: RecyclerWasteRecord | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (updatedRecord: RecyclerWasteRecord) => void;
}) {
  const { token } = useAuth();
  const [price, setPrice] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when record changes
  useEffect(() => {
    if (record) {
      setPrice('');
      setName('');
      setError(null);
    }
  }, [record]);

  async function handleSubmit() {
    if (!record || !token) return;
    const basePrice = parseFloat(price);
    if (!price || isNaN(basePrice) || basePrice <= 0) {
      setError('Ievadiet derīgu cenu (> 0)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await recyclerCreateListing(token, record.id, {
        basePrice,
        name: name.trim() || undefined,
      });
      onSuccess({ ...record, producedMaterialId: result.material.id });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightCircle className="h-5 w-5 text-emerald-600" />
            Pārvērst tirgus sarakstā
          </DialogTitle>
          <DialogDescription>
            {formatWeight(record.recyclableWeight)} pārstrādājamā materiāla no{' '}
            <strong>{record.wasteType}</strong> tiks publicēts kā RC materiāls tirgū.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="listing-name">Nosaukums (nav obligāts)</Label>
            <Input
              id="listing-name"
              placeholder={`RC materiāls — ${record.recyclingCenter?.name ?? ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="listing-price">
              Cena par tonnu (EUR) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="listing-price"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="p.ē. 12.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Atcelt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? 'Publicē...' : 'Publicēt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── APUS tracking dialog ──────────────────────────────────────────────────────

function ApusDialog({
  record,
  open,
  onClose,
  onSuccess,
}: {
  record: RecyclerWasteRecord | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: RecyclerWasteRecord) => void;
}) {
  const { token } = useAuth();
  const [apusStatus, setApusStatus] = useState('');
  const [apusSubmissionId, setApusSubmissionId] = useState('');
  const [apusNote, setApusNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setApusStatus(record.apusStatus ?? 'NOT_REQUIRED');
      setApusSubmissionId(record.apusSubmissionId ?? '');
      setApusNote(record.apusNote ?? '');
      setError(null);
    }
  }, [record]);

  async function handleSave() {
    if (!record || !token || !record.recyclingCenter?.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await recyclerUpdateWasteRecord(token, record.recyclingCenter.id, record.id, {
        apusStatus: apusStatus || undefined,
        apusSubmissionId: apusSubmissionId.trim() || undefined,
        apusNote: apusNote.trim() || undefined,
      });
      onSuccess(updated);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            APUS izsekošana
          </DialogTitle>
          <DialogDescription>
            Atjauniniet APUS reģistrācijas statusu šim atkritumu ierakstam.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Statuss</Label>
            <Select value={apusStatus} onValueChange={setApusStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Izvēlieties statusu" />
              </SelectTrigger>
              <SelectContent>
                {APUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apus-id">Iesnieguma ID</Label>
            <Input
              id="apus-id"
              placeholder="APUS iesnieguma numurs"
              value={apusSubmissionId}
              onChange={(e) => setApusSubmissionId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apus-note">Piezīme</Label>
            <Input
              id="apus-note"
              placeholder="Papildu informācija"
              value={apusNote}
              onChange={(e) => setApusNote(e.target.value)}
            />
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecyclerWasteRecordsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [records, setRecords] = useState<RecyclerWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<RecyclerWasteRecord | null>(null);
  const [apusTarget, setApusTarget] = useState<RecyclerWasteRecord | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;
    getRecyclerWasteRecords(token)
      .then(setRecords)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, token]);

  function handleConvertSuccess(updated: RecyclerWasteRecord) {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleApusSuccess(updated: RecyclerWasteRecord) {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleAdvanceStage(record: RecyclerWasteRecord) {
    const nextStage = STAGE_SEQUENCE[record.processingStage ?? ''];
    if (!nextStage || !token || !record.recyclingCenter?.id) return;
    setAdvancingId(record.id);
    try {
      const updated = await recyclerUpdateWasteRecord(token, record.recyclingCenter.id, record.id, {
        processingStage: nextStage,
      });
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      // silent — user can retry
    } finally {
      setAdvancingId(null);
    }
  }

  if (isLoading || !user) return <PageSpinner />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        title="Atkritumu žurnāls"
        description="Pieņemtie atkritumi un apstrādes rekordi visos jūsu centros"
      />

      {loading && <PageSpinner />}

      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Nav atkritumu rekordu"
          description="Šeit parādīsies pieņemto atkritumu apstrādes ieraksti"
        />
      )}

      {!loading && !error && records.length > 0 && (
        <div className="space-y-3">
          {records.map((record) => {
            const stageMeta = record.processingStage
              ? (STAGE_META[record.processingStage] ?? {
                  label: record.processingStage,
                  variant: 'outline' as const,
                })
              : null;

            const gradeLabel =
              record.rcGrade && record.rcGrade !== 'UNGRADED'
                ? (RC_GRADE_LABELS[record.rcGrade] ?? record.rcGrade)
                : null;

            const canConvert = (record.recyclableWeight ?? 0) > 0 && !record.producedMaterialId;

            return (
              <Card key={record.id} className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{record.wasteType}</p>
                        {gradeLabel && (
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            {gradeLabel}
                          </span>
                        )}
                      </div>
                      {record.recyclingCenter && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {record.recyclingCenter.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Svars: {formatWeight(record.weightKg)}
                        {(record.recyclableWeight ?? 0) > 0 && (
                          <span className="ml-2 text-emerald-700 font-medium">
                            · Pārstrādājams: {formatWeight(record.recyclableWeight)}
                            {record.recyclingRate != null && ` (${record.recyclingRate}%)`}
                          </span>
                        )}
                      </p>
                      {record.weighbridgeTicketRef && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Svēršanas biļete:{' '}
                          <span className="font-mono">{record.weighbridgeTicketRef}</span>
                        </p>
                      )}
                      {record.certificateUrl && (
                        <a
                          href={record.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          Sertifikāts <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {stageMeta && (
                        <Badge variant={stageMeta.variant} className="whitespace-nowrap">
                          {stageMeta.label}
                        </Badge>
                      )}
                      {STAGE_SEQUENCE[record.processingStage ?? ''] && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          disabled={advancingId === record.id}
                          onClick={() => handleAdvanceStage(record)}
                        >
                          <ChevronRight className="size-3.5 mr-1" />
                          {advancingId === record.id
                            ? 'Virzās...'
                            : `→ ${STAGE_META[STAGE_SEQUENCE[record.processingStage ?? '']]?.label}`}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => setApusTarget(record)}
                      >
                        <Shield className="size-3.5 mr-1" />
                        APUS
                      </Button>
                      {record.producedMaterialId ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle2 className="size-3.5" /> Tirgū
                        </span>
                      ) : canConvert ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setConvertTarget(record)}
                        >
                          <ArrowRightCircle className="size-3.5 mr-1" />
                          Pārvērst sarakstā
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Izveidots {fmtDate(record.createdAt)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConvertDialog
        record={convertTarget}
        open={convertTarget !== null}
        onClose={() => setConvertTarget(null)}
        onSuccess={handleConvertSuccess}
      />
      <ApusDialog
        record={apusTarget}
        open={apusTarget !== null}
        onClose={() => setApusTarget(null)}
        onSuccess={handleApusSuccess}
      />
    </div>
  );
}
