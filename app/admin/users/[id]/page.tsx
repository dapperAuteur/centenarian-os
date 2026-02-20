'use client';

// app/admin/users/[id]/page.tsx
// Admin user detail: stats, promo code management, subscription override

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save, AlertTriangle, CheckCircle } from 'lucide-react';

interface UserDetail {
  profile: {
    id: string; username: string; display_name: string | null;
    subscription_status: string; shirt_promo_code: string | null;
    stripe_customer_id: string | null; stripe_subscription_id: string | null;
    cancel_at_period_end: boolean | null; cancel_at: string | null;
    cancellation_feedback: string | null; cancellation_comment: string | null;
    subscription_expires_at: string | null;
    created_at: string;
  };
  email: string | null;
  stats: { focusSessions: number; recipes: number; blogPosts: number };
}

const SUBSCRIPTION_OPTIONS = ['free', 'monthly', 'lifetime'] as const;

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoInput, setPromoInput] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setPromoInput(d.profile?.shirt_promo_code ?? '');
        setSubStatus(d.profile?.subscription_status ?? 'free');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function saveChanges() {
    setSaving(true);
    setMessage(null);
    const body: Record<string, string> = {};
    if (promoInput !== (data?.profile?.shirt_promo_code ?? '')) body.shirt_promo_code = promoInput;
    if (subStatus !== data?.profile?.subscription_status) body.subscription_status = subStatus;

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMessage({ type: 'ok', text: 'Saved successfully.' });
      setData((prev) => prev ? { ...prev, profile: { ...prev.profile, shirt_promo_code: promoInput || null, subscription_status: subStatus } } : prev);
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function retryPromo() {
    setRetrying(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/retry-promo`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPromoInput(d.code);
      setData((prev) => prev ? { ...prev, profile: { ...prev.profile, shirt_promo_code: d.code } } : prev);
      setMessage({ type: 'ok', text: `Generated code: ${d.code}` });
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Retry failed' });
    } finally {
      setRetrying(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" /></div>;
  if (!data) return <div className="p-8 text-red-400">User not found.</div>;

  const { profile, email, stats } = data;

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/admin/users" className="flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      <h1 className="text-2xl font-bold text-white mb-1">{email ?? profile.username}</h1>
      <p className="text-gray-400 text-sm mb-8">@{profile.username} · joined {new Date(profile.created_at).toLocaleDateString()}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[['Focus Sessions', stats.focusSessions], ['Recipes', stats.recipes], ['Blog Posts', stats.blogPosts]].map(([label, val]) => (
          <div key={label as string} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{val}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Subscription Override */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-white mb-3">Subscription</h2>
        <div className="flex gap-2 flex-wrap">
          {SUBSCRIPTION_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSubStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${subStatus === s ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
        {profile.stripe_customer_id && (
          <p className="mt-3 text-xs text-gray-600">Stripe customer: {profile.stripe_customer_id}</p>
        )}
      </div>

      {/* Cancellation details — only shown when present */}
      {(profile.cancel_at_period_end || profile.cancellation_feedback || profile.cancellation_comment) && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-amber-300 mb-3">Cancellation Details</h2>
          {profile.cancel_at_period_end && profile.cancel_at && (
            <p className="text-sm text-amber-200 mb-2">
              <span className="font-medium">Cancels on:</span>{' '}
              {new Date(profile.cancel_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {profile.cancellation_feedback && (
            <p className="text-sm text-amber-200 mb-1">
              <span className="font-medium">Reason:</span> {profile.cancellation_feedback}
            </p>
          )}
          {profile.cancellation_comment && (
            <p className="text-sm text-amber-200">
              <span className="font-medium">Comment:</span> {profile.cancellation_comment}
            </p>
          )}
        </div>
      )}

      {/* Promo Code */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-white mb-3">Shirt Promo Code</h2>
        {profile.subscription_status !== 'lifetime' && subStatus !== 'lifetime' && (
          <p className="text-sm text-gray-500 mb-3">Only applies to lifetime members.</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            placeholder="CENT-XXXXXX"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-fuchsia-500"
          />
          <button
            onClick={retryPromo}
            disabled={retrying}
            title="Auto-generate via Shopify API"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            Retry Shopify
          </button>
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm ${message.type === 'ok' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
          {message.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <button
        onClick={saveChanges}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition font-semibold text-sm disabled:opacity-60"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
