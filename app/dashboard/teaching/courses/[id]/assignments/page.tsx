'use client';

// app/dashboard/teaching/courses/[id]/assignments/page.tsx
// Teacher: create assignments, view submissions, grade student work.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Plus, ClipboardList, ChevronDown, ChevronUp,
  Loader2, CheckCircle, Clock, Save,
} from 'lucide-react';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
}

interface Submission {
  id: string;
  student_id: string;
  content: string | null;
  media_url: string | null;
  submitted_at: string;
  grade: string | null;
  teacher_feedback: string | null;
  profiles: { username: string; display_name: string | null } | null;
}

export default function CourseAssignmentsPage() {
  const { id: courseId } = useParams<{ id: string }>();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', description: '', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', teacher_feedback: '' });

  useEffect(() => {
    fetch(`/api/academy/courses/${courseId}/assignments`)
      .then((r) => r.json())
      .then((d) => { setAssignments(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId]);

  async function loadSubmissions(assignmentId: string) {
    if (submissions[assignmentId]) return;
    const r = await fetch(`/api/academy/assignments/${assignmentId}/submissions`);
    if (r.ok) {
      const d = await r.json();
      setSubmissions((prev) => ({ ...prev, [assignmentId]: Array.isArray(d) ? d : [] }));
    }
  }

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      loadSubmissions(id);
    }
  }

  async function handleCreate() {
    if (!newForm.title.trim()) { setCreateError('Title required.'); return; }
    setSaving(true);
    setCreateError('');
    const r = await fetch(`/api/academy/courses/${courseId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newForm.title.trim(),
        description: newForm.description.trim() || null,
        due_date: newForm.due_date || null,
      }),
    });
    const d = await r.json();
    if (!r.ok) { setCreateError(d.error ?? 'Failed'); setSaving(false); return; }
    setAssignments((prev) => [d, ...prev]);
    setCreating(false);
    setNewForm({ title: '', description: '', due_date: '' });
    setSaving(false);
  }

  async function handleGrade(assignmentId: string, submissionId: string) {
    const r = await fetch(`/api/academy/assignments/${assignmentId}/submissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submissionId,
        grade: gradeForm.grade || null,
        teacher_feedback: gradeForm.teacher_feedback || null,
      }),
    });
    if (r.ok) {
      const updated = await r.json();
      setSubmissions((prev) => ({
        ...prev,
        [assignmentId]: (prev[assignmentId] ?? []).map((s) =>
          s.id === submissionId ? { ...s, ...updated } : s,
        ),
      }));
      setGradingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href={`/dashboard/teaching/courses/${courseId}`}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-2 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Course Editor
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-fuchsia-400" /> Assignments
          </h1>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" /> New Assignment
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="dark-input bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-white">Create Assignment</h2>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Title *</label>
            <input
              type="text"
              value={newForm.title}
              onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Instructions</label>
            <textarea
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Due Date</label>
            <input
              type="datetime-local"
              value={newForm.due_date}
              onChange={(e) => setNewForm((f) => ({ ...f, due_date: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
            />
          </div>
          {createError && <p className="text-red-400 text-sm">{createError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setCreateError(''); }}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assignment list */}
      {assignments.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-dashed border-gray-800 rounded-xl">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm">No assignments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const subs = submissions[a.id] ?? [];
            const isExpanded = expanded === a.id;
            return (
              <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(a.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/50 transition"
                >
                  <ClipboardList className="w-4 h-4 text-fuchsia-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{a.title}</p>
                    {a.due_date && (
                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Due {new Date(a.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {isExpanded && subs.length > 0 && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {subs.length} submission{subs.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
                </button>

                {/* Expanded: submissions */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4">
                    {a.description && (
                      <p className="text-gray-400 text-sm mb-4 leading-relaxed">{a.description}</p>
                    )}
                    {subs.length === 0 ? (
                      <p className="text-gray-600 text-sm">No submissions yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {subs.map((sub) => (
                          <div key={sub.id} className="bg-gray-800 rounded-xl p-4">
                            {/* Submission header */}
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <p className="font-medium text-white text-sm">
                                  {sub.profiles?.display_name ?? sub.profiles?.username ?? 'Student'}
                                </p>
                                <p className="text-gray-500 text-xs">
                                  {new Date(sub.submitted_at).toLocaleString()}
                                </p>
                              </div>
                              {sub.grade ? (
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium shrink-0">
                                  {sub.grade}
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded-full text-xs font-medium shrink-0">
                                  Ungraded
                                </span>
                              )}
                            </div>

                            {/* Submission content */}
                            {sub.content && (
                              <p className="text-gray-300 text-sm mb-3 bg-gray-900 rounded-lg p-3 leading-relaxed">
                                {sub.content}
                              </p>
                            )}
                            {sub.media_url && (
                              <a
                                href={sub.media_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-fuchsia-400 text-xs hover:underline mb-3 block"
                              >
                                View attached media
                              </a>
                            )}

                            {/* Existing feedback display */}
                            {sub.teacher_feedback && gradingId !== sub.id && (
                              <p className="text-gray-400 text-xs italic mb-2">
                                Feedback: {sub.teacher_feedback}
                              </p>
                            )}

                            {/* Grade form */}
                            {gradingId === sub.id ? (
                              <div className="dark-input space-y-2 mt-3">
                                <input
                                  type="text"
                                  placeholder="Grade (e.g. A, 90/100, Pass)"
                                  value={gradeForm.grade}
                                  onChange={(e) => setGradeForm((f) => ({ ...f, grade: e.target.value }))}
                                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                                />
                                <textarea
                                  placeholder="Feedback for student…"
                                  value={gradeForm.teacher_feedback}
                                  onChange={(e) => setGradeForm((f) => ({ ...f, teacher_feedback: e.target.value }))}
                                  rows={3}
                                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500 resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleGrade(a.id, sub.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Save Grade
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setGradingId(null)}
                                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setGradingId(sub.id);
                                  setGradeForm({
                                    grade: sub.grade ?? '',
                                    teacher_feedback: sub.teacher_feedback ?? '',
                                  });
                                }}
                                className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition mt-1"
                              >
                                {sub.grade ? 'Edit Grade' : 'Grade Submission'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
