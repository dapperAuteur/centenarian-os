'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Clock, DollarSign, Car,
  FolderOpen, Phone, MessageSquare, Camera, Receipt,
  Trash2, Edit2, Check, X, Zap, Globe, Lock,
} from 'lucide-react';
import JobStatusBadge from '@/components/contractor/JobStatusBadge';
import JobSummaryCards from '@/components/contractor/JobSummaryCards';
import QuickLogModal from '@/components/contractor/QuickLogModal';

/* ─── Types ─────────────────────────────────────────────── */
interface Job {
  id: string;
  job_number: string;
  client_name: string;
  event_name: string | null;
  location_name: string | null;
  poc_name: string | null;
  poc_phone: string | null;
  crew_coordinator_name: string | null;
  crew_coordinator_phone: string | null;
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
  travel_benefits: Record<string, number>;
  est_pay_date: string | null;
  distance_from_home_miles: number | null;
  is_public: boolean;
  share_contacts: boolean;
  notes: string | null;
  _counts: {
    time_entries: number;
    invoices: number;
    trips: number;
    expenses: number;
    documents: number;
  };
}

interface TimeEntry {
  id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  adjusted_in: string | null;
  adjusted_out: string | null;
  total_hours: number | null;
  st_hours: number | null;
  ot_hours: number | null;
  dt_hours: number | null;
  meal_provided: boolean;
  invoice_id: string | null;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  status: string;
  total: number;
  invoice_date: string;
  custom_fields: Record<string, string>;
}

interface Summary {
  days_worked: number;
  total_hours: number;
  total_invoiced: number;
  total_paid: number;
  pending_invoices: number;
  total_miles: number;
  total_expenses: number;
  net_earnings: number;
}

interface Document {
  id: string;
  name: string;
  url: string;
  doc_type: string;
  created_at: string;
}

/* ─── Tabs ──────────────────────────────────────────────── */
const TABS = [
  { id: 'time', label: 'Time', icon: Clock },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'expenses', label: 'Expenses', icon: DollarSign },
  { id: 'mileage', label: 'Mileage', icon: Car },
  { id: 'documents', label: 'Docs', icon: FolderOpen },
  { id: 'contacts', label: 'Contacts', icon: Phone },
];

