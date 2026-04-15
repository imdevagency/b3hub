// Must be imported at the very top of main.ts — before any other imports.
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  // Do NOT send PII (IPs, cookies, request bodies) — GDPR compliance
  sendDefaultPii: false,
  // Sample 20% of transactions in production to control costs
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
});
