'use client';

// app/academy/error.tsx
// Error boundary for the learner-facing academy surface. Catches anything
// thrown below /academy/... so a broken course detail page doesn't blank
// the whole app. Mirrors app/error.tsx's shape but uses academy-aware copy
// and a link back to the academy home instead of the site home.

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, BookOpen } from 'lucide-react';
import { logError } from '@/lib/error-logging';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AcademyError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logError(error, { module: 'academy-boundary', digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-fuchsia-100 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-fuchsia-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">This lesson hit an error</h1>
        <p className="mt-3 text-gray-600 text-sm">
          Something went wrong loading this page. Your progress is safe — it&apos;s saved against your account. Try again, or pick a different lesson from your course list.
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
            href="/academy"
            className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            Back to Academy
          </Link>
        </div>
      </div>
    </div>
  );
}
