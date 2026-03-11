'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Modal from '@/components/ui/Modal';

interface Episode {
  id: string;
  title: string;
  episode_number: number | null;
  season_number: number | null;
  air_date: string | null;
  status: string;
  duration_min: number | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  recorded: { label: 'Recorded', className: 'bg-amber-100 text-amber-700' },
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PodcastEpisodesPage() {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', episode_number: '', season_number: '', air_date: '',
    description: '', status: 'draft', brand_id: '', duration_min: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [epRes, brRes] = await Promise.all([
        offlineFetch('/api/podcasts'),
        offlineFetch('/api/brands'),
      ]);
      if (epRes.ok) {
        const d = await epRes.json();
        setEpisodes(d.episodes || []);
      }
      if (brRes.ok) {
        const d = await brRes.json();
        setBrands(d || []);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await offlineFetch('/api/podcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          episode_number: form.episode_number ? parseInt(form.episode_number) : null,
          season_number: form.season_number ? parseInt(form.season_number) : null,
          air_date: form.air_date || null,
          description: form.description.trim() || null,
          status: form.status,
          brand_id: form.brand_id || null,
          duration_min: form.duration_min ? parseInt(form.duration_min) : null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ title: '', episode_number: '', season_number: '', air_date: '', description: '', status: 'draft', brand_id: '', duration_min: '' });
        load();
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media" className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Podcast Episodes</h1>
            <p className="text-sm text-gray-500">{episodes.length} episodes</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-medium hover:bg-fuchsia-700 transition min-h-11">
          <Plus className="w-4 h-4" /> New Episode
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-fuchsia-600" />
        </div>
      ) : episodes.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">No episodes yet.</div>
      ) : (
        <div className="space-y-2">
          {episodes.map((ep) => {
            const badge = STATUS_BADGE[ep.status] ?? STATUS_BADGE.draft;
            return (
              <button key={ep.id} type="button"
                onClick={() => router.push(`/dashboard/media/podcasts/${ep.id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-fuchsia-300 hover:shadow-sm transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {ep.episode_number != null && (
                        <span className="text-xs text-gray-400 font-mono">
                          {ep.season_number != null ? `S${ep.season_number}E${ep.episode_number}` : `#${ep.episode_number}`}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.className}`}>{badge.label}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{ep.title}</h3>
                    {ep.air_date && <p className="text-xs text-gray-500 mt-0.5">{fmtDate(ep.air_date)}</p>}
                  </div>
                  {ep.duration_min && (
                    <span className="text-xs text-gray-400 shrink-0">{ep.duration_min} min</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Episode" size="sm">
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="ep-title" className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input id="ep-title" type="text" value={form.title} required
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="ep-season" className="block text-xs font-medium text-gray-600 mb-1">Season #</label>
                <input id="ep-season" type="number" value={form.season_number}
                  onChange={(e) => setForm((f) => ({ ...f, season_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ep-number" className="block text-xs font-medium text-gray-600 mb-1">Episode #</label>
                <input id="ep-number" type="number" value={form.episode_number}
                  onChange={(e) => setForm((f) => ({ ...f, episode_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ep-duration" className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input id="ep-duration" type="number" value={form.duration_min}
                  onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="ep-date" className="block text-xs font-medium text-gray-600 mb-1">Air Date</label>
                <input id="ep-date" type="date" value={form.air_date}
                  onChange={(e) => setForm((f) => ({ ...f, air_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ep-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select id="ep-status" value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="draft">Draft</option>
                  <option value="recorded">Recorded</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            {brands.length > 0 && (
              <div>
                <label htmlFor="ep-brand" className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                <select id="ep-brand" value={form.brand_id}
                  onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">None</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="ep-desc" className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea id="ep-desc" value={form.description} rows={3}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex flex-col sm:flex-row gap-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-200 rounded-xl min-h-11 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-fuchsia-600 text-white rounded-xl min-h-11 text-sm font-medium hover:bg-fuchsia-700 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Episode'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
