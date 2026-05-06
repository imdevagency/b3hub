/**
 * API key management — /api/v1/api-keys
 * Company OWNER/MANAGER endpoints to create, list, and revoke API keys
 * used for ERP / machine-to-machine integrations.
 */
import { apiFetch } from './common';

export type ApiKeyScope =
  | 'orders:read'
  | 'orders:write'
  | 'invoices:read'
  | 'transport:read'
  | 'materials:read';

export interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyInput {
  label: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
}

export interface CreatedApiKey extends ApiKey {
  /** The raw key — shown ONCE, cannot be retrieved again */
  key: string;
}

export function listApiKeys(token: string): Promise<ApiKey[]> {
  return apiFetch('/api-keys', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createApiKey(
  token: string,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  return apiFetch('/api-keys', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function revokeApiKey(token: string, id: string): Promise<void> {
  return apiFetch(`/api-keys/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
