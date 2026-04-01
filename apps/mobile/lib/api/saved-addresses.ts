import { apiFetch } from './common';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedAddressInput {
  label: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export interface UpdateSavedAddressInput extends Partial<CreateSavedAddressInput> {}

export const savedAddressesApi = {
  list: (token: string): Promise<SavedAddress[]> =>
    apiFetch('/saved-addresses', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),

  create: (data: CreateSavedAddressInput, token: string): Promise<SavedAddress> =>
    apiFetch('/saved-addresses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateSavedAddressInput, token: string): Promise<SavedAddress> =>
    apiFetch(`/saved-addresses/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  remove: (id: string, token: string): Promise<{ success: boolean }> =>
    apiFetch(`/saved-addresses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  setDefault: (id: string, token: string): Promise<SavedAddress> =>
    apiFetch(`/saved-addresses/${id}/set-default`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }),
};
