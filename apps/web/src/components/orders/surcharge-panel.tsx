'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Zap } from 'lucide-react';
import { fmtMoney } from '@/lib/format';
import { getOrder, addOrderSurcharge, removeOrderSurcharge } from '@/lib/api';
import type { ApiOrderSurcharge, SurchargeType } from '@/lib/api';

export const SURCHARGE_LABELS: Record<SurchargeType, string> = {
  FUEL: 'Degvielas piemaksa',
  WAITING_TIME: 'Gaidīšanas laiks',
  WEEKEND: 'Nedēļas nogale',
  OVERWEIGHT: 'Pārslogots',
  NARROW_ACCESS: 'Šaura pieeja',
  REMOTE_AREA: 'Attālināta zona',
  TOLL: 'Ceļa nodeva',
  OTHER: 'Cits',
};

interface SurchargePanelProps {
  orderId: string;
  token: string;
  initialSurcharges?: ApiOrderSurcharge[];
}

export function SurchargePanel({ orderId, token, initialSurcharges }: SurchargePanelProps) {
  const [surcharges, setSurcharges] = useState<ApiOrderSurcharge[]>(initialSurcharges ?? []);
  const [loading, setLoading] = useState(!initialSurcharges);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<SurchargeType>('FUEL');
  const [formLabel, setFormLabel] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch surcharges on first render if not provided
  useEffect(() => {
    if (initialSurcharges) return;
    getOrder(orderId, token)
      .then((o) => setSurcharges(o.surcharges ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    const amount = parseFloat(formAmount);
    if (!formLabel.trim() || isNaN(amount) || amount <= 0) {
      setFormError('Lūdzu aizpildiet visus laukus.');
      return;
    }
    setAdding(true);
    setFormError(null);
    try {
      const created = await addOrderSurcharge(
        orderId,
        { type: formType, label: formLabel.trim(), amount },
        token,
      );
      setSurcharges((prev) => [...prev, created]);
      setFormLabel('');
      setFormAmount('');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kļūda pievienojot piemaksu');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (surchargeId: string) => {
    setRemoving(surchargeId);
    try {
      await removeOrderSurcharge(orderId, surchargeId, token);
      setSurcharges((prev) => prev.filter((s) => s.id !== surchargeId));
    } catch {
      // silently ignore
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground py-2">Ielādē piemaksas…</p>;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Zap className="size-3" /> Piemaksas
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
        >
          <Plus className="size-3" /> Pievienot
        </button>
      </div>

      {surcharges.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">Nav piemaksu</p>
      )}

      {surcharges.map((s) => (
        <div key={s.id} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {s.label}{' '}
            <span className="text-xs opacity-60">({SURCHARGE_LABELS[s.type] ?? s.type})</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{fmtMoney(s.amount)}</span>
            <button
              disabled={removing === s.id}
              onClick={() => handleRemove(s.id)}
              className="text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="rounded-xl bg-muted/50 p-3 space-y-2">
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value as SurchargeType)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          >
            {(Object.keys(SURCHARGE_LABELS) as SurchargeType[]).map((t) => (
              <option key={t} value={t}>
                {SURCHARGE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Apraksts (piem. Degviela 10%)"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            type="number"
            placeholder="Summa (EUR)"
            min="0"
            step="0.01"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Atcelt
            </button>
            <button
              disabled={adding}
              onClick={handleAdd}
              className="rounded-lg bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {adding ? 'Saglabā…' : 'Saglabāt'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
