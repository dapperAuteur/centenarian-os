'use client';

// app/dashboard/engine/history/debrief/page.tsx
// Browsable debrief history with CRUD, filtering, and cross-module linking.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ChevronLeft, ChevronDown, ChevronUp, Pencil, Trash2, Loader2, Search, Star,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

interface DailyLog {
  id: string;
  date: string;
  energy_rating: number | null;
  biggest_win: string | null;
  biggest_challenge: string | null;
  total_spent: number | null;
  total_earned: number | null;
}

const ENERGY_COLORS = ['', 'bg-red-100 text-red-700', 'bg-orange-100 text-orange-700', 'bg-amber-100 text-amber-700', 'bg-lime-100 text-lime-700', 'bg-green-100 text-green-700'];

export default function DebriefHistoryPage() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [energyFilter, setEnergyFilter] = useState<number | null>(null);

  // Edit modal
  const [editing, setEditing] = useState<DailyLog | null>(null);
  const [editForm, setEditForm] = useState({ energy_rating: 3, biggest_win: '', biggest_challenge: '' });
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('daily_logs')
      .select('id, date, energy_rating, biggest_win, biggest_challenge, total_spent, total_earned')
      .not('energy_rating', 'is', null)
      .order('date', { ascending: false })
      .limit(100);

    if (fromDate) q = q.gte('date', fromDate);
    if (toDate) q = q.lte('date', toDate);
    if (energyFilter) q = q.eq('energy_rating', energyFilter);

    const { data } = await q;
    let results = data || [];

    if (search.trim()) {
      const s = search.toLowerCase();
      results = results.filter(
        (l) => l.biggest_win?.toLowerCase().includes(s) || l.biggest_challenge?.toLowerCase().includes(s),
      );
    }

    setLogs(results);
    setLoading(false);
  }, [supabase, fromDate, toDate, energyFilter, search]);

  useEffect(() => { load(); }, [load]);

  function openEdit(log: DailyLog) {
    setEditing(log);
    setEditForm({
      energy_rating: log.energy_rating ?? 3,
      biggest_win: log.biggest_win ?? '',
      biggest_challenge: log.biggest_challenge ?? '',
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    await supabase
      .from('daily_logs')
      .update({
        energy_rating: editForm.energy_rating,
        biggest_win: editForm.biggest_win || null,
        biggest_challenge: editForm.biggest_challenge || null,
      })
      .eq('id', editing.id);
    setSaving(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this debrief entry?')) return;
    await supabase.from('daily_logs').delete().eq('id', id);
    load();
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link href="/dashboard/engine/history" className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm mb-4 transition">
        <ChevronLeft className="w-4 h-4" /> Engine History
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Debrief History</h1>
      <p className="text-gray-500 text-sm mb-6">Browse, edit, and connect past daily debrief entries.</p>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search wins / challenges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white text-sm text-gray-900 rounded-lg pl-9 pr-3 py-2 border border-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
          />
        </div>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          className="bg-white text-sm text-gray-900 rounded-lg px-2 py-2 border border-gray-300 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
          className="bg-white text-sm text-gray-900 rounded-lg px-2 py-2 border border-gray-300 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent" />
        <select
          value={energyFilter ?? ''}
          onChange={(e) => setEnergyFilter(e.target.value ? Number(e.target.value) : null)}
          className="bg-white text-sm text-gray-900 rounded-lg px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
        >
          <option value="">All Energy</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No debrief entries found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const eColor = ENERGY_COLORS[log.energy_rating ?? 0] || '';
            return (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition rounded-xl"
                >
                  <span className="text-sm text-gray-600 w-24 shrink-0">{new Date(log.date + 'T00:00').toLocaleDateString()}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${eColor}`}>
                    <Star className="w-3 h-3 inline mr-0.5" />{log.energy_rating}/5
                  </span>
                  <span className="text-sm text-gray-900 flex-1 truncate">{log.biggest_win || '—'}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Biggest Win</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{log.biggest_win || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Biggest Challenge</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{log.biggest_challenge || '—'}</p>
                      </div>
                    </div>
                    {(log.total_spent != null || log.total_earned != null) && (
                      <div className="flex gap-4 text-xs text-gray-500">
                        {log.total_spent != null && <span>Spent: ${log.total_spent.toFixed(2)}</span>}
                        {log.total_earned != null && <span>Earned: ${log.total_earned.toFixed(2)}</span>}
                      </div>
                    )}

                    {/* Cross-module linking */}
                    <div className="pt-2 space-y-2">
                      <ActivityLinker entityType="daily_log" entityId={log.id} />
                      <LifeCategoryTagger entityType="daily_log" entityId={log.id} compact />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => openEdit(log)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => handleDelete(log.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Debrief" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Energy Rating</label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setEditForm((f) => ({ ...f, energy_rating: n }))}
                  className={`w-10 h-10 rounded-lg font-bold text-sm transition ${
                    editForm.energy_rating === n
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Biggest Win</label>
            <textarea
              value={editForm.biggest_win}
              onChange={(e) => setEditForm((f) => ({ ...f, biggest_win: e.target.value }))}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Biggest Challenge</label>
            <textarea
              value={editForm.biggest_challenge}
              onChange={(e) => setEditForm((f) => ({ ...f, biggest_challenge: e.target.value }))}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>
        </div>
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 flex gap-3">
          <button onClick={handleSaveEdit} disabled={saving}
            className="flex-1 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
          <button onClick={() => setEditing(null)}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 transition">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
