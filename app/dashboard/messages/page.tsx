'use client';

// app/dashboard/messages/page.tsx
// User message inbox — shows admin messages with two-way reply threads.

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCircle, Send, Loader2 } from 'lucide-react';
import MediaUploader from '@/components/ui/MediaUploader';

interface Message {
  id: string;
  subject: string;
  body: string;
  recipient_scope: string;
  created_at: string;
  is_read: boolean;
}

interface Reply {
  id: string;
  is_admin: boolean;
  body: string;
  media_url?: string | null;
  created_at: string;
}

interface ThreadState {
  replies: Reply[];
  loaded: boolean;
}

function MediaPreview({ url }: { url: string }) {
  const isVideo = /\.(mp4|webm|mov|avi)/i.test(url) || url.includes('/video/');
  return isVideo
    ? <video src={url} className="max-h-40 rounded-lg border border-gray-200 mt-2" controls />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={url} alt="attachment" className="max-h-40 rounded-lg border border-gray-200 mt-2 object-contain" />;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyMedia, setReplyMedia] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/messages')
      .then((r) => r.json())
      .then((d) => { setMessages(d.messages ?? []); setLoading(false); });
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin ?? false))
      .catch(() => {});
  }, []);

  const openMessage = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    // Mark as read
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.is_read) {
      await fetch(`/api/messages/${id}/read`, { method: 'POST' });
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_read: true } : m));
    }
    // Load thread
    if (!threads[id]?.loaded) {
      const r = await fetch(`/api/messages/${id}/replies`);
      const d = await r.json();
      setThreads((prev) => ({ ...prev, [id]: { replies: d.replies ?? [], loaded: true } }));
    }
  }, [expanded, messages, threads]);

  async function sendReply(id: string) {
    const body = (replyText[id] ?? '').trim();
    if (!body) return;
    setSending(id);
    setSendError((prev) => ({ ...prev, [id]: '' }));
    try {
      const r = await fetch(`/api/messages/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, media_url: replyMedia[id] || null }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
      // Optimistically add — use isAdmin flag for correct attribution
      const newReply: Reply = {
        id: Date.now().toString(),
        is_admin: isAdmin,
        body,
        media_url: replyMedia[id] || null,
        created_at: new Date().toISOString(),
      };
      setThreads((prev) => ({
        ...prev,
        [id]: { ...prev[id], replies: [...(prev[id]?.replies ?? []), newReply] },
      }));
      setReplyText((prev) => ({ ...prev, [id]: '' }));
      setReplyMedia((prev) => ({ ...prev, [id]: null }));
    } catch (e) {
      setSendError((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : 'Failed to send' }));
    } finally {
      setSending(null);
    }
  }

  // Context-aware reply perspective:
  // Admin viewing: their replies (is_admin=true) are "mine" → right side
  // User viewing:  their replies (is_admin=false) are "mine" → right side
  function getReplyMeta(reply: Reply) {
    const isMine = isAdmin ? reply.is_admin : !reply.is_admin;
    const label = isMine ? 'You' : (reply.is_admin ? 'CentenarianOS Team' : 'Member');
    return { isMine, label };
  }

  const unread = messages.filter((m) => !m.is_read).length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-2">
        <Bell className="w-6 h-6 text-fuchsia-600" />
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        {unread > 0 && (
          <span className="px-2 py-0.5 bg-fuchsia-600 text-white text-xs font-bold rounded-full">{unread} new</span>
        )}
      </div>
      <p className="text-gray-500 mb-8">Messages from the CentenarianOS team. You can reply to any message.</p>

      {messages.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No messages yet. Check back later!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const isOpen = expanded === m.id;
            const thread = threads[m.id];
            return (
              <div
                key={m.id}
                className={`rounded-2xl border transition ${m.is_read ? 'bg-white border-gray-200' : 'bg-fuchsia-50 border-fuchsia-200'}`}
              >
                {/* Header — click to toggle */}
                <button
                  type="button"
                  className="w-full flex items-start gap-3 p-5 text-left"
                  onClick={() => openMessage(m.id)}
                >
                  {!m.is_read && <div className="w-2 h-2 rounded-full bg-fuchsia-600 mt-1.5 shrink-0" />}
                  {m.is_read && <CheckCircle className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-0.5">
                      <p className={`font-semibold truncate ${m.is_read ? 'text-gray-700' : 'text-gray-900'}`}>{m.subject}</p>
                      <p className="text-xs text-gray-400 shrink-0">{new Date(m.created_at).toLocaleDateString()}</p>
                    </div>
                    {!isOpen && (
                      <p className="text-sm text-gray-500 truncate">
                        {m.body.startsWith('<') ? m.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : m.body.split('\n')[0]}
                      </p>
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                    {/* Original message body */}
                    {m.body.startsWith('<') ? (
                      <div
                        className="prose prose-sm max-w-none text-gray-700"
                        dangerouslySetInnerHTML={{ __html: m.body }}
                      />
                    ) : (
                      <div>
                        {m.body.split('\n').map((line, i) =>
                          line.trim() === '' ? <br key={i} /> : <p key={i} className="text-gray-700 text-sm mb-2">{line}</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-400">— CentenarianOS Team</p>

                    {/* Thread */}
                    {!thread?.loaded && (
                      <div className="flex justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}

                    {thread?.loaded && thread.replies.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Conversation</p>
                        {thread.replies.map((reply) => {
                          const { isMine, label } = getReplyMeta(reply);
                          return (
                            <div key={reply.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                                isMine
                                  ? 'bg-fuchsia-50 border border-fuchsia-200 text-gray-800'
                                  : 'bg-purple-50 border border-purple-100 text-gray-800'
                              }`}>
                                <p className={`text-xs font-semibold mb-1 ${isMine ? 'text-fuchsia-600' : 'text-purple-600'}`}>
                                  {label}
                                </p>
                                <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                                {reply.media_url && <MediaPreview url={reply.media_url} />}
                                <p className="text-xs text-gray-400 mt-1.5 text-right">
                                  {new Date(reply.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reply form */}
                    <div className="pt-3 border-t border-gray-100">
                      <textarea
                        value={replyText[m.id] ?? ''}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        rows={3}
                        placeholder={isAdmin ? 'Reply as the CentenarianOS team…' : 'Reply to the team…'}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent resize-none"
                      />
                      <div className="flex items-center justify-between mt-2 gap-3">
                        <MediaUploader
                          onUpload={(url) => setReplyMedia((prev) => ({ ...prev, [m.id]: url }))}
                          onRemove={() => setReplyMedia((prev) => ({ ...prev, [m.id]: null }))}
                          currentUrl={replyMedia[m.id]}
                          label="Attach"
                        />
                        <div className="flex items-center gap-3">
                          {sendError[m.id] && (
                            <p className="text-xs text-red-500">{sendError[m.id]}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => sendReply(m.id)}
                            disabled={sending === m.id || !(replyText[m.id] ?? '').trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
                          >
                            {sending === m.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Send className="w-4 h-4" />
                            }
                            {sending === m.id ? 'Sending…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    </div>
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
