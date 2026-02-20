'use client';

// app/admin/academy/page.tsx
// Admin: Academy overview and platform settings (teacher fee, plan pricing).

import { useEffect, useState } from 'react';
import { GraduationCap, Percent, CreditCard, Save, Loader2, BookOpen, RefreshCw, CheckCircle } from 'lucide-react';

interface Settings {
  teacher_fee_percent: string;
  teacher_monthly_price_id: string;
  teacher_annual_price_id: string;
}

const DEFAULT: Settings = {
  teacher_fee_percent: '15',
  teacher_monthly_price_id: '',
  teacher_annual_price_id: '',
};

export default function AdminAcademyPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [ingestStatus, setIngestStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [ingestResult, setIngestResult] = useState('');

  useEffect(() => {
    fetch('/api/admin/academy/settings')
      .then((r) => r.json())
      .then((d) => {
        setSettings({ ...DEFAULT, ...d });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleIngest() {
    setIngestStatus('loading');
    setIngestResult('');
    try {
      const r = await fetch('/api/admin/help/ingest', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Ingest failed');
      const firstErr = d.failed?.[0]?.error ?? '';
      const msg = d.succeeded === 0 && d.failed?.length
        ? `All ${d.failed.length} articles failed. First error: ${firstErr}`
        : `Ingested ${d.succeeded} article${d.succeeded !== 1 ? 's' : ''}${d.failed ? ` (${d.failed.length} failed — first: ${firstErr})` : ''}.`;
      setIngestResult(msg);
      setIngestStatus(d.succeeded === 0 ? 'error' : 'done');
    } catch (e) {
      setIngestResult(e instanceof Error ? e.message : 'Ingest failed');
      setIngestStatus('error');
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const r = await fetch('/api/admin/academy/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Save failed'); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <GraduationCap className="w-6 h-6 text-fuchsia-400" />
        <h1 className="text-2xl font-bold text-white">Academy Settings</h1>
      </div>
      <p className="text-gray-400 text-sm mb-8">Configure teacher plans and platform fees.</p>

      <div className="space-y-6 dark-input">
        {/* Teacher fee */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="w-4 h-4 text-fuchsia-400" />
            <h2 className="font-semibold text-white">Platform Fee</h2>
          </div>
          <label className="block text-sm text-gray-200 mb-2">
            CentenarianOS fee on each course sale (%)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              value={settings.teacher_fee_percent}
              onChange={(e) => setSettings((s) => ({ ...s, teacher_fee_percent: e.target.value }))}
              className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
            />
            <span className="text-gray-400 text-sm">%</span>
          </div>
          <p className="text-gray-400 text-xs mt-2">
            Applied via Stripe Connect application_fee_amount on course enrollments.
          </p>
        </div>

        {/* Teacher subscription plan */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-fuchsia-400" />
            <h2 className="font-semibold text-white">Teacher Subscription</h2>
          </div>
          <p className="text-gray-400 text-xs mb-4">
            Create prices in your Stripe dashboard, then paste the Price IDs here.
            The env var <code className="bg-gray-700 px-1 rounded text-gray-200">TEACHER_MONTHLY_PRICE_ID</code> is used
            as a fallback if these fields are empty.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-200 mb-2">Monthly Plan — Stripe Price ID</label>
              <input
                type="text"
                placeholder="price_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.teacher_monthly_price_id}
                onChange={(e) => setSettings((s) => ({ ...s, teacher_monthly_price_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-fuchsia-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-200 mb-2">Annual Plan — Stripe Price ID</label>
              <input
                type="text"
                placeholder="price_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.teacher_annual_price_id}
                onChange={(e) => setSettings((s) => ({ ...s, teacher_annual_price_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-fuchsia-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Help RAG — ingest articles */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-fuchsia-400" />
            <h2 className="font-semibold text-white">In-App Help Articles</h2>
          </div>
          <p className="text-gray-400 text-xs mb-4">
            Embed tutorial content into the RAG help system. Run this once after initial setup and
            after any tutorial doc updates. Requires <code className="bg-gray-700 px-1 rounded text-gray-200">GOOGLE_GEMINI_API_KEY</code>.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleIngest}
              disabled={ingestStatus === 'loading'}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-600 transition disabled:opacity-50"
            >
              {ingestStatus === 'loading'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : ingestStatus === 'done'
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <RefreshCw className="w-4 h-4" />}
              {ingestStatus === 'loading' ? 'Ingesting…' : 'Ingest Help Articles'}
            </button>
            {ingestResult && (
              <p className={`text-xs ${ingestStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                {ingestResult}
              </p>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg font-semibold text-sm hover:bg-fuchsia-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <p className="text-green-400 text-sm">Settings saved.</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
}
