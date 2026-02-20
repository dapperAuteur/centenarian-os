'use client';

// app/dashboard/teaching/promo-codes/page.tsx
// Teacher: create and manage discount promo codes (Stripe coupons).

import { useEffect, useState } from 'react';
import { Tag, Plus, Trash2 } from 'lucide-react';

interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  created_at: string;
}

const EMPTY_FORM = { code: '', discount_percent: 20, max_uses: '', expires_at: '' };

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/teacher/promo-codes')
      .then((r) => r.json())
      .then((data) => { setCodes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/teacher/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code,
        discount_percent: form.discount_percent,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed'); setSaving(false); return; }
    setCodes((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setCreating(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this promo code? It will also be removed from Stripe.')) return;
    await fetch(`/api/teacher/promo-codes?id=${id}`, { method: 'DELETE' });
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Promo Codes</h1>
          <p className="text-gray-400 text-sm mt-1">Discount codes applied at checkout via Stripe.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" /> New Code
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-white mb-2">Create Promo Code</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Code *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER20"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono tracking-wide focus:outline-none focus:border-fuchsia-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Discount % *</label>
              <input
                required
                type="number"
                min={1}
                max={100}
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Max Uses (leave blank for unlimited)</label>
              <input
                type="number"
                min={1}
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="Unlimited"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Expires At (optional)</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Code'}
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

      {codes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-16 text-center">
          <Tag className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500">No promo codes yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Code</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Discount</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Uses</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Expires</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/40 transition">
                  <td className="px-5 py-3 font-mono text-fuchsia-300 font-medium">{c.code}</td>
                  <td className="px-5 py-3 text-white">{c.discount_percent}% off</td>
                  <td className="px-5 py-3 text-gray-400">
                    {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
