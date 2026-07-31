// sentry.server.config.ts
// Server-runtime (Node) Sentry init. Loaded by instrumentation.ts's register().
//
// GUARDED ON THE DSN: with no SENTRY_DSN set, init never runs and the SDK stays
// inert, so the app ships and behaves exactly as it did before this was wired
// up. The DSN gets set only once BAM provisions the Better Stack / Sentry-
// compatible project (see plans/user-tasks).

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only. No tracing spend until we decide we want performance data.
    tracesSampleRate: 0,
    // Never auto-attach IP, cookies, or the user's email. This app holds health
    // data, so the default-off setting is the first line of defense and the
    // beforeSend scrub below is the second.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
