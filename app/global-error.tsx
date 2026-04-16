'use client';

// app/global-error.tsx
// Absolute last-resort error boundary. Catches errors thrown inside the
// root layout itself (where app/error.tsx would be too late because the
// layout is what's broken). Must define its own <html> and <body> tags
// since the normal root layout has crashed.
//
// Keep this file dependency-free — no imports from @/components or @/lib
// that might themselves be broken. Inline styles only; no Tailwind, since
// we can't assume globals.css loaded.

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Mirror lib/error-logging.ts's production format so log aggregators
    // still pick this up. Duplicated on purpose — we can't trust imports here.
    const payload = {
      timestamp: new Date().toISOString(),
      module: 'app-global-boundary',
      digest: error.digest,
      error: { name: error.name, message: error.message, stack: error.stack },
    };
    // eslint-disable-next-line no-console
    console.error('[centos-error]', JSON.stringify(payload));
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '28rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>
              Something went wrong at the root
            </h1>
            <p style={{ marginTop: '0.75rem', color: '#4b5563', fontSize: '0.875rem' }}>
              The app hit an error it couldn&apos;t recover from. Reloading the page usually fixes it. If the problem keeps coming back, please email support.
            </p>
            {error.digest && (
              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                Error ref: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: '2rem',
                minHeight: '2.75rem',
                padding: '0.625rem 1.25rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
