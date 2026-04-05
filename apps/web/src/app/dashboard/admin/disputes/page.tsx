/**
 * Admin Disputes page — /dashboard/admin/disputes
 * Lists all disputes raised by buyers. Admins can update status and add resolution notes.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  listDisputes,
  updateDispute,
  type ApiDispute,
  type DisputeStatus,
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  getDisputeStatusColor,
} from '@/lib/api/disputes';
import { AlertTriangle, ChevronRight, RefreshCw, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_FILTERS: { value: 'ALL' | DisputeStatus; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'OPEN', label: 'Jauni' },
  { value: 'UNDER_REVIEW', label: 'Izskatīšanā' },
  { value: 'RESOLVED', label: 'Atrisināti' },
  { value: 'REJECTED', label: 'Noraidīti' },
];

export default function AdminDisputesPage() {
  const { token, user } = useAuth();
  const [disputes, setDisputes] = useState<ApiDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DisputeStatus>('ALL');
  const [selected, setSelected] = useState<ApiDispute | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [updateStatus, setUpdateStatus] = useState<DisputeStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listDisputes(token);
      setDisputes(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selected) {
      setResolutionText(selected.resolution ?? '');
      setUpdateStatus(selected.status);
      setSaveError('');
    }
  }, [selected]);

  const handleSave = async () => {
    if (!token || !selected || !updateStatus) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateDispute(
        selected.id,
        { status: updateStatus as DisputeStatus, resolution: resolutionText || undefined },
        token,
      );
      setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelected(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kļūda saglabājot');
    } finally {
      setSaving(false);
    }
  };

  if (user?.userType !== 'ADMIN') {
    return <div className="p-8 text-center text-muted-foreground">Pieeja atteikta.</div>;
  }

  const filtered =
    statusFilter === 'ALL' ? disputes : disputes.filter((d) => d.status === statusFilter);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Sūdzības" description="Pircēju iesniegtās pretenzijas par pasūtījumiem" />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f.label}
            {f.value !== 'ALL' && (
              <span className="ml-1.5 text-xs opacity-75">
                ({disputes.filter((d) => d.status === f.value).length})
              </span>
            )}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <AlertTriangle className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nav sūdzību šajā kategorijā</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="w-full text-left rounded-2xl border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDisputeStatusColor(d.status)}`}
                    >
                      {DISPUTE_STATUS_LABELS[d.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {DISPUTE_REASON_LABELS[d.reason]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold truncate">
                    Pasūtījums #{d.order.orderNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {d.raisedBy.firstName} {d.raisedBy.lastName} · {d.order.deliveryAddress}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {d.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString('lv-LV')}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail panel (slide-over style modal) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/30 backdrop-blur-sm">
          <div className="w-full sm:w-120 h-full sm:h-auto sm:max-h-[90vh] bg-white shadow-2xl flex flex-col overflow-hidden sm:rounded-2xl sm:mr-4 sm:my-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <p className="font-bold">Sūdzība — #{selected.order.orderNumber}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {DISPUTE_REASON_LABELS[selected.reason]}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 hover:bg-muted transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Info */}
              <div className="rounded-xl bg-muted/40 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Iesniedzējs</span>
                  <span className="font-medium">
                    {selected.raisedBy.firstName} {selected.raisedBy.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-pasts</span>
                  <span className="font-medium">{selected.raisedBy.email ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Iesniegts</span>
                  <span className="font-medium">
                    {new Date(selected.createdAt).toLocaleDateString('lv-LV', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pasūtījums</span>
                  <Link
                    href={`/dashboard/admin/orders/${selected.orderId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    #{selected.order.orderNumber}
                  </Link>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Apraksts
                </p>
                <p className="text-sm leading-relaxed">{selected.description}</p>
              </div>

              {/* Admin action */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Atjaunināt statusu
                </p>
                <Select
                  value={updateStatus}
                  onValueChange={(v) => setUpdateStatus(v as DisputeStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izvēlēties statusu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Jauns</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Izskatīšanā</SelectItem>
                    <SelectItem value="RESOLVED">Atrisināts</SelectItem>
                    <SelectItem value="REJECTED">Noraidīts</SelectItem>
                  </SelectContent>
                </Select>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Atbildes teksts <span className="font-normal normal-case">(neobligāts)</span>
                  </p>
                  <Textarea
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="Paskaidrojiet lēmumu vai nākamās darbības..."
                    rows={3}
                  />
                </div>

                {saveError && <p className="text-xs text-destructive">{saveError}</p>}

                <Button onClick={handleSave} disabled={saving || !updateStatus} className="w-full">
                  {saving ? 'Saglabā...' : 'Saglabāt izmaiņas'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
