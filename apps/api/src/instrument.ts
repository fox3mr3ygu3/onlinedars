// Must be imported before anything else (Sentry instruments modules on load).
import * as Sentry from '@sentry/nestjs';
import { loadDotEnv } from './config/env';

loadDotEnv();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
