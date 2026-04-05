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
  clientSecret: string;
  publishableKey: string;
  paymentIntentId: string;
}

export const paymentsApi = {
  /**
   * Generates a Stripe Connect onboarding link.
   */
  setupPayouts: async (token: string): Promise<PaymentOnboardResponse> => {
    return apiFetch('payments/onboard', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Returns the Stripe Connect account's available + pending balance.
   * Returns { available: 0, pending: 0, onboarded: false } if not yet set up.
   */
  getBalance: async (token: string): Promise<ConnectBalanceResponse> => {
    return apiFetch('payments/balance', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Creates (or retrieves) a Stripe PaymentIntent for the given order.
   * Returns the clientSecret needed to present the payment sheet.
   */
  createIntent: async (orderId: string, token: string): Promise<PaymentIntentResponse> => {
    return apiFetch(`payments/create-intent/${orderId}`, {
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
    return apiFetch(`disputes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, reason, description: description || reason }),
    });
  },

  /**
   * List the current buyer's disputes.
   */
  listDisputes: async (token: string): Promise<ApiDispute[]> => {
    return apiFetch('disputes', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Fetch a single dispute by id.
   */
  getDispute: async (id: string, token: string): Promise<ApiDispute> => {
    return apiFetch(`disputes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

