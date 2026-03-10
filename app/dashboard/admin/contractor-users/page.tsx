'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Shield, Save, Users, HardHat, Crown, UserCircle,
} from 'lucide-react';

interface UserRow {
  id: string;
  username: string | null;
  email: string | null;
  contractor_role: string;
  products: string[];
  lister_company_name: string | null;
  lister_union_local: string | null;
  created_at: string;
}

const ROLE_STYLES: Record<string, { color: string; icon: typeof HardHat; label: string }> = {
  worker: { color: 'text-blue-400 bg-blue-500/20', icon: HardHat, label: 'Worker' },
  lister: { color: 'text-indigo-400 bg-indigo-500/20', icon: Users, label: 'Lister' },
  union_leader: { color: 'text-purple-400 bg-purple-500/20', icon: Crown, label: 'Union Leader' },
};

const PRODUCT_LABELS: Record<string, string> = {
  centos: 'CentenarianOS',
  contractor: 'Contractor Hub',
  lister: 'Lister',
};

export default function AdminContractorUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<UserRow>>>({});
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/contractor-users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(u: UserRow, field: string, value: unknown) {
    setEdits((prev) => ({
      ...prev,
      [u.id]: { ...prev[u.id], [field]: value },
    }));
  }

  function toggleProduct(userId: string, product: string, currentProducts: string[]) {
    const updated = currentProducts.includes(product)
      ? currentProducts.filter((p) => p !== product)
      : [...currentProducts, product];
    startEdit({ id: userId } as UserRow, 'products', updated);
  }

  async function saveUser(id: string) {
    const edit = edits[id];
    if (!edit) return;
    setSavingId(id);

    await fetch(`/api/admin/contractor-users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    });

    setSavingId(null);
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    load();
  }

  const getEffective = (u: UserRow, field: keyof UserRow) => {
    return edits[u.id]?.[field] ?? u[field];
  };

  const filtered = filter === 'all'
    ? users
    : filter === 'has_products'
      ? users.filter((u) => (u.products ?? []).length > 0)
      : users.filter((u) => u.contractor_role === filter || (u.products ?? []).includes(filter));

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">
          <Shield size={20} className="inline mr-2 text-amber-400" aria-hidden="true" />
          Contractor & Lister Management
        </h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-amber-500 focus:outline-none"
          aria-label="Filter users"
        >
          <option value="all">All Users ({users.length})</option>
          <option value="has_products">With Products ({users.filter((u) => (u.products ?? []).length > 0).length})</option>
          <option value="lister">Listers ({users.filter((u) => u.contractor_role === 'lister').length})</option>
          <option value="union_leader">Union Leaders ({users.filter((u) => u.contractor_role === 'union_leader').length})</option>
          <option value="contractor">Contractor Product ({users.filter((u) => (u.products ?? []).includes('contractor')).length})</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={28} aria-label="Loading users" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No users found.
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="User management list">
          {filtered.map((u) => {
            const currentRole = getEffective(u, 'contractor_role') as string;
            const currentProducts = (getEffective(u, 'products') as string[]) ?? [];
            const rs = ROLE_STYLES[currentRole] ?? ROLE_STYLES.worker;
            const RoleIcon = rs.icon;
            const hasEdits = !!edits[u.id];
            const isSaving = savingId === u.id;

            return (
              <article key={u.id} role="listitem" className={`rounded-xl border bg-neutral-900 p-4 ${hasEdits ? 'border-amber-700/50' : 'border-neutral-800'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* User info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UserCircle size={16} className="text-neutral-500 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-neutral-100 text-sm">{u.username || 'No username'}</span>
                      <span className="text-xs text-neutral-500">{u.email}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1 ${rs.color}`}>
                        <RoleIcon size={10} aria-hidden="true" />
                        {rs.label}
                      </span>
                      {currentProducts.map((p) => (
                        <span key={p} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                          {PRODUCT_LABELS[p] ?? p}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                      {u.lister_company_name && ` · ${u.lister_company_name}`}
                      {u.lister_union_local && ` · ${u.lister_union_local}`}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-500">Role:</span>
                      <select
                        value={currentRole}
                        onChange={(e) => startEdit(u, 'contractor_role', e.target.value)}
                        className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-100 focus:border-amber-500 focus:outline-none min-h-11"
                        aria-label={`Role for ${u.username || u.email}`}
                      >
                        <option value="worker">Worker</option>
                        <option value="lister">Lister</option>
                        <option value="union_leader">Union Leader</option>
                      </select>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-500">Products:</span>
                      {(['centos', 'contractor', 'lister'] as const).map((product) => (
                        <label key={product} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentProducts.includes(product)}
                            onChange={() => toggleProduct(u.id, product, currentProducts)}
                            className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500 h-4 w-4"
                            aria-label={`${PRODUCT_LABELS[product]} access for ${u.username || u.email}`}
                          />
                          <span className="text-xs text-neutral-400">{product === 'centos' ? 'OS' : product === 'contractor' ? 'Cont' : 'List'}</span>
                        </label>
                      ))}
                    </div>

                    {hasEdits && (
                      <button
                        onClick={() => saveUser(u.id)}
                        disabled={isSaving}
                        className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
                        aria-label={`Save changes for ${u.username || u.email}`}
                      >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} aria-hidden="true" />}
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
