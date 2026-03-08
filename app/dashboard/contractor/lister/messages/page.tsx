'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Send, Inbox, Mail, MailOpen, Trash2, X,
  ChevronDown, Users as UsersIcon,
} from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  group_id: string | null;
  subject: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
  sender_username?: string;
  recipient_username?: string;
  group_name?: string | null;
}

interface Group {
  id: string;
  name: string;
  member_count: number;
}

interface RosterContact {
  id: string;
  name: string;
  linked_user_id: string | null;
  username: string | null;
}

export default function ListerMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [roster, setRoster] = useState<RosterContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    mode: 'individual' as 'individual' | 'group',
    recipient_id: '',
    group_id: '',
    subject: '',
    body: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, gRes, rRes] = await Promise.all([
      fetch(`/api/contractor/lister/messages?folder=${folder}`).then((r) => r.json()),
      fetch('/api/contractor/lister/groups').then((r) => r.json()),
      fetch('/api/contractor/roster').then((r) => r.json()),
    ]);
    setMessages(mRes.messages ?? []);
    setGroups(gRes.groups ?? []);
    setRoster(rRes.roster ?? []);
    setLoading(false);
  }, [folder]);

  useEffect(() => { load(); }, [load]);

  async function sendMessage() {
    if (!form.body.trim()) return;
    setSending(true);
    const payload: Record<string, unknown> = {
      subject: form.subject.trim() || null,
      body: form.body.trim(),
    };
    if (form.mode === 'individual') {
      payload.recipient_id = form.recipient_id;
    } else {
      payload.group_id = form.group_id;
    }

    const res = await fetch('/api/contractor/lister/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSending(false);
    if (res.ok) {
      setShowCompose(false);
      setForm({ mode: 'individual', recipient_id: '', group_id: '', subject: '', body: '' });
      setFolder('sent');
      load();
    }
  }

  async function deleteMessage(id: string) {
    setDeletingId(id);
    await fetch(`/api/contractor/lister/messages/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    load();
  }

  async function markRead(id: string) {
    await fetch(`/api/contractor/lister/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    });
    load();
  }

  const assignableContacts = roster.filter((c) => c.linked_user_id);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-100">Messages</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          <Send size={14} /> Compose
        </button>
      </div>

      {/* Folder tabs */}
      <div className="flex gap-1 border-b border-neutral-800" role="tablist" aria-label="Message folders">
        {[
          { id: 'inbox' as const, label: 'Inbox', icon: Inbox },
          { id: 'sent' as const, label: 'Sent', icon: Send },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={folder === t.id}
              onClick={() => setFolder(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
                folder === t.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Compose form */}
      {showCompose && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">New Message</h2>
            <button onClick={() => setShowCompose(false)} className="rounded p-1 text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {[
              { id: 'individual' as const, label: 'Individual', icon: Mail },
              { id: 'group' as const, label: 'Group', icon: UsersIcon },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setForm({ ...form, mode: id })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  form.mode === id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {form.mode === 'individual' ? (
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">To *</span>
              <div className="relative mt-1">
                <select
                  value={form.recipient_id}
                  onChange={(e) => setForm({ ...form, recipient_id: e.target.value })}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 pr-8 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 appearance-none"
                >
                  <option value="">Select recipient...</option>
                  {assignableContacts.map((c) => (
                    <option key={c.id} value={c.linked_user_id!}>{c.name}{c.username ? ` (@${c.username})` : ''}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              </div>
            </label>
          ) : (
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Group *</span>
              <div className="relative mt-1">
                <select
                  value={form.group_id}
                  onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 pr-8 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 appearance-none"
                >
                  <option value="">Select group...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.member_count} members)</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              </div>
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Subject</span>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="Job offer for upcoming event"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Message *</span>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
              placeholder="Write your message..."
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={sendMessage}
              disabled={sending || !form.body.trim() || (form.mode === 'individual' ? !form.recipient_id : !form.group_id)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button onClick={() => setShowCompose(false)}
              className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading" />
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          {folder === 'inbox' ? 'No messages in your inbox.' : 'No sent messages.'}
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label={`${folder} messages`}>
          {messages.map((m) => {
            const isUnread = folder === 'inbox' && !m.is_read;
            return (
              <article
                key={m.id}
                role="listitem"
                className={`rounded-xl border bg-neutral-900 p-4 ${isUnread ? 'border-indigo-700/50' : 'border-neutral-800'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1" onClick={() => isUnread && markRead(m.id)} role={isUnread ? 'button' : undefined} tabIndex={isUnread ? 0 : undefined}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnread ? (
                        <Mail size={14} className="text-indigo-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <MailOpen size={14} className="text-neutral-500 shrink-0" aria-hidden="true" />
                      )}
                      {m.subject && <span className={`text-sm font-medium ${isUnread ? 'text-neutral-100' : 'text-neutral-300'}`}>{m.subject}</span>}
                      {m.group_name && (
                        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">{m.group_name}</span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm ${isUnread ? 'text-neutral-200' : 'text-neutral-400'} line-clamp-2`}>{m.body}</p>
                    <div className="mt-1 text-xs text-neutral-500 flex gap-2">
                      {folder === 'inbox' ? (
                        <span>From: {m.sender_username ?? 'Unknown'}</span>
                      ) : (
                        <span>To: {m.recipient_username ?? m.group_name ?? 'Unknown'}</span>
                      )}
                      <span>· {new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {folder === 'sent' && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      disabled={deletingId === m.id}
                      className="rounded p-1.5 text-neutral-500 hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      aria-label="Delete message"
                    >
                      {deletingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
