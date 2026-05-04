// apps/web/src/lib/api/payments.ts
import { apiFetch } from './common';

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
  return apiFetch<PaymentOnboardResponse>('/payments/onboard', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createPaymentIntent(
  orderId: string,
  token: string,
): Promise<PaymentIntentResponse> {
  return apiFetch<PaymentIntentResponse>(`/payments/create-intent/${orderId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getEarnings(token: string): Promise<EarningsResponse> {
  return apiFetch<EarningsResponse>('/payments/earnings', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
