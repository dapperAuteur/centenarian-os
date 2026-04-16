'use client';

// app/dashboard/error.tsx
// Error boundary for any /dashboard/... route. Dashboard surfaces are
// dark-themed (teaching, admin, etc.) so this one uses the same dark
// palette as the rest of the surface to avoid a jarring light-flash
// when an error replaces a dashboard page.

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { logError } from '@/lib/error-logging';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logError(error, { module: 'dashboard-boundary', digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 bg-gray-950 text-gray-200">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-fuchsia-900/40 border border-fuchsia-800 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-fuchsia-400" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-white">Dashboard hit an error</h1>
        <p className="mt-3 text-gray-400 text-sm">
          Something went wrong loading this page. Unsaved form state may be lost, but your data is safe — the error happened in the UI, not in storage. Try again, or head back to the dashboard home.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-500 font-mono">
            Error ref: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            Dashboard home
          </Link>
        </div>
      </div>
    </div>
  );
}
