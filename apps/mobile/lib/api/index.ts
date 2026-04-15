/**
 * lib/api/index.ts
 *
 * Central export for all API modules.
 * Assembles domain-specific function groups into the single `api` object
 * and re-exports all types for backwards compatibility.
 */

// ─── Domain modules ────────────────────────────────────────────────────────
export * from './auth';
export * from './orders';
export * from './skip-hire';
export * from './transport';
export * from './materials';
export * from './quote-requests';
export * from './invoices';
export * from './notifications';
export * from './documents';
export * from './chat';
export * from './containers';
export * from './payments';
export * from './saved-addresses';

export * from './company';
export * from './projects';
export * from './field-passes';
export * from './analytics';
export * from './carrier-settings';
// Re-export the helper for consumers that need it directly
export { apiFetch } from './common';

// ─── Named imports needed to assemble `api` ────────────────────────────────
import { authApi } from './auth';
import { ordersApi } from './orders';
import { skipHireApi } from './skip-hire';
import { transportApi } from './transport';
import { materialsApi } from './materials';
import { quoteRequestsApi } from './quote-requests';
import { invoicesApi } from './invoices';
import { notificationsApi } from './notifications';
import { documentsApi } from './documents';
import { chatApi } from './chat';
import { containersApi } from './containers';
import { companyApi } from './company';
import { paymentsApi } from './payments';
import { projectsApi } from './projects';
import { savedAddressesApi } from './saved-addresses';
import { fieldPassesApi } from './field-passes';
import { analyticsApi } from './analytics';
import { carrierSettingsApi } from './carrier-settings';

// ─── Assembled api object ─────────────────────────────────────────────────
/**
 * Unified API client.  Spread from domain modules so each feature lives in its
 * own file while consumers enjoy one consistent import path: `@/lib/api`.
 */
export const api = {
  // ── Auth (flat methods) ────────────────────────────────────────────────
  ...authApi,
  ...paymentsApi,

  // ── Orders ────────────────────────────────────────────────────────────
  ...ordersApi,

  // ── Skip-hire ─────────────────────────────────────────────────────────
  ...skipHireApi,

  // ── Transport jobs, vehicles, driver schedule ─────────────────────────
  ...transportApi,

  // ── Materials & quotes ─────────────────────────────────────────────────
  ...materialsApi,
  ...quoteRequestsApi,

  // ── Invoices ──────────────────────────────────────────────────────────
  ...invoicesApi,

  // ── Notifications ─────────────────────────────────────────────────────
  ...notificationsApi,

  // ── Documents & reviews ───────────────────────────────────────────────
  ...documentsApi,

  // ── Chat ──────────────────────────────────────────────────────────────
  ...chatApi,

  // ── Containers & recycling centers ────────────────────────────────────
  ...containersApi,

  // ── Company members & framework contracts ─────────────────────────────
  ...companyApi,

  // ── Projects ─────────────────────────────────────────────────────────
  ...projectsApi,

  // ── Saved addresses ──────────────────────────────────────────────────
  savedAddresses: savedAddressesApi,

  // ── Field Passes & Weighing Slips ─────────────────────────────────────
  ...fieldPassesApi,

  // ── Analytics ────────────────────────────────────────────────────────
  analytics: analyticsApi,

  // ── Carrier settings ──────────────────────────────────────────────
  carrierSettings: carrierSettingsApi,
};
