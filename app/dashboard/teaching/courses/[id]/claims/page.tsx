'use client';

// app/dashboard/teaching/courses/[id]/claims/page.tsx
// Teacher: list claims that need a source, paste a DOI/URL to auto-resolve the citation,
// confirm or drop each claim, and see the course's verified source library.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import {
  ChevronLeft, Loader2, Plus, CheckCircle, XCircle, BookCheck, Search, ExternalLink, RotateCcw,
} from 'lucide-react';

interface Source { id: string; in_text: string | null; apa: string | null; doi: string | null; url: string | null; pdf_url: string | null; }
interface Claim {
  id: string; claim_text: string; location: string | null; status: 'unconfirmed' | 'confirmed' | 'dropped';
  notes: string | null; source_id: string | null; course_sources: Source | null;
}
interface Resolved { inText: string; apa: string; doi: string | null; url: string | null; pdfUrl: string | null; }

export default function ClaimsPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  // add-claim
  const [newClaim, setNewClaim] = useState('');
  const [newLoc, setNewLoc] = useState('');

  // per-claim resolve state
  const [openId, setOpenId] = useState<string | null>(null);
  const [doiInput, setDoiInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    offlineFetch(`/api/academy/courses/${courseId}/claims`)
      .then((r) => r.json())
      .then((d) => { setClaims(d.claims ?? []); setSources(d.sources ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(load, [courseId]);

  async function addClaim() {
    if (!newClaim.trim()) return;
    setBusy(true);
    await offlineFetch(`/api/academy/courses/${courseId}/claims`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_text: newClaim.trim(), location: newLoc.trim() || null }),
    });
    setNewClaim(''); setNewLoc(''); setBusy(false); load();
  }

  function startSource(id: string) { setOpenId(id); setDoiInput(''); setResolved(null); setErr(''); }

  async function resolve() {
    if (!doiInput.trim()) return;
    setResolving(true); setErr(''); setResolved(null);
    try {
      const r = await fetch(`/api/academy/sources/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doiInput.includes('http') && !/10\.\d{4,}/.test(doiInput) ? { url: doiInput.trim() } : { doi: doiInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not resolve');
      setResolved(d);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not resolve'); }
    finally { setResolving(false); }
  }

  async function confirmClaim(claimId: string) {
    if (!resolved) return;
    setBusy(true);
    await offlineFetch(`/api/academy/courses/${courseId}/claims`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, action: 'confirm', source: resolved }),
    });
    setOpenId(null); setResolved(null); setDoiInput(''); setBusy(false); load();
  }

  async function act(claimId: string, action: 'drop' | 'reopen') {
    setBusy(true);
    await offlineFetch(`/api/academy/courses/${courseId}/claims`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, action }),
    });
    setBusy(false); load();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" /></div>;

  const unconfirmed = claims.filter((c) => c.status === 'unconfirmed');
  const confirmed = claims.filter((c) => c.status === 'confirmed');
  const dropped = claims.filter((c) => c.status === 'dropped');
  const total = unconfirmed.length + confirmed.length;

  return (
    <div className="text-white">
      <div className="border-b border-gray-800 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href={`/dashboard/teaching/courses/${courseId}`} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm">
          <ChevronLeft className="w-4 h-4" /> Back to course
        </Link>
        <span className="ml-auto text-sm text-gray-400">{confirmed.length} of {total} claims sourced</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-start gap-3 mb-2">
          <BookCheck className="w-6 h-6 text-fuchsia-400 shrink-0 mt-0.5" />
          <h1 className="text-2xl font-bold">Sources and Claims</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8">
          List a claim that needs a source, paste a DOI or link, and the citation fills in. Confirm it to add the source to this course, or drop the claim if no source holds up.
        </p>

        {/* add a claim */}
        <div className="dark-input bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5 mb-8">
          <h2 className="font-semibold mb-3 text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-fuchsia-400" /> Add a claim to verify</h2>
          <textarea value={newClaim} onChange={(e) => setNewClaim(e.target.value)} rows={2} placeholder="The claim as written in the course…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 mb-2" />
          <input value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="Where it appears (e.g. Module 2, Lesson 4)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 mb-3" />
          <button onClick={addClaim} disabled={busy || !newClaim.trim()} className="min-h-11 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-50">Add claim</button>
        </div>

        {/* needs a source */}
        <h2 className="font-semibold text-amber-400 mb-3">Needs a source ({unconfirmed.length})</h2>
        {unconfirmed.length === 0 && <p className="text-gray-500 text-sm mb-8">Nothing pending. Every listed claim has a source.</p>}
        <ul className="space-y-3 mb-10">
          {unconfirmed.map((c) => (
            <li key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-sm">{c.claim_text}</p>
              {c.location && <p className="text-gray-500 text-xs mt-1">{c.location}</p>}
              {openId !== c.id ? (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => startSource(c.id)} className="min-h-11 px-3 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 flex items-center gap-1.5"><Search className="w-4 h-4" /> Add source</button>
                  <button onClick={() => act(c.id, 'drop')} disabled={busy} className="min-h-11 px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Drop</button>
                </div>
              ) : (
                <div className="mt-3 border-t border-gray-800 pt-3">
                  <div className="flex gap-2">
                    <input value={doiInput} onChange={(e) => setDoiInput(e.target.value)} placeholder="Paste a DOI (10.xxxx/…) or a link"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500" />
                    <button onClick={resolve} disabled={resolving || !doiInput.trim()} className="min-h-11 px-3 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
                      {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resolve'}
                    </button>
                  </div>
                  {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
                  {resolved && (
                    <div className="mt-3 bg-gray-800/60 rounded-lg p-3">
                      <p className="text-xs text-gray-400">In-text: <span className="text-white">{resolved.inText}</span></p>
                      <p className="text-sm text-gray-200 mt-1">{resolved.apa}</p>
                      <div className="flex gap-3 mt-2 text-xs">
                        {resolved.url && <a href={resolved.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open</a>}
                        {resolved.pdfUrl && <a href={resolved.pdfUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Free PDF</a>}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => confirmClaim(c.id)} disabled={busy} className="min-h-11 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Confirm with this source</button>
                        <button onClick={() => { setOpenId(null); setResolved(null); }} className="min-h-11 px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* confirmed */}
        <h2 className="font-semibold text-green-400 mb-3">Confirmed ({confirmed.length})</h2>
        <ul className="space-y-3 mb-10">
          {confirmed.map((c) => (
            <li key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-sm">{c.claim_text}</p>
              {c.course_sources?.apa && <p className="text-gray-400 text-xs mt-2">{c.course_sources.in_text} {c.course_sources.apa}</p>}
              <div className="flex gap-3 mt-2 text-xs items-center">
                {c.course_sources?.url && <a href={c.course_sources.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open</a>}
                <button onClick={() => act(c.id, 'reopen')} disabled={busy} className="text-gray-500 hover:text-gray-300 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reopen</button>
              </div>
            </li>
          ))}
          {confirmed.length === 0 && <li className="text-gray-500 text-sm">None yet.</li>}
        </ul>

        {/* dropped */}
        {dropped.length > 0 && (
          <details className="mb-10">
            <summary className="font-semibold text-gray-400 cursor-pointer">Dropped ({dropped.length})</summary>
            <ul className="space-y-2 mt-3">
              {dropped.map((c) => (
                <li key={c.id} className="text-sm text-gray-500 flex items-center justify-between gap-3">
                  <span className="line-through">{c.claim_text}</span>
                  <button onClick={() => act(c.id, 'reopen')} className="text-gray-500 hover:text-gray-300 shrink-0"><RotateCcw className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* verified sources */}
        <h2 className="font-semibold mb-3">Verified sources ({sources.length})</h2>
        <ul className="space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="text-sm text-gray-300">
              {s.apa} {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline ml-1">link</a>}
            </li>
          ))}
          {sources.length === 0 && <li className="text-gray-500 text-sm">No sources added yet.</li>}
        </ul>
      </div>
    </div>
  );
}
