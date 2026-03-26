/**
 * Reviews API module.
 * Functions to submit and list reviews via /api/v1/reviews/*.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  orderId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  reviewer: { id: string; firstName: string; lastName: string; avatar?: string };
  company?: { id: string; name: string };
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMyReviews(companyId: string, token: string): Promise<Review[]> {
  return apiFetch<Review[]>(`/reviews/company/${companyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getCompanyReviews(companyId: string, token: string): Promise<Review[]> {
  return apiFetch<Review[]>(`/reviews/company/${companyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
