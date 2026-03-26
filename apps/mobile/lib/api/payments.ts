import { apiFetch } from './common';

export interface PaymentOnboardResponse {
  url: string;
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
   * Creates (or retrieves) a Stripe PaymentIntent for the given order.
   * Returns the clientSecret needed to present the payment sheet.
   */
  createIntent: async (orderId: string, token: string): Promise<PaymentIntentResponse> => {
    return apiFetch(`payments/create-intent/${orderId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

