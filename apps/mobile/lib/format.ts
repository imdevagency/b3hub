/**
 * Shared date-formatting helpers used across multiple screens.
 * Locale: lv-LV (Latvia)
 */

/**
 * Returns a full long-form date, e.g. "3. jūlijs 2025".
 * The `T00:00:00` suffix prevents off-by-one with date-only ISO strings.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Returns a short date + time string, e.g. "3. jūl., 14:05".
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('lv-LV', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
