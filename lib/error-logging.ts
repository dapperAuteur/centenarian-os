// lib/error-logging.ts
// Structured error logger. Replaces scattered `console.error(...)` calls with
// a single entry point that includes a module tag, the error digest Next.js
// attaches to uncaught errors, and any extra context the caller passes.
//
// Keeps output readable in dev (grouped console.error) and machine-parseable
// in production (single-line JSON via console.error with a prefix). When we
// add Sentry or LogRocket later, this is the one place that changes.

type ErrorContext = Record<string, unknown>;

interface LogOptions {
  /** Short tag for the feature/module that caught this — e.g. "VirtualTour", "Stripe". */
  module: string;
  /** Next.js attaches this to every error caught by an error.tsx boundary. */
  digest?: string;
  /** Arbitrary structured data to attach (user id, course id, route, etc.). */
  context?: ErrorContext;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

/**
 * Log an error with structured context. Prefer this over bare console.error
 * so every error has the same shape and is greppable in production logs.
 */
export function logError(error: unknown, options: LogOptions): void {
  const payload = {
    timestamp: new Date().toISOString(),
    module: options.module,
    digest: options.digest,
    error: formatError(error),
    context: options.context,
  };

  if (process.env.NODE_ENV === 'development') {
    // Dev: grouped console output, easier to scan during local work.
    // eslint-disable-next-line no-console
    console.group(`[${payload.module}] ${payload.error.message}`);
    if (payload.digest) {
      // eslint-disable-next-line no-console
      console.log('digest:', payload.digest);
    }
    if (payload.context) {
      // eslint-disable-next-line no-console
      console.log('context:', payload.context);
    }
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line no-console
    console.groupEnd();
  } else {
    // Prod: single-line JSON prefixed so log aggregators can pick it up.
    // eslint-disable-next-line no-console
    console.error('[centos-error]', JSON.stringify(payload));
  }
}
