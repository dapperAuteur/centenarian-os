'use client';

// app/dashboard/workouts/page.tsx
// Workout templates + log history — refactored to use extracted form components

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Play, Trash2, Edit3, Clock, Dumbbell, Copy,
  ChevronDown, ChevronUp, Upload, Download, Link2, Activity, MessageSquarePlus, ExternalLink, Pencil,
} from 'lucide-react';
import ActivityLinkModal from '@/components/ui/ActivityLinkModal';
import WorkoutTemplateForm from '@/components/workouts/WorkoutTemplateForm';
import WorkoutLogForm from '@/components/workouts/WorkoutLogForm';
import SuggestWorkoutEditModal from '@/components/workouts/SuggestWorkoutEditModal';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import WorkoutFeedbackModal from '@/components/workouts/WorkoutFeedbackModal';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Exercise {
  id?: string;
  name: string;
  exercise_id?: string | null;
  sets: number | null;
  reps: number | null;
  weight_lbs: number | null;
  duration_sec: number | null;
  rest_sec: number | null;
  notes: string | null;
  sort_order: number;
  equipment_id?: string | null;
  is_circuit?: boolean;
  is_negative?: boolean;
  is_isometric?: boolean;
  to_failure?: boolean;
  is_superset?: boolean;
  superset_group?: number | null;
  is_balance?: boolean;
  is_unilateral?: boolean;
  percent_of_max?: number | null;
  rpe?: number | null;
  tempo?: string;
  distance_miles?: number | null;
  hold_sec?: number | null;
  phase?: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  estimated_duration_min: number | null;
  use_count: number;
  purpose?: string[];
  visibility?: 'public' | 'private';
  workout_template_exercises: Exercise[];
}

interface LogExercise {
  name: string;
  exercise_id?: string | null;
  sets_completed: number | null;
  reps_completed: number | null;
  weight_lbs: number | null;
  duration_sec: number | null;
  rest_sec?: number | null;
  notes: string | null;
  is_circuit?: boolean;
  is_negative?: boolean;
  is_isometric?: boolean;
  to_failure?: boolean;
  is_superset?: boolean;
  superset_group?: number | null;
  is_balance?: boolean;
  is_unilateral?: boolean;
  rpe?: number | null;
  tempo?: string;
  percent_of_max?: number | null;
  distance_miles?: number | null;
  hold_sec?: number | null;
  phase?: string | null;
  side?: string | null;
  feeling?: number | null;
}

interface WorkoutLog {
  id: string;
  name: string;
  date: string;
  started_at?: string | null;
  duration_min: number | null;
  notes: string | null;
  template_id: string | null;
  purpose?: string[];
  overall_feeling?: number | null;
  warmup_notes?: string | null;
  cooldown_notes?: string | null;
  workout_log_exercises: LogExercise[];
}

