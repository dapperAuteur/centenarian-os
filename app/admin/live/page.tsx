'use client';

// app/admin/live/page.tsx
// Admin: create and manage CentOS Team live sessions.

import { useEffect, useState } from 'react';
import { Radio, Plus, Trash2, Eye } from 'lucide-react';

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  embed_code: string;
  is_live: boolean;
  visibility: string;
  published_at: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  scheduled_at: '',
  embed_code: '',
  is_live: false,
  visibility: 'public' as 'public' | 'members' | 'scheduled',
  published_at: '',
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Public (anyone)',
  members: 'Members only',
  scheduled: 'Scheduled',
};

export default function AdminLivePage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function loadSessions() {
    // Fetch all sessions for admin (including non-public) — use admin API
    fetch('/api/live?host_type=centos_team')
      .then((r) => r.json())
      .then((d) => { setSessions(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadSessions(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        scheduled_at: form.scheduled_at || null,
        embed_code: form.embed_code,
        is_live: form.is_live,
        visibility: form.visibility,
        published_at: form.visibility === 'scheduled' && form.published_at ? form.published_at : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed'); setSaving(false); return; }
    setSessions((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setCreating(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this live session?')) return;
    await fetch(`/api/live?id=${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  async function toggleLive(s: LiveSession) {
    const res = await fetch('/api/live', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, is_live: !s.is_live }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSessions((prev) => prev.map((item) => item.id === updated.id ? updated : item));
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
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-500" /> Live Sessions
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage CentenarianOS Team live sessions. Members will be notified by email when a session is created.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="dark-input bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-white mb-2">Create Live Session</h2>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Scheduled At (display time)</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as typeof form.visibility })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
              >
                <option value="public">Public (anyone)</option>
                <option value="members">Members only</option>
                <option value="scheduled">Scheduled (publish at date)</option>
              </select>
            </div>
          </div>

          {form.visibility === 'scheduled' && (
            <div>
              <label className="block text-xs text-gray-300 mb-1">Publish At (auto-visible after this time)</label>
              <input
                type="datetime-local"
                value={form.published_at}
                onChange={(e) => setForm({ ...form, published_at: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-300 mb-1">Embed Code * (Viloud or any iframe)</label>
            <textarea
              required
              value={form.embed_code}
              onChange={(e) => setForm({ ...form, embed_code: e.target.value })}
              rows={3}
              placeholder="<iframe src='https://player.viloud.tv/embed/...' ...></iframe>"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-fuchsia-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_live}
              onChange={(e) => setForm({ ...form, is_live: e.target.checked })}
              className="accent-red-500"
            />
            Mark as Live Now
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <p className="text-amber-500 text-xs">
            Creating a session will email all active members.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create & Notify Members'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setForm(EMPTY_FORM); setError(''); }}
              className="px-5 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sessions.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-16 text-center">
          <Radio className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500">No live sessions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.is_live && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-900/40 text-red-400 rounded-full text-xs font-medium">
                        <Radio className="w-3 h-3" /> LIVE
                      </span>
                    )}
                    <p className="text-white font-medium">{s.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      s.visibility === 'public' ? 'bg-green-900/30 text-green-400' :
                      s.visibility === 'members' ? 'bg-blue-900/30 text-blue-400' :
                      'bg-amber-900/30 text-amber-400'
                    }`}>
                      {VISIBILITY_LABELS[s.visibility] ?? s.visibility}
                    </span>
                  </div>
                  {s.description && <p className="text-gray-500 text-sm mt-0.5">{s.description}</p>}
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                    {s.scheduled_at && <span>Scheduled: {new Date(s.scheduled_at).toLocaleString()}</span>}
                    {s.visibility === 'scheduled' && s.published_at && (
                      <span>Publishes: {new Date(s.published_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleLive(s)}
                    title="Toggle live"
                    className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    title="Delete"
                    className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
