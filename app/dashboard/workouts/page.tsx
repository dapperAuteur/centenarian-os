'use client';

// app/dashboard/workouts/page.tsx
// Workout templates + log history

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Play, Trash2, Edit3, Clock, Dumbbell,
  ChevronDown, ChevronUp, X, Upload, Download, Link2,
} from 'lucide-react';
import ActivityLinkModal from '@/components/ui/ActivityLinkModal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Exercise {
  id?: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight_lbs: number | null;
  duration_sec: number | null;
  rest_sec: number | null;
  notes: string | null;
  sort_order: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  estimated_duration_min: number | null;
  use_count: number;
  workout_template_exercises: Exercise[];
}

interface LogExercise {
  name: string;
  sets_completed: number | null;
  reps_completed: number | null;
  weight_lbs: number | null;
  duration_sec: number | null;
  notes: string | null;
}

interface WorkoutLog {
  id: string;
  name: string;
  date: string;
  duration_min: number | null;
  notes: string | null;
  template_id: string | null;
  workout_log_exercises: LogExercise[];
}

const CATEGORIES = ['Strength', 'Cardio', 'HIIT', 'Yoga', 'Flexibility', 'Cycling', 'Running', 'Swimming', 'Other'];

function DraftExerciseRow({
  ex, index, onChange, onRemove,
}: {
  ex: Exercise; index: number;
  onChange: (i: number, field: string, val: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <input
          placeholder="Exercise name *"
          value={ex.name}
          onChange={(e) => onChange(index, 'name', e.target.value)}
          className="col-span-2 sm:col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          required
        />
        <input
          type="number" placeholder="Sets"
          value={ex.sets ?? ''}
          onChange={(e) => onChange(index, 'sets', e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        />
        <input
          type="number" placeholder="Reps"
          value={ex.reps ?? ''}
          onChange={(e) => onChange(index, 'reps', e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        />
        <input
          type="number" step="0.5" placeholder="Weight (lbs)"
          value={ex.weight_lbs ?? ''}
          onChange={(e) => onChange(index, 'weight_lbs', e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        />
      </div>
      <button type="button" onClick={() => onRemove(index)} className="p-1 text-red-400 hover:text-red-600 mt-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function WorkoutsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'templates' | 'history'>('templates');

  // Template form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', estimated_duration_min: '' });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  const [linkingLogId, setLinkingLogId] = useState<string | null>(null);

  // Log workout modal
  const [logModal, setLogModal] = useState<Template | null>(null);
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().split('T')[0], duration_min: '', notes: '' });
  const [logExercises, setLogExercises] = useState<{ name: string; sets_completed: string; reps_completed: string; weight_lbs: string; duration_sec: string; notes: string }[]>([]);
  const [loggingSave, setLoggingSave] = useState(false);

  // Expanded template
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tmplRes, logsRes] = await Promise.all([
        offlineFetch('/api/workouts'),
        offlineFetch('/api/workouts/logs?limit=20'),
      ]);
      if (tmplRes.ok) setTemplates(await tmplRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ name: '', description: '', category: '', estimated_duration_min: '' });
    setExercises([]);
    setEditingId(null);
    setShowForm(false);
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, {
      name: '', sets: null, reps: null, weight_lbs: null,
      duration_sec: null, rest_sec: 60, notes: null, sort_order: prev.length,
    }]);
  };

  const updateExercise = (i: number, field: string, val: string) => {
    setExercises((prev) => prev.map((ex, idx) => {
      if (idx !== i) return ex;
      if (field === 'name') return { ...ex, name: val };
      return { ...ex, [field]: val ? Number(val) : null };
    }));
  };

  const removeExercise = (i: number) => {
    setExercises((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        estimated_duration_min: form.estimated_duration_min ? Number(form.estimated_duration_min) : null,
        exercises: exercises.filter((ex) => ex.name.trim()),
      };

      const url = editingId ? `/api/workouts/${editingId}` : '/api/workouts';
      const res = await offlineFetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { resetForm(); load(); }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? '',
      category: t.category ?? '',
      estimated_duration_min: t.estimated_duration_min != null ? String(t.estimated_duration_min) : '',
    });
    setExercises(t.workout_template_exercises.map((ex) => ({
      ...ex, sort_order: ex.sort_order ?? 0,
    })));
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workout template?')) return;
    await offlineFetch(`/api/workouts/${id}`, { method: 'DELETE' });
    load();
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Delete this workout log?')) return;
    await offlineFetch(`/api/workouts/logs/${id}`, { method: 'DELETE' });
    load();
  };

  // Open log modal from template
  const openLogModal = (t: Template) => {
    setLogModal(t);
    setLogForm({ date: new Date().toISOString().split('T')[0], duration_min: t.estimated_duration_min ? String(t.estimated_duration_min) : '', notes: '' });
    setLogExercises(t.workout_template_exercises.map((ex) => ({
      name: ex.name,
      sets_completed: ex.sets != null ? String(ex.sets) : '',
      reps_completed: ex.reps != null ? String(ex.reps) : '',
      weight_lbs: ex.weight_lbs != null ? String(ex.weight_lbs) : '',
      duration_sec: ex.duration_sec != null ? String(ex.duration_sec) : '',
      notes: '',
    })));
  };

  const handleLogWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingSave(true);
    try {
      const res = await offlineFetch('/api/workouts/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: logModal?.id,
          name: logModal?.name,
          date: logForm.date,
          duration_min: logForm.duration_min ? Number(logForm.duration_min) : null,
          notes: logForm.notes || null,
          exercises: logExercises.filter((ex) => ex.name.trim()).map((ex) => ({
            name: ex.name,
            sets_completed: ex.sets_completed ? Number(ex.sets_completed) : null,
            reps_completed: ex.reps_completed ? Number(ex.reps_completed) : null,
            weight_lbs: ex.weight_lbs ? Number(ex.weight_lbs) : null,
            duration_sec: ex.duration_sec ? Number(ex.duration_sec) : null,
            notes: ex.notes || null,
          })),
        }),
      });
      if (res.ok) {
        setLogModal(null);
        setTab('history');
        load();
      }
    } finally {
      setLoggingSave(false);
    }
  };

  // Quick log (no template)
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: '', date: new Date().toISOString().split('T')[0], duration_min: '', notes: '' });
  const [quickExercises, setQuickExercises] = useState<{ name: string; sets_completed: string; reps_completed: string; weight_lbs: string; duration_sec: string; notes: string }[]>([]);

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingSave(true);
    try {
      const res = await offlineFetch('/api/workouts/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickForm.name,
          date: quickForm.date,
          duration_min: quickForm.duration_min ? Number(quickForm.duration_min) : null,
          notes: quickForm.notes || null,
          exercises: quickExercises.filter((ex) => ex.name.trim()).map((ex) => ({
            name: ex.name,
            sets_completed: ex.sets_completed ? Number(ex.sets_completed) : null,
            reps_completed: ex.reps_completed ? Number(ex.reps_completed) : null,
            weight_lbs: ex.weight_lbs ? Number(ex.weight_lbs) : null,
            duration_sec: ex.duration_sec ? Number(ex.duration_sec) : null,
            notes: ex.notes || null,
          })),
        }),
      });
      if (res.ok) {
        setShowQuickLog(false);
        setQuickForm({ name: '', date: new Date().toISOString().split('T')[0], duration_min: '', notes: '' });
        setQuickExercises([]);
        setTab('history');
        load();
      }
    } finally {
      setLoggingSave(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-lime-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workouts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Build templates & log your sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowQuickLog(true);
              setQuickExercises([{ name: '', sets_completed: '', reps_completed: '', weight_lbs: '', duration_sec: '', notes: '' }]);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-lime-600 text-white rounded-xl text-sm font-medium hover:bg-lime-700 transition"
          >
            <Play className="w-4 h-4" />
            Quick Log
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); addExercise(); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
          <Link
            href="/dashboard/data/import/workouts"
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-xl text-sm font-medium hover:bg-fuchsia-100 transition"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <a
            href="/api/workouts/logs/export"
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('templates')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'templates' ? 'border-lime-600 text-lime-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Templates ({templates.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'history' ? 'border-lime-600 text-lime-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          History ({logs.length})
        </button>
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {templates.length === 0 && !showForm && (
            <div className="text-center py-12">
              <Dumbbell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No workout templates yet.</p>
              <button onClick={() => { resetForm(); setShowForm(true); addExercise(); }} className="mt-3 text-sm text-lime-600 font-medium hover:text-lime-700">
                Create your first template
              </button>
            </div>
          )}

          {templates.map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <div key={t.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-lime-50 rounded-xl flex items-center justify-center shrink-0">
                      <Dumbbell className="w-5 h-5 text-lime-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.workout_template_exercises.length} exercises
                        {t.estimated_duration_min ? ` · ~${t.estimated_duration_min} min` : ''}
                        {t.category ? ` · ${t.category}` : ''}
                        {t.use_count > 0 ? ` · Used ${t.use_count}x` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openLogModal(t); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-lime-600 text-white rounded-lg text-xs font-medium hover:bg-lime-700 transition"
                    >
                      <Play className="w-3 h-3" /> Log
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    {t.description && <p className="text-sm text-gray-600 mb-3">{t.description}</p>}
                    <div className="space-y-1.5">
                      {t.workout_template_exercises.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                          <span className="font-medium text-gray-800">{ex.name}</span>
                          <span className="text-gray-500 text-xs">
                            {[
                              ex.sets != null ? `${ex.sets} sets` : null,
                              ex.reps != null ? `${ex.reps} reps` : null,
                              ex.weight_lbs != null ? `${ex.weight_lbs} lbs` : null,
                              ex.duration_sec != null ? `${ex.duration_sec}s` : null,
                            ].filter(Boolean).join(' · ') || 'No details'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleEdit(t)} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
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

      {/* History tab */}
      {tab === 'history' && (
        <div className="space-y-3">
          {logs.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No workouts logged yet.</p>
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{log.name}</p>
                  <p className="text-xs text-gray-500">
                    {log.date}
                    {log.duration_min ? ` · ${log.duration_min} min` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setLinkingLogId(log.id)} className="text-xs text-gray-400 hover:text-sky-600" title="Link activities">
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteLog(log.id)} className="text-xs text-red-400 hover:text-red-600" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {log.notes && <p className="text-xs text-gray-500 mb-2">{log.notes}</p>}
              {log.workout_log_exercises.length > 0 && (
                <div className="space-y-1">
                  {log.workout_log_exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-gray-700 font-medium">{ex.name}</span>
                      <span className="text-gray-500">
                        {[
                          ex.sets_completed != null ? `${ex.sets_completed}s` : null,
                          ex.reps_completed != null ? `${ex.reps_completed}r` : null,
                          ex.weight_lbs != null ? `${ex.weight_lbs}lb` : null,
                        ].filter(Boolean).join(' × ') || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveTemplate} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl my-8">
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Template' : 'New Workout Template'}</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Push Day, Morning HIIT"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Est. duration (min)</label>
                <input
                  type="number" value={form.estimated_duration_min}
                  onChange={(e) => setForm((f) => ({ ...f, estimated_duration_min: e.target.value }))}
                  placeholder="45" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes about this workout"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Exercises */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Exercises</label>
                <button type="button" onClick={addExercise} className="text-xs text-lime-600 font-medium hover:text-lime-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add exercise
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {exercises.map((ex, i) => (
                  <DraftExerciseRow key={i} ex={ex} index={i} onChange={updateExercise} onRemove={removeExercise} />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={resetForm}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-gray-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Log from Template Modal */}
      {logModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleLogWorkout} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl my-8">
            <h2 className="text-lg font-bold text-gray-900">Log: {logModal.name}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={logForm.date}
                  onChange={(e) => setLogForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input type="number" value={logForm.duration_min}
                  onChange={(e) => setLogForm((f) => ({ ...f, duration_min: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Exercises — adjust as needed</label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {logExercises.map((ex, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input value={ex.name} readOnly className="col-span-2 sm:col-span-4 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium bg-white" />
                    <input type="number" placeholder="Sets" value={ex.sets_completed}
                      onChange={(e) => setLogExercises((prev) => prev.map((p, j) => j === i ? { ...p, sets_completed: e.target.value } : p))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                    <input type="number" placeholder="Reps" value={ex.reps_completed}
                      onChange={(e) => setLogExercises((prev) => prev.map((p, j) => j === i ? { ...p, reps_completed: e.target.value } : p))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                    <input type="number" step="0.5" placeholder="Wt (lbs)" value={ex.weight_lbs}
                      onChange={(e) => setLogExercises((prev) => prev.map((p, j) => j === i ? { ...p, weight_lbs: e.target.value } : p))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                    <input type="number" placeholder="Dur (sec)" value={ex.duration_sec}
                      onChange={(e) => setLogExercises((prev) => prev.map((p, j) => j === i ? { ...p, duration_sec: e.target.value } : p))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={logForm.notes} onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="How did it go?" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setLogModal(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={loggingSave}
                className="flex-1 bg-lime-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-lime-700 transition disabled:opacity-50">
                {loggingSave ? 'Saving…' : 'Save Workout'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Log Modal (no template) */}
      {showQuickLog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleQuickLog} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl my-8">
            <h2 className="text-lg font-bold text-gray-900">Log Workout</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Workout name *</label>
              <input value={quickForm.name} onChange={(e) => setQuickForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Morning Run, Gym Session"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input type="date" value={quickForm.date}
                  onChange={(e) => setQuickForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input type="number" value={quickForm.duration_min}
                  onChange={(e) => setQuickForm((f) => ({ ...f, duration_min: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Exercises</label>
                <button type="button" onClick={() => setQuickExercises((prev) => [...prev, { name: '', sets_completed: '', reps_completed: '', weight_lbs: '', duration_sec: '', notes: '' }])}
                  className="text-xs text-lime-600 font-medium hover:text-lime-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {quickExercises.map((ex, i) => (
                  <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input placeholder="Exercise *" value={ex.name}
                        onChange={(e) => setQuickExercises((prev) => prev.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}
                        className="col-span-2 sm:col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                      <input type="number" placeholder="Sets" value={ex.sets_completed}
                        onChange={(e) => setQuickExercises((prev) => prev.map((p, j) => j === i ? { ...p, sets_completed: e.target.value } : p))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                      <input type="number" placeholder="Reps" value={ex.reps_completed}
                        onChange={(e) => setQuickExercises((prev) => prev.map((p, j) => j === i ? { ...p, reps_completed: e.target.value } : p))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                    </div>
                    <button type="button" onClick={() => setQuickExercises((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600 mt-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={quickForm.notes} onChange={(e) => setQuickForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowQuickLog(false); setQuickExercises([]); }}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={loggingSave}
                className="flex-1 bg-lime-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-lime-700 transition disabled:opacity-50">
                {loggingSave ? 'Saving…' : 'Save Workout'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ActivityLinkModal
        isOpen={!!linkingLogId}
        onClose={() => setLinkingLogId(null)}
        entityType="workout"
        entityId={linkingLogId || ''}
        title="Link Workout"
      />
    </div>
  );
}
