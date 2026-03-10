'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Send, UserPlus, CheckCircle, Clock, Mail } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Invite {
  id: string;
  email: string;
  product: string;
  is_active: boolean;
  accepted_at: string | null;
  invited_at: string;
}

export default function ListerInvitePage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [product, setProduct] = useState<'contractor' | 'lister'>('contractor');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    offlineFetch('/api/contractor/invite')
      .then((r) => r.json())
      .then((d) => setInvites(d.invites ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setMessage(null);

    const res = await offlineFetch('/api/contractor/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), product }),
    });

    const data = await res.json();
    setSending(false);

    if (res.ok) {
      setMessage({ type: 'success', text: data.already_exists ? `${email} already has an account. Invite recorded.` : `Invite sent to ${email}!` });
      setEmail('');
      load();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to send invite' });
    }
  }

  const PRODUCT_LABELS: Record<string, string> = { contractor: 'Contractor', lister: 'Lister' };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold text-neutral-100">
        <UserPlus size={20} className="inline mr-2 text-indigo-400" aria-hidden="true" />
        Invite Users
      </h1>
      <p className="text-sm text-neutral-400">
        Invite contractors to join JobHub or other listers to join CrewOps.
        They&apos;ll receive a magic link. You can send up to 10 invites.
      </p>

      {/* Invite form */}
      <form onSubmit={sendInvite} className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            aria-label="Email address to invite"
          />
        </label>
        <select
          value={product}
          onChange={(e) => setProduct(e.target.value as 'contractor' | 'lister')}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none min-h-11"
          aria-label="Invite as product"
        >
          <option value="contractor">As Contractor</option>
          <option value="lister">As Lister</option>
        </select>
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-11"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} aria-hidden="true" />}
          Send Invite
        </button>
      </form>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${message.type === 'success' ? 'border-green-700/50 bg-green-900/20 text-green-300' : 'border-red-700/50 bg-red-900/20 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Sent invites */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-200 mb-3">Sent Invites ({invites.length}/10)</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-neutral-500" aria-label="Loading invites" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-neutral-500">No invites sent yet.</p>
        ) : (
          <div className="space-y-2" role="list" aria-label="Sent invites">
            {invites.map((inv) => (
              <div key={inv.id} role="listitem" className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={14} className="text-neutral-500 shrink-0" aria-hidden="true" />
                  <span className="text-sm text-neutral-200 truncate">{inv.email}</span>
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                    {PRODUCT_LABELS[inv.product] ?? inv.product}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {inv.accepted_at ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle size={12} aria-hidden="true" /> Accepted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-neutral-500">
                      <Clock size={12} aria-hidden="true" /> Pending
                    </span>
                  )}
                  <span className="text-neutral-500">{new Date(inv.invited_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
