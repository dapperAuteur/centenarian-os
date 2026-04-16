'use client';

// app/error.tsx
// Client error boundary that catches any uncaught error thrown inside a
// server or client component below /app/. Next.js auto-wraps this around
// route segments; when an error propagates here, the page is replaced with
// this component. The `reset()` prop re-mounts the segment, which is
// enough to recover from transient failures (network hiccups, stale
// state, etc.) without reloading the whole app.
//
// Deeper boundaries under /app/academy and /app/dashboard take precedence
// for errors inside those subtrees so users get module-aware messaging
// when possible; this file is the catch-all.

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logError } from '@/lib/error-logging';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logError(error, { module: 'app-root-boundary', digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-fuchsia-100 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-fuchsia-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-3 text-gray-600 text-sm">
          We hit an unexpected error while loading this page. The team has been notified.
          Try the page again or head home — most routes still work.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400 font-mono">
            Error ref: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
