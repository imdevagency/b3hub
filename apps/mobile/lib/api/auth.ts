import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type UserType = 'BUYER' | 'ADMIN';
export type RegistrationRole = 'BUYER' | 'SUPPLIER' | 'CARRIER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  isCompany: boolean;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire?: boolean;
  payoutEnabled?: boolean;
  status: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
  companyRole?: string | null;
  notifPush?: boolean;
  notifOrderUpdates?: boolean;
  notifJobAlerts?: boolean;
  notifMarketing?: boolean;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;
  company?: {
    id: string;
    name: string;
    companyType: string;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** e.g. ['BUYER'] or ['BUYER','SUPPLIER'] or ['BUYER','CARRIER'] */
  roles?: RegistrationRole[];
  isCompany?: boolean;
  phone?: string;
  companyName?: string;
  regNumber?: string;
  /** Must be true — user accepted T&C and Privacy Policy */
  termsAccepted: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ProviderApplication {
  id: string;
  appliesForSell: boolean;
  appliesForTransport: boolean;
  companyName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface ApplyRoleInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  regNumber?: string;
  appliesForSell: boolean;
  appliesForTransport: boolean;
  description?: string;
  userId?: string;
}

// ─── API ───────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: RegisterInput) =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginInput) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ ok: boolean; _devResetUrl?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  /** Send a 6-digit OTP to the given E.164 phone number */
  sendPhoneOtp: (phone: string) =>
    apiFetch<{ ok: boolean }>('/auth/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  /**
   * Verify OTP.
   * - Returns `AuthResponse` for existing users or new users with a name provided.
   * - Returns `{ needsProfile: true }` for new users without a name yet.
   */
  verifyPhoneOtp: (
    phone: string,
    code: string,
    firstName?: string,
    lastName?: string,
  ) =>
    apiFetch<AuthResponse | { needsProfile: true }>('/auth/phone/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, firstName, lastName }),
    }),

  getMe: (token: string) =>
    apiFetch<User>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateProfile: (
    data: { firstName?: string; lastName?: string; phone?: string },
    token: string,
  ) =>
    apiFetch<User>('/auth/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  updatePushToken: (pushToken: string | null, token: string) =>
    apiFetch<{ ok: boolean }>('/auth/push-token', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pushToken }),
    }),

  /** Exchange a refresh token for a new access + refresh token pair. */
  refreshToken: (refreshToken: string) =>
    apiFetch<{ token: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  /** Server-side logout — revokes the refresh token. */
  logoutServer: (token: string) =>
    apiFetch<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => ({ ok: false })),

  changePassword: (currentPassword: string, newPassword: string, token: string) =>
    apiFetch<{ ok: boolean }>('/auth/change-password', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  updateNotificationPrefs: (
    prefs: {
      notifPush?: boolean;
      notifOrderUpdates?: boolean;
      notifJobAlerts?: boolean;
      notifMarketing?: boolean;
    },
    token: string,
  ) =>
    apiFetch<{
      notifPush: boolean;
      notifOrderUpdates: boolean;
      notifJobAlerts: boolean;
      notifMarketing: boolean;
    }>('/auth/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    }),

  /** Permanently anonymise and deactivate the current user's account (Apple guideline 5.1.1). */
  deleteAccount: (token: string) =>
    apiFetch<void>('/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  providerApplications: {    /** Get the current user's own applications */
    mine: (token: string) =>
      apiFetch<ProviderApplication[]>('/provider-applications/mine', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Submit an application to add a new role (post-registration) */
    apply: (data: ApplyRoleInput, token: string) =>
      apiFetch<ProviderApplication>('/provider-applications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),
  },
};
