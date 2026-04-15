import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@b3hub/shared'],
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
