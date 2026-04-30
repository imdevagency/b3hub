/**
 * Auth API module.
 * Functions wrapping /api/v1/auth/* endpoints: login, register, refresh token,
 * logout, forgot/reset/change password, get/update profile.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type UserType = 'BUYER' | 'ADMIN';
export type RegistrationRole = 'BUYER' | 'SUPPLIER' | 'CARRIER';
export type Mode = 'BUYER' | 'SUPPLIER' | 'CARRIER';
export type CompanyRole = 'OWNER' | 'MANAGER' | 'DRIVER' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  isCompany: boolean;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire: boolean;
  payoutEnabled?: boolean;
  status: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
  companyRole?: CompanyRole;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;
  availableModes: Mode[];
  notifPush?: boolean;
  notifOrderUpdates?: boolean;
  notifJobAlerts?: boolean;
  notifMarketing?: boolean;
  company?: {
    id: string;
    name: string;
    companyType: string;
    logo?: string;
  };
  buyerProfile?: {
    creditLimit: number | null;
    creditUsed: number;
    paymentTerms: string | null;
  } | null;
}

export interface AuthResponse {
  user: User;
  token: string;
  /** Opaque 30-day rolling refresh token. Store securely and use to obtain new access tokens. */
  refreshToken?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles?: RegistrationRole[];
  isCompany?: boolean;
  phone?: string;
  companyId?: string;
  companyName?: string;
  regNumber?: string;
  /** Latvian personal ID code (personas kods) — individuals only */
  personalCode?: string;
  /** Must be true — user accepted T&C and Privacy Policy */
  termsAccepted: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface DashboardStats {
  // BUYER (company + personal)
  activeOrders?: number;
  awaitingDelivery?: number;
  myOrders?: number; // skip hire orders count
  documents?: number;
  // SUPPLIER
  activeListings?: number;
  pendingOrders?: number;
  monthlyRevenue?: number;
  // CARRIER
  activeJobs?: number;
  completedToday?: number;
  awaitingPayment?: number;
  vehicleCount?: number;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function registerUser(data: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function loginUser(data: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function forgotPassword(
  email: string,
): Promise<{ ok: boolean; _devResetUrl?: string }> {
  return apiFetch<{ ok: boolean; _devResetUrl?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function getMe(token: string): Promise<User> {
  return apiFetch<User>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateProfile(
  data: { firstName?: string; lastName?: string; phone?: string },
  token: string,
): Promise<User> {
  return apiFetch<User>('/auth/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/change-password', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/orders/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateNotificationPrefs(
  prefs: {
    notifPush?: boolean;
    notifOrderUpdates?: boolean;
    notifJobAlerts?: boolean;
    notifMarketing?: boolean;
  },
  token: string,
): Promise<{
  notifPush: boolean;
  notifOrderUpdates: boolean;
  notifJobAlerts: boolean;
  notifMarketing: boolean;
}> {
  return apiFetch('/auth/notifications', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
}

/** Exchange a refresh token for a new access + refresh token pair. */
export async function refreshTokens(
  refreshToken: string,
): Promise<{ token: string; refreshToken: string }> {
  return apiFetch<{ token: string; refreshToken: string }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
