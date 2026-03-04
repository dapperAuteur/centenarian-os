'use client';

// app/admin/metrics/page.tsx
// Admin: configure global metric availability, and grant/revoke per-user access for testing.

import { useEffect, useState, useCallback } from 'react';
import { Activity, Lock, Unlock, Search, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';

interface MetricConfig {
  metric_key: string;
  label: string;
  description: string;
  is_globally_enabled: boolean;
  is_locked: boolean;
  unlock_type: string;
  sort_order: number;
}

interface UserResult {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
}

interface UserPermission {
  metric_key: string;
  is_enabled: boolean;
  acknowledged_disclaimer: boolean;
  metric_config?: { label: string; is_locked: boolean; unlock_type: string };
}

export default function AdminMetricsPage() {
  const [configs, setConfigs] = useState<MetricConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // User search + override
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [userPerms, setUserPerms] = useState<UserPermission[]>([]);
  const [userPermsLoading, setUserPermsLoading] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/metrics');
    if (res.ok) {
      const { data } = await res.json() as { data: MetricConfig[] };
      setConfigs(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const toggleMetric = async (key: string, field: 'is_globally_enabled' | 'is_locked', current: boolean) => {
    setSaving(key + field);
    const res = await fetch('/api/admin/metrics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metricKey: key, updates: { [field]: !current } }),
    });
    if (res.ok) {
      setConfigs((prev) =>
        prev.map((c) => c.metric_key === key ? { ...c, [field]: !current } : c)
      );
    }
    setSaving(null);
  };

  const searchUsers = async () => {
    if (!userQuery.trim()) return;
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(userQuery)}&limit=10`);
    if (res.ok) {
      const { data } = await res.json() as { data: UserResult[] };
      setUserResults(data || []);
    }
  };

  const selectUser = async (u: UserResult) => {
    setSelectedUser(u);
    setUserResults([]);
    setUserQuery('');
    setUserPermsLoading(true);
    const res = await fetch(`/api/admin/metrics/users?userId=${u.id}`);
    if (res.ok) {
      const { data } = await res.json() as { data: UserPermission[] };
      setUserPerms(data || []);
    }
    setUserPermsLoading(false);
  };

  const toggleUserPerm = async (userId: string, metricKey: string, currentEnabled: boolean) => {
    setSaving(userId + metricKey);
    const res = await fetch('/api/admin/metrics/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, metricKey, isEnabled: !currentEnabled }),
    });
    if (res.ok) {
      setUserPerms((prev) =>
        prev.map((p) =>
          p.metric_key === metricKey ? { ...p, is_enabled: !currentEnabled } : p
        )
      );
      // If permission wasn't there yet, add it
      if (!userPerms.find((p) => p.metric_key === metricKey)) {
        const config = configs.find((c) => c.metric_key === metricKey);
        setUserPerms((prev) => [
          ...prev,
          {
            metric_key: metricKey,
            is_enabled: !currentEnabled,
            acknowledged_disclaimer: true,
            metric_config: config
              ? { label: config.label, is_locked: config.is_locked, unlock_type: config.unlock_type }
              : undefined,
          },
        ]);
      }
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-10 w-10 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-7 h-7 text-fuchsia-600" />
          Metrics Configuration
        </h1>
        <p className="text-gray-500 mt-1">
          Control which metrics are available globally and manage per-user access for testing.
        </p>
      </div>

      {/* Global metric config table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Global Metric Settings</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm" aria-label="Global metric settings">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Metric</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Globally Enabled</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Locked</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Unlock Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {configs.map((c) => (
                <tr key={c.metric_key} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{c.label}</p>
                    <p className="text-xs text-gray-400">{c.metric_key}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleMetric(c.metric_key, 'is_globally_enabled', c.is_globally_enabled)}
                      disabled={saving === c.metric_key + 'is_globally_enabled'}
                      aria-label={c.is_globally_enabled ? `Disable ${c.label} globally` : `Enable ${c.label} globally`}
                      role="switch"
                      aria-checked={c.is_globally_enabled}
                      className="transition"
                    >
                      {c.is_globally_enabled
                        ? <ToggleRight className="w-7 h-7 text-green-500" />
                        : <ToggleLeft className="w-7 h-7 text-gray-300" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <button
                      onClick={() => toggleMetric(c.metric_key, 'is_locked', c.is_locked)}
                      disabled={saving === c.metric_key + 'is_locked'}
                      aria-label={c.is_locked ? `Unlock ${c.label}` : `Lock ${c.label}`}
                      role="switch"
                      aria-checked={c.is_locked}
                      className="transition"
                    >
                      {c.is_locked
                        ? <Lock className="w-5 h-5 text-amber-500" />
                        : <Unlock className="w-5 h-5 text-gray-300" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.unlock_type === 'admin_only'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {c.unlock_type === 'admin_only' ? 'Admin Only' : 'Acknowledgment'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-user override panel */}
      <section>
        <button
          onClick={() => setShowUserPanel((v) => !v)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-fuchsia-700 transition"
        >
          Per-User Access Testing
          {showUserPanel ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Grant or revoke metric access for any user to test edge cases before release.
        </p>

        {showUserPanel && (
          <div className="space-y-5">
            {/* User search */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by username or email…"
                aria-label="Search users by username or email"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              />
              <button
                onClick={searchUsers}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition font-medium"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>

            {/* Search results */}
            {userResults.length > 0 && (
              <ul className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 shadow-sm">
                {userResults.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => selectUser(u)}
                      className="w-full text-left px-4 py-3 hover:bg-fuchsia-50 transition text-sm"
                    >
                      <span className="font-medium text-gray-900">{u.username || u.id}</span>
                      {u.display_name && (
                        <span className="text-gray-500 ml-2">({u.display_name})</span>
                      )}
                      <span className="text-gray-400 ml-2 text-xs">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Selected user permissions */}
            {selectedUser && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedUser.username || selectedUser.id}
                    </p>
                    <p className="text-xs text-gray-400">{selectedUser.email}</p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>

                {userPermsLoading ? (
                  <div className="p-8 flex justify-center">
                    <div className="animate-spin h-6 w-6 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-5 py-3 font-medium text-gray-600">Metric</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Unlocked</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Toggle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {configs.filter((c) => c.is_locked).map((c) => {
                        const perm = userPerms.find((p) => p.metric_key === c.metric_key);
                        const enabled = perm?.is_enabled ?? false;
                        return (
                          <tr key={c.metric_key} className="hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-900">{c.label}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {enabled ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleUserPerm(selectedUser.id, c.metric_key, enabled)}
                                disabled={saving === selectedUser.id + c.metric_key}
                                className="transition"
                              >
                                {enabled
                                  ? <ToggleRight className="w-7 h-7 text-green-500" />
                                  : <ToggleLeft className="w-7 h-7 text-gray-300" />
                                }
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {configs.filter((c) => c.is_locked).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-6 text-center text-gray-400 text-sm">
                            No locked metrics to override.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
