/**
 * Shared formatting utilities used across all dashboard pages.
 * Centralises locale-specific date and currency formatting so pages
 * don't each define their own fmtDate / fmtMoney helpers.
 */

/** Format an ISO date string to dd.mm.yyyy (Latvian locale). Returns '—' for falsy values. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format an ISO date string to dd.mm.yyyy HH:MM (Latvian locale). Returns '—' for falsy values. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a number as a Euro amount: €1 234.  Rounds to nearest integer. */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return `€${Math.round(n).toLocaleString('lv-LV')}`;
}

/** Format a number as a Euro amount with decimal cents: €1 234.56 */
export function fmtMoneyExact(n: number | null | undefined): string {
  if (n == null) return '—';
  return `€${n.toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a weight in kg to tonnes if ≥ 1000, otherwise keep kg. */
export function fmtWeight(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t`;
  return `${kg.toLocaleString('lv-LV')} kg`;
}
