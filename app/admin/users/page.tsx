'use client';

// app/admin/users/page.tsx
// Admin user list with search, subscription filter, sortable columns, and renewal date

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, AlertTriangle, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import PaginationBar from '@/components/ui/PaginationBar';

const PAGE_SIZE = 20;

interface UserRow {
  id: string;
  email: string | null;
  username: string;
  display_name: string | null;
  subscription_status: 'free' | 'monthly' | 'lifetime';
  shirt_promo_code: string | null;
  subscription_expires_at: string | null;
  created_at: string;
}

type SortKey = 'email' | 'subscription_status' | 'subscription_expires_at' | 'created_at';
type SortDir = 'asc' | 'desc';

const STATUS_BADGE: Record<string, string> = {
  free: 'bg-gray-800 text-gray-300',
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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(searchParams.get('filter') === 'promo_pending' ? 'promo_pending' : 'all');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
      filter === 'all' ||
      (filter === 'promo_pending' ? u.subscription_status === 'lifetime' && !u.shirt_promo_code : u.subscription_status === filter);
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
    return (
      <th
        className="text-left px-5 py-3 cursor-pointer select-none hover:text-white transition"
        onClick={() => handleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon active={sortKey === col} dir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Users</h1>
      <p className="text-gray-400 text-sm mb-6">{users.length} total accounts</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search email or username…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
          />
        </div>
        {(['all', 'free', 'monthly', 'lifetime', 'promo_pending'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${filter === f ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {f === 'promo_pending' ? '⚠ No promo code' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                <Th label="Email / Username" col="email" />
                <Th label="Plan" col="subscription_status" />
                <th className="text-left px-5 py-3">Promo Code</th>
                <Th label="Renewal Date" col="subscription_expires_at" />
                <Th label="Joined" col="created_at" />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-600">No users found</td>
                </tr>
              )}
              {paginated.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium">{u.email ?? '—'}</p>
                    <p className="text-gray-500 text-xs">@{u.username}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE[u.subscription_status]}`}>
                      {u.subscription_status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.subscription_status === 'lifetime' ? (
                      u.shirt_promo_code ? (
                        <code className="text-lime-400 text-xs">{u.shirt_promo_code}</code>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 text-xs">
                          <AlertTriangle className="w-3 h-3" /> Pending
                        </span>
                      )
                    ) : (
                      <span className="text-gray-600 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {u.subscription_status === 'monthly' && u.subscription_expires_at
                      ? new Date(u.subscription_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-gray-500 hover:text-white transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
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
