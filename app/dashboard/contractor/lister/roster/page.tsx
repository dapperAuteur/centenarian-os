'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Plus, Trash2, X, Search, UserCircle,
} from 'lucide-react';

interface RosterContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  skills: string[] | null;
  availability_notes: string | null;
  linked_user_id: string | null;
  username: string | null;
  use_count: number;
}

export default function ListerRosterPage() {
  const [roster, setRoster] = useState<RosterContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', skills: '', availability_notes: '', linked_user_id: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/contractor/roster')
      .then((r) => r.json())
      .then((d) => setRoster(d.roster ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addContractor() {
    if (!form.name.trim()) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      skills: form.skills.trim() ? form.skills.split(',').map((s) => s.trim()).filter(Boolean) : null,
      availability_notes: form.availability_notes.trim() || null,
      linked_user_id: form.linked_user_id.trim() || null,
    };

    const res = await fetch('/api/contractor/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      setShowAdd(false);
      setForm({ name: '', email: '', phone: '', skills: '', availability_notes: '', linked_user_id: '' });
      load();
    }
  }

  async function removeContractor(contactId: string) {
    setRemovingId(contactId);
    await fetch('/api/contractor/roster', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId }) });
    setRemovingId(null);
    load();
  }

  const filtered = roster.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q)
      || (c.email?.toLowerCase().includes(q))
      || (c.skills?.some((s) => s.toLowerCase().includes(q)));
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-100">Crew Roster</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          <Plus size={14} aria-hidden="true" /> Add Contractor
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or skill..."
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 pl-9 pr-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          aria-label="Search roster"
        />
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">Add to Roster</h2>
            <button onClick={() => setShowAdd(false)} className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Close form">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Name *</span>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" placeholder="Jane Doe" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" placeholder="jane@example.com" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Phone</span>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" placeholder="317-555-0123" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Skills (comma-separated)</span>
              <input type="text" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" placeholder="Camera Op, Audio A2, Utility" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Availability Notes</span>
            <input type="text" value={form.availability_notes} onChange={(e) => setForm({ ...form, availability_notes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" placeholder="Available weekends, prefers multi-day jobs" />
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={addContractor} disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900">
              {saving ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Plus size={14} aria-hidden="true" />}
              {saving ? 'Saving...' : 'Add'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Roster list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {search ? 'No contractors match your search.' : 'No contractors in your roster yet.'}
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Crew roster">
          {filtered.map((c) => (
            <article key={c.id} role="listitem" className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <UserCircle size={16} className="text-indigo-400 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-neutral-100 text-sm">{c.name}</span>
                    {c.username && (
                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">@{c.username}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                    {c.availability_notes && <span>· {c.availability_notes}</span>}
                  </div>
                  {c.skills && c.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.skills.map((s) => (
                        <span key={s} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeContractor(c.id)}
                  disabled={removingId === c.id}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label={`Remove ${c.name} from roster`}
                >
                  {removingId === c.id ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Trash2 size={14} aria-hidden="true" />}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-600">{filtered.length} contractor{filtered.length !== 1 ? 's' : ''} in roster</p>
    </div>
  );
}
