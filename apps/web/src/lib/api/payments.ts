// apps/web/src/lib/api/payments.ts
import { API_URL as API_BASE } from './common';

export interface PaymentOnboardResponse {
  url: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  publishableKey: string;
  paymentIntentId: string;
}

export async function setupPayouts(token: string): Promise<PaymentOnboardResponse> {
  const res = await fetch(`${API_BASE}/payments/onboard`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('Failed to initiate payout setup');
  }

  return res.json();
}

export async function createPaymentIntent(
  orderId: string,
  token: string,
): Promise<PaymentIntentResponse> {
  const res = await fetch(`${API_BASE}/payments/create-intent/${orderId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('Failed to initialize payment');
  }

  return res.json();
}
