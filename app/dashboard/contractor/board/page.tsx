'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search, MapPin, Calendar, DollarSign, Send, Check, Clock, Inbox } from 'lucide-react';
import JobStatusBadge from '@/components/contractor/JobStatusBadge';

interface BoardJob {
  id: string;
  job_number: string;
  client_name: string;
  event_name: string | null;
  location_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  pay_rate: number | null;
  ot_rate: number | null;
  dt_rate: number | null;
  rate_type: string;
  union_local: string | null;
  department: string | null;
  benefits_eligible: boolean;
  distance_from_home_miles: number | null;
  poster_username: string;
  my_request_status: string | null;
}

interface Request {
  id: string;
  job_id: string;
  status: string;
  message: string | null;
  poster_note: string | null;
  created_at: string;
  job: { job_number: string; client_name: string; event_name: string | null; start_date: string | null; status: string } | null;
  poster_username: string;
  requester_username: string;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  accepted: 'bg-green-500/20 text-green-300',
  declined: 'bg-red-500/20 text-red-300',
  withdrawn: 'bg-neutral-500/20 text-neutral-400',
};

export default function JobBoardPage() {
  const [view, setView] = useState<'board' | 'incoming' | 'outgoing'>('board');
  const [jobs, setJobs] = useState<BoardJob[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadBoard = useCallback(() => {
    setLoading(true);
    fetch('/api/contractor/board')
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const loadRequests = useCallback((direction: 'incoming' | 'outgoing') => {
    setLoading(true);
    fetch(`/api/contractor/requests?direction=${direction}`)
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (view === 'board') loadBoard();
    else loadRequests(view);
  }, [view, loadBoard, loadRequests]);

  async function sendRequest(jobId: string) {
    setSendingRequest(true);
    const res = await fetch('/api/contractor/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, message: requestMessage.trim() || null }),
    });
    setSendingRequest(false);
    if (res.ok) {
      setRequestingId(null);
      setRequestMessage('');
      loadBoard();
    }
  }

  async function handleAction(reqId: string, status: string) {
    setActionLoading(reqId);
    await fetch(`/api/contractor/requests/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setActionLoading(null);
    loadRequests(view as 'incoming' | 'outgoing');
  }

  const filtered = search
    ? jobs.filter(
        (j) =>
          j.client_name.toLowerCase().includes(search.toLowerCase()) ||
          j.event_name?.toLowerCase().includes(search.toLowerCase()) ||
          j.location_name?.toLowerCase().includes(search.toLowerCase()) ||
          j.union_local?.toLowerCase().includes(search.toLowerCase()) ||
          j.department?.toLowerCase().includes(search.toLowerCase()),
      )
    : jobs;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-2xl font-bold text-neutral-100">Job Board</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-neutral-800" role="tablist" aria-label="Board views">
        {[
          { id: 'board' as const, label: 'Available Jobs', icon: Search },
          { id: 'outgoing' as const, label: 'My Requests', icon: Send },
          { id: 'incoming' as const, label: 'Incoming', icon: Inbox },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={view === t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 ${
              view === t.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <t.icon size={14} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Board view */}
      {view === 'board' && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by client, event, location, union..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2.5 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              aria-label="Search available jobs"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
              {search ? 'No jobs match your search.' : 'No jobs available right now.'}
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Available jobs">
              {filtered.map((job) => (
                <article
                  key={job.id}
                  role="listitem"
                  className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-amber-400">{job.job_number}</span>
                        <JobStatusBadge status={job.status} />
                        {job.union_local && (
                          <span className="text-xs text-neutral-500">{job.union_local}</span>
                        )}
                        {job.department && (
                          <span className="text-xs text-neutral-500">· {job.department}</span>
                        )}
                      </div>
                      <div className="mt-1 text-neutral-100 font-medium">
                        {job.client_name}
                        {job.event_name && (
                          <span className="text-neutral-400 font-normal"> — {job.event_name}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                        {job.location_name && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} aria-hidden="true" /> {job.location_name}
                          </span>
                        )}
                        {job.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} aria-hidden="true" />
                            {new Date(job.start_date + 'T00:00').toLocaleDateString()}
                            {job.end_date && job.end_date !== job.start_date && (
                              <> – {new Date(job.end_date + 'T00:00').toLocaleDateString()}</>
                            )}
                          </span>
                        )}
                        {job.pay_rate && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={11} aria-hidden="true" /> {fmt(job.pay_rate)}/hr
                          </span>
                        )}
                        {job.benefits_eligible && (
                          <span className="text-green-400">Benefits</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Posted by {job.poster_username}
                      </div>
                    </div>

                    {/* Request action */}
                    <div className="shrink-0">
                      {job.my_request_status ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${REQUEST_STATUS_STYLES[job.my_request_status]}`}>
                          {job.my_request_status === 'pending' && <Clock size={12} aria-hidden="true" />}
                          {job.my_request_status === 'accepted' && <Check size={12} aria-hidden="true" />}
                          {job.my_request_status.charAt(0).toUpperCase() + job.my_request_status.slice(1)}
                        </span>
                      ) : requestingId === job.id ? (
                        <div className="space-y-2 w-full sm:w-64">
                          <textarea
                            value={requestMessage}
                            onChange={(e) => setRequestMessage(e.target.value)}
                            placeholder="Optional message to poster..."
                            rows={2}
                            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
                            aria-label="Message to job poster"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => sendRequest(job.id)}
                              disabled={sendingRequest}
                              className="flex-1 flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                            >
                              {sendingRequest ? <Loader2 size={14} className="animate-spin" aria-label="Loading..." /> : <Send size={14} aria-hidden="true" />}
                              Send
                            </button>
                            <button
                              onClick={() => { setRequestingId(null); setRequestMessage(''); }}
                              className="min-h-11 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRequestingId(job.id)}
                          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                        >
                          <Send size={14} aria-hidden="true" /> Request
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Requests views (incoming/outgoing) */}
      {(view === 'incoming' || view === 'outgoing') && (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading..." />
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
              {view === 'incoming' ? 'No incoming requests.' : 'No outgoing requests.'}
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label={view === 'incoming' ? 'Incoming requests' : 'Outgoing requests'}>
              {requests.map((req) => (
                <article
                  key={req.id}
                  role="listitem"
                  className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {req.job && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-amber-400">{req.job.job_number}</span>
                          <span className="text-neutral-100 text-sm font-medium">{req.job.client_name}</span>
                          {req.job.event_name && (
                            <span className="text-neutral-400 text-sm">— {req.job.event_name}</span>
                          )}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-neutral-500">
                        <span>
                          {view === 'incoming' ? `From: ${req.requester_username}` : `To: ${req.poster_username}`}
                        </span>
                        <span>· {new Date(req.created_at).toLocaleDateString()}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${REQUEST_STATUS_STYLES[req.status]}`}>
                          {req.status}
                        </span>
                      </div>
                      {req.message && (
                        <p className="mt-2 text-sm text-neutral-300 bg-neutral-800 rounded-lg px-3 py-2">
                          {req.message}
                        </p>
                      )}
                      {req.poster_note && view === 'outgoing' && (
                        <p className="mt-1 text-sm text-neutral-400 bg-neutral-800/50 rounded-lg px-3 py-2">
                          <span className="text-xs text-neutral-500">Reply: </span>{req.poster_note}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {req.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        {view === 'incoming' ? (
                          <>
                            <button
                              onClick={() => handleAction(req.id, 'accepted')}
                              disabled={actionLoading === req.id}
                              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                              aria-label={`Accept request from ${req.requester_username}`}
                            >
                              <Check size={14} aria-hidden="true" /> Accept
                            </button>
                            <button
                              onClick={() => handleAction(req.id, 'declined')}
                              disabled={actionLoading === req.id}
                              className="min-h-11 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              aria-label={`Decline request from ${req.requester_username}`}
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleAction(req.id, 'withdrawn')}
                            disabled={actionLoading === req.id}
                            className="min-h-11 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            aria-label="Withdraw request"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
