'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, ArrowLeft, Plus, Star, Trash2, Edit2, Save, Globe, Lock,
  UtensilsCrossed, Hotel, ShoppingCart, Dumbbell, Pill, Ticket, Bus, Coffee, Shirt, HelpCircle,
  type LucideIcon,
} from 'lucide-react';

interface CityGuide {
  id: string;
  user_id: string;
  city_name: string;
  state: string | null;
  region: string | null;
  is_shared: boolean;
  notes: string | null;
}

interface Entry {
  id: string;
  category: string;
  name: string;
  address: string | null;
  rating: number | null;
  price_range: number | null;
  notes: string | null;
  url: string | null;
  near_venue_name: string | null;
  is_shared: boolean;
}

const CATEGORIES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { value: 'hotel', label: 'Hotel', icon: Hotel },
  { value: 'grocery', label: 'Grocery', icon: ShoppingCart },
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'pharmacy', label: 'Pharmacy', icon: Pill },
  { value: 'entertainment', label: 'Entertainment', icon: Ticket },
  { value: 'transport', label: 'Transport', icon: Bus },
  { value: 'coffee', label: 'Coffee', icon: Coffee },
  { value: 'laundry', label: 'Laundry', icon: Shirt },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const getCatIcon = (cat: string) => CATEGORIES.find((c) => c.value === cat)?.icon ?? HelpCircle;
const getCatLabel = (cat: string) => CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

export default function CityGuideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [guide, setGuide] = useState<CityGuide | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const emptyForm = { category: 'restaurant', name: '', address: '', rating: '', price_range: '', notes: '', url: '', is_shared: false };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/contractor/cities/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setGuide(d.guide ?? null);
        setEntries(d.entries ?? []);
        // Check ownership via /api/auth/me
        fetch('/api/auth/me')
          .then((r) => r.json())
          .then((me) => setIsOwner(d.guide?.user_id === me.id));
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addEntry() {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/contractor/cities/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        rating: form.rating ? Number(form.rating) : null,
        price_range: form.price_range ? Number(form.price_range) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowAdd(false);
      setForm(emptyForm);
      load();
    }
  }

  async function updateEntry(entryId: string) {
    setSaving(true);
    await fetch(`/api/contractor/cities/${id}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        rating: form.rating ? Number(form.rating) : null,
        price_range: form.price_range ? Number(form.price_range) : null,
      }),
    });
    setSaving(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  }

  async function deleteEntry(entryId: string) {
    setDeletingId(entryId);
    await fetch(`/api/contractor/cities/${id}/entries/${entryId}`, { method: 'DELETE' });
    setDeletingId(null);
    load();
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setForm({
      category: entry.category,
      name: entry.name,
      address: entry.address ?? '',
      rating: entry.rating?.toString() ?? '',
      price_range: entry.price_range?.toString() ?? '',
      notes: entry.notes ?? '',
      url: entry.url ?? '',
      is_shared: entry.is_shared,
    });
  }

  const filtered = filterCat ? entries.filter((e) => e.category === filterCat) : entries;

  // Group by category
  const grouped = filtered.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading..." />
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-neutral-500">City guide not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button
            onClick={() => router.push('/dashboard/contractor/cities')}
            className="mb-2 flex min-h-11 items-center gap-1 py-2 text-sm text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
            aria-label="Back to city guides"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <h1 className="text-2xl font-bold text-neutral-100">
            {guide.city_name}{guide.state ? `, ${guide.state}` : ''}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-neutral-500">
            {guide.region && <span>{guide.region}</span>}
            {guide.is_shared ? (
              <span className="flex items-center gap-1 text-green-400"><Globe size={12} aria-hidden="true" /> Shared</span>
            ) : (
              <span className="flex items-center gap-1"><Lock size={12} aria-hidden="true" /> Private</span>
            )}
            <span>· {entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          {guide.notes && <p className="mt-2 text-sm text-neutral-400">{guide.notes}</p>}
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
          >
            <Plus size={14} aria-hidden="true" /> Add Entry
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        <button
          onClick={() => setFilterCat(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
            !filterCat ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => {
          const count = entries.filter((e) => e.category === c.value).length;
          if (count === 0) return null;
          return (
            <button
              key={c.value}
              onClick={() => setFilterCat(filterCat === c.value ? null : c.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                filterCat === c.value ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Add/Edit form */}
      {(showAdd || editingId) && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-neutral-100">
            {editingId ? 'Edit Entry' : 'New Entry'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Category *</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Name *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="Place name"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Address</span>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              placeholder="123 Main St"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Rating (1-5)</span>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Price Range</span>
              <select
                value={form.price_range}
                onChange={(e) => setForm({ ...form, price_range: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="">—</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{PRICE_LABELS[n]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">URL</span>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="https://..."
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
              placeholder="Tips, recommendations..."
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => (editingId ? updateEntry(editingId) : addEntry())}
              disabled={saving || !form.name.trim()}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
            >
              {saving ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Save size={14} aria-hidden="true" />}
              {editingId ? 'Update' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setEditingId(null); setForm(emptyForm); }}
              className="min-h-11 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entries grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {filterCat ? 'No entries in this category.' : 'No entries yet. Add your first recommendation.'}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catEntries]) => {
            const CatIcon = getCatIcon(cat);
            return (
              <section key={cat} aria-label={getCatLabel(cat)}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-300">
                  <CatIcon size={14} className="text-amber-400" aria-hidden="true" />
                  {getCatLabel(cat)}
                  <span className="text-xs text-neutral-600">({catEntries.length})</span>
                </h3>
                <div className="space-y-2" role="list">
                  {catEntries.map((entry) => (
                    <article
                      key={entry.id}
                      role="listitem"
                      className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-neutral-100 text-sm">{entry.name}</span>
                            {entry.rating && (
                              <span className="flex items-center gap-0.5 text-xs text-amber-400">
                                <Star size={10} aria-hidden="true" fill="currentColor" />
                                {entry.rating}
                              </span>
                            )}
                            {entry.price_range && (
                              <span className="text-xs text-neutral-500">
                                {PRICE_LABELS[entry.price_range]}
                              </span>
                            )}
                          </div>
                          {entry.address && (
                            <p className="mt-0.5 text-xs text-neutral-500">{entry.address}</p>
                          )}
                          {entry.notes && (
                            <p className="mt-1 text-sm text-neutral-400">{entry.notes}</p>
                          )}
                          {entry.near_venue_name && (
                            <p className="mt-0.5 text-xs text-neutral-600">Near {entry.near_venue_name}</p>
                          )}
                        </div>
                        {isOwner && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(entry)}
                              className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              aria-label={`Edit ${entry.name}`}
                            >
                              <Edit2 size={14} aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              disabled={deletingId === entry.id}
                              className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              aria-label={`Delete ${entry.name}`}
                            >
                              {deletingId === entry.id ? (
                                <Loader2 size={14} className="animate-spin" aria-label="Loading..." />
                              ) : (
                                <Trash2 size={14} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
