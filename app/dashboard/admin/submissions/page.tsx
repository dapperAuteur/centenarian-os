'use client';

// app/dashboard/admin/submissions/page.tsx
// Admin curation queue — review new user-submitted exercises and equipment.
// Promote items to the shared system library / equipment catalog, or dismiss.

import { useEffect, useState, useCallback } from 'react';
import {
  Inbox, CheckCheck, Trash2, Loader2, Dumbbell, Package,
  ArrowUpRight, Check, ChevronDown,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Notification {
  id: string;
  type: 'new_exercise' | 'new_equipment';
  user_email: string | null;
  entity_name: string;
  entity_id: string;
  entity_meta: {
    category?: string | null;
    primary_muscles?: string[] | null;
    equipment_needed?: string | null;
    brand?: string | null;
    model?: string | null;
    condition?: string | null;
  };
  is_read: boolean;
  promoted: boolean;
  created_at: string;
}

const DIFFICULTY_OPTIONS = ['beginner', 'intermediate', 'advanced'];

export default function AdminSubmissionsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new_exercise' | 'new_equipment'>('all');
  const [promoting, setPromoting] = useState<Record<string, boolean>>({});
  const [dismissing, setDismissing] = useState<Record<string, boolean>>({});
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await offlineFetch('/api/admin/notifications');
    if (res.ok) {
      const d = await res.json();
      setNotifications(d.notifications || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    await offlineFetch('/api/admin/notifications', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handlePromote = async (n: Notification) => {
    setPromoting((prev) => ({ ...prev, [n.id]: true }));
    try {
      const endpoint =
        n.type === 'new_exercise'
          ? '/api/admin/system-exercises'
          : '/api/admin/equipment/catalog';

      const body =
        n.type === 'new_exercise'
          ? { exercise_id: n.entity_id, notification_id: n.id, difficulty: difficulty[n.id] || 'intermediate' }
          : { equipment_id: n.entity_id, notification_id: n.id };

      const res = await offlineFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setPromoted((prev) => new Set(prev).add(n.id));
      }
    } finally {
      setPromoting((prev) => { const next = { ...prev }; delete next[n.id]; return next; });
    }
  };

  const handleDismiss = async (id: string) => {
    setDismissing((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await offlineFetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDismissed((prev) => new Set(prev).add(id));
      }
    } finally {
      setDismissing((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  const visible = notifications.filter((n) => {
    if (dismissed.has(n.id)) return false;
    if (filter !== 'all' && n.type !== filter) return false;
    return true;
  });

  const unread = notifications.filter((n) => !n.is_read && !n.promoted).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Inbox className="w-7 h-7 text-fuchsia-600 shrink-0" />
            Library Submissions
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {unread > 0
              ? `${unread} unread submission${unread !== 1 ? 's' : ''} — review and promote to shared libraries.`
              : 'All caught up. Items added by users appear here for review.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllRead}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </button>
        </div>
      </header>

      {/* Type filter */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          ['all',          'All'],
          ['new_exercise', 'Exercises'],
          ['new_equipment','Equipment'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              filter === val
                ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No submissions{filter !== 'all' ? ' for this filter' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((n) => {
            const isExercise = n.type === 'new_exercise';
            const isPromoted = promoted.has(n.id) || n.promoted;
            const isDismissed = dismissed.has(n.id);
            if (isDismissed) return null;

            return (
              <div
                key={n.id}
                className={`bg-white border rounded-xl p-4 transition ${
                  n.is_read || isPromoted
                    ? 'border-gray-200 opacity-75'
                    : 'border-indigo-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg shrink-0 ${isExercise ? 'bg-fuchsia-50' : 'bg-indigo-50'}`}>
                    {isExercise
                      ? <Dumbbell className="w-4 h-4 text-fuchsia-600" />
                      : <Package className="w-4 h-4 text-indigo-600" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{n.entity_name}</span>
                      {!n.is_read && !isPromoted && (
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 shrink-0" title="Unread" />
                      )}
                      {isPromoted && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                          Promoted
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      Added by <span className="text-gray-700">{n.user_email || 'unknown'}</span>
                      {' · '}
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {n.entity_meta.category && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {n.entity_meta.category}
                        </span>
                      )}
                      {n.entity_meta.equipment_needed && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                          {n.entity_meta.equipment_needed}
                        </span>
                      )}
                      {n.entity_meta.brand && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {n.entity_meta.brand}
                          {n.entity_meta.model ? ` ${n.entity_meta.model}` : ''}
                        </span>
                      )}
                      {n.entity_meta.primary_muscles?.slice(0, 3).map((m) => (
                        <span key={m} className="text-[10px] px-1.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 rounded">
                          {m}
                        </span>
                      ))}
                      {n.entity_meta.condition && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                          {n.entity_meta.condition}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {!isPromoted && (
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* Exercise: difficulty picker before promote */}
                        {isExercise && (
                          <div className="relative">
                            <select
                              value={difficulty[n.id] || 'intermediate'}
                              onChange={(e) => setDifficulty((prev) => ({ ...prev, [n.id]: e.target.value }))}
                              className="appearance-none pl-2 pr-6 py-1 border border-gray-300 rounded text-xs bg-white text-gray-700 cursor-pointer"
                            >
                              {DIFFICULTY_OPTIONS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1.5 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                        )}

                        <button
                          onClick={() => handlePromote(n)}
                          disabled={!!promoting[n.id]}
                          className="px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {promoting[n.id]
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Promoting...</>
                            : <><ArrowUpRight className="w-3 h-3" /> {isExercise ? 'Add to System Library' : 'Add to Equipment Catalog'}</>
                          }
                        </button>

                        <button
                          onClick={() => handleDismiss(n.id)}
                          disabled={!!dismissing[n.id]}
                          className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 flex items-center gap-1.5"
                        >
                          {dismissing[n.id]
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                          Dismiss
                        </button>
                      </div>
                    )}

                    {isPromoted && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700">
                        <Check className="w-3.5 h-3.5" />
                        {isExercise ? 'Added to System Library' : 'Added to Equipment Catalog'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
