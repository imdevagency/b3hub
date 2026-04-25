import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@b3hub/shared'],
  async redirects() {
    return [
      // ── Legacy URL aliases (dead stubs — kept as server-level 308s) ──────────
      { source: '/dashboard/garage', destination: '/dashboard/fleet-management', permanent: true },
      { source: '/dashboard/containers', destination: '/dashboard/orders', permanent: true },
      {
        source: '/dashboard/containers/fleet',
        destination: '/dashboard/fleet-management',
        permanent: true,
      },
      { source: '/dashboard/certificates', destination: '/dashboard/documents', permanent: true },
      {
        source: '/dashboard/supplier/earnings',
        destination: '/dashboard/earnings',
        permanent: true,
      },
      {
        source: '/dashboard/transporter/earnings',
        destination: '/dashboard/earnings',
        permanent: true,
      },
      {
        source: '/dashboard/driver/earnings',
        destination: '/dashboard/earnings',
        permanent: true,
      },
      {
        source: '/dashboard/buyer/projects',
        destination: '/dashboard/projects',
        permanent: true,
      },
      {
        source: '/dashboard/buyer/projects/:id',
        destination: '/dashboard/projects/:id',
        permanent: true,
      },
      // ── Consolidated routes ───────────────────────────────────────────────────
      { source: '/dashboard/fleet', destination: '/dashboard/active', permanent: true },
      {
        source: '/dashboard/incoming-orders',
        destination: '/dashboard/orders',
        permanent: true,
      },
      {
        source: '/dashboard/transport-history',
        destination: '/dashboard/orders',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source map upload — set SENTRY_AUTH_TOKEN in CI to enable
  silent: !process.env.CI,
  // Disable source map upload in dev (no auth token)
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production',
  },
  // Suppress Sentry's default telemetry
  telemetry: false,
});
