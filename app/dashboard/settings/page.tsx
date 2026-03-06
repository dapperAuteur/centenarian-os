'use client';

// app/dashboard/settings/page.tsx
// Dashboard preferences — lets users choose their home page.

import { useState, useEffect } from 'react';
import { NAV_GROUPS } from '@/components/nav/NavConfig';
import { Settings, Check, Loader2 } from 'lucide-react';
import MfaSetupSection from '@/components/settings/MfaSetupSection';

// All non-admin nav items as choosable home pages
const HOME_OPTIONS = NAV_GROUPS
  .filter((g) => g.id !== 'ai') // skip admin-only groups
  .flatMap((g) =>
    g.items
      .filter((i) => !i.adminOnly)
      .map((i) => ({ ...i, group: g.label }))
  );

export default function DashboardSettingsPage() {
  const [current, setCurrent] = useState<string>('/dashboard/blog');
  const [selected, setSelected] = useState<string>('/dashboard/blog');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanAutoSave, setScanAutoSave] = useState(false);
  const [scanAutoSaveSaving, setScanAutoSaveSaving] = useState(false);

  useEffect(() => {
    fetch('/api/user/preferences')
      .then((r) => r.json())
      .then((d) => {
        const home = d.dashboard_home ?? '/dashboard/blog';
        setCurrent(home);
        setSelected(home);
        setScanAutoSave(d.scan_auto_save_images ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_home: selected }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to save');
      }
      setCurrent(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  // Group options by their nav group label
  const grouped = HOME_OPTIONS.reduce<Record<string, typeof HOME_OPTIONS>>((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-fuchsia-600" />
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Preferences</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Home Page</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose which page you land on when you click &ldquo;Go to Dashboard&rdquo; or log in.
        </p>

        <div className="space-y-4">
          {Object.entries(grouped).map(([groupLabel, items]) => (
            <div key={groupLabel}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {groupLabel}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((item) => {
                  const ItemIcon = item.icon;
                  const isSelected = selected === item.href;
                  return (
                    <button
                      key={item.href}
                      onClick={() => setSelected(item.href)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition text-left ${
                        isSelected
                          ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-fuchsia-200 hover:bg-fuchsia-50/40'
                      }`}
                    >
                      <ItemIcon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isSelected && <Check className="w-4 h-4 shrink-0 text-fuchsia-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || selected === current}
            className="px-6 py-2.5 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Preference'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-lime-700 font-medium">
              <Check className="w-4 h-4" />
              Saved!
            </span>
          )}
        </div>
      </div>

      {/* Scan Preferences */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Smart Scan</h2>
        <p className="text-sm text-gray-500 mb-5">
          Configure how scanned documents are handled.
        </p>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-700">Auto-save scanned images</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Automatically upload receipt/document images to your account when scanning
            </p>
          </div>
          <button
            onClick={async () => {
              const newVal = !scanAutoSave;
              setScanAutoSaveSaving(true);
              try {
                const res = await fetch('/api/user/preferences', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scan_auto_save_images: newVal }),
                });
                if (res.ok) setScanAutoSave(newVal);
              } finally {
                setScanAutoSaveSaving(false);
              }
            }}
            disabled={scanAutoSaveSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              scanAutoSave ? 'bg-fuchsia-600' : 'bg-gray-300'
            } ${scanAutoSaveSaving ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                scanAutoSave ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Two-Factor Authentication */}
      <MfaSetupSection />
    </div>
  );
}