const STATUS_ORDER = ['assigned', 'confirmed', 'in_progress', 'completed', 'invoiced', 'paid', 'cancelled'];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('time');
  const [generating, setGenerating] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [statusEditing, setStatusEditing] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const loadJob = useCallback(async () => {
    const [jobRes, summaryRes, timeRes, invoiceRes, docRes] = await Promise.all([
      fetch(`/api/contractor/jobs/${id}`),
      fetch(`/api/contractor/jobs/${id}/summary`),
      fetch(`/api/contractor/jobs/${id}/time-entries`),
      fetch(`/api/finance/invoices?job_id=${id}`),
      fetch(`/api/contractor/jobs/${id}/documents`),
    ]);
    const [jobData, summaryData, timeData, invoiceData, docData] = await Promise.all([
      jobRes.json(), summaryRes.json(), timeRes.json(), invoiceRes.json(), docRes.json(),
    ]);
    setJob(jobData);
    setSummary(summaryData);
    setTimeEntries(timeData.time_entries ?? []);
    setInvoices(invoiceData.invoices ?? []);
    setDocuments(docData.documents ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadJob(); }, [loadJob]);

  /* ─── Time Entry Form ───────────────────────────────── */
  const [teForm, setTeForm] = useState({ work_date: '', time_in: '', time_out: '', total_hours: '', st_hours: '', ot_hours: '', notes: '' });
  const [teSaving, setTeSaving] = useState(false);

  async function addTimeEntry(e: React.FormEvent) {
    e.preventDefault();
    setTeSaving(true);
    const res = await fetch(`/api/contractor/jobs/${id}/time-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_date: teForm.work_date,
        total_hours: teForm.total_hours ? parseFloat(teForm.total_hours) : null,
        st_hours: teForm.st_hours ? parseFloat(teForm.st_hours) : null,
        ot_hours: teForm.ot_hours ? parseFloat(teForm.ot_hours) : null,
        notes: teForm.notes || null,
      }),
    });
    setTeSaving(false);
    if (res.ok) {
      setTeForm({ work_date: '', time_in: '', time_out: '', total_hours: '', st_hours: '', ot_hours: '', notes: '' });
      loadJob();
    }
  }

  async function deleteTimeEntry(entryId: string) {
    await fetch(`/api/contractor/jobs/${id}/time-entries/${entryId}`, { method: 'DELETE' });
    loadJob();
  }

  /* ─── Generate Invoice ──────────────────────────────── */
  async function generateInvoice(entryId?: string) {
    setGenerating(true);
    await fetch(`/api/contractor/jobs/${id}/generate-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryId ? { entry_id: entryId } : {}),
    });
    setGenerating(false);
    loadJob();
  }

  /* ─── Toggle Public / Share Contacts ────────────────── */
  async function togglePublic() {
    const newVal = !job?.is_public;
    await fetch(`/api/contractor/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: newVal }),
    });
    loadJob();
  }

  async function toggleShareContacts() {
    const newVal = !job?.share_contacts;
    await fetch(`/api/contractor/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_contacts: newVal }),
    });
    loadJob();
  }

  /* ─── Status Update ─────────────────────────────────── */
  async function updateStatus() {
    await fetch(`/api/contractor/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatusEditing(false);
    loadJob();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-neutral-500" size={32} aria-label="Loading job details" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center text-neutral-500">
        Job not found. <Link href="/dashboard/contractor" className="text-amber-400">Go back</Link>
      </div>
    );
  }

  const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none';
  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtTime = (ts: string | null) => ts ? new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Header */}
      <Link href="/dashboard/contractor" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 min-h-11 py-2" aria-label="Back to Jobs">
        <ArrowLeft size={14} aria-hidden="true" /> Jobs
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-amber-400">{job.job_number}</span>
            {statusEditing ? (
              <div className="flex items-center gap-1">
                <select
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  aria-label="Change job status"
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
                <button onClick={updateStatus} className="p-2 text-green-400 hover:text-green-300 min-h-11 min-w-11 flex items-center justify-center" aria-label="Confirm status change"><Check size={16} /></button>
                <button onClick={() => setStatusEditing(false)} className="p-2 text-neutral-500 hover:text-neutral-300 min-h-11 min-w-11 flex items-center justify-center" aria-label="Cancel status change"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => { setNewStatus(job.status); setStatusEditing(true); }} aria-label={`Change job status, currently ${job.status.replace('_', ' ')}`} className="min-h-11 flex items-center">
                <JobStatusBadge status={job.status} />
              </button>
            )}
          </div>
          <h1 className="text-xl font-bold text-neutral-100 mt-1">
            {job.client_name}
            {job.event_name && <span className="text-neutral-400 font-normal"> — {job.event_name}</span>}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500 mt-1">
            {job.location_name && <span>{job.location_name}</span>}
            {job.union_local && <span>{job.union_local}</span>}
            {job.department && <span>{job.department}</span>}
            {job.start_date && <span>{new Date(job.start_date + 'T00:00').toLocaleDateString()}{job.end_date && job.end_date !== job.start_date ? ` – ${new Date(job.end_date + 'T00:00').toLocaleDateString()}` : ''}</span>}
            {job.pay_rate && <span>{fmt(job.pay_rate)}/hr</span>}
            {job.est_pay_date && <span>Est. pay: {new Date(job.est_pay_date + 'T00:00').toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setQuickLogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-500 min-h-11"
            aria-label="Quick log hours, expenses, and mileage"
          >
            <Zap size={14} aria-hidden="true" /> Quick Log
          </button>
          <Link
            href={`/dashboard/contractor/jobs/${id}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
            aria-label="Edit job details"
          >
            <Edit2 size={14} aria-hidden="true" /> Edit
          </Link>
          <button
            onClick={togglePublic}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              job.is_public
                ? 'border-green-600/50 text-green-400 hover:bg-green-600/10'
                : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800'
            }`}
            aria-label={job.is_public ? 'Job is public — click to make private' : 'Job is private — click to post on board'}
            title={job.is_public ? 'Posted on board — click to make private' : 'Click to post on job board'}
          >
            {job.is_public ? <Globe size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
            <span className="hidden sm:inline">{job.is_public ? 'Public' : 'Private'}</span>
          </button>
        </div>

        {/* Share controls — shown when job is public */}
        {job.is_public && (
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>This job is visible on the board.</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={job.share_contacts}
                onChange={toggleShareContacts}
                className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-neutral-950"
                aria-label="Share contacts with accepted replacement"
              />
              <span className="text-neutral-400">Share contacts when accepted</span>
            </label>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary && <JobSummaryCards summary={summary} />}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-800 pb-0" role="tablist" aria-label="Job details sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors min-h-11 ${
              tab === t.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <t.icon size={14} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'time' && (
        <div className="space-y-4">
          {/* Add Time Entry Form */}
          <form onSubmit={addTimeEntry} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3" aria-label="Add time entry">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end lg:gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="te-date" className="block text-sm text-neutral-400 mb-1">Date <span aria-hidden="true">*</span></label>
                <input id="te-date" type="date" className={inputClass} value={teForm.work_date} onChange={(e) => setTeForm(p => ({ ...p, work_date: e.target.value }))} required aria-required="true" />
              </div>
              <div>
                <label htmlFor="te-total" className="block text-sm text-neutral-400 mb-1">Total Hrs</label>
                <input id="te-total" type="number" step="0.25" className={inputClass} value={teForm.total_hours} onChange={(e) => setTeForm(p => ({ ...p, total_hours: e.target.value }))} aria-label="Total hours" />
              </div>
              <div>
                <label htmlFor="te-st" className="block text-sm text-neutral-400 mb-1">ST Hrs</label>
                <input id="te-st" type="number" step="0.25" className={inputClass} value={teForm.st_hours} onChange={(e) => setTeForm(p => ({ ...p, st_hours: e.target.value }))} aria-label="Straight time hours" />
              </div>
              <div>
                <label htmlFor="te-ot" className="block text-sm text-neutral-400 mb-1">OT Hrs</label>
                <input id="te-ot" type="number" step="0.25" className={inputClass} value={teForm.ot_hours} onChange={(e) => setTeForm(p => ({ ...p, ot_hours: e.target.value }))} aria-label="Overtime hours" />
              </div>
              <div className="col-span-2 sm:col-span-1 sm:flex-1 sm:min-w-30">
                <label htmlFor="te-notes" className="block text-sm text-neutral-400 mb-1">Notes</label>
                <input id="te-notes" className={inputClass} placeholder="Optional" value={teForm.notes} onChange={(e) => setTeForm(p => ({ ...p, notes: e.target.value }))} aria-label="Time entry notes" />
              </div>
            </div>
            <button type="submit" disabled={teSaving} className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 min-h-11 w-full sm:w-auto">
              {teSaving ? <Loader2 size={14} className="animate-spin" aria-label="Saving" /> : 'Add Entry'}
            </button>
          </form>

          {/* Time Entries List */}
          {timeEntries.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">No time entries yet.</p>
          ) : (
            <>
            {/* Mobile card view */}
            <div className="space-y-2 lg:hidden">
              {timeEntries.map((te) => (
                <div key={te.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-100">{new Date(te.work_date + 'T00:00').toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      {te.invoice_id ? (
                        <Link href={`/dashboard/finance/invoices/${te.invoice_id}`} className="text-xs text-green-400 hover:underline px-2 py-1" aria-label="View invoice">View Invoice</Link>
                      ) : (
                        <button onClick={() => generateInvoice(te.id)} disabled={generating} className="text-xs text-amber-400 hover:underline px-2 py-1 min-h-11 flex items-center" aria-label={`Generate invoice for ${new Date(te.work_date + 'T00:00').toLocaleDateString()}`}>
                          Generate
                        </button>
                      )}
                      <button onClick={() => deleteTimeEntry(te.id)} className="p-2 text-neutral-500 hover:text-red-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Delete time entry for ${new Date(te.work_date + 'T00:00').toLocaleDateString()}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><span className="text-neutral-500 text-xs">Total</span><div className="text-neutral-100 font-medium">{te.total_hours ?? '—'}h</div></div>
                    <div><span className="text-neutral-500 text-xs">ST</span><div className="text-neutral-400">{te.st_hours ?? '—'}h</div></div>
                    <div><span className="text-neutral-500 text-xs">OT</span><div className="text-neutral-400">{te.ot_hours ?? '—'}h</div></div>
                  </div>
                  {(te.time_in || te.time_out) && (
                    <div className="text-xs text-neutral-500">
                      {fmtTime(te.adjusted_in || te.time_in)} – {fmtTime(te.adjusted_out || te.time_out)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm" aria-label="Time entries">
                <thead className="text-neutral-500 text-xs border-b border-neutral-800">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">Date</th>
                    <th scope="col" className="px-3 py-2 text-right">In</th>
                    <th scope="col" className="px-3 py-2 text-right">Out</th>
                    <th scope="col" className="px-3 py-2 text-right">Total</th>
                    <th scope="col" className="px-3 py-2 text-right">ST</th>
                    <th scope="col" className="px-3 py-2 text-right">OT</th>
                    <th scope="col" className="px-3 py-2 text-center">Invoice</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((te) => (
                    <tr key={te.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                      <td className="px-3 py-2 text-neutral-100">{new Date(te.work_date + 'T00:00').toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right text-neutral-400">{fmtTime(te.adjusted_in || te.time_in)}</td>
                      <td className="px-3 py-2 text-right text-neutral-400">{fmtTime(te.adjusted_out || te.time_out)}</td>
                      <td className="px-3 py-2 text-right text-neutral-100 font-medium">{te.total_hours ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-neutral-400">{te.st_hours ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-neutral-400">{te.ot_hours ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {te.invoice_id ? (
                          <Link href={`/dashboard/finance/invoices/${te.invoice_id}`} className="text-xs text-green-400 hover:underline" aria-label="View invoice">View</Link>
                        ) : (
                          <button
                            onClick={() => generateInvoice(te.id)}
                            disabled={generating}
                            className="text-xs text-amber-400 hover:underline disabled:opacity-50"
                            aria-label={`Generate invoice for ${new Date(te.work_date + 'T00:00').toLocaleDateString()}`}
                          >
                            Generate
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => deleteTimeEntry(te.id)} className="p-2 text-neutral-600 hover:text-red-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Delete time entry for ${new Date(te.work_date + 'T00:00').toLocaleDateString()}`}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Bulk Generate */}
          {timeEntries.some((te) => !te.invoice_id) && (
            <button
              onClick={() => generateInvoice()}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg border border-amber-600/50 px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-600/10 disabled:opacity-50 min-h-11"
              aria-label="Generate invoices for all uninvoiced time entries"
            >
              <Receipt size={14} aria-hidden="true" />
              {generating ? 'Generating...' : 'Generate All Invoices'}
            </button>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">No invoices linked to this job.</p>
          ) : (
            invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/dashboard/finance/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700"
              >
                <div>
                  <span className="font-mono text-sm text-neutral-100">{inv.invoice_number || inv.id.slice(0, 8)}</span>
                  <span className={`ml-2 text-xs ${inv.status === 'paid' ? 'text-green-400' : inv.status === 'draft' ? 'text-neutral-500' : 'text-yellow-400'}`}>
                    {inv.status}
                  </span>
                  {inv.custom_fields?.work_date && (
                    <span className="ml-2 text-xs text-neutral-500">{inv.custom_fields.work_date}</span>
                  )}
                </div>
                <span className="text-neutral-100 font-medium">{fmt(inv.total)}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'expenses' && (
        <div className="text-center py-6">
          <p className="text-sm text-neutral-500 mb-2">View expenses linked to this job in the Finance module.</p>
          <Link href={`/dashboard/finance?job_id=${id}`} className="text-sm text-amber-400 hover:underline">
            Open Finance <DollarSign size={12} className="inline" aria-hidden="true" />
          </Link>
        </div>
      )}

      {tab === 'mileage' && (
        <div className="text-center py-6">
          <p className="text-sm text-neutral-500 mb-2">View trips linked to this job in the Travel module.</p>
          <Link href={`/dashboard/travel?job_id=${id}`} className="text-sm text-amber-400 hover:underline">
            Open Travel <Car size={12} className="inline" aria-hidden="true" />
          </Link>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">No documents uploaded yet.</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:underline truncate">
                  {doc.name}
                </a>
                <span className="text-xs text-neutral-500 ml-2">{doc.doc_type}</span>
              </div>
            ))
          )}
          {/* Upload placeholder — Cloudinary upload widget would go here */}
          <p className="text-xs text-neutral-600 text-center">
            Document upload via Cloudinary widget coming soon.
          </p>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-3">
          {job.poc_name && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div>
                <div className="text-xs text-neutral-500">Point of Contact</div>
                <div className="text-neutral-100 font-medium">{job.poc_name}</div>
              </div>
              {job.poc_phone && (
                <div className="flex gap-2">
                  <a href={`tel:${job.poc_phone}`} className="rounded-full bg-neutral-800 p-3 text-neutral-400 hover:text-green-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Call ${job.poc_name}`}>
                    <Phone size={16} aria-hidden="true" />
                  </a>
                  <a href={`sms:${job.poc_phone}`} className="rounded-full bg-neutral-800 p-3 text-neutral-400 hover:text-blue-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Text ${job.poc_name}`}>
                    <MessageSquare size={16} aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          )}
          {job.crew_coordinator_name && (
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div>
                <div className="text-xs text-neutral-500">Crew Coordinator</div>
                <div className="text-neutral-100 font-medium">{job.crew_coordinator_name}</div>
              </div>
              {job.crew_coordinator_phone && (
                <div className="flex gap-2">
                  <a href={`tel:${job.crew_coordinator_phone}`} className="rounded-full bg-neutral-800 p-3 text-neutral-400 hover:text-green-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Call ${job.crew_coordinator_name}`}>
                    <Phone size={16} aria-hidden="true" />
                  </a>
                  <a href={`sms:${job.crew_coordinator_phone}`} className="rounded-full bg-neutral-800 p-3 text-neutral-400 hover:text-blue-400 min-h-11 min-w-11 flex items-center justify-center" aria-label={`Text ${job.crew_coordinator_name}`}>
                    <MessageSquare size={16} aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          )}
          {!job.poc_name && !job.crew_coordinator_name && (
            <p className="text-sm text-neutral-500 text-center py-6">No contacts set for this job.</p>
          )}
        </div>
      )}

      {/* Scan Pay Stub Button */}
      <div className="flex justify-center pt-4 border-t border-neutral-800">
        <button
          onClick={() => {/* TODO: Open scan modal */}}
          className="flex items-center gap-2 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 min-h-11"
          aria-label="Scan pay stub to auto-fill time entry"
        >
          <Camera size={16} aria-hidden="true" /> Scan Pay Stub
        </button>
      </div>

      {/* Quick Log Modal */}
      <QuickLogModal
        isOpen={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        jobId={id}
        jobNumber={job.job_number}
        onLogged={loadJob}
      />
    </div>
  );
}
