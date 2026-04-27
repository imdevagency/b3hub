import { apiFetch } from './common';

export type DisputeReason =
  | 'SHORT_DELIVERY'
  | 'WRONG_MATERIAL'
  | 'DAMAGE'
  | 'LATE_DELIVERY'
  | 'NO_DELIVERY'
  | 'QUALITY_ISSUE'
  | 'OTHER';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface ApiDispute {
  id: string;
  reason: DisputeReason;
  status: DisputeStatus;
  description: string;
  resolution: string | null;
  resolvedAt: string | null;
  orderId: string;
  order: { id: string; orderNumber: string; status: string; deliveryAddress: string } | null;
  raisedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOnboardResponse {
  url: string;
}

export interface ConnectBalanceResponse {
  available: number;
  pending: number;
  currency: string;
  onboarded: boolean;
}

export interface PaymentIntentResponse {
  /** Paysera-hosted checkout URL — open in browser for buyer to complete payment */
  paymentUrl: string;
  payseraOrderId: string;
}

export const paymentsApi = {
  /**
   * Generates a Paysera IBAN payout onboarding link (for sellers/carriers to submit their IBAN).
   */
  setupPayouts: async (token: string): Promise<PaymentOnboardResponse> => {
    return apiFetch('/payments/onboard', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Returns the current user's payout balance (always zero with Paysera;
   * kept for API surface compatibility).
   */
  getBalance: async (token: string): Promise<ConnectBalanceResponse> => {
    return apiFetch('/payments/balance', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Creates (or retrieves) a Paysera checkout for the given order.
   * Returns a paymentUrl to open in the browser so the buyer can complete payment.
   */
  createIntent: async (orderId: string, token: string): Promise<PaymentIntentResponse> => {
    return apiFetch(`/payments/create-intent/${orderId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Buyer reports an issue with a delivered order.
   * Flags the order for admin review and sends admin notifications.
   */
  reportDispute: async (
    orderId: string,
    reason: string,
    description: string | undefined,
    token: string,
  ): Promise<{ id: string; status: string }> => {
    return apiFetch('/disputes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reason, description: description || reason }),
    });
  },

  /**
   * List the current buyer's disputes. Optionally filter by orderId.
   */
  listDisputes: async (token: string, orderId?: string): Promise<ApiDispute[]> => {
    const qs = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
    return apiFetch(`/disputes${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Fetch a single dispute by id.
   */
  getDispute: async (id: string, token: string): Promise<ApiDispute> => {
    return apiFetch(`/disputes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

