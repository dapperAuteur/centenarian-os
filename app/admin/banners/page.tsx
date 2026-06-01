'use client';

// app/admin/banners/page.tsx
// Admin marketing-banner management — create, activate/deactivate site-wide
// banners. Banners show on every non-admin page for the targeted subscription
// tiers (see components/marketing/MarketingBanner.tsx). Promo reactivation also
// auto-creates a banner; this page lets admin manage them directly.

import { useEffect, useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { Plus, Loader2, Megaphone, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface Banner {
  id: string;
  title: string;
  body: string;
  cta_text: string;
  cta_url: string;
  target_tiers: string[];
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const TIERS = ['free', 'monthly', 'starter', 'annual'] as const;

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaText, setCtaText] = useState('Upgrade');
  const [ctaUrl, setCtaUrl] = useState('/pricing');
  const [tiers, setTiers] = useState<string[]>(['free', 'monthly']);
  const [endsAt, setEndsAt] = useState('');

  useEffect(() => {
    offlineFetch('/api/admin/banners')
      .then((r) => r.json())
      .then((d) => { setBanners(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function toggleTier(t: string) {
    setTiers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function handleCreate() {
    if (!title || !body) { setFormError('Title and body are required.'); return; }
    if (tiers.length === 0) { setFormError('Pick at least one tier to show the banner to.'); return; }
    setCreating(true);
    setFormError(null);
    try {
      const res = await offlineFetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, body, cta_text: ctaText || 'Upgrade', cta_url: ctaUrl || '/pricing',
          target_tiers: tiers, ends_at: endsAt || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setBanners((prev) => [created, ...prev]);
        setShowCreate(false);
        setTitle(''); setBody(''); setCtaText('Upgrade'); setCtaUrl('/pricing'); setTiers(['free', 'monthly']); setEndsAt('');
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error ?? 'Failed to create banner');
      }
    } catch { setFormError('Network error — please try again.'); }
    setCreating(false);
  }

  async function handleToggle(id: string, currentActive: boolean) {
    setToggling(id);
    try {
      const res = await offlineFetch('/api/admin/banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      if (res.ok) setBanners((prev) => prev.map((b) => b.id === id ? { ...b, is_active: !currentActive } : b));
    } catch { /* ignore */ }
    setToggling(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  const active = banners.filter((b) => b.is_active);
  const inactive = banners.filter((b) => !b.is_active);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 dark-input">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-fuchsia-400" />
          <h1 className="text-2xl font-bold text-white">Marketing Banners</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition min-h-11"
        >
          <Plus className="w-4 h-4" />
          New Banner
        </button>
      </div>

      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Active ({active.length})</h2>
          <div className="space-y-3">
            {active.map((b) => <BannerCard key={b.id} banner={b} onToggle={handleToggle} toggling={toggling} />)}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Inactive ({inactive.length})</h2>
          <div className="space-y-3">
            {inactive.map((b) => <BannerCard key={b.id} banner={b} onToggle={handleToggle} toggling={toggling} />)}
          </div>
        </div>
      )}

      {banners.length === 0 && (
        <div className="text-center py-16 bg-gray-900 border border-dashed border-gray-800 rounded-xl">
          <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm">No banners yet.</p>
          <p className="text-gray-600 text-xs mt-1">Create one, or publish a promo with the &ldquo;announcement banner&rdquo; option.</p>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Marketing Banner">
        <div className="dark-input space-y-4">
          <div>
            <label htmlFor="b-title" className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input id="b-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lifetime is back!" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
          </div>
          <div>
            <label htmlFor="b-body" className="block text-sm font-medium text-gray-300 mb-1">Body</label>
            <input id="b-body" type="text" value={body} onChange={(e) => setBody(e.target.value)} placeholder="20% off lifetime through Friday." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="b-cta-text" className="block text-sm font-medium text-gray-300 mb-1">Button Text</label>
              <input id="b-cta-text" type="text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
            </div>
            <div>
              <label htmlFor="b-cta-url" className="block text-sm font-medium text-gray-300 mb-1">Button URL</label>
              <input id="b-cta-url" type="text" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-300 mb-1">Show to tiers</span>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTier(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition min-h-11 ${tiers.includes(t) ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="b-ends" className="block text-sm font-medium text-gray-300 mb-1">End Date (optional)</label>
            <input id="b-ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-fuchsia-500" />
          </div>
          {formError && <p role="alert" className="text-sm text-red-400">{formError}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || !title || !body}
            className="w-full px-4 py-3 bg-fuchsia-600 text-white rounded-lg font-semibold text-sm hover:bg-fuchsia-700 transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-11"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Creating...' : 'Create Banner'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function BannerCard({ banner: b, onToggle, toggling }: { banner: Banner; onToggle: (id: string, active: boolean) => void; toggling: string | null }) {
  return (
    <div className={`bg-gray-900 border rounded-xl p-5 ${b.is_active ? 'border-fuchsia-700/50' : 'border-gray-800'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold">{b.title}</h3>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${b.is_active ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
              {b.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{b.body}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
            <span>Tiers: {b.target_tiers.join(', ')}</span>
            <span>CTA: {b.cta_text} → {b.cta_url}</span>
            {b.ends_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Ends {new Date(b.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onToggle(b.id, b.is_active)}
          disabled={toggling === b.id}
          className="flex items-center gap-2 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 min-h-11 shrink-0"
          aria-label={b.is_active ? 'Deactivate banner' : 'Activate banner'}
        >
          {toggling === b.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : b.is_active ? (
            <ToggleRight className="w-4 h-4 text-emerald-400" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {b.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
}
