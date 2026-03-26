// apps/web/src/lib/api/payments.ts
import { API_URL as API_BASE } from './common';

export interface PaymentOnboardResponse {
  url: string;
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
