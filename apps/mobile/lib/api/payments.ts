import { apiFetch } from './common';

export interface PaymentOnboardResponse {
  url: string;
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
};

