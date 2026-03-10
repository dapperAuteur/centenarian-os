'use client';

// app/dashboard/admin/invites/page.tsx
// Admin invite management: send invites, control access, seed/clear demo data.

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Loader2, Trash2, Edit2, Check, RefreshCw, Database, Eraser, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { NAV_GROUPS } from '@/components/nav/NavConfig';

interface Invite {
  id: string;
  email: string;
  product: 'centos';
  access_type: 'trial' | 'lifetime';
  expires_at: string | null;
  is_active: boolean;
  allowed_modules: string[] | null;
  demo_profile: 'visitor' | 'tutorial' | null;
  demo_seeded: boolean;
  demo_seeded_at: string | null;
  invite_token: string;
  invited_at: string;
  accepted_at: string | null;
  user_id: string | null;
  notes: string | null;
}

const MODULE_GROUPS = [
  {
    label: 'CentOS',
    items: NAV_GROUPS.filter((g) => ['operate', 'health', 'life'].includes(g.id))
      .flatMap((g) => g.items.filter((i) => i.paid && !i.adminOnly).map((i) => ({ label: i.label, href: i.href }))),
  },
];

function statusChip(invite: Invite) {
  if (!invite.is_active) return { label: 'Revoked', cls: 'bg-gray-100 text-gray-500' };
  if (!invite.accepted_at) return { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { label: 'Expired', cls: 'bg-red-100 text-red-600' };
  return { label: 'Active', cls: 'bg-green-100 text-green-700' };
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_FORM = {
  email: '',
  product: 'centos' as const,
  access_type: 'trial' as 'trial' | 'lifetime',
  expires_at: '',
  all_modules: true,
  allowed_modules: [] as string[],
  demo_profile: '' as '' | 'visitor' | 'tutorial',
  notes: '',
};

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    const res = await offlineFetch('/api/admin/invites');
    const data = await res.json();
    setInvites(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(invite: Invite) {
    setEditId(invite.id);
    setForm({
      email: invite.email,
      product: invite.product ?? 'centos',
      access_type: invite.access_type,
      expires_at: invite.expires_at ? invite.expires_at.slice(0, 10) : '',
      all_modules: invite.allowed_modules === null,
      allowed_modules: invite.allowed_modules ?? [],
      demo_profile: invite.demo_profile ?? '',
      notes: invite.notes ?? '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const payload = {
      email: form.email,
      product: form.product,
      access_type: form.access_type,
      expires_at: form.access_type === 'lifetime' || !form.expires_at ? null : form.expires_at,
      allowed_modules: form.all_modules ? null : form.allowed_modules,
      demo_profile: form.demo_profile || null,
      notes: form.notes || null,
    };

    try {
      const res = editId
        ? await offlineFetch(`/api/admin/invites/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await offlineFetch('/api/admin/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Something went wrong');
      } else {
        setModalOpen(false);
        if (!editId && data.already_exists) {
          alert(`${form.email} already has an account. They can log in directly — no invite email was sent.`);
        }
        await fetchInvites();
      }
    } catch {
      setFormError('Network error');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Delete invite for ${email}? This revokes their access immediately.`)) return;
    setActionLoading(`delete-${id}`);
    await offlineFetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
    await fetchInvites();
    setActionLoading(null);
  }

  async function handleToggleActive(invite: Invite) {
    setActionLoading(`toggle-${invite.id}`);
    await offlineFetch(`/api/admin/invites/${invite.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !invite.is_active }),
    });
    await fetchInvites();
    setActionLoading(null);
  }

  async function handleSeedDemo(invite: Invite) {
    if (!confirm(`Seed ${invite.demo_profile} demo data for ${invite.email}?`)) return;
    setActionLoading(`seed-${invite.id}`);
    const res = await offlineFetch(`/api/admin/invites/${invite.id}/seed-demo`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) alert(data.error);
    await fetchInvites();
    setActionLoading(null);
  }

  async function handleClearDemo(invite: Invite) {
    if (!confirm(`Clear all demo data for ${invite.email}? This cannot be undone.`)) return;
    setActionLoading(`clear-${invite.id}`);
    const res = await offlineFetch(`/api/admin/invites/${invite.id}/clear-demo`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) alert(data.error);
    await fetchInvites();
    setActionLoading(null);
  }

  function toggleModule(href: string) {
    setForm((f) => ({
      ...f,
      allowed_modules: f.allowed_modules.includes(href)
        ? f.allowed_modules.filter((m) => m !== href)
        : [...f.allowed_modules, href],
    }));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-indigo-600" />
            Invites
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage trial access for testers and demo users.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchInvites} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No invites yet.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Invites table">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Access</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Expiry</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Modules</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Demo</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invites.map((inv) => {
                  const chip = statusChip(inv);
                  const isAccepted = !!inv.accepted_at;
                  const canSeed = isAccepted && !inv.demo_seeded && !!inv.demo_profile;
                  const canClear = isAccepted && inv.demo_seeded;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{inv.email}</div>
                        {inv.notes && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-48">{inv.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-fuchsia-100 text-fuchsia-700">
                          CentOS
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${chip.cls}`}>
                          {chip.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 capitalize hidden sm:table-cell">{inv.access_type}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{fmtDate(inv.expires_at)}</td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                        {inv.allowed_modules === null
                          ? <span className="text-green-600 text-xs font-medium">All</span>
                          : <span className="text-xs">{inv.allowed_modules.length} module{inv.allowed_modules.length !== 1 ? 's' : ''}</span>
                        }
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {inv.demo_profile ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-medium ${inv.demo_seeded ? 'text-indigo-600' : 'text-gray-500'}`}>
                              {inv.demo_profile.replace('_', ' ')}
                              {inv.demo_seeded && <span className="ml-1 text-green-600">✓</span>}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canSeed && (
                            <button
                              onClick={() => handleSeedDemo(inv)}
                              disabled={actionLoading === `seed-${inv.id}`}
                              aria-label={`Seed demo data for ${inv.email}`}
                              className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition disabled:opacity-50"
                            >
                              {actionLoading === `seed-${inv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" aria-hidden="true" />}
                            </button>
                          )}
                          {canClear && (
                            <button
                              onClick={() => handleClearDemo(inv)}
                              disabled={actionLoading === `clear-${inv.id}`}
                              aria-label={`Clear demo data for ${inv.email}`}
                              className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition disabled:opacity-50"
                            >
                              {actionLoading === `clear-${inv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" aria-hidden="true" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(inv)}
                            disabled={actionLoading === `toggle-${inv.id}`}
                            aria-label={inv.is_active ? `Revoke access for ${inv.email}` : `Restore access for ${inv.email}`}
                            role="switch"
                            aria-checked={inv.is_active}
                            className={`p-1.5 rounded-lg transition disabled:opacity-50 ${inv.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                          >
                            {actionLoading === `toggle-${inv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : inv.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => openEdit(inv)}
                            aria-label={`Edit invite for ${inv.email}`}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv.id, inv.email)}
                            disabled={actionLoading === `delete-${inv.id}`}
                            aria-label={`Delete invite for ${inv.email}`}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          >
                            {actionLoading === `delete-${inv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Invite' : 'Invite User'} size="md">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{formError}</div>
            )}

            {/* Email -- only editable on create */}
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="invite-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                aria-required="true"
                disabled={!!editId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="tester@example.com"
              />
            </div>

            {/* Product (CentOS only — contractor/lister are separate apps) */}
            <input type="hidden" name="product" value="centos" />

            {/* Access type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Access Type</label>
              <div className="flex gap-2">
                {(['trial', 'lifetime'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, access_type: t }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition capitalize ${
                      form.access_type === t
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry -- only for trial */}
            {form.access_type === 'trial' && (
              <div>
                <label htmlFor="invite-expiry" className="block text-sm font-medium text-gray-700 mb-1">Expiry Date <span className="text-gray-400 font-normal">(leave blank for no expiry)</span></label>
                <input
                  id="invite-expiry"
                  type="date"
                  value={form.expires_at}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* Module access */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Module Access</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, all_modules: !f.all_modules, allowed_modules: [] }))}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
                    form.all_modules
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {form.all_modules ? <Check className="w-3 h-3" /> : null}
                  All Modules
                </button>
              </div>
              {!form.all_modules && (
                <div className="mt-2 space-y-4">
                  {MODULE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allHrefs = group.items.map((i) => i.href);
                            const allSelected = allHrefs.every((h) => form.allowed_modules.includes(h));
                            setForm((f) => ({
                              ...f,
                              allowed_modules: allSelected
                                ? f.allowed_modules.filter((m) => !allHrefs.includes(m))
                                : [...new Set([...f.allowed_modules, ...allHrefs])],
                            }));
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          {group.items.every((i) => form.allowed_modules.includes(i.href)) ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.items.map((item) => {
                          const checked = form.allowed_modules.includes(item.href);
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => toggleModule(item.href)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition text-left ${
                                checked
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 shrink-0" />}
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Demo profile */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Demo Data</label>
              <div className="flex gap-2">
                {(['', 'visitor', 'tutorial'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, demo_profile: p }))}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition capitalize ${
                      form.demo_profile === p
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {p === '' ? 'None' : p.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="invite-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                id="invite-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="e.g. Friend testing finance module"
              />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 pt-3 pb-3 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? 'Save Changes' : 'Send Invite'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
