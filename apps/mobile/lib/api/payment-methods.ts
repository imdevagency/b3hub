import { apiFetch } from './common';

export interface SavedPaymentMethod {
  id: string;
  label: string;
  cardType: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
}

export interface CreatePaymentMethodInput {
  label: string;
  cardType: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  payseraToken: string;
  isDefault?: boolean;
}

export const paymentMethodsApi = {
  list: (token: string): Promise<SavedPaymentMethod[]> =>
    apiFetch('/payment-methods', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),

  create: (data: CreatePaymentMethodInput, token: string): Promise<SavedPaymentMethod> =>
    apiFetch('/payment-methods', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  setDefault: (id: string, token: string): Promise<{ id: string; isDefault: boolean }> =>
    apiFetch(`/payment-methods/${id}/set-default`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }),

  remove: (id: string, token: string): Promise<{ success: boolean }> =>
    apiFetch(`/payment-methods/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
};
