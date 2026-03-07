'use client';

// app/dashboard/engine/history/pain/page.tsx
// Browsable pain tracking history with CRUD, filtering, intensity chart, and cross-module linking.

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ChevronLeft, ChevronDown, ChevronUp, Pencil, Trash2, Loader2, Search,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import Modal from '@/components/ui/Modal';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

const BODY_LOCATIONS = [
  'Right Hip Flexor', 'Left Hip Flexor', 'Right Glute', 'Left Glute',
  'SI Joint', 'Lower Back (L5/S1)', 'Mid Back (Thoracic)', 'Neck',
  'Left Shoulder', 'Right Shoulder', 'Left Hamstring', 'Right Knee',
];
const SENSATIONS = ['Tightness', 'Pinching', 'Dull Ache', 'Sharp Stab', 'Burning'];

interface PainLog {
  id: string;
  date: string;
  pain_intensity: number | null;
  pain_locations: string[] | null;
  pain_sensations: string[] | null;
  pain_activities: string[] | null;
  pain_notes: string | null;
}

function intensityColor(n: number): string {
  if (n <= 2) return 'bg-lime-100 text-lime-700';
  if (n <= 4) return 'bg-amber-100 text-amber-700';
  if (n <= 6) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

export default function PainHistoryPage() {
  const [logs, setLogs] = useState<PainLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minIntensity, setMinIntensity] = useState<number | null>(null);
  const [locationFilter, setLocationFilter] = useState('');

  // Edit modal
  const [editing, setEditing] = useState<PainLog | null>(null);
  const [editForm, setEditForm] = useState({
    pain_intensity: 1,
    pain_locations: [] as string[],
    pain_sensations: [] as string[],
    pain_activities: '',
    pain_notes: '',
  });
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('daily_logs')
      .select('id, date, pain_intensity, pain_locations, pain_sensations, pain_activities, pain_notes')
      .not('pain_intensity', 'is', null)
      .order('date', { ascending: false })
      .limit(200);

    if (fromDate) q = q.gte('date', fromDate);
    if (toDate) q = q.lte('date', toDate);
    if (minIntensity) q = q.gte('pain_intensity', minIntensity);

    const { data } = await q;
    let results = (data || []) as PainLog[];

    if (search.trim()) {
      const s = search.toLowerCase();
      results = results.filter(
        (l) =>
          l.pain_notes?.toLowerCase().includes(s) ||
          l.pain_activities?.some((a) => a.toLowerCase().includes(s)),
      );
    }
    if (locationFilter) {
      results = results.filter((l) => l.pain_locations?.includes(locationFilter));
    }

    setLogs(results);
    setLoading(false);
  }, [supabase, fromDate, toDate, minIntensity, search, locationFilter]);

  useEffect(() => { load(); }, [load]);

  // Chart data (chronological)
  const chartData = useMemo(
    () =>
      [...logs]
        .reverse()
        .map((l) => ({
          date: new Date(l.date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          intensity: l.pain_intensity ?? 0,
        })),
    [logs],
  );

  function openEdit(log: PainLog) {
    setEditing(log);
    setEditForm({
      pain_intensity: log.pain_intensity ?? 1,
      pain_locations: log.pain_locations ?? [],
      pain_sensations: log.pain_sensations ?? [],
      pain_activities: (log.pain_activities ?? []).join('\n'),
      pain_notes: log.pain_notes ?? '',
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    const activitiesArray = editForm.pain_activities.split('\n').map((a) => a.trim()).filter(Boolean);
    await supabase
      .from('daily_logs')
      .update({
        pain_intensity: editForm.pain_intensity,
        pain_locations: editForm.pain_locations.length > 0 ? editForm.pain_locations : null,
        pain_sensations: editForm.pain_sensations.length > 0 ? editForm.pain_sensations : null,
        pain_activities: activitiesArray.length > 0 ? activitiesArray : null,
        pain_notes: editForm.pain_notes || null,
      })
      .eq('id', editing.id);
    setSaving(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Clear pain data from this entry?')) return;
    await supabase
      .from('daily_logs')
      .update({
        pain_intensity: null,
        pain_locations: null,
        pain_sensations: null,
        pain_activities: null,
        pain_notes: null,
      })
      .eq('id', id);
    load();
  }

  function toggleEditArray(field: 'pain_locations' | 'pain_sensations', value: string) {
    setEditForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
    }));
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link href="/dashboard/engine/history" className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm mb-4 transition">
        <ChevronLeft className="w-4 h-4" /> Engine History
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Pain History</h1>
      <p className="text-gray-500 text-sm mb-6">Browse, edit, and analyse past pain tracking entries.</p>

      {/* Trend Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-600 mb-3">Intensity Trend</h2>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="painGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827' }} />
              <Area type="monotone" dataKey="intensity" stroke="#f43f5e" fill="url(#painGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes / activities..."
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
          value={minIntensity ?? ''}
          onChange={(e) => setMinIntensity(e.target.value ? Number(e.target.value) : null)}
          className="bg-white text-sm text-gray-900 rounded-lg px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
        >
          <option value="">All Intensity</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}+ / 10</option>)}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="bg-white text-sm text-gray-900 rounded-lg px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
        >
          <option value="">All Locations</option>
          {BODY_LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No pain entries found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition rounded-xl"
                >
                  <span className="text-sm text-gray-600 w-24 shrink-0">{new Date(log.date + 'T00:00').toLocaleDateString()}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${intensityColor(log.pain_intensity ?? 0)}`}>
                    {log.pain_intensity}/10
                  </span>
                  <span className="text-sm text-gray-900 flex-1 truncate">
                    {log.pain_locations?.join(', ') || '—'}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-4 space-y-3">
                    {/* Locations */}
                    {log.pain_locations && log.pain_locations.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Locations</p>
                        <div className="flex flex-wrap gap-1">
                          {log.pain_locations.map((loc) => (
                            <span key={loc} className="px-2 py-0.5 bg-fuchsia-100 text-fuchsia-700 rounded-full text-xs">{loc}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Sensations */}
                    {log.pain_sensations && log.pain_sensations.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Sensations</p>
                        <div className="flex flex-wrap gap-1">
                          {log.pain_sensations.map((s) => (
                            <span key={s} className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full text-xs">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Activities */}
                    {log.pain_activities && log.pain_activities.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Aggravating Activities</p>
                        <ul className="text-sm text-gray-800 list-disc list-inside">
                          {log.pain_activities.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                    {/* Notes */}
                    {log.pain_notes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.pain_notes}</p>
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
                        <Trash2 className="w-3 h-3" /> Clear Pain Data
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
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Pain Entry" size="lg">
        <div className="p-6 space-y-4">
          {/* Intensity */}
          <div>
            <label className="text-xs font-medium text-gray-600">Pain Intensity (1-10)</label>
            <div className="flex gap-1.5 mt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setEditForm((f) => ({ ...f, pain_intensity: n }))}
                  className={`w-9 h-9 rounded-lg font-bold text-sm transition ${
                    editForm.pain_intensity === n
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {/* Locations */}
          <div>
            <label className="text-xs font-medium text-gray-600">Locations</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {BODY_LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  onClick={() => toggleEditArray('pain_locations', loc)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    editForm.pain_locations.includes(loc)
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
          {/* Sensations */}
          <div>
            <label className="text-xs font-medium text-gray-600">Sensations</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SENSATIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleEditArray('pain_sensations', s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    editForm.pain_sensations.includes(s)
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* Activities */}
          <div>
            <label className="text-xs font-medium text-gray-600">Aggravating Activities (one per line)</label>
            <textarea
              value={editForm.pain_activities}
              onChange={(e) => setEditForm((f) => ({ ...f, pain_activities: e.target.value }))}
              rows={3}
              className="w-full mt-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>
          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600">Notes</label>
            <textarea
              value={editForm.pain_notes}
              onChange={(e) => setEditForm((f) => ({ ...f, pain_notes: e.target.value }))}
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
