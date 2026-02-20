'use client';

// app/academy/[courseId]/assignments/[id]/page.tsx
// Student: view assignment, save draft, submit work, see grade/feedback, message thread.

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Send, CheckCircle, Loader2, ClipboardList, MessageCircle, Clock, FileEdit,
} from 'lucide-react';
import SubmissionUploader, { SubmissionFile } from '@/components/ui/SubmissionUploader';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
}

interface Submission {
  id: string;
  content: string | null;
  media_urls: SubmissionFile[];
  submitted_at: string | null;
  status: 'draft' | 'submitted';
  grade: string | null;
  teacher_feedback: string | null;
}

interface Message {
  id: string;
  is_teacher: boolean;
  body: string;
  created_at: string;
  profiles: { username: string; display_name: string | null } | null;
}

export default function AssignmentPage() {
  const { courseId, id: assignmentId } = useParams<{ courseId: string; id: string }>();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state mirrors the submission
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<SubmissionFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/academy/courses/${courseId}/assignments`).then((r) => r.json()),
      fetch(`/api/academy/assignments/${assignmentId}/submissions`).then((r) => r.json()),
    ]).then(([assignments, submissions]) => {
      const found = (Array.isArray(assignments) ? assignments : []).find(
        (a: Assignment) => a.id === assignmentId,
      );
      setAssignment(found ?? null);
      const sub: Submission | null =
        Array.isArray(submissions) && submissions.length > 0 ? submissions[0] : null;
      setSubmission(sub);
      if (sub) {
        setContent(sub.content ?? '');
        setMediaFiles(Array.isArray(sub.media_urls) ? sub.media_urls : []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courseId, assignmentId]);

  useEffect(() => {
    if (!submission?.id) return;
    fetch(`/api/academy/assignments/${assignmentId}/submissions/${submission.id}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [assignmentId, submission?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSave(status: 'draft' | 'submitted') {
    setSaving(true);
    setSaveError('');
    try {
      const r = await fetch(`/api/academy/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() || null, media_urls: mediaFiles, status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed');
      setSubmission(d);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !submission?.id) return;
    setSending(true);
    const r = await fetch(
      `/api/academy/assignments/${assignmentId}/submissions/${submission.id}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newMessage.trim() }),
      },
    );
    if (r.ok) {
      const msg = await r.json();
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }
  if (!assignment) {
    return <div className="text-center py-20 text-gray-500">Assignment not found.</div>;
  }

  const isSubmitted = submission?.status === 'submitted';
  const isDraft = submission?.status === 'draft';
  const isDirty =
    content !== (submission?.content ?? '') ||
    JSON.stringify(mediaFiles) !== JSON.stringify(submission?.media_urls ?? []);

  return (
    <div className="text-white">
      {/* Top nav */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link
          href={`/academy/${courseId}`}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back to course
        </Link>
        {submission && (
          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
            isSubmitted
              ? 'bg-green-900/30 text-green-400'
              : 'bg-amber-900/30 text-amber-400'
          }`}>
            {isSubmitted ? 'Submitted' : 'Draft'}
          </span>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start gap-3 mb-2">
          <ClipboardList className="w-6 h-6 text-fuchsia-400 shrink-0 mt-0.5" />
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
        </div>
        {assignment.due_date && (
          <p className="text-gray-400 text-sm flex items-center gap-1.5 mb-5">
            <Clock className="w-3.5 h-3.5" />
            Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </p>
        )}
        {assignment.description && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {assignment.description}
          </div>
        )}

        {/* Grade / feedback banner */}
        {submission?.grade && (
          <div className="bg-fuchsia-900/20 border border-fuchsia-700/50 rounded-xl p-5 mb-6">
            <p className="font-semibold text-fuchsia-300 mb-1">Grade: {submission.grade}</p>
            {submission.teacher_feedback && (
              <p className="text-gray-300 text-sm leading-relaxed">{submission.teacher_feedback}</p>
            )}
          </div>
        )}

        {/* Submission form */}
        <div className="dark-input bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-fuchsia-400" />
            {isSubmitted ? 'Your Submission' : isDraft ? 'Draft' : 'Your Work'}
          </h2>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Write your response here…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 resize-none mb-4"
          />

          <div className="mb-5">
            <p className="text-xs text-gray-400 mb-2">Attachments (up to 5 files)</p>
            <SubmissionUploader files={mediaFiles} onChange={setMediaFiles} />
          </div>

          {saveError && <p className="text-red-400 text-sm mb-3">{saveError}</p>}

          <div className="flex items-center gap-3 flex-wrap">
            {/* Save Draft — always available unless already submitted with no changes */}
            {!isSubmitted && (
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={saving || (!content.trim() && mediaFiles.length === 0)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-xl text-sm font-medium hover:bg-gray-600 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileEdit className="w-4 h-4" />}
                Save Draft
              </button>
            )}

            {/* Submit button */}
            <button
              type="button"
              onClick={() => handleSave('submitted')}
              disabled={saving || (!content.trim() && mediaFiles.length === 0)}
              className="flex items-center gap-2 px-5 py-2 bg-fuchsia-600 text-white rounded-xl font-semibold text-sm hover:bg-fuchsia-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {isSubmitted ? (isDirty ? 'Update Submission' : 'Resubmit') : 'Submit'}
            </button>

            {submission?.submitted_at && (
              <span className="text-gray-600 text-xs ml-auto">
                Submitted {new Date(submission.submitted_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Message thread — visible once a submission (draft or submitted) exists */}
        {submission && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-fuchsia-400" /> Feedback Thread
            </h2>
            {messages.length === 0 ? (
              <p className="text-gray-600 text-sm mb-4">
                No messages yet.{' '}
                {isSubmitted
                  ? 'Your teacher will respond here once they review your submission.'
                  : 'Submit your work for teacher feedback.'}
              </p>
            ) : (
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.is_teacher ? '' : 'flex-row-reverse'}`}>
                    <div className={`max-w-sm ${msg.is_teacher ? '' : 'ml-auto'}`}>
                      <div className={`inline-block px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                        msg.is_teacher
                          ? 'bg-gray-800 text-gray-200 rounded-tl-none'
                          : 'bg-fuchsia-700/80 text-white rounded-tr-none'
                      }`}>
                        {msg.body}
                      </div>
                      <p className={`text-gray-600 text-xs mt-1 ${msg.is_teacher ? '' : 'text-right'}`}>
                        {msg.is_teacher
                          ? (msg.profiles?.display_name ?? msg.profiles?.username ?? 'Teacher')
                          : 'You'}{' '}
                        · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
            <div className="dark-input flex gap-2 mt-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSendMessage(); }}
                placeholder="Message your teacher…"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
                className="p-2.5 bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
