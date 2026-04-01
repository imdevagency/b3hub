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
  list: (): Promise<SavedAddress[]> =>
    apiFetch('/saved-addresses', { method: 'GET' }),

  create: (data: CreateSavedAddressInput): Promise<SavedAddress> =>
    apiFetch('/saved-addresses', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateSavedAddressInput): Promise<SavedAddress> =>
    apiFetch(`/saved-addresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiFetch(`/saved-addresses/${id}`, { method: 'DELETE' }),

  setDefault: (id: string): Promise<SavedAddress> =>
    apiFetch(`/saved-addresses/${id}/set-default`, { method: 'PATCH' }),
};
