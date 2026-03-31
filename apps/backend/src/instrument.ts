// Must be imported at the very top of main.ts — before any other imports.
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ??
    'https://66fe1bd39e78f631865a18fbeab68b9e@o4511139242508288.ingest.de.sentry.io/4511139246374992',
  environment: process.env.NODE_ENV ?? 'development',
  // Capture request user info (IP, user-agent) on error events
  sendDefaultPii: true,
  // Sample 20% of transactions in production to control costs
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
});
