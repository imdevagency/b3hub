import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Capture 20% of transactions in production; 100% in development
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  // Session replays: capture 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  // DSN is public by design — do not send PII
  sendDefaultPii: false,
});
