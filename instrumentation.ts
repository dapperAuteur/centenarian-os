// instrumentation.ts
// Next.js instrumentation hook. Loads the right Sentry config for whichever
// runtime the process is, and reports server-side App Router errors.
//
// Everything here is inert without a SENTRY_DSN: the imported configs each guard
// their own Sentry.init(), and captureRequestError is a no-op on an SDK that was
// never initialized. So with no env vars set, the app behaves exactly as before.

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures errors thrown while rendering or serving a request (server
// components, route handlers, server actions). The beforeSend scrub in
// lib/sentry-scrub.ts strips the identity off whatever this sends.
export const onRequestError = Sentry.captureRequestError;
