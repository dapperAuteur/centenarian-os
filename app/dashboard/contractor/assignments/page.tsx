'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Briefcase, Check, X as XIcon, MessageCircle,
} from 'lucide-react';

interface Assignment {
  id: string;
  job_id: string;
  assigned_by: string;
  status: string;
  message: string | null;
  response_note: string | null;
  assigned_at: string;
  responded_at: string | null;
  job: { job_number: string; client_name: string; event_name: string | null; start_date: string | null; location_name: string | null } | null;
  assigned_by_username: string;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  offered: { color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  accepted: { color: 'text-green-400', bg: 'bg-green-400/10' },
  declined: { color: 'text-red-400', bg: 'bg-red-400/10' },
  removed: { color: 'text-neutral-500', bg: 'bg-neutral-700/30' },
};

export default function WorkerAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [showNoteId, setShowNoteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/contractor/assignments?role=worker')
      .then((r) => r.json())
      .then((d) => setAssignments(d.assignments ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function respond(id: string, status: 'accepted' | 'declined') {
    setRespondingId(id);
    await fetch(`/api/contractor/assignments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, response_note: responseNote.trim() || null }),
    });
    setRespondingId(null);
    setResponseNote('');
    setShowNoteId(null);
    load();
  }

  const filtered = statusFilter
    ? assignments.filter((a) => a.status === statusFilter)
    : assignments;

  const pendingCount = assignments.filter((a) => a.status === 'offered').length;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-100">Job Offers</h1>
        {pendingCount > 0 && (
          <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-sm font-medium text-yellow-400">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-1 flex-wrap" role="group" aria-label="Filter by status">
        {['', 'offered', 'accepted', 'declined'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === s
                ? 'bg-amber-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {statusFilter ? `No ${statusFilter} offers.` : 'No job offers yet.'}
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Job offers">
          {filtered.map((a) => {
            const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.offered;
            const isOffer = a.status === 'offered';

            return (
              <article key={a.id} role="listitem" className={`rounded-xl border bg-neutral-900 p-4 ${isOffer ? 'border-yellow-700/50' : 'border-neutral-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Briefcase size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium text-neutral-100">
                        {a.job?.event_name || a.job?.client_name || 'Unknown Job'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.color} ${style.bg}`}>
                        {a.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 flex flex-wrap gap-x-3">
                      <span>From: {a.assigned_by_username}</span>
                      {a.job?.start_date && <span>· {new Date(a.job.start_date + 'T00:00:00').toLocaleDateString()}</span>}
                      {a.job?.location_name && <span>· {a.job.location_name}</span>}
                      {a.job?.job_number && <span>· #{a.job.job_number}</span>}
                    </div>
                    {a.message && (
                      <p className="mt-2 text-sm text-neutral-300 bg-neutral-800/50 rounded-lg px-3 py-2 italic">
                        &ldquo;{a.message}&rdquo;
                      </p>
                    )}
                    {a.response_note && (
                      <p className="mt-1 text-xs text-neutral-400">
                        <span className="text-neutral-500">Your response:</span> {a.response_note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions for pending offers */}
                {isOffer && (
                  <div className="mt-3 space-y-2">
                    {showNoteId === a.id && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={responseNote}
                          onChange={(e) => setResponseNote(e.target.value)}
                          placeholder="Add a note (optional)..."
                          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        />
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => respond(a.id, 'accepted')}
                        disabled={respondingId === a.id}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                      >
                        {respondingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Accept
                      </button>
                      <button
                        onClick={() => respond(a.id, 'declined')}
                        disabled={respondingId === a.id}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                      >
                        <XIcon size={14} />
                        Decline
                      </button>
                      <button
                        onClick={() => setShowNoteId(showNoteId === a.id ? null : a.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2.5 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <MessageCircle size={14} />
                        {showNoteId === a.id ? 'Hide Note' : 'Add Note'}
                      </button>
                    </div>
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
