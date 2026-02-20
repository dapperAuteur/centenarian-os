'use client';

// app/dashboard/feedback/page.tsx
// User view of their submitted feedback and admin reply threads.

import { useEffect, useState, useCallback } from 'react';
import { Bug, Lightbulb, MessageSquare, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react';
import MediaUploader from '@/components/ui/MediaUploader';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface FeedbackEntry {
  id: string;
  category: 'bug' | 'feature' | 'general';
  message: string;
  media_url?: string | null;
  created_at: string;
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

const CATEGORY_CONFIG = {
  bug:     { label: 'Bug Report',       icon: Bug,           badgeClass: 'bg-red-50 text-red-600 border border-red-200' },
  feature: { label: 'Feature Request',  icon: Lightbulb,     badgeClass: 'bg-purple-50 text-purple-600 border border-purple-200' },
  general: { label: 'General',          icon: MessageSquare, badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200' },
};


export default function FeedbackHistoryPage() {
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyMedia, setReplyMedia] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/feedback')
      .then((r) => r.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!threads[id]?.loaded) {
      const r = await fetch(`/api/feedback/${id}/replies`);
      const d = await r.json();
      setThreads((prev) => ({ ...prev, [id]: { replies: d.replies ?? [], loaded: true } }));
    }
  }, [expanded, threads]);

  async function sendReply(id: string) {
    const body = (replyText[id] ?? '').trim();
    if (!body) return;
    setSending(id);
    setSendError((prev) => ({ ...prev, [id]: '' }));
    try {
      const r = await fetch(`/api/feedback/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, media_url: replyMedia[id] || null }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
      const newReply: Reply = {
        id: Date.now().toString(),
        is_admin: false,
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
        <MessageSquare className="w-6 h-6 text-fuchsia-600" />
        <h1 className="text-3xl font-bold text-gray-900">My Feedback</h1>
      </div>
      <p className="text-gray-500 mb-8">
        Your submitted feedback and replies from our team. Click any item to view the conversation.
      </p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="mb-4">You haven&apos;t submitted any feedback yet.</p>
          <p className="text-sm text-gray-500">
            Use the <span className="inline-flex items-center gap-1 font-medium text-fuchsia-600"><MessageSquare className="w-3 h-3" /> feedback button</span> in the bottom-right corner to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = CATEGORY_CONFIG[item.category];
            const Icon = cfg.icon;
            const isOpen = expanded === item.id;
            const thread = threads[item.id];
            const hasReplies = thread?.replies?.length > 0;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="w-full flex items-start gap-3 p-5 text-left hover:bg-gray-50 transition"
                >
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${cfg.badgeClass}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 line-clamp-2">{item.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {hasReplies && (
                        <span className="ml-2 text-fuchsia-600 font-medium">
                          · {thread.replies.length} repl{thread.replies.length === 1 ? 'y' : 'ies'}
                        </span>
                      )}
                    </p>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                  }
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                    {/* Original submission */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Submission</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
                      {item.media_url && <ImageLightbox url={item.media_url} />}
                    </div>

                    {/* Thread */}
                    {!thread?.loaded && (
                      <div className="flex justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}

                    {thread?.loaded && thread.replies.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Conversation</p>
                        {thread.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`flex ${reply.is_admin ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                              reply.is_admin
                                ? 'bg-purple-50 border border-purple-100 text-gray-800'
                                : 'bg-fuchsia-50 border border-fuchsia-200 text-gray-800'
                            }`}>
                              <p className={`text-xs font-semibold mb-1 ${reply.is_admin ? 'text-purple-600' : 'text-fuchsia-600'}`}>
                                {reply.is_admin ? 'CentenarianOS Team' : 'You'}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                              {reply.media_url && <ImageLightbox url={reply.media_url} />}
                              <p className="text-xs text-gray-400 mt-1.5 text-right">
                                {new Date(reply.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply form */}
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add a Reply</p>
                      <textarea
                        value={replyText[item.id] ?? ''}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        rows={3}
                        placeholder="Add more details or respond to the team…"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent resize-none"
                      />
                      <div className="flex items-center justify-between mt-2 gap-3">
                        <MediaUploader
                          onUpload={(url) => setReplyMedia((prev) => ({ ...prev, [item.id]: url }))}
                          onRemove={() => setReplyMedia((prev) => ({ ...prev, [item.id]: null }))}
                          currentUrl={replyMedia[item.id]}
                          label="Attach"
                        />
                        <div className="flex items-center gap-3">
                          {sendError[item.id] && (
                            <p className="text-xs text-red-500">{sendError[item.id]}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => sendReply(item.id)}
                            disabled={sending === item.id || !(replyText[item.id] ?? '').trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
                          >
                            {sending === item.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Send className="w-4 h-4" />
                            }
                            {sending === item.id ? 'Sending…' : 'Send Reply'}
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
