/**
 * Admin API module.
 * Functions wrapping /api/v1/admin/* endpoints: user listing, approve/suspend users,
 * platform stats, and provider application management.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProviderApplicationInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  regNumber?: string;
  taxId?: string;
  website?: string;
  appliesForSell: boolean;
  appliesForTransport: boolean;
  description?: string;
  userId?: string;
}

export type ProviderApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProviderApplication {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  regNumber?: string;
  taxId?: string;
  website?: string;
  appliesForSell: boolean;
  appliesForTransport: boolean;
  description?: string;
  status: ProviderApplicationStatus;
  reviewNote?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  userType: string;
  status: string;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire: boolean;
  companyRole?: string;
  emailVerified: boolean;
  company?: { id: string; name: string } | null;
  createdAt: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function createProviderApplication(
  data: ProviderApplicationInput,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>('/provider-applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProviderApplications(
  token: string,
  status?: ProviderApplicationStatus,
): Promise<ProviderApplication[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<ProviderApplication[]>(`/provider-applications${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function approveProviderApplication(
  id: string,
  reviewNote: string,
  token: string,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>(`/provider-applications/${id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reviewNote }),
  });
}

export async function rejectProviderApplication(
  id: string,
  reviewNote: string,
  token: string,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>(`/provider-applications/${id}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reviewNote }),
  });
}

export async function adminGetUsers(token: string): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminUpdateUser(
  id: string,
  data: Partial<{
    canSell: boolean;
    canTransport: boolean;
    canSkipHire: boolean;
    status: string;
    userType: string;
  }>,
  token: string,
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}
