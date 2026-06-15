'use client';

// components/academy/OptionalEmailCapture.tsx
// Optional, no-pressure email capture shown AFTER a free download. The download already
// happened; this never gates it. The copy makes clear it is optional and that the
// resource is free with no email required, per BAM's stance: do not collect emails from
// people who just want the free stuff.

import { useState } from 'react';
import { ensureLeadSession } from '@/lib/lead/session';

interface Props {
  courseId?: string | null;
  sourceDocument?: string | null;
}

export default function OptionalEmailCapture({ courseId, sourceDocument }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    try {
      ensureLeadSession();
      await fetch('/api/academy/lead-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), course_id: courseId ?? null, source_document: sourceDocument ?? null }),
      });
    } catch { /* optional, never block */ }
    setStatus('done');
  }

  if (status === 'done') {
    return (
      <p className="mt-3 text-sm text-gray-600" role="status">
        Thanks, that is all we needed. Enjoy the resource.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <p className="text-sm text-gray-700">
        Your download is on its way, free, with no email required. This is completely
        optional. If you would like the occasional update, you can leave your email. If not,
        just skip it and enjoy the resource.
      </p>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <label htmlFor="lead-email" className="sr-only">Email (optional)</label>
        <input
          id="lead-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com (optional)"
          className="flex-1 min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={status === 'sending' || !email.trim()}
          className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'sending' ? 'Sending…' : 'Send (optional)'}
        </button>
      </div>
    </form>
  );
}
