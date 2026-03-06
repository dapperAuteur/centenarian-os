'use client';

// components/ui/MfaBanner.tsx
// Persistent banner shown when user has sensitive data but no MFA enabled.

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { ShieldAlert, X } from 'lucide-react';
import Link from 'next/link';

export default function MfaBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function check() {
      // Check if MFA is already enabled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedFactor = factors?.totp?.some((f) => f.status === 'verified');
      if (hasVerifiedFactor) return;

      // Check if user has sensitive data
      try {
        const res = await offlineFetch('/api/auth/mfa-status');
        if (!res.ok) return;
        const data = await res.json();
        if (data.mfaRequired) setShow(true);
      } catch {}
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          Your account contains health or financial data.{' '}
          <Link
            href="/dashboard/settings"
            className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
          >
            Enable two-factor authentication
          </Link>{' '}
          to secure your account.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-amber-500 hover:text-amber-700 transition shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
