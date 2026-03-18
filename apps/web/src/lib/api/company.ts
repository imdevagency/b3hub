import { apiFetch } from './common';
import type { CompanyRole } from './auth';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  legalName?: string;
  registrationNum?: string;
  taxId?: string;
  companyType: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  logo?: string;
  verified: boolean;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  companyRole?: CompanyRole;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire: boolean;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface InviteMemberInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyRole: CompanyRole;
  canTransport?: boolean;
  canSell?: boolean;
  canSkipHire?: boolean;
}

export interface UpdateMemberInput {
  companyRole?: CompanyRole;
  canTransport?: boolean;
  canSell?: boolean;
  canSkipHire?: boolean;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMyCompany(token: string): Promise<Company> {
  return apiFetch<Company>('/company/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateMyCompany(
  data: Partial<{
    name: string;
    legalName: string;
    email: string;
    phone: string;
    website: string;
    description: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    logo: string;
  }>,
  token: string,
): Promise<Company> {
  return apiFetch<Company>('/company/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function getCompanyMembers(token: string): Promise<CompanyMember[]> {
  return apiFetch<CompanyMember[]>('/company/me/members', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function inviteCompanyMember(
  data: InviteMemberInput,
  token: string,
): Promise<{ user: CompanyMember; tempPassword: string }> {
  return apiFetch<{ user: CompanyMember; tempPassword: string }>('/company/me/members', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateCompanyMember(
  memberId: string,
  data: UpdateMemberInput,
  token: string,
): Promise<CompanyMember> {
  return apiFetch<CompanyMember>(`/company/me/members/${memberId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function removeCompanyMember(memberId: string, token: string): Promise<void> {
  await apiFetch<void>(`/company/me/members/${memberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
