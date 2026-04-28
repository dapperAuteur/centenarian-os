'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Link2, X, Shield, Plus, Search, Sparkles, Loader2,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Lesson {
  id: string; title: string; lesson_type: string; content_url: string | null;
  text_content: string | null; duration_seconds: number | null; order: number;
  is_free_preview: boolean; module_id: string | null;
}
interface Module { id: string; title: string; order: number; lessons: Lesson[]; }
interface Course {
  id: string; title: string; description: string | null; cover_image_url: string | null;
  category: string | null; price: number; price_type: string; is_published: boolean;
  navigation_mode: 'linear' | 'cyoa'; is_sequential: boolean;
  visibility: 'public' | 'members' | 'scheduled'; published_at: string | null;
  trial_period_days: number; course_modules: Module[];
}

interface Prerequisite { id: string; prerequisite_course_id: string; enforcement: string; sort_order: number; title: string; cover_image_url: string | null; completed: boolean; }
interface Recommendation { id: string; recommended_course_id: string; direction: string; sort_order: number; notes: string | null; title: string; cover_image_url: string | null; }
interface Override { id: string; user_id: string; notes: string | null; student_name: string; student_avatar: string | null; }
interface OverrideRequest { id: string; student_id: string; status: string; answers: Record<string, string>; reason: string | null; student_name: string; created_at: string; }
interface OverrideQuestion { id: string; question: string; type: 'text' | 'rating' | 'select'; options?: string[]; required: boolean; }

interface TabProps {
  course: Course;
  courseId: string;
  saveCourseField: (updates: Partial<Course>) => Promise<void>;
  saving: boolean;
  feedback: string;
  setFeedback: (msg: string) => void;
}