export default function WorkoutsPage() {
  useTrackPageView('workouts', '/dashboard/workouts');
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'templates' | 'history'>('templates');

  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Log form state
  const [logTemplate, setLogTemplate] = useState<Template | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);

  const [linkingLogId, setLinkingLogId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [suggestTemplate, setSuggestTemplate] = useState<Template | null>(null);
  const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);

  // Post-workout feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackLogId, setFeedbackLogId] = useState<string | undefined>();
  const [feedbackWorkoutName, setFeedbackWorkoutName] = useState<string | undefined>();

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

  const handleDuplicateTemplate = async (t: Template) => {
    const res = await offlineFetch(`/api/workouts/${t.id}/duplicate`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      await load();
      if (data.template) {
        setEditingTemplate(data.template);
        setShowTemplateForm(true);
      }
    }
  };

  const handleToggleVisibility = async (t: Template, next: 'public' | 'private') => {
    await offlineFetch(`/api/workouts/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: next }),
    });
    load();
  };

  const handleEditLog = async (logId: string) => {
    const res = await offlineFetch(`/api/workouts/logs/${logId}`);
    if (res.ok) {
      const data = await res.json();
      setEditingLog(data.workout ?? data);
    }
  };

  const handleDuplicateLog = async (logId: string) => {
    const res = await offlineFetch(`/api/workouts/logs/${logId}/duplicate`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/workouts/${data.id}?edit=1`);
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
            onClick={() => setShowQuickLog(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-lime-600 text-white rounded-xl text-sm font-medium hover:bg-lime-700 transition"
          >
            <Play className="w-4 h-4" />
            Quick Log
          </button>
          <button
            onClick={() => { setEditingTemplate(null); setShowTemplateForm(true); }}
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
      <div role="tablist" className="flex border-b border-gray-200">
        <button
          role="tab"
          aria-selected={tab === 'templates'}
          onClick={() => setTab('templates')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'templates' ? 'border-lime-600 text-lime-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Templates ({templates.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'history'}
          onClick={() => setTab('history')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'history' ? 'border-lime-600 text-lime-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          History ({logs.length})
        </button>
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {/* Nomad Longevity OS program card */}
          <Link
            href="/dashboard/workouts/nomad"
            className="flex items-center gap-4 p-4 bg-linear-to-br from-gray-900 to-indigo-900 rounded-2xl text-white hover:opacity-95 transition group"
          >
            <div className="w-11 h-11 bg-indigo-600/40 rounded-xl flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6 text-indigo-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Nomad Longevity OS</p>
              <p className="text-xs text-indigo-300 mt-0.5">Structured routines for travelers · AM · PM · Hotel · Gym</p>
            </div>
            <span className="text-xs font-bold bg-indigo-600 px-2 py-0.5 rounded-full shrink-0">v1.1</span>
          </Link>

          {templates.length === 0 && (
            <div className="text-center py-12">
              <Dumbbell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No workout templates yet.</p>
              <button onClick={() => { setEditingTemplate(null); setShowTemplateForm(true); }}
                className="mt-3 text-sm text-lime-600 font-medium hover:text-lime-700">
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
                    {t.visibility === 'public' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(t, 'private'); }}
                        className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full hover:bg-green-100 transition"
                        aria-label={`${t.name} is public. Click to make private.`}
                      >
                        Public
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(t, 'public'); }}
                        className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full hover:bg-gray-200 transition"
                        aria-label={`${t.name} is private. Click to make public.`}
                      >
                        Private
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setLogTemplate(t); }}
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
                    {t.purpose && t.purpose.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {t.purpose.map((p) => (
                          <span key={p} className="text-xs px-2 py-0.5 bg-fuchsia-50 text-fuchsia-700 rounded-full">{p}</span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {t.workout_template_exercises.map((ex, i) => {
                        const detail = [
                          ex.sets != null ? `${ex.sets} sets` : null,
                          ex.reps != null ? `${ex.reps} reps` : null,
                          ex.weight_lbs != null ? `${ex.weight_lbs} lbs` : null,
                          ex.duration_sec != null ? `${ex.duration_sec}s` : null,
                          ex.rpe != null ? `RPE ${ex.rpe}` : null,
                          ex.tempo ? `Tempo ${ex.tempo}` : null,
                        ].filter(Boolean).join(' · ');
                        const flags = [
                          ex.is_circuit && 'Circuit',
                          ex.is_superset && 'Superset',
                          ex.to_failure && 'To Failure',
                          ex.is_unilateral && 'Unilateral',
                          ex.is_isometric && 'Isometric',
                        ].filter(Boolean) as string[];
                        const phase = ex.phase && ex.phase !== 'working' ? ex.phase : null;
                        return (
                          <div key={i} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {phase && (
                                  <span className="text-[10px] font-medium text-fuchsia-600 bg-fuchsia-50 px-1.5 py-0.5 rounded shrink-0 capitalize">
                                    {phase}
                                  </span>
                                )}
                                <span className="text-sm font-medium text-gray-800 truncate">{ex.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-gray-500 text-xs">{detail || '—'}</span>
                                {ex.exercise_id && (
                                  <Link
                                    href={`/dashboard/exercises/${ex.exercise_id}`}
                                    className="text-sky-500 hover:text-sky-700 transition"
                                    aria-label={`View ${ex.name} exercise details`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                  </Link>
                                )}
                              </div>
                            </div>
                            {(ex.notes || flags.length > 0) && (
                              <div className="px-3 pb-2 flex flex-wrap items-center gap-1.5">
                                {flags.map((f) => (
                                  <span key={f} className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                                    {f}
                                  </span>
                                ))}
                                {ex.notes && (
                                  <span className="text-[11px] text-gray-400 italic">{ex.notes}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {t.visibility === 'public' ? (
                        <button onClick={() => setSuggestTemplate(t)}
                          className="text-xs text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1" aria-label={`Suggest edit for ${t.name}`}>
                          <MessageSquarePlus className="w-3 h-3" /> Suggest Edit
                        </button>
                      ) : (
                        <button onClick={() => { setEditingTemplate(t); setShowTemplateForm(true); }}
                          className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1" aria-label={`Edit ${t.name}`}>
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      )}
                      <button onClick={() => handleDuplicateTemplate(t)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1" aria-label={`Duplicate ${t.name} as private copy`}>
                        <Copy className="w-3 h-3" /> Duplicate
                      </button>
                      <button onClick={() => handleDelete(t.id)}
                        className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1" aria-label={`Delete ${t.name}`}>
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
            <div key={log.id} className="bg-white border border-gray-200 rounded-2xl p-4 cursor-pointer hover:border-gray-300 transition" onClick={() => router.push(`/dashboard/workouts/${log.id}`)}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{log.name}</p>
                  <p className="text-xs text-gray-500">
                    {log.date}
                    {log.duration_min ? ` · ${log.duration_min} min` : ''}
                    {log.overall_feeling ? ` · Feeling: ${log.overall_feeling}/5` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEditLog(log.id)} className="p-1 text-gray-400 hover:text-sky-600" aria-label={`Edit ${log.name}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDuplicateLog(log.id)} className="p-1 text-gray-400 hover:text-indigo-600" aria-label={`Duplicate ${log.name}`}>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setLinkingLogId(log.id)} className="p-1 text-gray-400 hover:text-sky-600" aria-label={`Link activities for ${log.name}`}>
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteLog(log.id)} className="p-1 text-red-400 hover:text-red-600" aria-label={`Delete ${log.name}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {log.purpose && log.purpose.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {log.purpose.map((p) => (
                    <span key={p} className="text-xs px-1.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 rounded-full">{p}</span>
                  ))}
                </div>
              )}
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
                          ex.rpe != null ? `RPE ${ex.rpe}` : null,
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

      {/* Template Form Modal */}
      <WorkoutTemplateForm
        isOpen={showTemplateForm}
        onClose={() => { setShowTemplateForm(false); setEditingTemplate(null); }}
        onSaved={load}
        initial={editingTemplate}
      />

      {/* Log from Template Modal */}
      <WorkoutLogForm
        isOpen={!!logTemplate}
        onClose={() => setLogTemplate(null)}
        onSaved={() => { setTab('history'); load(); }}
        onWorkoutLogged={(logId) => { setFeedbackLogId(logId); setFeedbackWorkoutName(logTemplate?.name); setFeedbackOpen(true); }}
        template={logTemplate}
      />

      {/* Quick Log Modal */}
      <WorkoutLogForm
        isOpen={showQuickLog}
        onClose={() => setShowQuickLog(false)}
        onSaved={() => { setTab('history'); load(); }}
        onWorkoutLogged={(logId) => { setFeedbackLogId(logId); setFeedbackWorkoutName(undefined); setFeedbackOpen(true); }}
        title="Log Workout"
      />

      <ActivityLinkModal
        isOpen={!!linkingLogId}
        onClose={() => setLinkingLogId(null)}
        entityType="workout"
        entityId={linkingLogId || ''}
        title="Link Workout"
      />

      <WorkoutFeedbackModal
        isOpen={feedbackOpen}
        onClose={() => { setFeedbackOpen(false); setFeedbackLogId(undefined); setFeedbackWorkoutName(undefined); }}
        workoutLogId={feedbackLogId}
        workoutName={feedbackWorkoutName}
      />

      {/* Edit existing log modal — conditionally mounted so form state initialises from existingLog */}
      {editingLog && (
        <WorkoutLogForm
          key={editingLog.id}
          isOpen
          onClose={() => setEditingLog(null)}
          onSaved={() => { setEditingLog(null); load(); }}
          existingLog={editingLog}
        />
      )}

      {suggestTemplate && (
        <SuggestWorkoutEditModal
          isOpen={!!suggestTemplate}
          onClose={() => setSuggestTemplate(null)}
          templateId={suggestTemplate.id}
          templateName={suggestTemplate.name}
        />
      )}
    </div>
  );
}
