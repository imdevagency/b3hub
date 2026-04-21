/**
 * Next.js proxy (previously: middleware).
 * Runs on every request — checks for a valid JWT cookie/header and redirects
 * unauthenticated users away from protected /dashboard/* routes.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Route matchers ──────────────────────────────────────────────────────────

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
const ADMIN_PATH_PREFIX = '/dashboard/admin';

// ── JWT payload decoder (no signature verification — Edge Runtime lacks Node crypto)
// Trade-off: this only checks the unverified payload for routing decisions (e.g.
// admin redirect). All sensitive data access goes through the NestJS API which
// fully verifies the JWT on every request. A forged token could bypass the
// admin-page *redirect* but still receive 403 on every API call, so no data is
// exposed. To harden further, use the Web Crypto API with the JWT_SECRET env var.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Proxy ──────────────────────────────────────────────────────────────────

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and Next.js internals
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Only protect /dashboard/** routes
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('b3hub_token')?.value;

  // No token → send to login
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Admin routes → require ADMIN userType
  if (pathname.startsWith(ADMIN_PATH_PREFIX)) {
    const payload = decodeJwtPayload(token);
    if (!payload || payload.userType !== 'ADMIN') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Admin users → only allowed in /dashboard/admin; redirect everything else
  if (!pathname.startsWith(ADMIN_PATH_PREFIX)) {
    const payload = decodeJwtPayload(token);
    if (payload?.userType === 'ADMIN') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard/admin';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files, api routes, and Next.js internals.
     * This ensures the middleware runs on all page navigations.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)).*)',
  ],
};
