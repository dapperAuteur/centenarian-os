'use client';

// app/admin/cashapp/page.tsx
// Admin CashApp payment review queue.

import { useEffect, useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { CheckCircle, XCircle, Loader2, DollarSign, Clock, Ban } from 'lucide-react';

interface CashAppPayment {
  id: string;
  user_id: string;
  amount: number;
  cashapp_name: string | null;
  screenshot_url: string | null;
  status: 'pending' | 'verified' | 'rejected';
  admin_notes: string | null;
  verified_at: string | null;
  created_at: string;
  email: string | null;
  current_status: string;
}

export default function AdminCashAppPage() {
  const [payments, setPayments] = useState<CashAppPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    offlineFetch('/api/admin/cashapp')
      .then((r) => r.json())
      .then((d) => { setPayments(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAction(id: string, action: 'verify' | 'reject') {
    const notes = action === 'reject' ? prompt('Rejection reason (optional):') : null;
    setActionLoading(id);
    try {
      const res = await offlineFetch('/api/admin/cashapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, admin_notes: notes }),
      });
      if (res.ok) {
        setPayments((prev) =>
          prev.map((p) => p.id === id ? { ...p, status: action === 'verify' ? 'verified' : 'rejected', admin_notes: notes ?? p.admin_notes, verified_at: new Date().toISOString() } : p),
        );
      }
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const processed = payments.filter((p) => p.status !== 'pending');

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <DollarSign className="w-6 h-6 text-emerald-400" />
        <h1 className="text-2xl font-bold text-white">CashApp Payments</h1>
        {pending.length > 0 && (
          <span className="px-2.5 py-0.5 bg-amber-500 text-gray-900 text-xs font-bold rounded-full">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Pending payments */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Pending Review</h2>
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="bg-gray-900 border border-amber-700/50 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-medium">{p.email ?? 'Unknown user'}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> ${p.amount}
                      </span>
                      {p.cashapp_name && (
                        <span className="text-emerald-400 font-mono">{p.cashapp_name}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-gray-500">Current: {p.current_status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(p.id, 'verify')}
                      disabled={actionLoading === p.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 min-h-11"
                    >
                      {actionLoading === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(p.id, 'reject')}
                      disabled={actionLoading === p.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600/80 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 min-h-11"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed payments */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          History ({processed.length})
        </h2>
        {processed.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 border border-dashed border-gray-800 rounded-xl">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500 text-sm">No CashApp payments yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {processed.map((p) => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {p.status === 'verified' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Ban className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-white text-sm font-medium">{p.email ?? 'Unknown'}</span>
                    <span className="text-gray-500 text-xs">${p.amount}</span>
                    {p.cashapp_name && (
                      <span className="text-emerald-400/70 text-xs font-mono">{p.cashapp_name}</span>
                    )}
                  </div>
                  {p.admin_notes && (
                    <p className="text-xs text-gray-500 mt-1">Note: {p.admin_notes}</p>
                  )}
                </div>
                <div className="text-xs text-gray-500 shrink-0">
                  {p.verified_at
                    ? new Date(p.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
