// apps/web/src/lib/api/payments.ts
import { API_URL as API_BASE } from './common';

export interface PaymentOnboardResponse {
  type: 'COMPANY' | 'DRIVER';
  ibanNumber: string | null;
  payoutEnabled: boolean;
  instructions: string;
}

export interface PaymentIntentResponse {
  paymentUrl: string;
  payseraOrderId: string;
}

export interface EarningEntry {
  id: string;
  orderNumber?: string;
  jobNumber?: string;
  buyerName?: string;
  grossAmount: number;
  sellerPayout: number | null;
  driverPayout?: number | null;
  platformFee?: number | null;
  currency: string;
  status: string;
  date: string;
}

export interface EarningsResponse {
  type: 'COMPANY' | 'DRIVER';
  totalEarned: number;
  pendingAmount: number;
  payoutStatus: 'NOT_CONFIGURED' | 'ACTIVE';
  payments: EarningEntry[];
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

export async function getEarnings(token: string): Promise<EarningsResponse> {
  const res = await fetch(`${API_BASE}/payments/earnings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch earnings');
  return res.json();
}
