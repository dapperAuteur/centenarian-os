// instrumentation-client.ts
// Browser-runtime Sentry init. Reads the PUBLIC DSN, which is inlined at build
// time. Guarded the same way as the server config: with no
// NEXT_PUBLIC_SENTRY_DSN the SDK is inert, nothing is sent, and nothing changes
// for the people using the app.

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors only. Session Replay stays off: it records the DOM, and in this app
    // the DOM is somebody's weight, blood pressure, and medication list.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

// Instruments App Router client navigations. A no-op when Sentry was never
// initialized above.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
