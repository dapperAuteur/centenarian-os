'use client';

// components/finance/TellerConnectButton.tsx
// Opens the Teller Connect widget and posts enrollment data to /api/teller/connect.

import { useState, useCallback, useEffect } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface TellerConnectButtonProps {
  onSuccess: (result: {
    accounts: unknown[];
    synced: number;
    oldestTransactionDate: string | null;
  }) => void;
}

declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: {
        applicationId: string;
        environment: string;
        onSuccess: (enrollment: unknown) => void;
        onExit: () => void;
        onFailure: (error: { message: string }) => void;
      }) => { open: () => void };
    };
  }
}

export default function TellerConnectButton({ onSuccess }: TellerConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState('');

  // Load Teller Connect SDK
  useEffect(() => {
    if (typeof window !== 'undefined' && window.TellerConnect) {
      setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.teller.io/connect/connect.js';
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError('Failed to load Teller Connect');
    document.head.appendChild(script);

    return () => {
      // Don't remove — other instances may use it
    };
  }, []);

  const handleConnect = useCallback(() => {
    if (!window.TellerConnect) {
      setError('Teller Connect not loaded');
      return;
    }

    const appId = process.env.NEXT_PUBLIC_TELLER_APP_ID;
    const env = process.env.NODE_ENV === 'production'
      ? (process.env.NEXT_PUBLIC_TELLER_PROD_ENVIRONMENT ?? 'production')
      : (process.env.NEXT_PUBLIC_TELLER_DEV_ENVIRONMENT ?? 'sandbox');

    if (!appId) {
      setError('Teller application ID not configured');
      return;
    }

    setError('');

    const teller = window.TellerConnect.setup({
      applicationId: appId,
      environment: env,
      onSuccess: async (enrollment: unknown) => {
        const enr = enrollment as Record<string, unknown>;
        setLoading(true);
        setError('');
        try {
          // Teller Connect returns a flat object — forward it directly
          // and let the server extract what it needs
          const res = await offlineFetch('/api/teller/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enr),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Connection failed');
          }

          const result = await res.json();
          onSuccess(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Connection failed');
        } finally {
          setLoading(false);
        }
      },
      onExit: () => {
        // User closed the widget
      },
      onFailure: (err) => {
        setError(err.message || 'Teller Connect failed');
      },
    });

    teller.open();
  }, [onSuccess]);

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={loading || !sdkReady}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Landmark className="h-4 w-4" />
        )}
        {loading ? 'Connecting...' : 'Connect Bank'}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
