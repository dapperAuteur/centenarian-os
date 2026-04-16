'use client';

// app/admin/users/page.tsx
// Admin user list with search, subscription filter, sortable columns, and renewal date

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, AlertTriangle, ChevronRight, ChevronUp, ChevronDown, CheckCircle2, Mail, Loader2, MailX } from 'lucide-react';
import PaginationBar from '@/components/ui/PaginationBar';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastProvider';

const PAGE_SIZE = 20;

interface UserRow {
  id: string;
  email: string | null;
  username: string;
  display_name: string | null;
  subscription_status: 'free' | 'monthly' | 'lifetime' | 'starter';
  shirt_promo_code: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  email_confirmed_at: string | null;
}

type SortKey = 'email' | 'subscription_status' | 'subscription_expires_at' | 'created_at';
type SortDir = 'asc' | 'desc';

const STATUS_BADGE: Record<string, string> = {
  free: 'bg-gray-800 text-gray-300',
  starter: 'bg-sky-900/50 text-sky-300',
  monthly: 'bg-fuchsia-900/50 text-fuchsia-300',
  lifetime: 'bg-lime-900/50 text-lime-300',
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp className="w-3 h-3 opacity-20" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-fuchsia-400" />
    : <ChevronDown className="w-3 h-3 text-fuchsia-400" />;
}

// Inner component — uses useSearchParams, must be inside <Suspense>
function AdminUsersContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(
    searchParams.get('filter') === 'promo_pending' ? 'promo_pending'
      : searchParams.get('filter') === 'unverified' ? 'unverified'
      : 'all',
  );
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/users');
      const d = await r.json();
      setUsers(d.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleResendOne(u: UserRow) {
    if (!u.email) { toast.error('User has no email on file.'); return; }
    setResendingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/resend-verification`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.alreadyVerified) {
        toast.info(`${u.email} is already verified — no email sent.`);
        reload();
      } else {
        toast.success(`Verification email sent to ${u.email}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send verification email.');
    } finally {
      setResendingId(null);
    }
  }

  async function handleResendAll() {
    setBulkSending(true);
    try {
      const res = await fetch('/api/admin/users/resend-all-unverified', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const parts = [`${data.succeeded} sent`];
      if (data.failed > 0) parts.push(`${data.failed} failed`);
      if (data.skippedMissingEmail > 0) parts.push(`${data.skippedMissingEmail} skipped (no email)`);
      toast.success(parts.join(' · '));
      setBulkModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk resend failed.');
    } finally {
      setBulkSending(false);
    }
  }

  const unverifiedCount = users.filter((u) => !u.email_confirmed_at).length;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all'
        ? true
        : filter === 'promo_pending'
          ? u.subscription_status === 'lifetime' && !u.shirt_promo_code
          : filter === 'unverified'
            ? !u.email_confirmed_at
            : u.subscription_status === filter;
    return matchSearch && matchFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: string | null = null;
    let bv: string | null = null;
    if (sortKey === 'email') { av = a.email ?? a.username; bv = b.email ?? b.username; }
    else if (sortKey === 'subscription_status') { av = a.subscription_status; bv = b.subscription_status; }
    else if (sortKey === 'subscription_expires_at') { av = a.subscription_expires_at; bv = b.subscription_expires_at; }
    else { av = a.created_at; bv = b.created_at; }
    const cmp = (av ?? '').localeCompare(bv ?? '');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function Th({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col;
    return (
      <th
        className="text-left px-4 py-3 cursor-pointer select-none hover:text-white transition"
        onClick={() => handleSort(col)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon active={active} dir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Users</h1>
          <p className="text-gray-400 text-sm">
            {users.length} total accounts
            {unverifiedCount > 0 && (
              <span className="ml-2 text-amber-400">· {unverifiedCount} unverified</span>
            )}
          </p>
        </div>
        {unverifiedCount > 0 && (
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg transition"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            Resend to all unverified
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search email or username…"
            aria-label="Search users by email or username"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
          />
        </div>
        {(['all', 'free', 'starter', 'monthly', 'lifetime', 'promo_pending', 'unverified'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`min-h-11 px-3 py-2 rounded-lg text-xs font-semibold transition ${filter === f ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {f === 'promo_pending' ? '⚠ No promo code' : f === 'unverified' ? '✉ Unverified' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm" aria-label="Users table">
            <thead>
              <tr className="border-b border-gray-800 text-gray-300 text-xs uppercase tracking-wide">
                <Th label="Email / Username" col="email" />
                <th className="text-left px-4 py-3">Verified</th>
                <Th label="Plan" col="subscription_status" />
                <th className="text-left px-4 py-3 hidden md:table-cell">Promo Code</th>
                <Th label="Renewal Date" col="subscription_expires_at" />
                <Th label="Joined" col="created_at" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">No users found</td>
                </tr>
              )}
              {paginated.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{u.email ?? '—'}</p>
                    <p className="text-gray-400 text-xs">@{u.username}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.email_confirmed_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400" title={`Verified ${new Date(u.email_confirmed_at).toLocaleDateString()}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResendOne(u)}
                        disabled={resendingId === u.id}
                        className="min-h-11 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-amber-900/40 border border-amber-800 rounded-lg text-amber-200 hover:bg-amber-900/60 transition disabled:opacity-50"
                        title={u.email ? `Resend verification to ${u.email}` : 'No email on file'}
                      >
                        {resendingId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : u.email ? (
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <MailX className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        {resendingId === u.id ? 'Sending…' : 'Resend'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE[u.subscription_status]}`}>
                      {u.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.subscription_status === 'lifetime' ? (
                      u.shirt_promo_code ? (
                        <code className="text-lime-400 text-xs">{u.shirt_promo_code}</code>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 text-xs">
                          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Pending
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.subscription_status === 'monthly' && u.subscription_expires_at
                      ? new Date(u.subscription_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      aria-label={`View ${u.email ?? u.username}`}
                      className="text-gray-400 hover:text-white transition"
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <Modal
        isOpen={bulkModalOpen}
        onClose={() => !bulkSending && setBulkModalOpen(false)}
        title="Resend to all unverified users"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            This will fire a verification email to{' '}
            <strong className="text-white">{unverifiedCount}</strong>{' '}
            {unverifiedCount === 1 ? 'user' : 'users'} whose email isn&rsquo;t confirmed yet.
          </p>
          <p className="text-xs text-gray-500">
            Sequential send — Supabase&rsquo;s per-email rate limits apply. Already-verified users are skipped automatically.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setBulkModalOpen(false)}
              disabled={bulkSending}
              className="min-h-11 px-4 py-2 text-sm text-gray-300 hover:text-white transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResendAll}
              disabled={bulkSending}
              className="min-h-11 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {bulkSending ? (
                <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Sending…</>
              ) : (
                <><Mail className="w-4 h-4" aria-hidden="true" /> Send {unverifiedCount} emails</>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Outer component wraps in Suspense — required by Next.js when useSearchParams
// is used in a client component that may be statically rendered at build time.
export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}
