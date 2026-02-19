'use client';

// app/admin/messages/page.tsx
// Admin compose and send messages to users

import { useEffect, useState } from 'react';
import { Send, Users, CheckCircle, AlertTriangle } from 'lucide-react';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'free', label: 'Free tier only' },
  { value: 'monthly', label: 'Monthly subscribers' },
  { value: 'lifetime', label: 'Lifetime members' },
  { value: 'user', label: 'Specific user (by email)' },
] as const;

interface SentMessage {
  id: string;
  subject: string;
  body: string;
  recipient_scope: string;
  created_at: string;
  message_reads: [{ count: number }];
}

export default function AdminMessagesPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [sent, setSent] = useState<SentMessage[]>([]);

  useEffect(() => {
    fetch('/api/admin/messages')
      .then((r) => r.json())
      .then((d) => setSent(d.messages ?? []));
  }, []);

  async function lookupUser() {
    if (!targetEmail) return;
    setLookingUp(true);
    setTargetId(null);
    try {
      const res = await fetch(`/api/admin/users`);
      const d = await res.json();
      const found = (d.users ?? []).find((u: { email: string; id: string }) =>
        u.email?.toLowerCase() === targetEmail.toLowerCase()
      );
      if (found) {
        setTargetId(found.id);
      } else {
        setResult({ type: 'err', text: 'No user found with that email.' });
      }
    } catch {
      setResult({ type: 'err', text: 'Lookup failed.' });
    } finally {
      setLookingUp(false);
    }
  }

  async function sendMessage() {
    if (!subject.trim() || !body.trim()) {
      setResult({ type: 'err', text: 'Subject and body are required.' });
      return;
    }
    if (scope === 'user' && !targetId) {
      setResult({ type: 'err', text: 'Look up a user first.' });
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, body,
          recipient_scope: scope,
          recipient_user_id: scope === 'user' ? targetId : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setResult({ type: 'ok', text: `Sent to ${d.sent} / ${d.total} recipients.` });
      setSubject('');
      setBody('');
      // Refresh sent list
      fetch('/api/admin/messages').then((r) => r.json()).then((d) => setSent(d.messages ?? []));
    } catch (e) {
      setResult({ type: 'err', text: e instanceof Error ? e.message : 'Failed to send' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Messages</h1>
      <p className="text-gray-400 text-sm mb-8">Send in-app notifications + emails to your users.</p>

      {/* Compose */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="font-semibold text-white mb-4">Compose Message</h2>

        {/* Recipient scope */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recipients</label>
          <div className="flex flex-wrap gap-2">
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setScope(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${scope === o.value ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* User lookup */}
        {scope === 'user' && (
          <div className="mb-4 flex gap-2">
            <input
              type="email"
              placeholder="user@example.com"
              value={targetEmail}
              onChange={(e) => { setTargetEmail(e.target.value); setTargetId(null); }}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
            />
            <button
              onClick={lookupUser}
              disabled={lookingUp}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-600 transition disabled:opacity-50"
            >
              {lookingUp ? 'Looking up…' : 'Look up'}
            </button>
            {targetId && <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="w-3 h-3" /> Found</span>}
          </div>
        )}

        {/* Subject */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Important update from CentenarianOS"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
          />
        </div>

        {/* Body */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write your message here…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 resize-none"
          />
        </div>

        {result && (
          <div className={`flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm ${result.type === 'ok' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
            {result.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {result.text}
          </div>
        )}

        <button
          onClick={sendMessage}
          disabled={sending}
          className="flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition font-semibold text-sm disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending…' : 'Send Message'}
        </button>
      </div>

      {/* Sent messages */}
      <h2 className="font-semibold text-white mb-3">Sent Messages</h2>
      {sent.length === 0 ? (
        <p className="text-gray-600 text-sm">No messages sent yet.</p>
      ) : (
        <div className="space-y-3">
          {sent.map((m) => (
            <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white text-sm">{m.subject}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    To: <span className="text-gray-400">{m.recipient_scope}</span> · {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                  <Users className="w-3 h-3" />
                  {m.message_reads?.[0]?.count ?? 0} read
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-2 line-clamp-2">{m.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
