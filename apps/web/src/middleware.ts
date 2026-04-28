/**
 * Next.js Edge Middleware — app-mode route guard.
 *
 * NEXT_PUBLIC_APP_MODE controls which Vercel deployment this is:
 *   'admin'       → admin.b3hub.lv  — only /dashboard/admin/* is accessible
 *   'marketplace' → b3hub.lv        — /dashboard/admin/* is blocked (default)
 *
 * Set NEXT_PUBLIC_APP_MODE in the Vercel project environment variables.
 * Defaults to 'marketplace' if unset (safe for local dev).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const IS_ADMIN_APP = process.env.NEXT_PUBLIC_APP_MODE === 'admin';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (IS_ADMIN_APP) {
    // ── Admin project ──────────────────────────────────────────────────────
    // Root and bare /dashboard both redirect to the admin home.
    if (pathname === '/' || pathname === '/dashboard') {
      return NextResponse.redirect(new URL('/dashboard/admin', request.url));
    }

    // Registration has no meaning on the admin domain — redirect to login.
    if (pathname.startsWith('/register')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Only permit dashboard/admin/* and a handful of shared utility routes.
    const isPermitted =
      pathname.startsWith('/dashboard/admin') ||
      pathname.startsWith('/dashboard/settings') ||
      pathname.startsWith('/dashboard/notifications') ||
      pathname.startsWith('/dashboard/chat') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/forgot-password') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/api/');

    if (pathname.startsWith('/dashboard') && !isPermitted) {
      return NextResponse.redirect(new URL('/dashboard/admin', request.url));
    }
  } else {
    // ── Marketplace project ────────────────────────────────────────────────
    // Admin routes must not be reachable on the public domain.
    if (pathname.startsWith('/dashboard/admin')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on dashboard routes, root, register, and auth pages so all redirects
  // above are handled. Excludes static assets and Next.js internals.
  matcher: [
    '/',
    '/dashboard',
    '/dashboard/:path*',
    '/register',
    '/register/:path*',
  ],
};
