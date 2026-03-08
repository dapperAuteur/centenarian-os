'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, MapPin, Plus, Globe, Lock, ChevronRight, Search,
} from 'lucide-react';

interface CityGuide {
  id: string;
  city_name: string;
  state: string | null;
  region: string | null;
  is_shared: boolean;
  notes: string | null;
  entry_count: number;
  author: string | null;
  created_at: string;
}

export default function CityGuidesPage() {
  const router = useRouter();
  const [guides, setGuides] = useState<CityGuide[]>([]);
  const [shared, setShared] = useState<CityGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ city_name: '', state: '', region: '', notes: '', is_shared: false });
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/contractor/cities?shared=true')
      .then((r) => r.json())
      .then((d) => {
        setGuides(d.guides ?? []);
        setShared(d.shared ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGuide() {
    if (!form.city_name.trim()) return;
    setCreating(true);
    const res = await fetch('/api/contractor/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setShowCreate(false);
      setForm({ city_name: '', state: '', region: '', notes: '', is_shared: false });
      router.push(`/dashboard/contractor/cities/${data.id}`);
    }
  }

  const list = tab === 'mine' ? guides : shared;
  const filtered = search
    ? list.filter(
        (g) =>
          g.city_name.toLowerCase().includes(search.toLowerCase()) ||
          g.state?.toLowerCase().includes(search.toLowerCase()) ||
          g.region?.toLowerCase().includes(search.toLowerCase()),
      )
    : list;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-100">City Guides</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          <Plus size={14} aria-hidden="true" /> New Guide
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800" role="tablist" aria-label="Guide views">
        {[
          { id: 'mine' as const, label: 'My Guides' },
          { id: 'shared' as const, label: `Community (${shared.length})` },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 ${
              tab === t.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search cities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2.5 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          aria-label="Search city guides"
        />
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-neutral-100">New City Guide</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">City *</span>
              <input
                type="text"
                value={form.city_name}
                onChange={(e) => setForm({ ...form, city_name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="Indianapolis"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">State</span>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="IN"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Region</span>
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="Midwest"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
              placeholder="General notes about the city..."
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_shared}
              onChange={(e) => setForm({ ...form, is_shared: e.target.checked })}
              className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-neutral-900"
            />
            Share with community
          </label>
          <div className="flex gap-2">
            <button
              onClick={createGuide}
              disabled={creating || !form.city_name.trim()}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
            >
              {creating && <Loader2 size={14} className="animate-spin" aria-label="Loading..." />}
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="min-h-11 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {search
            ? 'No guides match your search.'
            : tab === 'mine'
              ? 'No city guides yet. Create one to start tracking your favorite spots.'
              : 'No shared guides from the community yet.'}
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label={tab === 'mine' ? 'My city guides' : 'Shared city guides'}>
          {filtered.map((guide) => (
            <button
              key={guide.id}
              onClick={() => router.push(`/dashboard/contractor/cities/${guide.id}`)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left transition-colors hover:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label={`${guide.city_name}${guide.state ? `, ${guide.state}` : ''} — ${guide.entry_count} entries`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <MapPin size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
                  <span className="font-medium text-neutral-100">{guide.city_name}</span>
                  {guide.state && <span className="text-sm text-neutral-400">{guide.state}</span>}
                  {guide.region && <span className="text-xs text-neutral-500">· {guide.region}</span>}
                  {guide.is_shared ? (
                    <Globe size={12} className="text-green-400" aria-label="Shared" />
                  ) : (
                    <Lock size={12} className="text-neutral-600" aria-label="Private" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span>{guide.entry_count} {guide.entry_count === 1 ? 'entry' : 'entries'}</span>
                  {guide.author && <span>· by {guide.author}</span>}
                </div>
              </div>
              <ChevronRight size={16} className="text-neutral-600 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
