'use client';

// components/ui/DemoLoginButton.tsx
// Reusable demo-login button that tracks which page the user came from.

import { useState } from 'react';
import { Play, Shield } from 'lucide-react';

interface Props {
  from: string;          // feature slug or page identifier
  redirect?: string;     // dashboard path to navigate to after login
  label?: string;        // button label override
  className?: string;    // outer wrapper override
}

export default function DemoLoginButton({ from, redirect, label, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, redirect }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Demo login failed');
      // Full page load so the new auth cookies take effect immediately
      window.location.href = data.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      {error && (
        <p className="text-red-600 text-xs mb-2 text-center">{error}</p>
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center px-6 py-3 bg-white border-2 border-fuchsia-300 text-fuchsia-700 rounded-lg hover:bg-fuchsia-50 transition font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="animate-spin inline-block w-4 h-4 border-2 border-fuchsia-600 border-t-transparent rounded-full mr-2" />
        ) : (
          <Play className="w-4 h-4 mr-2" />
        )}
        {loading ? 'Logging in...' : label ?? 'Try the Demo'}
      </button>
      <p className="text-gray-400 text-xs mt-2 flex items-center justify-center gap-1">
        <Shield className="w-3 h-3" /> Shared account — no sign-up required
      </p>
    </div>
  );
}
