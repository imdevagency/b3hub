import { apiFetch } from './common';

export type CmsArticleType = 'HELP' | 'FAQ' | 'BLOG' | 'POLICY' | 'PAGE' | 'LANDING';
export type CmsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AnnouncementSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AnnouncementTarget = 'ALL' | 'BUYER' | 'SELLER' | 'DRIVER' | 'ADMIN';

export interface CmsArticle {
  id: string;
  title: string;
  slug: string;
  body?: string;
  excerpt: string | null;
  type: CmsArticleType;
  status: CmsStatus;
  locale: string;
  translationKey: string | null;
  pageKey: string | null;
  targetRole: string | null;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  target: AnnouncementTarget;
  visibleFrom: string;
  visibleUntil: string | null;
  active: boolean;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleInput {
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  type?: CmsArticleType;
  status?: CmsStatus;
  locale?: string;
  translationKey?: string;
  pageKey?: string;
  targetRole?: string;
  sortOrder?: number;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  severity?: AnnouncementSeverity;
  target?: AnnouncementTarget;
  visibleFrom?: string;
  visibleUntil?: string;
}

// ─── Articles ────────────────────────────────────────────────────────────────

export function listArticles(
  token: string,
  filters?: { type?: CmsArticleType; status?: CmsStatus; locale?: string; pageKey?: string; translationKey?: string },
): Promise<CmsArticle[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.locale) params.set('locale', filters.locale);
  if (filters?.pageKey) params.set('pageKey', filters.pageKey);
  if (filters?.translationKey) params.set('translationKey', filters.translationKey);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/cms/articles${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getArticle(token: string, id: string): Promise<CmsArticle> {
  return apiFetch(`/cms/articles/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createArticle(token: string, data: CreateArticleInput): Promise<CmsArticle> {
  return apiFetch('/cms/articles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateArticle(
  token: string,
  id: string,
  data: Partial<CreateArticleInput>,
): Promise<CmsArticle> {
  return apiFetch(`/cms/articles/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteArticle(token: string, id: string): Promise<void> {
  return apiFetch(`/cms/articles/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Public marketing site API (no auth required) ────────────────────────────

export function listPublicArticles(filters?: {
  locale?: string;
  type?: CmsArticleType;
  pageKey?: string;
  translationKey?: string;
}): Promise<CmsArticle[]> {
  const params = new URLSearchParams();
  if (filters?.locale) params.set('locale', filters.locale);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.pageKey) params.set('pageKey', filters.pageKey);
  if (filters?.translationKey) params.set('translationKey', filters.translationKey);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/cms/public/articles${qs}`);
}

/** Get a single published article by slug */
export function getPublicArticle(slug: string): Promise<CmsArticle> {
  return apiFetch(`/cms/public/articles/${slug}`);
}

/** Get all published content blocks for a marketing page slot */
export function getPageContent(pageKey: string, locale = 'lv'): Promise<CmsArticle[]> {
  return apiFetch(`/cms/public/page/${pageKey}?locale=${locale}`);
}

/** Get all locale variants of a content piece */
export function getTranslations(translationKey: string): Promise<CmsArticle[]> {
  return apiFetch(`/cms/public/translations/${translationKey}`);
}

// ─── Announcements ───────────────────────────────────────────────────────────

export function listAnnouncements(token: string): Promise<CmsAnnouncement[]> {
  return apiFetch('/cms/announcements', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createAnnouncement(
  token: string,
  data: CreateAnnouncementInput,
): Promise<CmsAnnouncement> {
  return apiFetch('/cms/announcements', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateAnnouncement(
  token: string,
  id: string,
  data: Partial<CreateAnnouncementInput> & { active?: boolean },
): Promise<CmsAnnouncement> {
  return apiFetch(`/cms/announcements/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteAnnouncement(token: string, id: string): Promise<void> {
  return apiFetch(`/cms/announcements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
