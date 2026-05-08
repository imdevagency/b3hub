/**
 * Recycler — APUS (Atkritumu plūsmu uzskaites sistēma)
 * /dashboard/recycling/apus
 *
 * Latvia's mandatory waste flow tracking system (VVD). Licensed recycling
 * operators must report every waste intake/output movement. This page lets
 * the operator:
 *  – View all waste records with their APUS submission status
 *  – Mark individual records as SUBMITTED (after filing in VVD portal)
 *  – Bulk-mark all PENDING records as SUBMITTED
 *  – Add a submission ID and note to each record
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerWasteRecords, recyclerUpdateWasteRecord } from '@/lib/api';
import type { RecyclerWasteRecord } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  RefreshCw,
  SendHorizonal,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WASTE_TYPE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons',
  SOIL: 'Grunts',
  RUBBLE: 'Gruži',
  METAL: 'Metāls',
  WOOD: 'Koks',
  MIXED: 'Jaukti',
  ASPHALT: 'Asfalts',
  GLASS: 'Stikls',
  PLASTIC: 'Plastmasa',
  GYPSUM: 'Ģipsis',
};

function apusBadge(status?: string | null) {
  if (!status || status === 'PENDING') {
    return (
      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
        <Clock className="h-3 w-3 mr-1" />
        Gaida
      </Badge>
    );
  }
  if (status === 'SUBMITTED') {
    return (
      <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Iesniegts
      </Badge>
    );
  }
  if (status === 'ERROR') {
    return (
      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Kļūda
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApusPage() {
  const { token } = useAuth();

  const [records, setRecords] = useState<RecyclerWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RecyclerWasteRecord | null>(null);
  const [submissionId, setSubmissionId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const all = await getRecyclerWasteRecords(token);
      setRecords(all);
    } catch {
      setError('Neizdevās ielādēt ierakstus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function openDialog(r: RecyclerWasteRecord) {
    setSelected(r);
    setSubmissionId(r.apusSubmissionId ?? '');
    setNote(r.apusNote ?? '');
    setOpen(true);
  }

  async function submitRecord() {
    if (!token || !selected) return;
    if (!selected.recyclingCenter?.id) return;
    setSaving(true);
    try {
      await recyclerUpdateWasteRecord(token, selected.recyclingCenter.id, selected.id, {
        apusStatus: 'SUBMITTED',
        apusSubmissionId: submissionId || undefined,
        apusNote: note || undefined,
      });
      setOpen(false);
      await load();
    } catch {
      setError('Neizdevās atjaunināt ierakstu.');
    } finally {
      setSaving(false);
    }
  }

  async function bulkSubmit() {
    if (!token) return;
    const pending = records.filter(
      (r) => (!r.apusStatus || r.apusStatus === 'PENDING') && r.recyclingCenter?.id,
    );
    if (pending.length === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        pending.map((r) =>
          recyclerUpdateWasteRecord(token, r.recyclingCenter!.id, r.id, {
            apusStatus: 'SUBMITTED',
          }),
        ),
      );
      await load();
    } catch {
      setError('Neizdevās iesniegt visus ierakstus.');
    } finally {
      setBulkSaving(false);
    }
  }

  const pendingCount = records.filter((r) => !r.apusStatus || r.apusStatus === 'PENDING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="APUS"
        description="Atkritumu plūsmu uzskaites sistēma — VVD obligātā ziņošana"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atjaunot
            </Button>
            {pendingCount > 0 && (
              <Button size="sm" onClick={bulkSubmit} disabled={bulkSaving}>
                <SendHorizonal className="h-4 w-4 mr-1.5" />
                {bulkSaving ? 'Iesniedz...' : `Iesniegt visus (${pendingCount})`}
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nav atkritumu ierakstu"
          description="Kad tiks reģistrēta pirmā atkritumu pieņemšana, ieraksti parādīsies šeit."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datums</TableHead>
                  <TableHead>Centrs</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead className="text-right">Svars (t)</TableHead>
                  <TableHead>APUS statuss</TableHead>
                  <TableHead>Iesniegšanas ID</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {format(new Date(r.createdAt), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.recyclingCenter?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {WASTE_TYPE_LABELS[r.wasteType] ?? r.wasteType}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {(r as any).weightKg != null ? ((r as any).weightKg / 1000).toFixed(3) : '—'}
                    </TableCell>
                    <TableCell>{apusBadge(r.apusStatus)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {r.apusSubmissionId ?? '—'}
                    </TableCell>
                    <TableCell>
                      {(!r.apusStatus || r.apusStatus === 'PENDING') && (
                        <Button size="sm" variant="outline" onClick={() => openDialog(r)}>
                          Iesniegt
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Submit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iesniegt APUS ierakstu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>APUS iesniegšanas ID (no VVD portāla)</Label>
              <Input
                placeholder="piem. APUS-2026-00123"
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Piezīme</Label>
              <Input
                placeholder="Pēc izvēles"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={submitRecord} disabled={saving}>
              {saving ? 'Saglabā...' : 'Iesniegt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