export default function PrerequisitesTab({ course, courseId, saveCourseField, setFeedback }: TabProps) {
  const [prereqs, setPrereqs] = useState<Prerequisite[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [prereqSearch, setPrereqSearch] = useState('');
  const [prereqResults, setPrereqResults] = useState<Array<{ id: string; title: string }>>([]);
  const [prereqSearching, setPrereqSearching] = useState(false);
  const [prereqAddType, setPrereqAddType] = useState<'prerequisite' | 'recommendation'>('prerequisite');
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideRequests, setOverrideRequests] = useState<OverrideRequest[]>([]);
  const [overrideQuestions, setOverrideQuestions] = useState<OverrideQuestion[]>([]);
  const [aiRecsLoading, setAiRecsLoading] = useState(false);
  const [aiRecs, setAiRecs] = useState<{ before: Array<{ course_id: string; title: string; reason: string }>; after: Array<{ course_id: string; title: string; reason: string }> } | null>(null);

  const fetchPrereqs = useCallback(() => {
    offlineFetch(`/api/academy/courses/${courseId}/prerequisites`)
      .then((r) => r.json())
      .then((d) => { setPrereqs(d.prerequisites ?? []); setRecs(d.recommendations ?? []); })
      .catch(() => {});
    offlineFetch(`/api/academy/courses/${courseId}/prerequisites/overrides`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setOverrides(d); })
      .catch(() => {});
    offlineFetch(`/api/academy/courses/${courseId}/prerequisites/requests`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setOverrideRequests(d.filter((r: OverrideRequest) => r.status === 'pending')); })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => { fetchPrereqs(); }, [fetchPrereqs]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questions = (course as any).override_questions;
    if (Array.isArray(questions)) setOverrideQuestions(questions);
  }, [course]);

  async function searchCoursesForPrereq() {
    if (!prereqSearch.trim()) return;
    setPrereqSearching(true);
    try {
      const r = await offlineFetch(`/api/academy/courses?search=${encodeURIComponent(prereqSearch.trim())}&limit=10`);
      if (r.ok) {
        const d = await r.json();
        const courses = (d.courses ?? d ?? [])
          .filter((c: { id: string }) => c.id !== courseId)
          .map((c: { id: string; title: string }) => ({ id: c.id, title: c.title }));
        setPrereqResults(courses);
      }
    } finally { setPrereqSearching(false); }
  }

  async function addPrereqOrRec(targetCourseId: string) {
    const body: Record<string, string> = { type: prereqAddType, target_course_id: targetCourseId };
    if (prereqAddType === 'prerequisite') body.enforcement = 'recommended';
    if (prereqAddType === 'recommendation') body.direction = 'after';
    const r = await offlineFetch(`/api/academy/courses/${courseId}/prerequisites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) { setPrereqSearch(''); setPrereqResults([]); fetchPrereqs(); }
  }

  async function removePrereqOrRec(id: string, type: 'prerequisite' | 'recommendation') {
    await offlineFetch(`/api/academy/courses/${courseId}/prerequisites`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }),
    });
    fetchPrereqs();
  }

  async function toggleEnforcement(prereqId: string, current: string) {
    const newEnforcement = current === 'required' ? 'recommended' : 'required';
    const prereq = prereqs.find((p) => p.id === prereqId);
    if (!prereq) return;
    await offlineFetch(`/api/academy/courses/${courseId}/prerequisites`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'prerequisite', id: prereqId }),
    });
    await offlineFetch(`/api/academy/courses/${courseId}/prerequisites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'prerequisite', target_course_id: prereq.prerequisite_course_id, enforcement: newEnforcement }),
    });
    fetchPrereqs();
  }

  async function grantOverride() {
    if (!overrideEmail.trim()) return;
    const r = await offlineFetch(`/api/admin/users?search=${encodeURIComponent(overrideEmail.trim())}&limit=1`);
    if (!r.ok) return;
    const d = await r.json();
    const users = d.users ?? [];
    if (users.length === 0) { setFeedback('User not found'); setTimeout(() => setFeedback(''), 2000); return; }
    const userId = users[0].id;
    const res = await offlineFetch(`/api/academy/courses/${courseId}/prerequisites/overrides`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, notes: overrideNotes.trim() || null }),
    });
    if (res.ok) { setOverrideEmail(''); setOverrideNotes(''); fetchPrereqs(); }
    else { const err = await res.json(); setFeedback(err.error || 'Failed'); setTimeout(() => setFeedback(''), 2000); }
  }

  async function revokeOverride(overrideId: string) {
    await offlineFetch(`/api/academy/courses/${courseId}/prerequisites/overrides`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: overrideId }),
    });
    fetchPrereqs();
  }

  async function handleOverrideRequest(requestId: string, action: 'approve' | 'reject') {
    await offlineFetch(`/api/academy/courses/${courseId}/prerequisites/requests`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, action }),
    });
    fetchPrereqs();
  }

  function addOverrideQuestion() {
    const q: OverrideQuestion = { id: crypto.randomUUID(), question: '', type: 'text', required: true };
    const updated = [...overrideQuestions, q];
    setOverrideQuestions(updated);
    saveCourseField({ override_questions: updated } as Partial<Course>);
  }

  function removeOverrideQuestion(qId: string) {
    const updated = overrideQuestions.filter((q) => q.id !== qId);
    setOverrideQuestions(updated);
    saveCourseField({ override_questions: updated } as Partial<Course>);
  }

  function updateOverrideQuestion(qId: string, field: string, value: string | boolean) {
    const updated = overrideQuestions.map((q) => q.id === qId ? { ...q, [field]: value } : q);
    setOverrideQuestions(updated);
  }

  function saveOverrideQuestions() {
    saveCourseField({ override_questions: overrideQuestions } as Partial<Course>);
  }

  async function fetchAiRecommendations() {
    setAiRecsLoading(true);
    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/ai-recommendations`, { method: 'POST' });
      if (r.ok) { const d = await r.json(); setAiRecs(d); }
    } finally { setAiRecsLoading(false); }
  }

  async function addAiRecAsManual(targetCourseId: string, type: 'prerequisite' | 'recommendation', direction?: string) {
    const body: Record<string, string> = { type, target_course_id: targetCourseId };
    if (type === 'prerequisite') body.enforcement = 'recommended';
    if (type === 'recommendation') body.direction = direction || 'after';
    await offlineFetch(`/api/academy/courses/${courseId}/prerequisites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    fetchPrereqs();
    setAiRecs(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <Link2 className="w-5 h-5 text-fuchsia-400" />
        <h3 className="font-semibold text-white text-sm">Prerequisites & Recommendations</h3>
      </div>

      {/* Existing prerequisites */}
      {prereqs.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Prerequisites</p>
          <div className="space-y-2">
            {prereqs.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2.5">
                <span className="text-sm text-gray-200 flex-1 truncate">{p.title}</span>
                <button type="button" onClick={() => toggleEnforcement(p.id, p.enforcement)}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${p.enforcement === 'required' ? 'bg-red-900/40 text-red-400 border border-red-800' : 'bg-amber-900/40 text-amber-400 border border-amber-800'}`}>
                  {p.enforcement === 'required' ? 'Required' : 'Recommended'}
                </button>
                <button type="button" onClick={() => removePrereqOrRec(p.id, 'prerequisite')} className="text-gray-400 hover:text-red-400 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing recommendations */}
      {recs.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Recommendations</p>
          <div className="space-y-2">
            {recs.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2.5">
                <span className="text-sm text-gray-200 flex-1 truncate">{r.title}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${r.direction === 'before' ? 'bg-sky-900/40 text-sky-400 border border-sky-800' : 'bg-green-900/40 text-green-400 border border-green-800'}`}>
                  {r.direction === 'before' ? 'Before' : 'After'}
                </span>
                {r.notes && <span className="text-xs text-gray-500 truncate max-w-32">{r.notes}</span>}
                <button type="button" onClick={() => removePrereqOrRec(r.id, 'recommendation')} className="text-gray-400 hover:text-red-400 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add prerequisite / recommendation */}
      <div className="border border-gray-700 rounded-xl p-3 space-y-2 bg-gray-800/30">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={prereqAddType} onChange={(e) => setPrereqAddType(e.target.value as 'prerequisite' | 'recommendation')}
            style={{ colorScheme: 'dark' }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="prerequisite" className="bg-gray-800 text-white">Add Prerequisite</option>
            <option value="recommendation" className="bg-gray-800 text-white">Add Recommendation</option>
          </select>
          <div className="flex-1 flex gap-1 min-w-48">
            <input type="text" value={prereqSearch} onChange={(e) => setPrereqSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchCoursesForPrereq(); } }}
              placeholder="Search courses by title..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500" />
            <button type="button" onClick={searchCoursesForPrereq} disabled={prereqSearching}
              className="px-2 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs hover:bg-fuchsia-700 transition disabled:opacity-50">
              <Search className="w-3 h-3" />
            </button>
          </div>
        </div>
        {prereqResults.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {prereqResults.map((c) => (
              <button key={c.id} type="button" onClick={() => addPrereqOrRec(c.id)}
                className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-fuchsia-900/30 rounded transition truncate">
                {c.title}
              </button>
            ))}
          </div>
        )}
        {prereqSearching && <p className="text-xs text-gray-500">Searching...</p>}
        <p className="text-xs text-gray-400">Required = blocks enrollment. Recommended = shown as suggestion. Click badge to toggle.</p>
      </div>

      {/* Overrides */}
      {prereqs.some((p) => p.enforcement === 'required') && (
        <div className="border-t border-gray-800 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-fuchsia-400" />
            <p className="text-sm text-gray-300 font-medium">Prerequisite Overrides</p>
          </div>
          {overrides.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {overrides.map((o) => (
                <div key={o.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-300 flex-1">{o.student_name}</span>
                  {o.notes && <span className="text-xs text-gray-500 truncate max-w-32">{o.notes}</span>}
                  <button type="button" onClick={() => revokeOverride(o.id)} className="text-gray-400 hover:text-red-400 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input type="email" value={overrideEmail} onChange={(e) => setOverrideEmail(e.target.value)} placeholder="Student email..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 min-w-40" />
            <input type="text" value={overrideNotes} onChange={(e) => setOverrideNotes(e.target.value)} placeholder="Notes (optional)..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 min-w-40" />
            <button type="button" onClick={grantOverride}
              className="px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-medium hover:bg-fuchsia-700 transition">
              Grant Override
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Override lets a student enroll without completing required prerequisites.</p>

          {/* Pending Override Requests */}
          {overrideRequests.length > 0 && (
            <div className="mt-4 border-t border-gray-700 pt-3">
              <p className="text-xs text-amber-400 font-medium mb-2">{overrideRequests.length} Pending Request{overrideRequests.length > 1 ? 's' : ''}</p>
              <div className="space-y-2">
                {overrideRequests.map((req) => (
                  <div key={req.id} className="bg-gray-800/80 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300 font-medium">{req.student_name}</span>
                      <span className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                    {req.reason && <p className="text-xs text-gray-400 italic">&quot;{req.reason}&quot;</p>}
                    {Object.keys(req.answers).length > 0 && (
                      <div className="text-xs text-gray-400 space-y-1">
                        {Object.entries(req.answers).map(([q, a]) => (
                          <div key={q}><span className="text-gray-500">{q}:</span> {a}</div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleOverrideRequest(req.id, 'approve')}
                        className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition">Approve</button>
                      <button type="button" onClick={() => handleOverrideRequest(req.id, 'reject')}
                        className="px-2.5 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Override Questions Editor */}
          <div className="mt-4 border-t border-gray-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">Override Request Questions</p>
              <button type="button" onClick={addOverrideQuestion}
                className="text-xs text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Question
              </button>
            </div>
            {overrideQuestions.length === 0 ? (
              <p className="text-xs text-gray-400">No custom questions. Students will submit a simple text reason.</p>
            ) : (
              <div className="space-y-2">
                {overrideQuestions.map((q) => (
                  <div key={q.id} className="flex items-start gap-2 bg-gray-800/60 rounded-lg p-2">
                    <input type="text" value={q.question} onChange={(e) => updateOverrideQuestion(q.id, 'question', e.target.value)}
                      onBlur={saveOverrideQuestions} placeholder="Question text..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500" />
                    <select value={q.type} onChange={(e) => { updateOverrideQuestion(q.id, 'type', e.target.value); setTimeout(saveOverrideQuestions, 50); }}
                      style={{ colorScheme: 'dark' }}
                      className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-white">
                      <option value="text" className="bg-gray-800 text-white">Text</option>
                      <option value="rating" className="bg-gray-800 text-white">Rating (1-5)</option>
                      <option value="select" className="bg-gray-800 text-white">Select</option>
                    </select>
                    <button type="button" onClick={() => removeOverrideQuestion(q.id)}
                      className="text-gray-400 hover:text-red-400 transition mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Course Suggestions
          </p>
          <button type="button" onClick={fetchAiRecommendations} disabled={aiRecsLoading}
            className="text-xs text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 disabled:opacity-50">
            {aiRecsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiRecsLoading ? 'Generating...' : 'Suggest with AI'}
          </button>
        </div>
        {aiRecs && (
          <div className="space-y-2">
            {(aiRecs.before ?? []).map((r) => (
              <div key={r.course_id} className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-2">
                <span className="text-xs text-sky-400 shrink-0">Before:</span>
                <span className="text-xs text-gray-300 flex-1 truncate">{r.title}</span>
                <span className="text-xs text-gray-500 truncate max-w-40">{r.reason}</span>
                <button type="button" onClick={() => addAiRecAsManual(r.course_id, 'recommendation', 'before')}
                  className="text-xs text-fuchsia-400 hover:text-fuchsia-300 shrink-0">Add</button>
              </div>
            ))}
            {(aiRecs.after ?? []).map((r) => (
              <div key={r.course_id} className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-2">
                <span className="text-xs text-green-400 shrink-0">After:</span>
                <span className="text-xs text-gray-300 flex-1 truncate">{r.title}</span>
                <span className="text-xs text-gray-500 truncate max-w-40">{r.reason}</span>
                <button type="button" onClick={() => addAiRecAsManual(r.course_id, 'recommendation', 'after')}
                  className="text-xs text-fuchsia-400 hover:text-fuchsia-300 shrink-0">Add</button>
              </div>
            ))}
            {(aiRecs.before ?? []).length === 0 && (aiRecs.after ?? []).length === 0 && (
              <p className="text-xs text-gray-400">No AI suggestions available for this course.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
