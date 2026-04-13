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

export interface CreateReviewInput {
  rating: number;
  comment?: string;
  orderId?: string;
  skipOrderId?: string;
}

export async function createReview(input: CreateReviewInput, token: string): Promise<Review> {
  return apiFetch<Review>('/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getReviewStatus(
  token: string,
  orderId?: string,
  skipOrderId?: string,
): Promise<{ reviewed: boolean }> {
  const params = new URLSearchParams();
  if (orderId) params.set('orderId', orderId);
  if (skipOrderId) params.set('skipOrderId', skipOrderId);
  return apiFetch<{ reviewed: boolean }>(`/reviews/status?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
