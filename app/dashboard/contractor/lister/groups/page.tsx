'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, UsersRound, Plus, Trash2, X, UserPlus, UserMinus,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface GroupMember {
  id: string;
  user_id: string;
  username: string;
  added_at: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
}

interface GroupDetail extends Group {
  members: GroupMember[];
}

interface RosterContact {
  id: string;
  name: string;
  linked_user_id: string | null;
  username: string | null;
}

export default function ListerGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [roster, setRoster] = useState<RosterContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState('');

  const [form, setForm] = useState({ name: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [gRes, rRes] = await Promise.all([
      offlineFetch('/api/contractor/lister/groups').then((r) => r.json()),
      offlineFetch('/api/contractor/roster').then((r) => r.json()),
    ]);
    setGroups(gRes.groups ?? []);
    setRoster(rRes.roster ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGroup() {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await offlineFetch('/api/contractor/lister/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null }),
    });
    setSaving(false);
    if (res.ok) {
      setShowCreate(false);
      setForm({ name: '', description: '' });
      load();
    }
  }

  async function deleteGroup(id: string) {
    setDeletingId(id);
    await offlineFetch(`/api/contractor/lister/groups/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (expandedId === id) { setExpandedId(null); setDetail(null); }
    load();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setLoadingDetail(true);
    const res = await offlineFetch(`/api/contractor/lister/groups/${id}`);
    const d = await res.json();
    setDetail(d);
    setLoadingDetail(false);
  }

  async function addMember(groupId: string) {
    if (!selectedMember) return;
    setAddingMember(true);
    await offlineFetch(`/api/contractor/lister/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedMember }),
    });
    setAddingMember(false);
    setSelectedMember('');
    // Refresh detail
    const res = await offlineFetch(`/api/contractor/lister/groups/${groupId}`);
    setDetail(await res.json());
    load();
  }

  async function removeMember(groupId: string, userId: string) {
    setRemovingMemberId(userId);
    await offlineFetch(`/api/contractor/lister/groups/${groupId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    setRemovingMemberId(null);
    const res = await offlineFetch(`/api/contractor/lister/groups/${groupId}`);
    setDetail(await res.json());
    load();
  }

  const assignableContacts = roster.filter((c) => c.linked_user_id);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-100">Message Groups</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          <Plus size={14} aria-hidden="true" /> Create Group
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">New Group</h2>
            <button onClick={() => setShowCreate(false)} className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Group Name *</span>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="Camera Department" />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Description</span>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="All camera operators for Indianapolis events" />
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={createGroup} disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900">
              {saving ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Plus size={14} aria-hidden="true" />}
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading..." />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No groups yet. Create one to organize your contractors.
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Message groups">
          {groups.map((g) => {
            const isExpanded = expandedId === g.id;
            return (
              <article key={g.id} role="listitem" className="rounded-xl border border-neutral-800 bg-neutral-900">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    onClick={() => toggleExpand(g.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-11"
                    aria-expanded={isExpanded}
                    aria-label={`Toggle ${g.name} details`}
                  >
                    <ChevronRight size={14} className={`text-neutral-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
                    <UsersRound size={16} className="text-indigo-400 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-100">{g.name}</p>
                      <p className="text-xs text-neutral-500">
                        {g.member_count} member{g.member_count !== 1 ? 's' : ''}
                        {g.description && ` · ${g.description}`}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteGroup(g.id)}
                    disabled={deletingId === g.id}
                    className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label={`Delete group ${g.name}`}
                  >
                    {deletingId === g.id ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Trash2 size={14} aria-hidden="true" />}
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-neutral-800 px-4 py-3 space-y-3">
                    {loadingDetail ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="animate-spin text-neutral-500" size={18} aria-label="Loading..." />
                      </div>
                    ) : detail ? (
                      <>
                        {/* Add member */}
                        <div className="flex gap-2 items-end">
                          <label className="flex-1">
                            <span className="text-xs font-medium text-neutral-400">Add Member</span>
                            <div className="relative mt-1">
                              <select
                                value={selectedMember}
                                onChange={(e) => setSelectedMember(e.target.value)}
                                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 pr-8 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 appearance-none"
                              >
                                <option value="">Select contractor...</option>
                                {assignableContacts
                                  .filter((c) => !detail.members.some((m) => m.user_id === c.linked_user_id))
                                  .map((c) => (
                                    <option key={c.id} value={c.linked_user_id!}>{c.name}{c.username ? ` (@${c.username})` : ''}</option>
                                  ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" aria-hidden="true" />
                            </div>
                          </label>
                          <button
                            onClick={() => addMember(g.id)}
                            disabled={addingMember || !selectedMember}
                            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            aria-label="Add member"
                          >
                            {addingMember ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <UserPlus size={14} aria-hidden="true" />}
                          </button>
                        </div>

                        {/* Members list */}
                        {detail.members.length === 0 ? (
                          <p className="text-xs text-neutral-500">No members yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {detail.members.map((m) => (
                              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-neutral-800/50 px-3 py-2">
                                <span className="text-sm text-neutral-200">@{m.username}</span>
                                <button
                                  onClick={() => removeMember(g.id, m.user_id)}
                                  disabled={removingMemberId === m.user_id}
                                  className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  aria-label={`Remove ${m.username}`}
                                >
                                  {removingMemberId === m.user_id ? <Loader2 size={12} className="animate-spin" aria-label="Loading..." /> : <UserMinus size={12} aria-hidden="true" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
