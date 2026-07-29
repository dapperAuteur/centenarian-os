// sentry.edge.config.ts
// Edge-runtime Sentry init (middleware.ts and any edge route). Same DSN guard as
// the server config: inert with no SENTRY_DSN. Loaded by instrumentation.ts's
// register() when NEXT_RUNTIME is "edge".

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
