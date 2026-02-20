'use client';

// app/admin/feedback/page.tsx
// Admin view: feedback submissions with full conversation threads.

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Bug, Lightbulb, MessageSquare, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react';
import MediaUploader from '@/components/ui/MediaUploader';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface FeedbackEntry {
  id: string;
  category: 'bug' | 'feature' | 'general';
  message: string;
  media_url?: string | null;
  is_read_by_admin: boolean;
  created_at: string;
  user_id: string;
  email?: string | null;
  profiles?: { username: string; display_name?: string | null } | null;
}

interface Reply {
  id: string;
  is_admin: boolean;
  body: string;
  media_url?: string | null;
  created_at: string;
  sender_username?: string | null;
  sender_display_name?: string | null;
}

interface ThreadState {
  replies: Reply[];
  loaded: boolean;
}

const CATEGORY_CONFIG = {
  bug:     { label: 'Bug Reports',      color: '#ef4444', icon: Bug,           badgeClass: 'bg-red-900/30 text-red-300' },
  feature: { label: 'Feature Requests', color: '#a855f7', icon: Lightbulb,     badgeClass: 'bg-purple-900/30 text-purple-300' },
  general: { label: 'General',          color: '#6b7280', icon: MessageSquare,  badgeClass: 'bg-gray-800 text-gray-400' },
};


export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyMedia, setReplyMedia] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [sendError, setSendError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/admin/feedback')
      .then((r) => r.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!threads[id]?.loaded) {
      const r = await fetch(`/api/admin/feedback/${id}`);
      const d = await r.json();
      setThreads((prev) => ({ ...prev, [id]: { replies: d.replies ?? [], loaded: true } }));
      // Mark as read locally
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, is_read_by_admin: true } : item));
    }
  }, [expanded, threads]);

  async function sendReply(id: string) {
    const body = (replyText[id] ?? '').trim();
    if (!body) return;
    setSending(id);
    setSendError((prev) => ({ ...prev, [id]: '' }));
    try {
      const r = await fetch(`/api/admin/feedback/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, media_url: replyMedia[id] || null }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
      const newReply: Reply = {
        id: (await r.json().catch(() => ({ id: Date.now().toString() }))).id ?? Date.now().toString(),
        is_admin: true,
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

  const counts = {
    bug:     items.filter((i) => i.category === 'bug').length,
    feature: items.filter((i) => i.category === 'feature').length,
    general: items.filter((i) => i.category === 'general').length,
  };

  const chartData = Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    count: counts[key as keyof typeof counts],
    fill: cfg.color,
  }));

  const unreadCount = items.filter((i) => !i.is_read_by_admin).length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">User Feedback</h1>
      <p className="text-gray-400 text-sm mb-8">
        {items.length} total submissions{unreadCount > 0 && ` · ${unreadCount} unread`}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <Icon className="w-5 h-5 mx-auto mb-2" style={{ color: cfg.color }} />
              <p className="text-2xl font-bold text-white">{counts[key as keyof typeof counts]}</p>
              <p className="text-gray-500 text-xs mt-1">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      {items.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
          <h2 className="font-semibold text-white mb-4">By Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <rect key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feedback list */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No feedback submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const cfg = CATEGORY_CONFIG[item.category];
            const isOpen = expanded === item.id;
            const thread = threads[item.id];
            return (
              <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Row header — click to expand */}
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-800/60 transition text-left"
                >
                  {/* Unread dot */}
                  {!item.is_read_by_admin && (
                    <span className="w-2 h-2 rounded-full bg-fuchsia-500 shrink-0" />
                  )}
                  {item.is_read_by_admin && (
                    <span className="w-2 h-2 rounded-full bg-transparent shrink-0" />
                  )}

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${cfg.badgeClass}`}>
                    <cfg.icon className="w-3 h-3" />
                    {cfg.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm truncate">{item.message}</p>
                    <p className="text-gray-600 text-xs mt-0.5 truncate">
                      {item.profiles?.username ? `@${item.profiles.username}` : 'Unknown user'}
                      {item.email && ` · ${item.email}`}
                    </p>
                  </div>

                  <span className="text-gray-600 text-xs whitespace-nowrap shrink-0">
                    {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>

                  {thread?.replies?.length > 0 && (
                    <span className="text-xs text-fuchsia-400 shrink-0">{thread.replies.length} repl{thread.replies.length === 1 ? 'y' : 'ies'}</span>
                  )}

                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  }
                </button>

                {/* Expanded thread */}
                {isOpen && (
                  <div className="border-t border-gray-800 px-5 py-4 space-y-4">
                    {/* Original message */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Original Submission</p>
                        <p className="text-xs text-gray-500">
                          {item.profiles?.username ? `@${item.profiles.username}` : 'Unknown'}
                          {item.email && ` (${item.email})`}
                        </p>
                      </div>
                      <p className="text-gray-200 text-sm whitespace-pre-wrap">{item.message}</p>
                      {item.media_url && <ImageLightbox url={item.media_url} />}
                    </div>

                    {/* Thread */}
                    {!thread?.loaded && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                      </div>
                    )}

                    {thread?.loaded && thread.replies.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Conversation</p>
                        {thread.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`flex ${reply.is_admin ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                              reply.is_admin
                                ? 'bg-fuchsia-900/40 border border-fuchsia-800/50 text-fuchsia-100'
                                : 'bg-gray-800 border border-gray-700 text-gray-200'
                            }`}>
                              <p className={`text-xs font-semibold mb-1 ${reply.is_admin ? 'text-fuchsia-400' : 'text-gray-400'}`}>
                                {reply.is_admin ? 'You (Admin)' : (reply.sender_display_name ?? reply.sender_username ?? 'User')}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                              {reply.media_url && <ImageLightbox url={reply.media_url} />}
                              <p className="text-xs opacity-50 mt-1.5 text-right">
                                {new Date(reply.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Admin reply form */}
                    <div className="pt-2 border-t border-gray-800 dark-input">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Reply to User</p>
                      <textarea
                        value={replyText[item.id] ?? ''}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        rows={3}
                        placeholder="Write your reply… (user will be notified by email)"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 resize-none"
                      />
                      <div className="flex items-center justify-between mt-3 gap-3">
                        <MediaUploader
                          dark
                          onUpload={(url) => setReplyMedia((prev) => ({ ...prev, [item.id]: url }))}
                          onRemove={() => setReplyMedia((prev) => ({ ...prev, [item.id]: null }))}
                          currentUrl={replyMedia[item.id]}
                          label="Attach media"
                        />
                        <div className="flex items-center gap-3">
                          {sendError[item.id] && (
                            <p className="text-xs text-red-400">{sendError[item.id]}</p>
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
