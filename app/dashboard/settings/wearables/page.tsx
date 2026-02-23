'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Watch, RefreshCw, Unlink, CheckCircle2, AlertCircle,
  Upload, ExternalLink, Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface WearableConnection {
  id: string;
  provider: string;
  last_synced_at: string | null;
  sync_status: string;
  sync_error: string | null;
  created_at: string;
}

interface ProviderInfo {
  key: string;
  name: string;
  description: string;
  hasOAuth: boolean;
  color: string;
}

const PROVIDERS: ProviderInfo[] = [
  { key: 'oura', name: 'Oura Ring', description: 'Sleep, activity, readiness scores', hasOAuth: true, color: 'bg-gray-900' },
  { key: 'whoop', name: 'WHOOP', description: 'Recovery, strain, sleep performance', hasOAuth: true, color: 'bg-red-600' },
  { key: 'garmin', name: 'Garmin', description: 'Steps, sleep, heart rate, stress', hasOAuth: true, color: 'bg-blue-600' },
  { key: 'apple_health', name: 'Apple Health', description: 'Import via CSV export from iPhone', hasOAuth: false, color: 'bg-pink-500' },
  { key: 'google_health', name: 'Google Health', description: 'Import via CSV export from Android', hasOAuth: false, color: 'bg-green-500' },
  { key: 'inbody', name: 'InBody', description: 'Body composition scans — import via CSV', hasOAuth: false, color: 'bg-purple-600' },
  { key: 'hume_health', name: 'Hume Health', description: 'Emotional wellness data — import via CSV', hasOAuth: false, color: 'bg-amber-600' },
];

export default function WearableSettingsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<WearableConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wearables');
      if (res.ok) {
        const { connections: conns } = await res.json();
        setConnections(conns || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      setFlash(`Successfully connected ${connected}`);
      setTimeout(() => setFlash(null), 5000);
    } else if (error) {
      setFlash(`Connection error: ${error}`);
      setTimeout(() => setFlash(null), 5000);
    }
  }, [searchParams]);

  const getConnection = (provider: string) =>
    connections.find((c) => c.provider === provider);

  const handleConnect = (provider: string) => {
    window.location.href = `/api/wearables/${provider}/connect`;
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}? Your synced health data will be preserved.`)) return;
    const res = await fetch(`/api/wearables?provider=${provider}`, { method: 'DELETE' });
    if (res.ok) {
      setConnections((prev) => prev.filter((c) => c.provider !== provider));
    }
  };

  const handleSync = async (provider: string) => {
    setSyncing((prev) => new Set(prev).add(provider));
    try {
      await fetch(`/api/wearables/${provider}/sync`, { method: 'POST' });
      await load();
    } finally {
      setSyncing((prev) => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-10 w-10 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Watch className="w-7 h-7 text-fuchsia-600" />
          Wearable Connections
        </h1>
        <p className="text-gray-500 mt-1">
          Connect your devices for automatic data sync, or import data manually
        </p>
      </div>

      {/* Flash message */}
      {flash && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          flash.includes('error')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {flash.includes('error') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {flash}
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const conn = getConnection(provider.key);
          const isSyncing = syncing.has(provider.key) || conn?.sync_status === 'syncing';

          return (
            <div
              key={provider.key}
              className="border border-gray-200 rounded-2xl p-5 bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${provider.color} flex items-center justify-center shrink-0`}>
                    <Watch className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-sm text-gray-500">{provider.description}</p>

                    {conn && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Connected
                        </span>
                        {conn.last_synced_at && (
                          <span className="text-gray-400">
                            Last synced: {new Date(conn.last_synced_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}
                          </span>
                        )}
                        {conn.sync_error && (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <AlertCircle className="w-3 h-3" />
                            {conn.sync_error.slice(0, 60)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {provider.hasOAuth ? (
                    conn ? (
                      <>
                        <button
                          onClick={() => handleSync(provider.key)}
                          disabled={isSyncing}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-lg transition disabled:opacity-50"
                        >
                          {isSyncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          {isSyncing ? 'Syncing' : 'Sync'}
                        </button>
                        <button
                          onClick={() => handleDisconnect(provider.key)}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        >
                          <Unlink className="w-4 h-4" />
                          <span className="hidden sm:inline">Disconnect</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(provider.key)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Connect
                      </button>
                    )
                  ) : (
                    <Link
                      href={`/dashboard/metrics/import?source=${provider.key}`}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-lg transition"
                    >
                      <Upload className="w-4 h-4" />
                      Import CSV
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual import callout */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Bulk Import</h3>
        <p className="text-sm text-gray-500 mb-3">
          Have historical data from any source? Import it via CSV to backfill your health metrics.
        </p>
        <Link
          href="/dashboard/metrics/import"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-fuchsia-700 bg-white border border-fuchsia-200 hover:bg-fuchsia-50 rounded-lg transition"
        >
          <Upload className="w-4 h-4" />
          Go to Import
        </Link>
      </div>
    </div>
  );
}
